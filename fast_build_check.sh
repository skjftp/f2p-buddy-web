#!/bin/bash

echo "🚀 Fast build failure detection..."

# Get current commit
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "📝 Current commit: $CURRENT_COMMIT"

# Wait shorter time then check more frequently
echo "⏳ Waiting 45 seconds for build to start..."
sleep 45

echo "🔍 Checking build status..."

# Check every 15 seconds instead of 30
for i in {1..8}; do
    echo "📡 Quick check $i/8..."
    
    # Get current deployed hash
    CURRENT_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
    echo "   Build hash: $CURRENT_HASH"
    
    # If hash changed, success!
    if [ "$CURRENT_HASH" != "main.1e534c33.js" ]; then
        echo "✅ BUILD SUCCESS! New hash: $CURRENT_HASH"
        exit 0
    fi
    
    # If we're past attempt 5 (75+ seconds), likely failed
    if [ $i -ge 5 ]; then
        echo "❌ BUILD LIKELY FAILED!"
        echo "🔧 Commit $CURRENT_COMMIT failed to deploy after 75+ seconds"
        echo "⚡ Applying auto-corrections immediately..."
        exit 1
    fi
    
    sleep 15
done

echo "⚠️ Build timeout - definitely failed"
exit 1
