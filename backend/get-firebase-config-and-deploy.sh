#!/bin/bash

echo "🔥 Getting Firebase configuration and deploying backend..."

PROJECT_ID="f2p-buddy-1756234727"
SERVICE_NAME="f2p-buddy-api"
REGION="us-central1"

# Set project
gcloud config set project $PROJECT_ID

echo "🔍 Fetching Firebase configuration from project..."

# Get project details
PROJECT_INFO=$(gcloud projects describe $PROJECT_ID --format="json")
PROJECT_NUMBER=$(echo $PROJECT_INFO | grep -o '"projectNumber": "[^"]*"' | cut -d'"' -f4)

if [ -z "$PROJECT_NUMBER" ]; then
    echo "❌ Could not get project number"
    exit 1
fi

echo "📋 Project Number: $PROJECT_NUMBER"

# For Firebase configuration, we need to get it from the Firebase Console
# Since we can't directly fetch app configs via gcloud, let's try the Firebase Management API
echo ""
echo "🔑 Getting Firebase app configuration..."

# Try to get Firebase apps via REST API
APP_CONFIG_URL="https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps"
ACCESS_TOKEN=$(gcloud auth print-access-token)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not get access token. Please re-authenticate:"
    echo "gcloud auth login"
    exit 1
fi

# Get list of web apps
APPS_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$APP_CONFIG_URL")

# Check if we got a valid response
if echo "$APPS_RESPONSE" | grep -q "error"; then
    echo "❌ Error fetching Firebase apps:"
    echo "$APPS_RESPONSE"
    echo ""
    echo "📝 Manual configuration required:"
    echo "1. Go to: https://console.firebase.google.com/project/f2p-buddy-1756234727/settings/general"
    echo "2. Find your web app configuration"
    echo "3. Copy the values and set them as environment variables:"
    echo ""
    echo "export FIREBASE_API_KEY=\"your_api_key\""
    echo "export FIREBASE_MESSAGING_SENDER_ID=\"your_sender_id\""
    echo "export FIREBASE_APP_ID=\"your_app_id\""
    echo ""
    echo "Then run this script again or deploy directly."
    exit 1
fi

# Parse the first web app (if exists)
APP_ID=$(echo "$APPS_RESPONSE" | grep -o '"appId": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$APP_ID" ]; then
    echo "⚠️  No web apps found in Firebase project."
    echo "📱 Creating a new web app..."
    
    # Create a new web app
    CREATE_APP_DATA='{"displayName":"F2P Buddy Web App"}'
    CREATE_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$CREATE_APP_DATA" \
        "$APP_CONFIG_URL")
    
    if echo "$CREATE_RESPONSE" | grep -q "error"; then
        echo "❌ Failed to create web app:"
        echo "$CREATE_RESPONSE"
        exit 1
    fi
    
    APP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"appId": "[^"]*"' | cut -d'"' -f4)
    echo "✅ Created new web app: $APP_ID"
fi

# Get app config
CONFIG_URL="https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps/$APP_ID/config"
CONFIG_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$CONFIG_URL")

if echo "$CONFIG_RESPONSE" | grep -q "error"; then
    echo "❌ Error fetching app config:"
    echo "$CONFIG_RESPONSE"
    exit 1
fi

# Parse configuration
API_KEY=$(echo "$CONFIG_RESPONSE" | grep -o '"apiKey": "[^"]*"' | cut -d'"' -f4)
MESSAGING_SENDER_ID=$(echo "$CONFIG_RESPONSE" | grep -o '"messagingSenderId": "[^"]*"' | cut -d'"' -f4)

echo ""
echo "✅ Firebase Configuration Retrieved:"
echo "🔑 API Key: ${API_KEY:0:20}..."
echo "📱 App ID: $APP_ID"
echo "📨 Messaging Sender ID: $MESSAGING_SENDER_ID"

# Export as environment variables
export FIREBASE_API_KEY="$API_KEY"
export FIREBASE_MESSAGING_SENDER_ID="$MESSAGING_SENDER_ID"
export FIREBASE_APP_ID="$APP_ID"

echo ""
echo "🚀 Deploying to Cloud Run with Firebase configuration..."

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Deploy to Cloud Run with environment variables
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 3600 \
    --concurrency 80 \
    --max-instances 10 \
    --set-env-vars="FIREBASE_API_KEY=$FIREBASE_API_KEY" \
    --set-env-vars="FIREBASE_AUTH_DOMAIN=f2p-buddy-1756234727.firebaseapp.com" \
    --set-env-vars="FIREBASE_PROJECT_ID=f2p-buddy-1756234727" \
    --set-env-vars="FIREBASE_STORAGE_BUCKET=f2p-buddy-1756234727.appspot.com" \
    --set-env-vars="FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID" \
    --set-env-vars="FIREBASE_APP_ID=$FIREBASE_APP_ID" \
    --set-env-vars="ENVIRONMENT=production" \
    --set-env-vars="APP_VERSION=1.0.0"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
    echo "🌐 Service URL: $SERVICE_URL"
    
    echo ""
    echo "🧪 Testing deployment..."
    
    # Test health endpoint
    if curl -f "$SERVICE_URL/api/health" > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
    fi
    
    # Test config endpoint
    echo "🔧 Testing configuration endpoint..."
    CONFIG_TEST=$(curl -s "$SERVICE_URL/api/config")
    
    if echo "$CONFIG_TEST" | grep -q "success"; then
        echo "✅ Configuration endpoint working"
        echo "🔑 Firebase config successfully served by backend"
    else
        echo "❌ Configuration endpoint failed"
        echo "Response: $CONFIG_TEST"
    fi
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Update netlify.toml redirect URL to: $SERVICE_URL"
    echo "2. Add your Netlify domain to Firebase authorized domains"
    echo "3. Test the full authentication flow"
    
else
    echo "❌ Deployment failed"
    exit 1
fi