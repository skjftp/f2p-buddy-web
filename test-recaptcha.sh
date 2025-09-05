#!/bin/bash

echo "🔒 Testing reCAPTCHA Configuration for F2P Buddy"
echo "=============================================="

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

echo "🔍 Checking reCAPTCHA configuration..."

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Set Firebase project
firebase use f2p-buddy-1756234727 2>/dev/null

echo ""
print_info "Checking Firebase Authentication configuration..."

# Check if local server is running
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404"; then
    print_status "Local development server detected at localhost:3000"
    LOCAL_RUNNING=true
else
    print_warning "Local development server not running. Start with 'npm start'"
    LOCAL_RUNNING=false
fi

echo ""
print_info "Manual verification steps:"
echo ""
echo "1. Firebase Console Checklist:"
echo "   📱 Go to: https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers"
echo "   - [ ] Phone authentication is ENABLED"
echo "   - [ ] reCAPTCHA verification is configured"
echo ""
echo "2. Authorized Domains:"
echo "   🌐 Go to: https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/settings"
echo "   - [ ] localhost is in authorized domains"
echo "   - [ ] 127.0.0.1 is in authorized domains"
echo "   - [ ] Your Netlify domain is added"
echo ""
echo "3. Test Phone Authentication:"
if [ "$LOCAL_RUNNING" = true ]; then
    echo "   🧪 Open: http://localhost:3000"
else
    echo "   🧪 Start server: npm start, then open http://localhost:3000"
fi
echo "   - [ ] Try to register with phone number"
echo "   - [ ] reCAPTCHA appears (invisible or visible)"
echo "   - [ ] OTP is sent to your phone"
echo "   - [ ] OTP verification works"
echo ""
echo "4. Browser Console Check:"
echo "   🔧 Open browser Developer Tools (F12)"
echo "   - [ ] No reCAPTCHA errors in console"
echo "   - [ ] No Firebase auth errors"
echo "   - [ ] No network request failures"

echo ""
echo "🔧 Quick Fix Commands:"
echo ""
echo "If reCAPTCHA is not working:"
echo "1. Clear browser data:"
echo "   - Clear cookies and cache"
echo "   - Try incognito/private mode"
echo ""
echo "2. Verify Firebase config:"
echo "   ./get-firebase-config.sh"
echo ""
echo "3. Redeploy Firebase rules:"
echo "   ./deploy-firebase.sh"
echo ""
echo "4. Check environment variables:"
echo "   cat .env.local"

echo ""
print_info "🚀 If everything works, you should see:"
echo "   1. Phone number input form"
echo "   2. reCAPTCHA challenge (if needed)"  
echo "   3. 'OTP sent successfully!' message"
echo "   4. OTP input form"
echo "   5. Successful login to dashboard"

echo ""
print_status "reCAPTCHA test checklist complete!"
echo ""
echo "📋 Next steps:"
echo "1. Follow the manual verification steps above"
echo "2. Test with a real phone number"
echo "3. If issues persist, see RECAPTCHA_SETUP.md"
echo ""
print_info "Firebase Console: https://console.firebase.google.com/project/f2p-buddy-1756234727"