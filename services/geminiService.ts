import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AspectRatio } from "../types";

// Helper to clean base64 string (remove data URL prefix if present)
const cleanBase64 = (base64: string): string => {
  if (base64.includes(',')) {
    return base64.split(',')[1];
  }
  return base64;
};

// Retry logic wrapper with increased delays for Free Tier limits
const retryOperation = async <T>(operation: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 10000): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      
      // CRITICAL CHECK: If limit is 0, retrying won't help. It means the feature is disabled for this account/region.
      if (errString.includes("limit: 0") || errString.includes("limit:0")) {
         console.error("[Visioncraft] Quota is 0. Access denied by configuration.");
         throw new Error("QUOTA_ZERO");
      }

      // Check for rate limit (429) or server overload (503)
      const isRateLimit = 
        errString.includes("429") || 
        errString.includes("RESOURCE_EXHAUSTED") || 
        errString.includes("quota") ||
        (error.status === 429);
        
      const isServerOverload = 
        errString.includes("503") || 
        (error.status === 503);

      if (isRateLimit || isServerOverload) {
        console.warn(`[Visioncraft] Attempt ${i + 1} failed (Rate Limit/Overload). Retrying in ${baseDelay * Math.pow(2, i)}ms...`);
        // Exponential backoff: 10s, 20s, 40s (Slower backoff for free tier stability)
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's a different error, fail immediately
      throw error;
    }
  }
  
  throw lastError;
};

export const generateAdvertisementImage = async (
  apiKey: string,
  description: string,
  productBase64: string,
  productMimeType: string,
  logoBase64: string | null,
  logoMimeType: string | null,
  aspectRatio: AspectRatio,
  useProModel: boolean = false
): Promise<string> => {
  
  console.log("[Visioncraft] Initializing generation...");
  console.log("[Visioncraft] Mode:", useProModel ? "Pro (Billable)" : "Standard (Free Tier)");

  const ai = new GoogleGenAI({ apiKey });

  // Prompt Engineering
  const prompt = `
    Create a high-end, aesthetic advertisement image.
    
    Inputs:
    1. Product Image (Focus).
    ${logoBase64 ? "2. Brand Logo (Apply to product)." : ""}
    3. Brief: "${description}"

    Directives:
    - Integrate the product naturally into a generated background matching the brief.
    - Photorealistic lighting and composition.
    ${logoBase64 ? "- COMPOSITE the logo onto the product surface naturally (respect geometry/lighting). Do not float it." : ""}
    - No text overlays.
  `;

  const parts = [];

  // Add Product Image
  parts.push({
    inlineData: {
      data: cleanBase64(productBase64),
      mimeType: productMimeType,
    },
  });
  parts.push({ text: "Product Image" });

  // Add Logo Image if provided
  if (logoBase64 && logoMimeType) {
    parts.push({
      inlineData: {
        data: cleanBase64(logoBase64),
        mimeType: logoMimeType,
      },
    });
    parts.push({ text: "Brand Logo" });
  }

  // Add Text Prompt
  parts.push({ text: prompt });

  // FORCE Free model if not explicitly Pro
  const modelName = useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  const imageConfig: any = {
    aspectRatio: aspectRatio,
  };
  if (useProModel) {
    imageConfig.imageSize = "1K";
  }

  const apiCall = async () => {
    console.log(`[Visioncraft] Calling generateContent with model: ${modelName}`);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: parts },
      config: { 
        imageConfig: imageConfig,
        // Permissive safety settings to prevent false positives on product photos
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
        ]
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image was generated. The model might have returned only text.");
  };

  try {
    return await retryOperation(apiCall);
  } catch (error: any) {
    console.error("[Visioncraft] Gemini API Error Details:", error);
    
    const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));

    // 0. Handle Zero Quota (Limit: 0)
    if (error.message === "QUOTA_ZERO" || errString.includes("limit: 0") || errString.includes("limit:0")) {
      throw new Error("Access Restricted: Your Google Cloud project has a quota of 0 for this model. Ensure the 'Generative Language API' is enabled in your Google Cloud Console, or try a different region (US is recommended).");
    }
    
    // 1. Handle Permission/Billing specifically for Pro
    if (useProModel && (errString.includes("403") || errString.includes("PERMISSION_DENIED"))) {
      throw new Error("Permission Denied: The 'Pro' model requires a Google Cloud project with billing enabled. Please switch back to 'Standard' for free generation.");
    }
    
    // 2. Handle 404 Model Not Found
    if (errString.includes("404") || errString.includes("NOT_FOUND")) {
      throw new Error(`Model not available. The ${useProModel ? 'Pro' : 'Standard'} model is not accessible with your current API key.`);
    }

    // 3. Handle Rate Limits / Quotas (The "Billing" error often appears here confusingly)
    if (errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED") || errString.includes("quota") || errString.includes("limit")) {
      throw new Error("Free Tier Limit Reached: You are generating images too fast or have hit the daily limit. Please wait 1-2 minutes and try again.");
    }

    throw new Error(error.message || "Failed to generate advertisement.");
  }
};