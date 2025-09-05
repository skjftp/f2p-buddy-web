# F2P Buddy - Sales Incentive Management Platform

A comprehensive sales incentive management web application built with React.js, Firebase, and deployed on Netlify with a Golang backend on Google Cloud Run.

## 🚀 Features

- **Phone Number Authentication** with OTP verification
- **Role-based Access Control** (Admin/Employee)
- **Organization Management** with custom branding
- **Campaign Creation** with multiple metrics tracking
- **Real-time Leaderboards** and achievement tracking
- **Mobile-responsive Design** 
- **File Upload** support for campaigns and achievements
- **Real-time Data Sync** with Firebase Firestore

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Firebase** (Auth, Firestore, Storage)
- **Redux Toolkit** for state management
- **Material-UI** components
- **React Router** for navigation
- **React Hook Form** for form handling

### Backend
- **Golang** with Gin framework
- **Google Cloud Run** for serverless deployment
- **Firebase Admin SDK** for server-side operations

### Infrastructure
- **Netlify** for frontend hosting
- **Google Cloud Platform** (GCP Project: f2p-buddy-1756234727)
- **GitHub Actions** for CI/CD

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase CLI
- Google Cloud CLI (for backend deployment)
- GitHub account (for auto-deployment)

## 🚀 Quick Start

### Automated Setup (Recommended)
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/f2p-buddy-web.git
cd f2p-buddy-web

# Run the quick start script (handles everything automatically)
./quick-start.sh
```

This will:
- ✅ Install all dependencies
- ✅ Setup Firebase project connection
- ✅ Deploy Firestore rules and indexes
- ✅ Start the development server
- ✅ Guide you through remaining manual steps

### Manual Setup

#### 1. Environment Setup
```bash
# Install dependencies
./setup-development.sh

# Or manually:
npm install
```

#### 2. Firebase Configuration
```bash
# Deploy database rules and indexes
./deploy-firebase.sh

# Get Firebase config for your .env.local
./get-firebase-config.sh
```

#### 3. Start Development
```bash
npm start
```

The app will be available at `http://localhost:3000`

## 📋 Firebase Project Setup

The project uses existing Firebase project: **f2p-buddy-1756234727**

### Required Firebase Services:
- ✅ **Firestore Database** - Already configured
- ✅ **Authentication** - Enable Phone provider
- ✅ **Storage** - Default bucket active  

### Manual Firebase Steps:
1. Go to [Firebase Console](https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers)
2. Enable **Phone** authentication provider
3. Configure **reCAPTCHA** settings
4. Add your domain to **Authorized domains**

## 🚀 Deployment

### Frontend to Netlify
```bash
# Build and deploy to Netlify
./netlify-deploy.sh
```

**Manual Netlify Steps:**
1. Connect GitHub repository
2. Set build command: `npm run build` 
3. Set publish directory: `build`
4. Add environment variables in dashboard
5. Add your Netlify domain to Firebase authorized domains

### Backend to Google Cloud Run  
```bash
cd backend
./deploy-cloud-run.sh
```

**Manual Cloud Run Steps:**
1. Enable Cloud Run API
2. Authenticate with `gcloud auth login`
3. Deploy backend service
4. Update frontend with backend URL

### Complete Deployment Guide
📖 See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed step-by-step instructions.

### Environment Variables for Production
Set these in your deployment platforms:

**Netlify Environment Variables:**
```env
REACT_APP_FIREBASE_API_KEY=your_actual_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=f2p-buddy-1756234727.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=f2p-buddy-1756234727
REACT_APP_FIREBASE_STORAGE_BUCKET=f2p-buddy-1756234727.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id  
REACT_APP_FIREBASE_APP_ID=your_actual_app_id
REACT_APP_API_BASE_URL=https://your-cloud-run-service.run.app
NODE_VERSION=18
```

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Common components (ProtectedRoute, etc.)
│   ├── campaigns/      # Campaign-related components
│   ├── dashboard/      # Dashboard widgets
│   └── achievements/   # Achievement tracking components
├── pages/              # Page components
│   ├── admin/         # Admin-specific pages
│   └── employee/      # Employee-specific pages
├── contexts/          # React contexts (Auth, Theme)
├── store/            # Redux store and slices
├── config/           # Firebase and app configuration
├── hooks/            # Custom React hooks
└── utils/            # Utility functions
```

## 🎯 User Flows

### Admin Flow
1. **Login** with phone number/OTP
2. **Organization Setup** (first-time)
3. **Dashboard Access** with campaign management
4. **Create Campaigns** using the campaign wizard
5. **Monitor Analytics** and employee performance

### Employee Flow
1. **Login** with phone number/OTP
2. **Role Selection** (first-time)
3. **Dashboard Access** with active campaigns
4. **Participate** in campaigns
5. **Track Achievements** and view leaderboard

## 🔐 Security Features

- Phone number authentication with Firebase Auth
- Role-based access control
- Secure file uploads to Firebase Storage
- CSP headers and security best practices
- Environment variable protection

## 📱 Mobile Responsiveness

The application is fully responsive and optimized for:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage --watchAll=false
```

## 🚀 Backend Integration

The frontend integrates with a Golang backend deployed on Google Cloud Run:
- **Endpoint**: `https://f2p-buddy-api-[hash]-uc.a.run.app`
- **Authentication**: Firebase Admin SDK
- **Database**: Firebase Firestore
- **File Storage**: Firebase Storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure they pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team

## 🔄 Auto-Deployment

The project is configured for automatic deployment:
- **Frontend**: Netlify (deploys on push to `main`)
- **Backend**: Google Cloud Run (via GitHub Actions)

Every push to the `main` branch triggers automatic deployment to production.