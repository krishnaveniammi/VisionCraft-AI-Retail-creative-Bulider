import React, { useState, useEffect } from 'react';
import { UploadedImage, AspectRatio, GenerationResult } from './types';
import { ImageUploader } from './components/ImageUploader';
import { generateAdvertisementImage } from './services/geminiService';

const App: React.FC = () => {
  // Authentication State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);

  // Application State
  const [productImage, setProductImage] = useState<UploadedImage | null>(null);
  const [logoImage, setLogoImage] = useState<UploadedImage | null>(null);
  const [description, setDescription] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Square);
  const [useProModel, setUseProModel] = useState<boolean>(false); // Default to Standard (Free)
  
  // Sharing State
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [showManualShareStep, setShowManualShareStep] = useState<boolean>(false);
  const [shareCaption, setShareCaption] = useState<string>("");

  const [result, setResult] = useState<GenerationResult>({
    imageUrl: "",
    loading: false,
    error: null,
  });

  // Check for API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          // Fallback if not running in the specific AI Studio environment
          // Use import.meta.env for Vite or process.env for standard
          const key = (import.meta as any).env?.VITE_API_KEY || process.env.API_KEY;
          if (key) {
              console.log("[Visioncraft] API Key detected from environment.");
              setHasApiKey(true);
          } else {
              console.warn("[Visioncraft] No API Key found in VITE_API_KEY or process.env.");
              setHasApiKey(false);
          }
        }
      } catch (e) {
        console.error("Failed to check API key status", e);
      } finally {
        setIsCheckingKey(false);
      }
    };
    checkApiKey();
  }, []);

  const handleApiKeySelect = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        // Optimistically update state as per instructions
        setHasApiKey(true);
      } catch (e) {
        console.error("Failed to select API key", e);
      }
    }
  };

  // Derived state
  const isFormValid = productImage !== null && description.trim().length > 0;

  const handleGenerate = async () => {
    const apiKey = (import.meta as any).env?.VITE_API_KEY || process.env.API_KEY;

    // Safety check for API Key
    if (!apiKey) {
        setResult(prev => ({ ...prev, error: "API Key not found. Please check your .env file contains VITE_API_KEY." }));
        setHasApiKey(false);
        return;
    }
    
    if (!productImage) return;

    setResult({ imageUrl: "", loading: true, error: null });

    try {
      const generatedImage = await generateAdvertisementImage(
        apiKey,
        description,
        productImage.base64,
        productImage.mimeType,
        logoImage ? logoImage.base64 : null,
        logoImage ? logoImage.mimeType : null,
        aspectRatio,
        useProModel
      );

      setResult({
        imageUrl: generatedImage,
        loading: false,
        error: null,
      });

      // Pre-fill a default caption
      setShareCaption(`Check out this new ad created with Visioncraft AI! #Visioncraft #AI #Design \n\n${description.substring(0, 50)}...`);

    } catch (err: any) {
      console.error("Generation failed:", err);
      // Try to extract a meaningful message even from JSON objects
      let errorMessage = err.message;
      if (!errorMessage && typeof err === 'object') {
        errorMessage = JSON.stringify(err);
      }
      if (!errorMessage) {
        errorMessage = "Something went wrong during generation.";
      }
      
      let displayError = errorMessage;

      // User-friendly error mapping
      if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("API Key not found")) {
        setHasApiKey(false);
        displayError = "Session expired or API Key invalid. Please reconnect.";
      } 
      // If the service layer caught the billing/quota error, it throws "Free Tier Limit Reached"
      // We display that directly.

      setResult({
        imageUrl: "",
        loading: false,
        error: displayError,
      });
    }
  };

  // Helper to convert base64 to Blob for sharing
  const dataURItoBlob = (dataURI: string) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
  };

  const handleShareToInstagram = async () => {
    if (!result.imageUrl) return;

    try {
      const blob = dataURItoBlob(result.imageUrl);
      const file = new File([blob], "visioncraft-ad.png", { type: blob.type });

      // Check if Web Share API is supported and can share files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Visioncraft Ad',
          text: shareCaption
        });
        setIsShareModalOpen(false);
      } else {
        // Fallback for desktop/unsupported browsers: Initiate download and show guide
        const link = document.createElement("a");
        link.href = result.imageUrl;
        link.download = "visioncraft-instagram-post.png";
        link.click();
        
        // Copy caption to clipboard
        navigator.clipboard.writeText(shareCaption);
        
        // Switch modal view to manual instructions
        setShowManualShareStep(true);
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setTimeout(() => setShowManualShareStep(false), 300); // Reset after close
  };

  // Loading Screen
  if (isCheckingKey) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">Initializing Visioncraft...</p>
      </div>
    );
  }

  // Welcome / Auth Screen
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 max-w-lg w-full text-center space-y-10">
          <div className="space-y-6">
            <div className="w-24 h-24 bg-gradient-to-br from-brand-400 to-accent-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-brand-500/20 transform rotate-3">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
               </svg>
            </div>
            
            <div>
              <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Visioncraft</h1>
              <p className="text-xl text-gray-400">Professional AI Marketing Assets</p>
            </div>
          </div>

          <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-8 space-y-6">
             <div className="space-y-4">
               <div className="flex items-start gap-4 text-left">
                  <div className="bg-brand-500/20 p-2 rounded-lg mt-1">
                    <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Free Forever</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Use the Standard model to generate aesthetic ads without any cost.</p>
                  </div>
               </div>
               
               <div className="flex items-start gap-4 text-left">
                  <div className="bg-accent-500/20 p-2 rounded-lg mt-1">
                    <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Secure Access</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">Connect with your Google account to generate API keys securely.</p>
                  </div>
               </div>
             </div>

             <div className="pt-4 border-t border-gray-700/50">
               {/* Conditional rendering for VS Code vs Web */}
               {(window as any).aistudio ? (
                 <button 
                   onClick={handleApiKeySelect}
                   className="w-full group relative flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-500/10"
                 >
                   <span>Connect API Key</span>
                   <svg className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                   </svg>
                 </button>
               ) : (
                 <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                    <p className="font-bold mb-1">API Key Missing</p>
                    <p className="text-xs text-gray-400">Create a <code className="bg-gray-800 px-1 py-0.5 rounded">.env</code> file in your project root with <code className="bg-gray-800 px-1 py-0.5 rounded">VITE_API_KEY=your_key</code> and restart.</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Sidebar: Controls */}
      <div className="w-full md:w-[450px] bg-gray-900 border-r border-gray-800 flex flex-col h-screen overflow-y-auto z-10 shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-accent-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                </svg>
             </div>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Visioncraft
             </h1>
          </div>
          <p className="text-xs text-gray-500 mt-2">AI Marketing tool</p>
        </div>

        <div className="flex-1 p-6 space-y-8">
          
          {/* Section 1: Assets */}
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-4">1. Brand Assets</h2>
            <ImageUploader 
              label="Product Photo" 
              image={productImage} 
              onImageChange={setProductImage} 
            />
            <ImageUploader 
              label="Brand Logo" 
              image={logoImage} 
              onImageChange={setLogoImage} 
              optional
            />
          </div>

          {/* Section 2: Settings */}
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">2. Configuration</h2>
            
             <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Model Quality</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-800 rounded-lg border border-gray-700">
                <button
                  onClick={() => setUseProModel(false)}
                  className={`
                    px-3 py-2 text-xs font-semibold rounded-md transition-all
                    ${!useProModel 
                      ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600' 
                      : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  Standard (Free Forever)
                </button>
                <button
                  onClick={() => setUseProModel(true)}
                  className={`
                    px-3 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1
                    ${useProModel 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  Pro
                  <span className="bg-yellow-500/20 text-yellow-500 text-[9px] px-1.5 py-0.5 rounded ml-1">PAID</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-500 px-1 mt-1">
                {useProModel 
                  ? "⚠️ Pro requires a Google Cloud project with billing enabled." 
                  : "Standard is 100% free with generous daily limits."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Format & Size</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: AspectRatio.Square, label: 'Instagram Post (1:1)' },
                  { id: AspectRatio.Story, label: 'Instagram Story (9:16)' },
                  { id: AspectRatio.Widescreen, label: 'Facebook Post (16:9)' },
                ].map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setAspectRatio(ratio.id)}
                    className={`
                      px-3 py-3 text-sm font-medium rounded-lg border transition-all flex justify-center items-center
                      ${aspectRatio === ratio.id 
                        ? 'bg-brand-600/20 border-brand-500 text-brand-300' 
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }
                    `}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., A minimalist summer vibe with golden hour lighting. Place the logo on the front center of the bottle..."
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50 backdrop-blur-md">
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || result.loading}
            className={`
              w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg
              ${isFormValid && !result.loading
                ? 'bg-gradient-to-r from-brand-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white shadow-brand-900/20 hover:shadow-brand-500/30 transform hover:-translate-y-0.5'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {result.loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Assets...
              </span>
            ) : (
              "GENERATE ADVERTISEMENT"
            )}
          </button>
        </div>
      </div>

      {/* Right Area: Preview */}
      <div className="flex-1 bg-black relative flex items-center justify-center p-8 md:p-12 h-screen overflow-hidden">
        
        {/* Background Ambient Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/20 via-black to-black pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-5xl h-full flex flex-col items-center justify-center">
          
          {result.error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl mb-6 backdrop-blur-md max-w-lg text-center animate-fade-in">
              <div className="flex items-center justify-center mb-2">
                 <svg className="w-6 h-6 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                 </svg>
                 <span className="font-bold">Generation Failed</span>
              </div>
              <p className="text-sm opacity-90 leading-relaxed">{result.error}</p>
              {result.error.includes("expired") || result.error.includes("reconnect") || result.error.includes("API Key") ? (
                  <button onClick={() => setHasApiKey(false)} className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors">Reconnect Account</button>
              ) : null}
            </div>
          )}

          {!result.imageUrl && !result.loading && !result.error && (
            <div className="text-center space-y-6 opacity-40 select-none">
              <div className="w-24 h-24 rounded-full bg-gray-800 mx-auto flex items-center justify-center border border-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-200">Ready to Create</h3>
                <p className="text-gray-400 mt-2 max-w-sm mx-auto">Upload your product and logo, describe your vision, and let AI build your campaign.</p>
              </div>
            </div>
          )}

          {result.loading && (
             <div className="text-center space-y-8 animate-pulse-slow">
               <div className="relative">
                 <div className="w-32 h-32 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin mx-auto"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-brand-500/20 rounded-full blur-xl animate-pulse"></div>
                 </div>
               </div>
               <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Designing your Ad...</h3>
                  <p className="text-brand-300/70 mt-2">Analyzing product • Composing layout • Applying lighting</p>
               </div>
             </div>
          )}

          {result.imageUrl && !result.loading && (
            <div className="flex flex-col items-center gap-6 animate-fade-in w-full h-full justify-center">
              <div 
                className={`
                  relative bg-gray-800 rounded-lg overflow-hidden shadow-2xl ring-1 ring-gray-700
                  ${aspectRatio === AspectRatio.Story ? 'h-[80vh] aspect-[9/16]' : ''}
                  ${aspectRatio === AspectRatio.Square ? 'h-[70vh] aspect-square' : ''}
                  ${aspectRatio === AspectRatio.Widescreen ? 'w-[90%] aspect-video' : ''}
                  ${aspectRatio === AspectRatio.Portrait ? 'h-[80vh] aspect-[3/4]' : ''}
                  ${aspectRatio === AspectRatio.Landscape ? 'w-[80%] aspect-[4/3]' : ''}
                `}
              >
                <img 
                  src={result.imageUrl} 
                  alt="Generated Ad" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex gap-4">
                 <a 
                   href={result.imageUrl} 
                   download="visioncraft-output.png"
                   className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-200 transition-colors"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                   </svg>
                   Download Image
                 </a>
                 <button 
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
                 >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Post to Instagram
                 </button>
                 <button 
                    onClick={() => setResult({imageUrl: "", loading: false, error: null})}
                    className="flex items-center gap-2 bg-gray-800 border border-gray-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-gray-700 transition-colors"
                 >
                    New Design
                 </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">
                {showManualShareStep ? "Complete Your Post" : "New Post"}
              </h3>
              <button 
                onClick={closeShareModal}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {showManualShareStep ? (
              <div className="p-6 space-y-6">
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-green-400 bg-green-400/10 p-3 rounded-lg">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       <span className="text-sm font-medium">Image downloaded to device</span>
                    </div>
                    <div className="flex items-center gap-3 text-green-400 bg-green-400/10 p-3 rounded-lg">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                       <span className="text-sm font-medium">Caption copied to clipboard</span>
                    </div>
                 </div>
                 
                 <div className="text-center">
                    <p className="text-gray-400 text-sm mb-4">You can now open Instagram and create your post.</p>
                    <a 
                      href="https://www.instagram.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all"
                    >
                      Open Instagram.com
                      <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                 </div>
              </div>
            ) : (
              <>
                <div className="p-4 flex gap-4">
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden">
                    <img src={result.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                  </div>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    placeholder="Write a caption..."
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none resize-none h-24"
                  />
                </div>
                
                <div className="p-4 border-t border-gray-800 bg-gray-900">
                   <button 
                     onClick={handleShareToInstagram}
                     className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all"
                   >
                     Share Now
                   </button>
                   <p className="text-xs text-gray-500 text-center mt-3">
                     Opens native sharing or downloads for manual posting.
                   </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;