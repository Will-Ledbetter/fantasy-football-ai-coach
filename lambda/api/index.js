const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION || process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.DYNAMODB_TABLE;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path || event.resource;
    const method = event.httpMethod;

    // Get user ID from Cognito authorizer
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // POST /user/setup - Save user's league configuration
    if (path.includes('/user/setup') && method === 'POST') {
      const body = JSON.parse(event.body);
      
      // Get user email from Cognito claims
      const email = event.requestContext?.authorizer?.claims?.email;
      
      const item = {
        userId: userId,
        email: email,
        platform: body.platform,
        leagueId: body.leagueId,
        active: true,
        updatedAt: new Date().toISOString()
      };

      // Add platform-specific fields
      if (body.platform === 'espn') {
        item.espnS2 = body.espnS2;
        item.espnSwid = body.espnSwid;
      } else {
        item.platformUserId = body.platformUserId;
      }

      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: item
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'League connected successfully' })
      };
    }

    // GET /user/config - Get user's configuration
    if (path.includes('/user/config') && method === 'GET') {
      const result = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId }
      }));

      if (!result.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User configuration not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
      };
    }

    // GET /analysis/latest - Get latest analysis
    if (path.includes('/analysis/latest') && method === 'GET') {
      const result = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId }
      }));

      if (!result.Item || !result.Item.analysisData) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            recommendations: [],
            analysis: null,
            message: 'No analysis available yet. Run the daily analyzer to generate recommendations.'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...result.Item.analysisData,
          lastUpdated: result.Item.lastAnalysis
        })
      };
    }

    // GET /roster - Get current roster
    if (path.includes('/roster') && method === 'GET') {
      const result = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { userId }
      }));

      if (!result.Item || !result.Item.rosterData) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            starters: [],
            bench: [],
            message: 'Roster data will be available after first analysis run.'
          })
        };
      }

      const roster = result.Item.rosterData;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          platform: roster.platform,
          leagueId: roster.leagueId,
          players: roster.players || [],
          teamCount: roster.teamCount,
          lastUpdated: result.Item.lastAnalysis
        })
      };
    }

    // POST /analysis/run - Trigger analysis for current user
    if (path.includes('/analysis/run') && method === 'POST') {
      try {
        // Get user configuration
        const result = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: { userId }
        }));

        if (!result.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User configuration not found. Please set up your league first.' })
          };
        }

        // Trigger the daily analyzer for this specific user
        const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
        const lambdaClient = new LambdaClient({});
        
        const payload = {
          userId: userId,
          triggerType: 'manual',
          userConfig: result.Item
        };

        const command = new InvokeCommand({
          FunctionName: `fantasy-football-daily-analyzer-${process.env.ENVIRONMENT || 'dev'}`,
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify(payload)
        });

        await lambdaClient.send(command);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            message: 'Analysis started! Check back in a few moments for results.',
            status: 'running'
          })
        };

      } catch (error) {
        console.error('Error triggering analysis:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to start analysis. Please try again.' })
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
