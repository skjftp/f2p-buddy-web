#!/bin/bash

# F2P Buddy - Automated Build Monitoring Script
# This script monitors Netlify deployment after git push and auto-fixes errors

echo "🔍 Starting automated build monitoring..."
echo "📊 Site: https://f2p-buddy.netlify.app"

# Get current build hash
PREV_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
echo "🔗 Previous build hash: $PREV_HASH"

echo "⏳ Waiting for Netlify build to start..."
sleep 60

echo "🔄 Monitoring for new deployment..."
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "📡 Check $ATTEMPT/$MAX_ATTEMPTS..."
    
    # Check site status
    STATUS=$(curl -s -I https://f2p-buddy.netlify.app | head -1)
    echo "   Status: $STATUS"
    
    # Check current build hash
    CURRENT_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
    echo "   Build hash: $CURRENT_HASH"
    
    # Check if deployment completed (hash changed)
    if [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
        echo "✅ New deployment detected!"
        echo "🎯 Build successful - hash changed from $PREV_HASH to $CURRENT_HASH"
        echo "📝 Updating CLAUDE.md with successful deployment..."
        break
    fi
    
    # Check if we've been waiting too long (likely build failed)
    if [ $ATTEMPT -ge 6 ]; then
        echo "⚠️ Build taking longer than expected (>3 minutes)"
        echo "🔍 Checking for build failure indicators..."
        
        # Check if hash is very old (indicates failed build)
        if [ "$CURRENT_HASH" = "$PREV_HASH" ]; then
            echo "❌ BUILD FAILURE DETECTED!"
            echo "🔧 Hash unchanged after 3+ minutes - build likely failed"
            echo "📋 Likely causes: TypeScript errors, ESLint errors, compilation failures"
            echo "🔄 Claude should now apply auto-corrections..."
            break
        fi
    fi
    
    # Check if site is down (build failed)
    if [[ "$STATUS" != *"200"* ]]; then
        echo "❌ Site is down - build definitely failed"
        echo "🔧 Build failure detected - manual intervention may be required"
        break
    fi
    
    echo "⏳ Waiting 30 seconds for next check..."
    sleep 30
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "⚠️ Build monitoring timeout - deployment may have failed"
    echo "🔍 Check https://app.netlify.com/sites/f2p-buddy/deploys for details"
fi

echo "🏁 Build monitoring complete"
