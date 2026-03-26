# Fantasy Football AI Coach - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     EventBridge (Daily 6am)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Daily Analyzer Lambda (Orchestrator)            │
│  - Fetches all active users from DynamoDB                    │
│  - Invokes pipeline for each user                            │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│   Fetch     │  │    Fetch     │  │      AI      │
│   Roster    │→ │ Player Data  │→ │   Analyzer   │
│   Lambda    │  │    Lambda    │  │   (Bedrock)  │
└─────────────┘  └──────────────┘  └──────┬───────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │ Send Notification│
                                  │   Lambda (SES)   │
                                  └─────────────────┘
                                           │
                                           ▼
                                    📧 User Email
```

## Data Flow

### 1. Daily Analysis Pipeline

**Trigger**: EventBridge cron (6am EST daily)

**Flow**:
1. Daily Analyzer fetches all users with `active: true` from DynamoDB
2. For each user:
   - Fetch roster from fantasy platform API
   - Fetch latest player data (injuries, projections, weather)
   - Send to AI Analyzer with context
   - AI generates recommendations
   - Send email notification
   - Store results in DynamoDB

### 2. User Dashboard

**Flow**:
1. User authenticates via Cognito
2. Frontend fetches latest analysis from API Gateway
3. API Lambda queries DynamoDB for user's data
4. Returns analysis + recommendations
5. Dashboard displays with interactive UI

### 3. League Setup

**Flow**:
1. User provides league credentials
2. API validates by fetching roster
3. Stores configuration in DynamoDB
4. Sets `active: true` to enable daily analysis

## Components

### Lambda Functions

#### daily-analyzer
- **Trigger**: EventBridge (cron)
- **Purpose**: Orchestrate daily analysis for all users
- **Invokes**: fetch-roster, fetch-player-data, ai-analyzer, send-notifications
- **Timeout**: 5 minutes
- **Memory**: 512 MB

#### fetch-roster
- **Purpose**: Get user's fantasy roster from platform API
- **APIs**: Sleeper, ESPN, Yahoo
- **Returns**: Player list with positions, starters, bench
- **Timeout**: 30 seconds

#### fetch-player-data
- **Purpose**: Aggregate player stats, injuries, projections
- **APIs**: Sleeper (injuries), Weather API, FantasyPros (projections)
- **Returns**: Enhanced player data object
- **Timeout**: 60 seconds

#### ai-analyzer
- **Purpose**: AI-powered roster analysis
- **Service**: AWS Bedrock (Claude 3.5 Sonnet)
- **Input**: Roster + player data + week context
- **Output**: Structured recommendations with reasoning
- **Timeout**: 2 minutes
- **Memory**: 512 MB

#### send-notifications
- **Purpose**: Deliver analysis via email/SMS
- **Services**: SES (email), SNS (SMS optional)
- **Features**: HTML email with styling, plain text fallback
- **Timeout**: 30 seconds

### Data Storage

#### DynamoDB Table: fantasy-football-users

```javascript
{
  userId: "string",           // Partition key (Cognito sub)
  email: "string",
  platform: "sleeper|espn|yahoo",
  leagueId: "string",
  platformUserId: "string",
  active: boolean,
  createdAt: "timestamp",
  lastAnalysis: "timestamp",
  preferences: {
    emailEnabled: boolean,
    smsEnabled: boolean,
    analysisTime: "06:00"
  }
}
```

#### DynamoDB Table: analysis-history (Optional)

```javascript
{
  userId: "string",
  weekNumber: number,
  timestamp: "string",
  recommendations: [],
  analysis: "string",
  accuracy: number  // Track AI performance
}
```

### APIs Used

#### Sleeper API (Free)
- `GET /v1/league/{league_id}/rosters` - Get rosters
- `GET /v1/players/nfl` - Get all NFL players with injury status
- No authentication required

#### ESPN API (Requires cookies)
- More complex, requires user's ESPN session cookies
- Coming in v2

#### Weather API (Optional)
- OpenWeather or similar
- Enhance analysis with game-day weather

#### FantasyPros API (Optional, Paid)
- Expert consensus rankings
- Projections
- Enhances AI analysis quality

## Security

### Authentication
- Cognito User Pools for user management
- JWT tokens for API authentication
- No passwords stored in DynamoDB

### Authorization
- API Gateway validates Cognito tokens
- Lambda functions use IAM roles
- Users can only access their own data

### Data Privacy
- No sensitive data stored
- League credentials used only for API calls
- Email addresses encrypted at rest

### API Security
- Rate limiting on API Gateway
- Lambda concurrency limits
- Input validation on all endpoints

## Scalability

### Current Design
- Supports 1,000+ users easily
- DynamoDB on-demand pricing scales automatically
- Lambda concurrent executions: 1000 default

### Bottlenecks
- Bedrock API rate limits (10 requests/second)
- SES sending limits (14 emails/second in sandbox)
- Fantasy platform API rate limits

### Solutions
- Batch processing with delays
- SES production access (50,000 emails/day)
- Caching player data (reduces API calls)

## Cost Optimization

### Current Costs (per 100 users)
- Lambda: ~$0.50/month (free tier covers most)
- DynamoDB: ~$0.25/month (free tier eligible)
- Bedrock: ~$2/month (0.003/1K tokens)
- SES: Free (under 62K emails/month)
- **Total**: ~$3/month for 100 users

### Optimization Strategies
- Cache player data (reduce API calls)
- Batch Bedrock requests
- Use reserved concurrency for cost control
- Compress DynamoDB items

## Monitoring

### CloudWatch Metrics
- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- Bedrock API latency
- SES delivery rate

### Alarms
- Lambda error rate > 5%
- Bedrock throttling
- SES bounce rate > 10%
- DynamoDB throttling

### Logging
- Structured JSON logs
- User ID in all log entries
- Error tracking with context
- Performance metrics

## Future Enhancements

### Phase 2
- Trade analyzer
- Waiver wire recommendations
- Multi-league support
- SMS alerts

### Phase 3
- Mobile app (React Native)
- Real-time game day updates
- Social features (league chat)
- Historical accuracy tracking

### Phase 4
- Custom AI training on user preferences
- Video analysis integration
- Betting odds integration
- Premium tier with advanced features
