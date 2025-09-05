#!/bin/bash

echo "🚀 Setting up Git repository for F2P Buddy"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git not found. Please install Git first."
    exit 1
fi

print_status "Git found: $(git --version)"

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore file..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build

# Environment variables
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Firebase
.firebase/
firebase-debug.log
firebase-debug.*.log

# Netlify
.netlify/

# Temporary files
*.tmp
*.temp
EOF
    print_status ".gitignore created"
else
    print_status ".gitignore already exists"
fi

# Initialize git repository
if [ ! -d ".git" ]; then
    echo "🎯 Initializing Git repository..."
    git init
    print_status "Git repository initialized"
else
    print_status "Git repository already exists"
fi

# Configure git (if not already configured globally)
if [ -z "$(git config user.name)" ]; then
    print_warning "Git user not configured. Please set your Git credentials:"
    echo "Run these commands with your information:"
    echo "git config --global user.name 'Your Name'"
    echo "git config --global user.email 'your.email@example.com'"
    echo ""
    read -p "Do you want to continue without configuring? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Please configure Git and run this script again."
        exit 1
    fi
fi

# Add all files to git
echo "📦 Adding files to Git..."
git add .

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: F2P Buddy Sales Incentive Management Platform

🎯 Features implemented:
- Phone authentication with Firebase OTP
- Role-based access (Admin/Employee)
- Organization setup with custom branding
- Campaign creation wizard
- Employee dashboard with leaderboards  
- Admin dashboard with analytics
- Real-time data synchronization
- Mobile-responsive design
- Secure Golang backend API
- Automated deployment configuration

🚀 Ready for production deployment
📱 Firebase project: f2p-buddy-1756234727
🌐 Deployment: Netlify + Google Cloud Run"

if [ $? -eq 0 ]; then
    print_status "Initial commit created successfully"
else
    print_error "Failed to create initial commit"
    exit 1
fi

echo ""
print_info "Git repository is ready!"
echo ""
print_warning "Next steps:"
echo "1. Create a new repository on GitHub:"
echo "   - Go to: https://github.com/new"
echo "   - Repository name: f2p-buddy-web"
echo "   - Make it Public or Private"
echo "   - DON'T initialize with README (we already have files)"
echo ""
echo "2. After creating the GitHub repository, run:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/f2p-buddy-web.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Then set up Netlify deployment:"
echo "   - Go to: https://app.netlify.com/start"
echo "   - Connect to Git provider (GitHub)"
echo "   - Select your f2p-buddy-web repository"
echo "   - Configure build settings"
echo ""
print_status "Repository ready for GitHub push! 🚀"