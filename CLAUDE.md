# F2P Buddy - Claude Development Configuration

## 🚀 Automatic Build Monitoring & Correction

### **Post-Push Build Check Protocol:**

After every git push, Claude should automatically:

1. **Monitor Netlify Build Status**
   - Wait 2-3 minutes for build to start
   - Check build completion status
   - Monitor for compilation errors

2. **Build Status Commands:**
   ```bash
   # Check if site is accessible (indicates successful deployment)
   curl -s -I https://f2p-buddy.netlify.app | head -1
   
   # Check for new build hash in deployed site
   curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1
   
   # Compare with previous build hash to detect new deployment
   ```

3. **Error Detection & Auto-Fix:**
   - **ESLint Errors**: Unused variables, missing dependencies, import issues
   - **TypeScript Errors**: Type mismatches, property access, interface issues  
   - **Build Failures**: Syntax errors, compilation failures
   - **React Errors**: Hook rules, component structure issues

4. **Auto-Correction Actions:**
   - Remove unused imports and variables
   - Add missing dependencies to useEffect
   - Fix TypeScript type assertions
   - Resolve React hooks violations
   - Add proper null safety checks

### **Build Monitoring Workflow:**

```
Git Push → Wait 3 min → Check Build Status → If Failed → Identify Error → Auto-Fix → Re-Push
```

### **Specific Error Patterns to Auto-Fix:**

#### **ESLint Errors:**
- `'X' is defined but never used` → Remove unused variable/import
- `React Hook useEffect has a missing dependency` → Add to dependency array
- `React Hook "useState" is called in function` → Move hooks to component level

#### **TypeScript Errors:**  
- `Property 'X' does not exist on type 'Y'` → Add type assertion `(obj as any).prop`
- `Cannot assign to 'X' because it is a constant` → Change const to let
- `Type 'undefined' is not assignable to type 'string'` → Add fallback `|| ''`

#### **JavaScript Errors:**
- `Cannot read properties of undefined (reading 'X')` → Add null safety `obj?.prop`
- `X.map is not a function` → Add `Array.isArray(X) && X.map(...)`

### **Netlify Deployment Details:**

- **Site URL**: https://f2p-buddy.netlify.app
- **Site ID**: 9901c96c-621c-494b-9b07-fd3945d38434  
- **GitHub Repo**: https://github.com/skjftp/f2p-buddy-web
- **Build Command**: `npm run build`
- **Publish Directory**: `build`

### **Success Criteria:**

✅ **Successful Deployment Indicators:**
- Site returns HTTP 200 status
- New JavaScript bundle hash detected
- No console errors on site load
- Campaign creation/editing works end-to-end

❌ **Failed Deployment Indicators:**
- Site returns HTTP 5xx status
- Build hash unchanged after 5+ minutes
- Console shows compilation errors
- Campaign features not working

### **Manual Override:**

If automatic fixes don't resolve the issue:
- Document the error pattern in this file
- Request manual intervention
- Provide detailed error analysis
- Suggest alternative approaches

---

## 📊 Recent Build History:

*Claude will automatically update this section after each deployment check*

### Latest Deployment: 2025-09-07 13:49:00
- **Date**: September 7, 2025 - 1:49 PM
- **Status**: ✅ Success  
- **Build Hash**: main.67fae7c6.js
- **Site Status**: HTTP/2 200 - Accessible
- **Errors Fixed**: Regional targeting edit mode support added
- **Manual Actions**: None required

### Build Monitoring Commands:
```bash
# Check site status
CURRENT_STATUS=$(curl -s -I https://f2p-buddy.netlify.app | head -1)
echo "Site status: $CURRENT_STATUS"

# Get current build hash  
CURRENT_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
echo "Build hash: $CURRENT_HASH"

# Monitor build completion (wait for hash change)
PREV_HASH="main.67fae7c6.js"
while [ "$CURRENT_HASH" = "$PREV_HASH" ]; do
  sleep 30
  CURRENT_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
  echo "Checking... Current: $CURRENT_HASH"
done
echo "✅ New deployment detected: $CURRENT_HASH"
```

---

## 🎯 Development Guidelines:

### **Code Quality Standards:**
- All code must pass ESLint without warnings
- TypeScript strict mode compliance required
- React hooks rules must be followed
- Null safety checks for all data access
- Mobile-responsive design principles

### **Testing Requirements:**
- Campaign creation end-to-end flow
- Employee login with organization access
- Regional targeting with hierarchical distribution
- Campaign editing with data persistence
- Professional UI/UX validation

### **Performance Standards:**
- Page load under 3 seconds
- Real-time data updates
- Mobile-optimized interactions
- Offline persistence capabilities

---

*This file enables Claude to automatically monitor, detect, and fix frontend build issues after every git push, ensuring continuous deployment success.*