#!/bin/bash

echo "🚀 Netlify API Build Monitor"
SITE_ID="9901c96c-621c-494b-9b07-fd3945d38434"
CURRENT_COMMIT=$(git rev-parse --short HEAD)

echo "📝 Monitoring commit: $CURRENT_COMMIT"
echo "🏗️ Site ID: $SITE_ID"

# Wait for build to start
echo "⏳ Waiting 30 seconds for build to trigger..."
sleep 30

# Check recent deployments via API
echo "📡 Checking recent deployments via Netlify API..."

for i in {1..8}; do
    echo "🔍 API Check $i/8..."
    
    # Get recent deployments for our commit
    DEPLOYS=$(netlify api listSiteDeploys --data="{\"site_id\":\"$SITE_ID\"}" 2>/dev/null | jq -r '.[0:3][] | "\(.state)|\(.commit_ref)|\(.created_at)|\(.id)"' 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$DEPLOYS" ]; then
        echo "📊 Recent deployments:"
        echo "$DEPLOYS" | while IFS='|' read -r state commit_ref created_at deploy_id; do
            # Check if this is our commit
            if [[ "$commit_ref" == *"$CURRENT_COMMIT"* ]]; then
                echo "   🎯 Found our deploy: $state (commit: $CURRENT_COMMIT)"
                
                if [ "$state" = "ready" ]; then
                    echo "   ✅ BUILD SUCCESS!"
                    echo "   📝 Deploy ID: $deploy_id"
                    exit 0
                elif [ "$state" = "error" ] || [ "$state" = "failed" ]; then
                    echo "   ❌ BUILD FAILED!"
                    echo "   📋 Deploy ID: $deploy_id"
                    
                    # Get build logs
                    echo "   📄 Fetching build logs..."
                    netlify api getSiteDeploy --data="{\"site_id\":\"$SITE_ID\",\"deploy_id\":\"$deploy_id\"}" 2>/dev/null | jq -r '.error_message // "No error message available"'
                    exit 1
                elif [ "$state" = "building" ]; then
                    echo "   🔄 Still building..."
                else
                    echo "   ⏳ Status: $state"
                fi
            else
                echo "   📋 Other deploy: $state (commit: ${commit_ref:0:7})"
            fi
        done
    else
        echo "   ⚠️ API call failed, falling back to site check..."
        
        # Fallback to site hash check
        CURRENT_HASH=$(curl -s https://f2p-buddy.netlify.app | grep -o 'main\.[a-z0-9]*\.js' | head -1)
        echo "   Hash: $CURRENT_HASH"
    fi
    
    echo "   ⏳ Waiting 20 seconds..."
    sleep 20
done

echo "⚠️ Build monitoring timeout - check Netlify dashboard manually"
exit 2
