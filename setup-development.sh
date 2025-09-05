#!/bin/bash

echo "🛠️  Setting up F2P Buddy development environment..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 16+ or 18+."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Clean npm cache if needed
echo "🧹 Cleaning npm cache..."
rm -rf node_modules package-lock.json
npm cache clean --force 2>/dev/null || true

# Try different installation methods
echo "📦 Installing dependencies..."

if npm install --no-fund --no-audit; then
    echo "✅ Dependencies installed successfully with npm"
elif npx --yes npm install --no-fund --no-audit; then
    echo "✅ Dependencies installed successfully with npx npm"
elif yarn install 2>/dev/null; then
    echo "✅ Dependencies installed successfully with yarn"
else
    echo "❌ Failed to install dependencies. Trying manual approach..."
    
    # Create a minimal package.json for testing
    cat > package-minimal.json << 'EOF'
{
  "name": "f2p-buddy-web",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
    
    echo "📦 Trying minimal installation..."
    mv package.json package-full.json
    mv package-minimal.json package.json
    
    if npm install --no-fund --no-audit; then
        echo "✅ Minimal dependencies installed. Now adding remaining packages..."
        mv package-full.json package.json
        npm install --no-fund --no-audit || echo "⚠️  Some packages may not have installed"
    else
        mv package-full.json package.json
        echo "❌ Installation failed. Please check npm permissions or try with different Node version."
        exit 1
    fi
fi

echo ""
echo "🔥 Setting up Firebase configuration..."

# Check if Firebase CLI is available
if command -v firebase &> /dev/null; then
    echo "✅ Firebase CLI found"
    firebase use f2p-buddy-1756234727 2>/dev/null || echo "⚠️  Set Firebase project manually with: firebase use f2p-buddy-1756234727"
else
    echo "⚠️  Firebase CLI not found. Install with: npm install -g firebase-tools"
fi

echo ""
echo "📝 Next steps:"
echo "1. Run: npm start (to start development server)"
echo "2. Configure Firebase Authentication in console"
echo "3. Update .env.local with actual Firebase config values"
echo "4. Deploy Firebase rules with: ./deploy-firebase.sh"
echo ""
echo "Development server will be available at: http://localhost:3000"