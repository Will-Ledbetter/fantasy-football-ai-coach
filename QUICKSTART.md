# Fantasy Football AI Coach - Quick Start

Get your AI fantasy football assistant running in 30 minutes.

## Prerequisites

- AWS Account with Bedrock access (Claude 3.5 Sonnet)
- AWS CLI configured
- SAM CLI installed
- Node.js 20+
- Verified SES email address

## Step 1: Deploy Backend (10 min)

```bash
# Make deploy script executable
chmod +x deploy.sh

# Deploy to AWS
./deploy.sh dev us-east-1 your-email@domain.com

# Note the outputs - you'll need UserPoolId and ApiUrl
```

## Step 2: Verify SES Email (2 min)

```bash
# AWS will send verification email
# Click the link to verify your sender address
```

## Step 3: Configure Frontend (5 min)

```bash
cd frontend

# Create config file
cat > src/aws-config.js << EOF
export const awsConfig = {
  region: 'us-east-1',
  userPoolId: 'YOUR_USER_POOL_ID',  # From deploy output
  userPoolWebClientId: 'YOUR_CLIENT_ID',  # From deploy output
  apiEndpoint: 'YOUR_API_URL'  # From deploy output
};
EOF

# Install dependencies
npm install

# Start dev server
npm start
```

## Step 4: Create Your Account (3 min)

1. Open http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Verify email (check inbox)
5. Sign in

## Step 5: Connect Your League (5 min)

### For Sleeper:

1. Go to your Sleeper league
2. Copy League ID from URL: `sleeper.app/leagues/LEAGUE_ID`
3. Get your User ID:
   - Click profile → Settings → Account
   - Copy User ID
4. Enter both in the setup form

### For ESPN (Coming Soon):

Will require ESPN cookies for authentication.

## Step 6: Test It (5 min)

```bash
# Manually trigger analysis
aws lambda invoke \
  --function-name fantasy-football-daily-analyzer-dev \
  --payload '{}' \
  response.json

# Check your email for the analysis!
```

## What Happens Next?

- **Every morning at 6am EST**: AI analyzes your roster
- **Email arrives**: Personalized recommendations
- **Dashboard updates**: View full analysis online
- **Weekly insights**: Waiver wire targets, trade advice

## Troubleshooting

### No email received?

```bash
# Check Lambda logs
aws logs tail /aws/lambda/fantasy-football-send-notifications-dev --follow

# Verify SES email
aws ses get-identity-verification-attributes --identities your-email@domain.com
```

### Can't fetch roster?

- Verify League ID is correct
- Ensure User ID matches your Sleeper account
- Check Lambda logs for API errors

### Bedrock errors?

```bash
# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Request access if needed (takes 1-2 days)
```

## Cost Estimate

- **DynamoDB**: ~$0.25/month (free tier eligible)
- **Lambda**: ~$1/month (free tier eligible)
- **Bedrock**: ~$2-5/month (depends on usage)
- **SES**: Free for first 62,000 emails
- **Total**: ~$3-6/month

## Next Steps

1. Invite friends (multi-user support built-in)
2. Add more leagues (supports multiple)
3. Enable SMS alerts (optional)
4. Customize AI prompts for your strategy
5. Track AI accuracy over the season

## Support

- Check logs: `aws logs tail /aws/lambda/FUNCTION_NAME --follow`
- Test individual Lambdas via AWS Console
- Review CloudWatch metrics for errors

Ready to dominate your league! 🏆
