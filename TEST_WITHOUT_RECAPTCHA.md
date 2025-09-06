# 🧪 Testing Without reCAPTCHA

If reCAPTCHA is causing auth persistence issues, you can temporarily disable it for testing:

## Option 1: Use Test Phone Numbers (Recommended)

In Firebase Console → Authentication → Settings → Phone numbers for testing:
- Phone: +918422994352
- Code: 123456

These bypass reCAPTCHA completely.

## Option 2: Disable reCAPTCHA Temporarily

If you want to test with other numbers, temporarily comment out reCAPTCHA:

1. In `src/config/firebase.ts`, replace `setupRecaptcha()` with:
```typescript
export const setupRecaptcha = async (elementId: string) => {
  // Disabled for testing
  return null;
};
```

2. In `src/pages/Login.tsx`, modify `sendOTP()`:
```typescript
// Skip reCAPTCHA for testing
// const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
const confirmation = await signInWithPhoneNumber(
  authInstance, 
  `+${phoneNumber}`, 
  null as any // Skip reCAPTCHA
);
```

## Current Implementation

I've enhanced the reCAPTCHA setup to:
- Clear existing verifiers to prevent conflicts
- Preserve auth state after verification
- Add callbacks to maintain persistence

## Testing Instructions

1. Use test number: +918422994352 with code: 123456
2. This bypasses reCAPTCHA and should maintain auth state
3. If this works, the issue is definitely reCAPTCHA-related

Let me know if the test number works without logout issues!