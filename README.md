# Fantasy Football AI Coach

AI-powered fantasy football assistant that analyzes your roster daily and provides personalized lineup recommendations.

## Features

- **Daily Analysis**: Automated roster analysis every morning (during NFL season only)
- **Smart Recommendations**: AI-powered sit/start decisions with reasoning
- **Injury Tracking**: Real-time injury report monitoring
- **Matchup Analysis**: Considers opponent defense, weather, Vegas lines
- **Waiver Wire Intelligence**: Identifies pickup opportunities
- **Trade Analyzer**: Evaluates trade offers
- **Season Detection**: Automatically pauses during offseason (Feb-Aug) to save costs

## LinkedIn Post

[See it in action](https://www.linkedin.com/posts/will-ledbetter-114318167_aws-amazonkiro-awskiro-activity-7406546574559846400-uyCK?utm_source=share&utm_medium=member_desktop&rcm=ACoAACe8W6ABz_yW6tZUwf4zTku75hhXakj6lxU)

## Architecture

- **Backend**: AWS Lambda + EventBridge + DynamoDB
- **AI Engine**: AWS Bedrock (Claude)
- **APIs**: Sleeper, ESPN, NFL data
- **Frontend**: React dashboard
- **Notifications**: Email (SES) + optional SMS (SNS)

## Quick Start

1. Deploy Lambda functions: `./deploy.sh`
2. Configure fantasy platform credentials
3. Set up daily EventBridge trigger
4. Access dashboard at your Amplify URL

## Project Structure

```
/lambda
  /daily-analyzer       - Main analysis pipeline
  /fetch-roster         - Get user's fantasy roster
  /fetch-player-data    - Get NFL player stats/injuries
  /ai-analyzer          - Bedrock AI analysis
  /send-notifications   - Email/SMS delivery
  /api                  - REST API for dashboard

/frontend
  /src
    /components         - React components
    /services          - API clients
    /utils             - Helper functions

/infrastructure
  - CloudFormation/SAM templates
  - EventBridge rules
  - IAM policies
```

## Environment Variables

```
SLEEPER_API_KEY=your_key
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
DYNAMODB_TABLE=fantasy-football-users
SES_FROM_EMAIL=notifications@yourdomain.com
```

## Development Roadmap

- [x] Project setup
- [ ] Sleeper API integration
- [ ] Daily analysis Lambda
- [ ] AI recommendation engine
- [ ] Email notifications
- [ ] Web dashboard
- [ ] User authentication
- [ ] Multi-league support
- [ ] Trade analyzer
- [ ] Mobile app
