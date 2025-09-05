#!/bin/bash

# Deploy Firebase Firestore rules and indexes
# Make sure you have Firebase CLI installed and are logged in

echo "🚀 Deploying Firebase configuration for F2P Buddy..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

# Set the project
echo "📋 Setting Firebase project to f2p-buddy-1756234727..."
firebase use f2p-buddy-1756234727

if [ $? -ne 0 ]; then
    echo "❌ Failed to set Firebase project. Make sure you have access to f2p-buddy-1756234727"
    exit 1
fi

echo "🔒 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore rules"
    exit 1
fi

echo "📊 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore indexes"
    exit 1
fi

echo "💾 Deploying Storage security rules..."
firebase deploy --only storage

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Storage rules"
    exit 1
fi

echo "✅ Firebase configuration deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Enable Phone Authentication in Firebase Console"
echo "2. Configure reCAPTCHA for phone auth"
echo "3. Add your domain to authorized domains"
echo "4. Set up environment variables for deployment"
echo ""
echo "Firebase Console: https://console.firebase.google.com/project/f2p-buddy-1756234727"