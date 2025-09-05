# F2P Buddy Deployment Guide 🚀

Complete step-by-step guide to deploy F2P Buddy with the existing Firebase project `f2p-buddy-1756234727`.

## 🔥 Step 1: Configure Firebase Database & Authentication

### 1.1 Deploy Firestore Rules and Indexes

```bash
# Make sure Firebase CLI is installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy database configuration
./deploy-firebase.sh
```

### 1.2 Enable Phone Authentication

1. Go to [Firebase Console Authentication](https://console.firebase.google.com/u/1/project/f2p-buddy-1756234727/authentication/providers)
2. Click "Get Started" if first time
3. Go to "Sign-in method" tab
4. Enable "Phone" provider
5. Configure reCAPTCHA settings:
   - Add your domain to authorized domains
   - Configure reCAPTCHA v2 (required for phone auth)

### 1.3 Get Firebase Configuration

```bash
# Get your actual Firebase config
./get-firebase-config.sh
```

Update `.env.local` with the actual values from Firebase Console:
- Go to Project Settings > General > Your apps > Web app
- Copy the config values to `.env.local`

## 📱 Step 2: Local Development Setup

### 2.1 Install Dependencies and Setup

```bash
# Run the setup script
./setup-development.sh

# Or manually:
npm install
```

### 2.2 Start Development Server

```bash
npm start
```

The app will be available at: `http://localhost:3000`

### 2.3 Test Phone Authentication

1. Open the app in browser
2. Try to register with a phone number
3. You should receive an OTP (may be in console during development)

## 🌐 Step 3: Deploy Frontend to Netlify

### 3.1 Create Netlify Account and Site

1. Go to [Netlify](https://netlify.com) and create account
2. Click "Add new site" > "Import an existing project"
3. Connect to GitHub (or create GitHub repo first)

### 3.2 Configure GitHub Repository

```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit: F2P Buddy application"

# Create repository on GitHub (replace with your username)
# Go to GitHub and create new repository: f2p-buddy-web

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/f2p-buddy-web.git
git branch -M main
git push -u origin main
```

### 3.3 Configure Netlify Build Settings

In Netlify dashboard:
- **Build command**: `npm run build`
- **Publish directory**: `build`
- **Node version**: 18 (in Environment variables)

### 3.4 Set Environment Variables in Netlify

Go to Site Settings > Environment Variables and add:

```env
REACT_APP_FIREBASE_API_KEY=your_actual_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=f2p-buddy-1756234727.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=f2p-buddy-1756234727
REACT_APP_FIREBASE_STORAGE_BUCKET=f2p-buddy-1756234727.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
REACT_APP_FIREBASE_APP_ID=your_actual_app_id
REACT_APP_API_BASE_URL=https://your-cloud-run-url.run.app
NODE_VERSION=18
```

### 3.5 Configure Domain in Firebase

1. Go to [Firebase Console Authentication](https://console.firebase.google.com/u/1/project/f2p-buddy-1756234727/authentication/settings)
2. Add your Netlify domain to "Authorized domains":
   - `your-site-name.netlify.app`
   - Your custom domain if you have one

## ☁️ Step 4: Deploy Backend to Google Cloud Run

### 4.1 Setup Google Cloud CLI

```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth login

# Set project
gcloud config set project f2p-buddy-1756234727
```

### 4.2 Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 4.3 Deploy Backend

```bash
cd backend

# Deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or direct deployment
gcloud run deploy f2p-buddy-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10
```

### 4.4 Get Backend URL

```bash
# Get the service URL
gcloud run services describe f2p-buddy-api \
  --region us-central1 \
  --format "value(status.url)"
```

Update your Netlify environment variables with the actual backend URL.

### 4.5 Configure CORS

The backend is already configured to allow your Netlify domain. Make sure to update the CORS settings in `backend/main.go` if you have a custom domain.

## 🧪 Step 5: Test End-to-End Functionality

### 5.1 Test Authentication Flow

1. Open your Netlify site
2. Try to register as Admin with phone number
3. Verify OTP works
4. Complete organization setup
5. Test employee registration

### 5.2 Test Core Features

1. **Organization Setup**:
   - Create organization with custom branding
   - Upload logo
   - Configure settings

2. **Campaign Management**:
   - Create a campaign with all steps
   - Add metrics and prizes
   - Activate campaign

3. **Employee Features**:
   - Register as employee
   - Join campaigns
   - Create achievements
   - View leaderboard

### 5.3 Test Backend API

```bash
# Test health endpoint
curl https://your-cloud-run-url.run.app/api/health

# Test with Firebase token (replace with actual token)
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     https://your-cloud-run-url.run.app/api/campaigns
```

## 🔧 Troubleshooting Common Issues

### Phone Authentication Issues

1. **reCAPTCHA not showing**: 
   - Check domain is added to Firebase authorized domains
   - Ensure reCAPTCHA is properly configured

2. **OTP not received**:
   - Check phone number format (+91XXXXXXXXXX)
   - Verify Firebase phone auth is enabled
   - Check browser console for errors

### Deployment Issues

1. **Netlify build fails**:
   - Check Node version (set to 18)
   - Verify all environment variables are set
   - Check build logs for specific errors

2. **Cloud Run deployment fails**:
   - Check GCP project permissions
   - Verify APIs are enabled
   - Check Docker build logs

### CORS Issues

1. Update backend CORS configuration
2. Make sure Netlify domain is allowed
3. Check browser network tab for CORS errors

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/project/f2p-buddy-1756234727)
- [Google Cloud Console](https://console.cloud.google.com/home/dashboard?project=f2p-buddy-1756234727)
- [Netlify Documentation](https://docs.netlify.com/)
- [Firebase Phone Auth Guide](https://firebase.google.com/docs/auth/web/phone-auth)

## 🚀 Going Live Checklist

- [ ] Firebase Firestore rules deployed
- [ ] Phone authentication enabled and tested
- [ ] Frontend deployed to Netlify
- [ ] Backend deployed to Cloud Run
- [ ] Environment variables configured
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] End-to-end testing completed
- [ ] Performance monitoring setup

## 🔐 Security Notes

1. Never commit actual API keys to repository
2. Use environment variables for all sensitive data
3. Configure Firestore security rules properly
4. Set up proper CORS policies
5. Monitor authentication logs
6. Set up error tracking (Sentry, etc.)

Your F2P Buddy application should now be live and fully functional! 🎉