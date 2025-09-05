#!/bin/bash

echo "🚀 F2P Buddy Quick Start Setup"
echo "=============================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi
print_status "Node.js found: $(node --version)"

if ! command -v npm &> /dev/null; then
    print_error "npm not found"
    exit 1
fi
print_status "npm found: $(npm --version)"

# Check Firebase CLI
if ! command -v firebase &> /dev/null; then
    print_warning "Firebase CLI not found. Installing..."
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        print_error "Failed to install Firebase CLI"
        exit 1
    fi
fi
print_status "Firebase CLI ready"

# Setup development environment
echo ""
echo "🛠️  Setting up development environment..."
./setup-development.sh

if [ $? -ne 0 ]; then
    print_error "Failed to setup development environment"
    exit 1
fi

# Firebase authentication
echo ""
echo "🔥 Setting up Firebase..."
print_info "Please login to Firebase when prompted"
firebase login --no-localhost

firebase use f2p-buddy-1756234727
if [ $? -ne 0 ]; then
    print_error "Failed to set Firebase project. Make sure you have access to f2p-buddy-1756234727"
    exit 1
fi

print_status "Firebase project set to f2p-buddy-1756234727"

# Deploy Firebase rules
echo ""
echo "📋 Deploying Firestore rules and indexes..."
./deploy-firebase.sh

if [ $? -ne 0 ]; then
    print_warning "Firebase deployment had issues. You may need to configure manually."
fi

# Get Firebase config
echo ""
echo "📱 Getting Firebase configuration..."
print_info "Please copy the Firebase config to your .env.local file"
firebase apps:sdkconfig web --project f2p-buddy-1756234727

# Start development server
echo ""
echo "🚀 Starting development server..."
print_info "The app will open at http://localhost:3000"

# Check if we can start the server
if [ -d "node_modules" ] && [ -f "package.json" ]; then
    print_status "Starting React development server..."
    npm start
else
    print_warning "Node modules not found. Please run 'npm install' manually and then 'npm start'"
fi

echo ""
print_status "Quick start completed!"
echo ""
echo "📋 Next manual steps:"
echo "1. Enable Phone Authentication in Firebase Console:"
echo "   https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers"
echo ""
echo "2. Update .env.local with actual Firebase config values"
echo ""
echo "3. Add localhost:3000 to authorized domains in Firebase"
echo ""
echo "4. Test the application at http://localhost:3000"
echo ""
print_info "See DEPLOYMENT_GUIDE.md for complete deployment instructions"