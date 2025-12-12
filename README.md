VisionCraft – AI-Powered Retail Creative Builder

VisionCraft is an AI-powered creative builder that helps advertisers instantly generate high-quality, retailer-compliant marketing creatives. Users can upload product images, describe the desired design style, and let the AI generate polished, ready-to-publish ads across multiple formats — without any design experience required.

🚀 Features

🔹 AI-generated ad layouts and backgrounds

🔹 Automatic brand & retailer compliance checks

🔹 Supports multiple aspect ratios (1:1, 9:16, 16:9)

🔹 Simple, intuitive UI built with React + Tailwind

🔹 Downloadable creative outputs (<500KB)

🔹 Fast, accessible, and zero design skills needed

🎯 Problem Statement

Small advertisers struggle to create professional and compliant ad creatives due to limited design resources. Existing design tools do not validate retailer guidelines, leading to campaign rejections and lower ROI.
VisionCraft solves this by automating the entire creative workflow using AI, ensuring compliance, speed, and quality.

🧠 How It Works

Upload product image (and optional logo)

Enter a creative description

Select output size

AI generates a retail-ready creative

Download and publish

🛠️ Tech Stack

React + TypeScript

Tailwind CSS

Google Gemini Generative AI (@google/genai)

Vite (bundler/build)

Netlify / Vercel (deployment)

📁 Project Structure
src/
 ├── App.tsx
 ├── index.tsx
 ├── components/
 │     └── ImageUploader.tsx
 ├── services/
 │     └── geminiService.ts
 ├── types.ts
 ├── assets/
public/
dist/            # Production output
package.json
tsconfig.json
vite.config.ts

⚙️ Running the Project Locally
1. Clone the repository
git clone https://github.com/krishnaveniammi/VisionCraft-AI-Retail-creative-Builder.git
cd VisionCraft-AI-Retail-creative-Builder

2. Install dependencies
npm install

3. Add Gemini API key

Create a .env.local file:

VITE_API_KEY=your_gemini_api_key

4. Run development server
npm run dev

5. Build for production
npm run build

🌐 Live Demo

🔗 Add your Netlify or Vercel link here once deployed
Example: https://vision-craft-ai-retail-creative-bul-three.vercel.app/

🏆 Hackathon Context

Built for the Tesco Hackathon, VisionCraft empowers sellers to generate professional, consistent, and retailer-approved creatives rapidly — supporting scalable digital advertising for all merchants.

👥 Team

Harika Naga Sai Kundurthi

Krishnaveni Ammisetti

Manogna Charishma

📄 License

This project is developed for educational and hackathon use.
