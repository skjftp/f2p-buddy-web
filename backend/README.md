# F2P Buddy Backend API

A robust Golang backend API for the F2P Buddy sales incentive management platform, deployed on Google Cloud Run with Firebase integration.

## 🚀 Features

- **RESTful API** with Gin framework
- **Firebase Integration** (Auth, Firestore, Storage)
- **Real-time Data Sync** with Firestore listeners
- **JWT Authentication** with Firebase Auth
- **Role-based Access Control** (Admin/Employee)
- **Comprehensive Analytics** for campaigns and organizations
- **Auto-scaling** with Google Cloud Run
- **CORS Support** for frontend integration

## 🛠 Tech Stack

- **Go 1.21** with Gin web framework
- **Firebase Admin SDK** for server-side operations
- **Google Cloud Firestore** for database
- **Google Cloud Run** for serverless deployment
- **Docker** for containerization
- **GitHub Actions** for CI/CD

## 📋 Prerequisites

- Go 1.21+
- Docker (for local development)
- Google Cloud SDK
- Firebase CLI
- Access to GCP Project: `f2p-buddy-1756234727`

## 🔧 Local Development

### 1. Clone and Setup
```bash
cd backend
go mod download
```

### 2. Environment Configuration
Create a service account key for Firebase:
```bash
# Download service account key from Firebase Console
export FIREBASE_SERVICE_ACCOUNT_KEY="path/to/serviceAccountKey.json"
```

### 3. Run Locally
```bash
# Run the server
go run .

# Server will start on port 8080
# API available at: http://localhost:8080
```

### 4. Run Tests
```bash
go test -v ./...
```

## 🚀 Deployment

### Automatic Deployment
The backend is automatically deployed on push to `main` branch via GitHub Actions:

1. **Tests** run automatically
2. **Docker image** is built and pushed to GCR
3. **Cloud Run** service is updated
4. **Health check** verifies deployment

### Manual Deployment
```bash
# Build and deploy using Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly
gcloud run deploy f2p-buddy-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 📚 API Documentation

### Authentication
All protected endpoints require Firebase ID token in Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Base URL
- **Production**: `https://f2p-buddy-api-[hash]-uc.a.run.app`
- **Local**: `http://localhost:8080`

### Endpoints

#### Health Check
```http
GET /api/health
```

#### Authentication
```http
POST /api/auth/verify
POST /api/auth/user
```

#### Organizations
```http
POST /api/organizations          # Create organization
GET  /api/organizations/:id      # Get organization
PUT  /api/organizations/:id      # Update organization
GET  /api/organizations/:id/employees  # Get employees
```

#### Campaigns
```http
POST   /api/campaigns           # Create campaign
GET    /api/campaigns           # List campaigns
GET    /api/campaigns/:id       # Get campaign
PUT    /api/campaigns/:id       # Update campaign
DELETE /api/campaigns/:id       # Delete campaign
POST   /api/campaigns/:id/participate  # Join campaign
```

#### Achievements
```http
POST /api/achievements                    # Create achievement
GET  /api/achievements                    # List achievements
PUT  /api/achievements/:id/verify         # Verify achievement
GET  /api/achievements/leaderboard/:orgId # Get leaderboard
```

#### Analytics
```http
GET /api/analytics/organization/:orgId    # Organization analytics
GET /api/analytics/campaign/:campaignId  # Campaign analytics
```

## 🏗 Project Structure

```
backend/
├── main.go                    # Main application entry
├── handlers_auth.go           # Authentication endpoints
├── handlers_organizations.go  # Organization management
├── handlers_campaigns.go      # Campaign management
├── handlers_achievements.go   # Achievement tracking
├── handlers_analytics.go      # Analytics and reporting
├── main_test.go              # Test cases
├── Dockerfile                # Container configuration
├── cloudbuild.yaml           # Cloud Build configuration
├── go.mod                    # Go dependencies
└── .github/workflows/        # CI/CD workflows
```

## 🔒 Security Features

- **Firebase Auth Integration** for secure authentication
- **Role-based Access Control** for admin/employee permissions
- **CORS Protection** with configurable origins
- **Input Validation** on all endpoints
- **SQL Injection Protection** with Firestore queries
- **Environment Variable Security** for sensitive data

## 📊 Monitoring & Logging

- **Cloud Logging** for application logs
- **Error Tracking** with structured logging
- **Health Check Endpoint** for monitoring
- **Performance Metrics** via Cloud Run

## 🚀 Performance

- **Auto-scaling** from 0 to 10 instances
- **1GB Memory** per instance
- **1 CPU** per instance
- **80 Concurrent requests** per instance
- **3600s Timeout** for long-running operations

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 8080)
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Path to service account key (development only)

### Firebase Configuration
- Project ID: `f2p-buddy-1756234727`
- Authentication: Phone number with OTP
- Firestore: Native mode
- Storage: Default bucket

## 🧪 Testing

Run the test suite:
```bash
# Run all tests
go test -v ./...

# Run tests with coverage
go test -cover ./...

# Run specific test
go test -v -run TestHealthCheck
```

## 📝 API Response Format

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `go test ./...`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team

## 🔄 CI/CD Pipeline

The backend uses GitHub Actions for continuous integration and deployment:

1. **Code Push** to main branch
2. **Automated Testing** with Go test suite
3. **Docker Build** and push to Google Container Registry
4. **Cloud Run Deployment** with zero-downtime updates
5. **Health Check Verification** to ensure successful deployment

Every successful deployment automatically updates the production API endpoint.