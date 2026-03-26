#!/bin/bash

# Enhanced Fantasy Football AI Coach Deployment Script
# Now includes web research, weather analysis, and advanced AI capabilities

set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
SES_EMAIL=${3}
BEDROCK_MODEL_ID=${4:-"anthropic.claude-3-5-sonnet-20241022-v2:0"}

echo "🏈 Deploying ENHANCED Fantasy Football AI Coach to $ENVIRONMENT environment..."

if [ -z "$SES_EMAIL" ]; then
  echo "Error: SES email address required"
  echo "Usage: ./deploy.sh [environment] [region] [ses-email] [bedrock-model-id]"
  echo "Example: ./deploy.sh dev us-east-1 notifications@yourdomain.com"
  exit 1
fi

echo "🆕 ENHANCED FEATURES BEING DEPLOYED:"
echo "   • Weather analysis for all games"
echo "   • Expert opinion aggregation"
echo "   • Social media sentiment analysis"
echo "   • Vegas lines and game scripts"
echo "   • Defense matchup rankings"
echo "   • Advanced AI with Claude: $BEDROCK_MODEL_ID"
echo "   • Comprehensive web research"
echo ""

# Install dependencies for each Lambda
echo "📦 Installing Lambda dependencies..."
for dir in lambda/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing dependencies for $(basename $dir)..."
    cd "$dir"
    npm install --production
    cd ../..
  fi
done

# Build SAM application
echo "🔨 Building SAM application..."
cd infrastructure
sam build

# Deploy with enhanced parameters
echo "🚀 Deploying to AWS..."
sam deploy \
  --stack-name fantasy-football-$ENVIRONMENT \
  --region $REGION \
  --resolve-s3 \
  --parameter-overrides \
    Environment=$ENVIRONMENT \
    SESFromEmail=$SES_EMAIL \
    BedrockModelId=$BEDROCK_MODEL_ID \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# Get outputs
echo "✅ Enhanced deployment complete!"
echo ""
echo "📋 Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name fantasy-football-$ENVIRONMENT \
  --region $REGION \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
echo "🎯 Next Steps:"
echo "1. Verify your SES email address: $SES_EMAIL"
echo "2. Create a user in Cognito"
echo "3. Add user's fantasy league info to DynamoDB"
echo "4. Test the enhanced analyzer Lambda manually"
echo "5. Configure external API keys for real data sources"
echo ""
echo "🧪 Manual test command:"
echo "aws lambda invoke --function-name fantasy-football-daily-analyzer-$ENVIRONMENT response.json"
echo ""
echo "🔍 Test web research:"
echo "aws lambda invoke --function-name fantasy-football-web-research-$ENVIRONMENT test-research.json"
echo ""
echo "🤖 AI Model: $BEDROCK_MODEL_ID"
echo "📊 Your fantasy app is now MUCH smarter with:"
echo "   • Real-time weather impacts"
echo "   • Expert consensus from multiple sources"
echo "   • Social media buzz tracking"
echo "   • Vegas line integration"
echo "   • Advanced matchup analysis"
echo "   • AI-powered recommendations"
