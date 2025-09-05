# 📸 Visual reCAPTCHA Configuration Guide

Step-by-step visual guide with screenshots and exact URLs to configure reCAPTCHA for F2P Buddy.

## 🎯 Quick Configuration (5 Minutes)

### Step 1: Access Firebase Authentication
**URL:** `https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers`

1. **Login to Firebase Console**
   - Go to the URL above
   - You should see the Firebase project dashboard

2. **Navigate to Authentication**
   - Click **"Authentication"** in the left sidebar
   - Click **"Sign-in method"** tab at the top

### Step 2: Enable Phone Authentication
**What you'll see:** List of authentication providers

1. **Find Phone Provider**
   - Look for **"Phone"** in the list of providers
   - It will show **"Disabled"** status initially

2. **Enable Phone Provider**
   - Click on the **"Phone"** row
   - You'll see a modal popup
   - Toggle the **"Enable"** switch to ON
   - Click **"Save"**

### Step 3: Configure reCAPTCHA (Automatic)
**What happens:** Firebase automatically sets up reCAPTCHA

1. **reCAPTCHA Configuration**
   - After enabling Phone auth, reCAPTCHA is automatically configured
   - Firebase creates an invisible reCAPTCHA for your project
   - No manual configuration needed!

2. **Verification Settings**
   - You'll see **"reCAPTCHA verification"** section
   - It should show **"Enabled"** automatically
   - Default setting is **"Invisible reCAPTCHA"** (recommended)

### Step 4: Add Authorized Domains
**URL:** `https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/settings`

1. **Go to Settings Tab**
   - Click **"Settings"** tab (next to Sign-in method)
   - Scroll down to **"Authorized domains"** section

2. **Add Development Domain**
   - You should see **"localhost"** already listed
   - If not, click **"Add domain"**
   - Enter: `localhost`
   - Click **"Add"**

3. **Add Production Domains**
   - Click **"Add domain"** again
   - Enter your Netlify domain: `your-app-name.netlify.app`
   - Click **"Add"**
   - Repeat for any custom domains

## 🔧 Detailed Configuration Steps

### Manual reCAPTCHA Configuration (If Needed)

**Only do this if automatic configuration fails**

1. **Access Google reCAPTCHA Console**
   - Go to: `https://www.google.com/recaptcha/admin/`
   - Login with the same Google account as Firebase

2. **Create New reCAPTCHA Site**
   ```
   Site Label: F2P Buddy Phone Auth
   reCAPTCHA Type: reCAPTCHA v2 → "I'm not a robot" Checkbox
   Domains:
     - localhost
     - 127.0.0.1  
     - your-netlify-site.netlify.app
     - your-custom-domain.com
   ```

3. **Get Site Keys**
   - Copy the **Site Key** (public)
   - Copy the **Secret Key** (private)
   - You don't need to add these to your app (Firebase handles it)

## 🧪 Testing Your Configuration

### Visual Test Checklist

1. **Start Your App**
   ```bash
   npm start
   ```
   - App should load at `http://localhost:3000`

2. **Test Phone Registration**
   - Click on phone input field
   - Enter a phone number (your real number for testing)
   - Click **"Send OTP"** button

3. **What Should Happen:**
   - ✅ reCAPTCHA may appear (invisible or visible checkbox)
   - ✅ You see "Sending..." loading state
   - ✅ Success message: "OTP sent successfully!"
   - ✅ Form switches to OTP input screen
   - ✅ You receive SMS with 6-digit code

4. **Complete Authentication:**
   - Enter the 6-digit OTP you received
   - Click **"Verify OTP"**
   - You should be redirected to role selection or dashboard

## ❌ Common Issues & Solutions

### Issue 1: "This domain is not authorized"
**What you see:** Error in browser console or toast notification

**Solution:**
1. Go to Firebase Console → Authentication → Settings
2. Add `localhost` to authorized domains
3. Add your actual domain (Netlify URL)
4. Clear browser cache and try again

### Issue 2: reCAPTCHA not appearing
**What you see:** OTP send fails, no reCAPTCHA challenge

**Solution:**
1. Check browser console for JavaScript errors
2. Ensure the `<div id="recaptcha-container"></div>` exists
3. Verify Firebase config keys are correct
4. Try in incognito mode

### Issue 3: "Network request failed"
**What you see:** Error when clicking "Send OTP"

**Solution:**
1. Verify Phone authentication is enabled in Firebase
2. Check your internet connection
3. Verify Firebase project ID is correct
4. Check browser network tab for blocked requests

### Issue 4: OTP not received
**What you see:** reCAPTCHA works, but no SMS

**Solution:**
1. Check phone number format (+91XXXXXXXXXX)
2. Try with a different phone number
3. Check Firebase Console quotas
4. Wait a few minutes and retry

## 📱 Testing with Different Scenarios

### Test Case 1: First-time User
```
1. Enter phone number: +91 98765 43210
2. Complete reCAPTCHA (if appears)  
3. Receive OTP via SMS
4. Enter OTP: 123456
5. Select role: Admin or Employee
6. Complete registration
```

### Test Case 2: Returning User  
```
1. Enter phone number: +91 98765 43210  
2. Complete reCAPTCHA (if appears)
3. Receive OTP via SMS
4. Enter OTP: 123456
5. Auto-redirect to dashboard (no role selection)
```

### Test Case 3: Bot/Spam Detection
```
1. Multiple rapid attempts
2. reCAPTCHA should appear more frequently
3. May require solving visual challenges
4. This is normal behavior for security
```

## 🌍 International Phone Testing

Test with different country codes:

```bash
# India
+91 98765 43210

# United States  
+1 555-123-4567

# United Kingdom
+44 7700 900123

# Canada
+1 416-555-0123
```

## 🔍 Debugging Tools

### Browser Console Commands
```javascript
// Check if reCAPTCHA is loaded
console.log(window.recaptchaVerifier);

// Check Firebase config
console.log(firebase.auth().currentUser);

// Test reCAPTCHA manually
window.recaptchaVerifier.verify();
```

### Network Tab Inspection
Look for these requests:
- `https://www.google.com/recaptcha/api/verify` ✅
- `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode` ✅  
- `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber` ✅

## 🚀 Production Checklist

Before going live:

- [ ] Phone authentication enabled in Firebase
- [ ] reCAPTCHA verification active
- [ ] Production domain in authorized domains
- [ ] Test with real phone numbers
- [ ] Check SMS quotas and billing
- [ ] Monitor authentication logs
- [ ] Set up error tracking

## 🆘 Quick Help Commands

```bash
# Test reCAPTCHA configuration
./test-recaptcha.sh

# Check Firebase connection
firebase use f2p-buddy-1756234727

# View current project
firebase projects:list

# Get Firebase config
./get-firebase-config.sh
```

Your F2P Buddy app should now have fully functional phone authentication with reCAPTCHA protection! 🛡️

**Key URLs to Bookmark:**
- Firebase Auth Providers: `https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers`
- Firebase Auth Settings: `https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/settings`
- Google reCAPTCHA Admin: `https://www.google.com/recaptcha/admin/`