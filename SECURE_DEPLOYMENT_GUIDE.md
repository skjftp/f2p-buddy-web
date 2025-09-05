# 🔒 Secure Deployment Guide - Environment Variables on Backend Only

Complete guide to deploy F2P Buddy with all sensitive configuration stored securely on the Cloud Run backend.

## 🎯 Security Architecture

- ✅ **No secrets in Netlify** - Frontend has no environment variables
- ✅ **All config on Cloud Run** - Backend serves Firebase configuration  
- ✅ **Dynamic configuration** - Frontend fetches config from API
- ✅ **Zero client-side secrets** - Maximum security

## 📋 Step 1: Get Firebase Configuration Values

### 1.1 Access Firebase Console
Go to: [Firebase Project Settings](https://console.firebase.google.com/project/f2p-buddy-1756234727/settings/general)

### 1.2 Find Your Web App Configuration
1. Scroll to **"Your apps"** section
2. Find your web app (or create one)
3. Click the **config** icon (⚙️) 
4. Copy these values:

```javascript
// You'll see something like this:
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "f2p-buddy-1756234727.firebaseapp.com",
  projectId: "f2p-buddy-1756234727", 
  storageBucket: "f2p-buddy-1756234727.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijk"
};
```

### 1.3 Save These Values Securely
**You'll need:**
- `apiKey` 
- `messagingSenderId`
- `appId`

## 🚀 Step 2: Deploy Backend with Environment Variables

### 2.1 Set Environment Variables Locally
```bash
cd backend

# Set Firebase configuration as environment variables
export FIREBASE_API_KEY="your_actual_api_key"
export FIREBASE_MESSAGING_SENDER_ID="your_actual_sender_id"
export FIREBASE_APP_ID="your_actual_app_id"
```

### 2.2 Deploy to Cloud Run
```bash
# Deploy with environment variables
./deploy-cloud-run.sh
```

### 2.3 Alternative: Manual Cloud Run Deployment
```bash
gcloud run deploy f2p-buddy-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars="FIREBASE_API_KEY=your_actual_api_key" \
  --set-env-vars="FIREBASE_AUTH_DOMAIN=f2p-buddy-1756234727.firebaseapp.com" \
  --set-env-vars="FIREBASE_PROJECT_ID=f2p-buddy-1756234727" \
  --set-env-vars="FIREBASE_STORAGE_BUCKET=f2p-buddy-1756234727.appspot.com" \
  --set-env-vars="FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id" \
  --set-env-vars="FIREBASE_APP_ID=your_actual_app_id" \
  --set-env-vars="ENVIRONMENT=production"
```

### 2.4 Get Backend URL
```bash
# Get the deployed service URL
gcloud run services describe f2p-buddy-api \
  --region us-central1 \
  --format "value(status.url)"

# Example output: https://f2p-buddy-api-xyz123-uc.a.run.app
```

## 🌐 Step 3: Update Netlify Configuration

### 3.1 Update API Redirects
Edit `netlify.toml` to point to your actual Cloud Run URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-actual-cloud-run-url.run.app/api/:splat"
  status = 200
  force = true
```

### 3.2 Deploy Frontend to Netlify
```bash
# Deploy to Netlify (no environment variables needed!)
./netlify-deploy.sh
```

**Netlify Configuration:**
- **Build command**: `npm run build`
- **Publish directory**: `build` 
- **Environment variables**: None needed! 🎉

## 🧪 Step 4: Test the Configuration

### 4.1 Test Backend Config Endpoint
```bash
# Test that backend serves configuration
curl https://your-cloud-run-url.run.app/api/config

# Should return:
{
  "success": true,
  "config": {
    "firebase": {
      "apiKey": "AIzaSyD...",
      "authDomain": "f2p-buddy-1756234727.firebaseapp.com",
      "projectId": "f2p-buddy-1756234727",
      "storageBucket": "f2p-buddy-1756234727.appspot.com",
      "messagingSenderId": "123456789012",
      "appId": "1:123456789012:web:abc..."
    },
    "environment": "production",
    "version": "1.0.0"
  }
}
```

### 4.2 Test Frontend Configuration Loading
1. Open your Netlify site
2. Open browser Developer Tools (F12)
3. Check Console tab
4. Should see: "✅ Firebase config loaded from backend: f2p-buddy-1756234727"

### 4.3 Test Phone Authentication
1. Try to register with phone: `+91 84229 94352`
2. Use test OTP: `123456`
3. Should work without any environment variables in frontend

## 🔐 Step 5: Security Verification

### 5.1 Verify No Secrets in Frontend
```bash
# Check that no secrets are in the built files
npm run build
grep -r "AIzaSy" build/ # Should find nothing
grep -r "firebase.*key" build/ # Should find nothing
```

### 5.2 Verify Backend Security
```bash
# Test that config endpoint works
curl https://your-cloud-run-url.run.app/api/config | jq .

# Test health check
curl https://your-cloud-run-url.run.app/api/health
```

### 5.3 Check Network Requests
In browser Developer Tools → Network tab:
- ✅ Should see request to `/api/config`  
- ✅ Firebase config loaded dynamically
- ✅ No hardcoded secrets in JavaScript

## 🛠️ Environment Variable Management

### Development (Local)
```bash
# Create .env file in backend/ directory
cd backend
echo "FIREBASE_API_KEY=your_dev_api_key" > .env
echo "FIREBASE_MESSAGING_SENDER_ID=your_dev_sender_id" >> .env
echo "FIREBASE_APP_ID=your_dev_app_id" >> .env
```

### Production (Cloud Run)
Environment variables are set during deployment and stored securely in Google Cloud.

### Updating Production Config
```bash
# Update environment variables on existing service
gcloud run services update f2p-buddy-api \
  --region us-central1 \
  --set-env-vars="FIREBASE_API_KEY=new_api_key"
```

## 🔄 Configuration Flow

```
1. Frontend loads → Calls /api/config
2. Backend receives request → Reads environment variables  
3. Backend returns Firebase config → Frontend initializes Firebase
4. Authentication works → User can login
5. All subsequent API calls use Firebase auth tokens
```

## ✅ Advantages of This Approach

- 🔒 **Maximum Security** - No secrets in frontend code
- 🔄 **Dynamic Configuration** - Can change config without frontend rebuild
- 🌍 **Environment Flexibility** - Different configs for dev/staging/prod  
- 🛡️ **Secret Management** - All handled by Google Cloud securely
- 📱 **Client Safety** - Frontend JavaScript contains no sensitive data

## 🚨 Important Security Notes

### DO NOT:
- ❌ Commit Firebase keys to Git
- ❌ Put secrets in Netlify environment variables  
- ❌ Hardcode API keys in frontend code
- ❌ Share environment variable values

### DO:
- ✅ Store all secrets on Cloud Run
- ✅ Use Google Secret Manager for sensitive data
- ✅ Rotate API keys regularly
- ✅ Monitor access logs

## 📊 Monitoring & Debugging

### Check Configuration Loading:
```javascript
// In browser console
fetch('/api/config').then(r => r.json()).then(console.log)
```

### Monitor Backend Logs:
```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=f2p-buddy-api" --limit 50
```

## 🎉 Deployment Complete!

With this secure configuration:
- ✅ **Frontend deployed** to Netlify (no secrets)
- ✅ **Backend deployed** to Cloud Run (with secure env vars)
- ✅ **Firebase config** served dynamically 
- ✅ **Zero client-side secrets**
- ✅ **Production-ready security**

Your F2P Buddy application now has enterprise-grade security! 🛡️

## 🔧 Quick Commands Summary

```bash
# Deploy backend with secure environment variables
cd backend && ./deploy-cloud-run.sh

# Deploy frontend (no environment variables needed)
./netlify-deploy.sh

# Test configuration
curl https://your-backend-url.run.app/api/config

# Update environment variables
gcloud run services update f2p-buddy-api --set-env-vars="KEY=value"
```