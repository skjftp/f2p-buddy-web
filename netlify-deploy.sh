#!/bin/bash

echo "🌐 Deploying F2P Buddy to Netlify..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Installing Netlify CLI..."
    npm install -g netlify-cli
fi

echo "🏗️  Building the application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Check if this is first deployment
if [ ! -f ".netlify/state.json" ]; then
    echo "🆕 First time deployment - creating new site"
    echo "Please follow the prompts to create a new site on Netlify"
    netlify deploy --prod --dir=build --open
else
    echo "🚀 Deploying to existing site..."
    netlify deploy --prod --dir=build
fi

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Don't forget to:"
echo "1. Set environment variables in Netlify dashboard"
echo "2. Add your Netlify domain to Firebase authorized domains"
echo "3. Update REACT_APP_API_BASE_URL when backend is deployed"
echo ""
echo "🔗 Open Netlify dashboard:"
netlify open