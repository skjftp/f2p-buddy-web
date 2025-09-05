#!/bin/bash

# Get Firebase configuration for the web app
echo "🔥 Getting Firebase configuration..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Set the project
firebase use f2p-buddy-1756234727

echo "📱 Getting Firebase web app configuration..."
echo "Copy this configuration to your .env.local file:"
echo ""

firebase apps:sdkconfig web

echo ""
echo "📋 Create a .env.local file with the following format:"
echo ""
cat << 'EOF'
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=f2p-buddy-1756234727.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=f2p-buddy-1756234727
REACT_APP_FIREBASE_STORAGE_BUCKET=f2p-buddy-1756234727.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
REACT_APP_FIREBASE_APP_ID=your_app_id_here
REACT_APP_API_BASE_URL=http://localhost:8080
EOF

echo ""
echo "🚨 Don't forget to:"
echo "1. Enable Phone Authentication in Firebase Console"
echo "2. Configure reCAPTCHA settings"
echo "3. Add localhost:3000 to authorized domains"