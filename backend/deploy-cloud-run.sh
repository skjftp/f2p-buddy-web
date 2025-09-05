#!/bin/bash

echo "☁️  Deploying F2P Buddy Backend to Google Cloud Run..."

PROJECT_ID="f2p-buddy-1756234727"
SERVICE_NAME="f2p-buddy-api"
REGION="us-central1"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "🔐 Please authenticate with Google Cloud:"
    gcloud auth login
fi

# Set project
echo "📋 Setting Google Cloud project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy
echo "🏗️  Building and deploying to Cloud Run..."

if [ -f "cloudbuild.yaml" ]; then
    echo "Using Cloud Build configuration..."
    gcloud builds submit --config cloudbuild.yaml
else
    echo "Direct deployment to Cloud Run..."
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
        --max-instances 10
fi

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
    echo ""
    echo "🌐 Service URL: $SERVICE_URL"
    echo ""
    echo "🧪 Testing deployment..."
    curl -f "$SERVICE_URL/api/health" && echo "✅ Health check passed" || echo "❌ Health check failed"
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Update frontend REACT_APP_API_BASE_URL to: $SERVICE_URL"
    echo "2. Update CORS settings if using custom domain"
    echo "3. Configure Firebase service account for production"
    
else
    echo "❌ Deployment failed"
    exit 1
fi