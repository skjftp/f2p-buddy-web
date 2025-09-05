# 🔒 Firebase reCAPTCHA Configuration Guide

Complete guide to configure reCAPTCHA for Firebase Phone Authentication in F2P Buddy.

## 🎯 Why reCAPTCHA is Required

Firebase requires reCAPTCHA for phone authentication to prevent abuse and bot attacks. It's mandatory for production apps.

## 📋 Step-by-Step Configuration

### Step 1: Enable Phone Authentication in Firebase

1. Go to [Firebase Console - Authentication](https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers)

2. Click **"Get started"** if this is your first time

3. Go to **"Sign-in method"** tab

4. Find **"Phone"** in the list and click it

5. Toggle **"Enable"** to ON

6. Click **"Save"**

### Step 2: Configure reCAPTCHA Settings

#### Option A: Invisible reCAPTCHA (Recommended)

1. In the Phone provider settings, you'll see reCAPTCHA configuration

2. **reCAPTCHA verification** should be enabled by default

3. Firebase automatically creates a reCAPTCHA site key for your project

4. The invisible reCAPTCHA will show up automatically during phone auth

#### Option B: Manual reCAPTCHA Configuration

If you need custom reCAPTCHA settings:

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin/)

2. Click **"+ Create"** to create a new site

3. Fill in the details:
   - **Label**: `F2P Buddy Phone Auth`
   - **reCAPTCHA type**: Choose **reCAPTCHA v2** → **"I'm not a robot" Checkbox**
   - **Domains**: Add your domains:
     ```
     localhost
     127.0.0.1
     your-netlify-site.netlify.app
     your-custom-domain.com (if you have one)
     ```

4. Click **"Submit"**

5. Copy the **Site Key** and **Secret Key**

### Step 3: Add Authorized Domains

1. In Firebase Console, go to **Authentication** → **Settings** tab

2. Scroll down to **"Authorized domains"**

3. Add your domains:
   ```
   localhost (for development)
   your-netlify-site.netlify.app (your Netlify domain)
   your-custom-domain.com (if you have one)
   ```

4. Click **"Add domain"** for each

### Step 4: Update Your Application Code

The F2P Buddy app is already configured for reCAPTCHA! The setup is in `src/config/firebase.ts`:

```typescript
// This is already implemented in your app
export const setupRecaptcha = (elementId: string) => {
  if (!(window as any).recaptchaVerifier) {
    (window as any).recaptchaVerifier = new RecaptchaVerifier(elementId, {
      size: 'invisible', // or 'normal' for visible
      callback: () => {
        console.log('Recaptcha verified');
      },
      'expired-callback': () => {
        console.log('Recaptcha expired');
      }
    }, auth);
  }
  return (window as any).recaptchaVerifier;
};
```

### Step 5: Test the Configuration

1. Start your development server:
   ```bash
   npm start
   ```

2. Open `http://localhost:3000`

3. Try to register with a phone number

4. You should see:
   - reCAPTCHA verification (invisible or visible)
   - OTP sent to your phone
   - Successful authentication

## 🐛 Troubleshooting Common Issues

### Issue 1: "reCAPTCHA verification failed"

**Solution:**
- Check that your domain is added to Firebase authorized domains
- Verify localhost is in the authorized domains list
- Clear browser cache and cookies

### Issue 2: "This domain is not authorized"

**Solution:**
1. Go to Firebase Console → Authentication → Settings
2. Add your domain to authorized domains
3. Make sure to include both `localhost` and your deployment domain

### Issue 3: reCAPTCHA not showing

**Solution:**
- Check browser console for JavaScript errors
- Verify the `recaptcha-container` div exists in your HTML
- Ensure Firebase SDK is loaded properly

### Issue 4: "Network error" during phone auth

**Solution:**
- Check that Phone authentication is enabled in Firebase
- Verify your Firebase configuration keys are correct
- Test with a different phone number format

## 🔧 Advanced Configuration Options

### Invisible vs Visible reCAPTCHA

**Invisible reCAPTCHA** (Default in F2P Buddy):
```typescript
size: 'invisible'
```
- Better user experience
- Shows only when needed
- Recommended for most apps

**Visible reCAPTCHA**:
```typescript
size: 'normal'
```
- Always shows the checkbox
- More obvious security
- Use if you have bot problems

### Custom reCAPTCHA Styling

You can customize the reCAPTCHA appearance:

```typescript
(window as any).recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
  size: 'normal',
  theme: 'light', // or 'dark'
  callback: (response) => {
    // reCAPTCHA solved
    console.log('reCAPTCHA solved:', response);
  },
  'expired-callback': () => {
    // reCAPTCHA expired
    console.log('reCAPTCHA expired');
  }
}, auth);
```

## 📱 Testing with Real Phone Numbers

### Development Testing:
- Use your real phone number
- You'll receive actual SMS with OTP
- Firebase provides some free SMS for testing

### Production Considerations:
- Monitor Firebase usage quotas
- Consider SMS costs for high volume
- Set up proper error handling

## 🌍 International Phone Number Testing

Test with various formats:
```
+1 555-123-4567  (US)
+91 98765 43210  (India)  
+44 7700 900123  (UK)
+33 6 12 34 56 78 (France)
```

## 📊 Monitoring and Analytics

1. **Firebase Console**: Monitor authentication events
2. **Phone Auth Usage**: Track SMS usage and costs  
3. **reCAPTCHA Reports**: View spam/bot detection stats

## 🚀 Quick Test Script

Create a test file to verify reCAPTCHA is working:

```bash
# Test reCAPTCHA configuration
curl -X POST "https://console.firebase.google.com/project/f2p-buddy-1756234727/authentication/providers" \
  -H "Content-Type: application/json"
```

## ✅ Final Verification Checklist

- [ ] Phone authentication enabled in Firebase Console
- [ ] reCAPTCHA verification enabled
- [ ] Authorized domains configured (localhost + your domains)
- [ ] Application code includes reCAPTCHA setup
- [ ] Test registration works with real phone number  
- [ ] reCAPTCHA appears (invisible or visible)
- [ ] OTP received and verification works
- [ ] No console errors during authentication

## 🆘 Still Having Issues?

If you're still having problems:

1. **Check Firebase Console Logs**:
   - Go to Firebase Console → Authentication → Users
   - Look for failed authentication attempts

2. **Browser Developer Tools**:
   - Open Console tab
   - Look for reCAPTCHA or Firebase errors
   - Check Network tab for failed requests

3. **Test Different Browsers**:
   - Try Chrome, Firefox, Safari
   - Test in incognito/private mode
   - Disable browser extensions

4. **Firebase Documentation**:
   - [Phone Auth Guide](https://firebase.google.com/docs/auth/web/phone-auth)
   - [reCAPTCHA Setup](https://firebase.google.com/docs/auth/web/phone-auth#use-recaptcha-verification)

Your F2P Buddy application should now have fully working phone authentication with reCAPTCHA protection! 🎉