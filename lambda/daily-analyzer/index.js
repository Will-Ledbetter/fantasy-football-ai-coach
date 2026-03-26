/**
 * Daily Fantasy Football Analyzer
 * Triggered by EventBridge daily at 6am
 * Orchestrates the full analysis pipeline
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

exports.handler = async (event) => {
  console.log('Starting fantasy football analysis...', JSON.stringify(event));
  
  // Check if this is a manual trigger for a specific user
  if (event.userId && event.triggerType === 'manual') {
    console.log(`Manual analysis triggered for user: ${event.userId}`);
    
    try {
      const result = await processUser(event.userConfig);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Manual analysis complete',
          processed: 1,
          results: [result]
        })
      };
    } catch (error) {
      console.error('Error in manual analysis:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Manual analysis failed',
          error: error.message
        })
      };
    }
  }
  
  // Original automatic analysis logic
  console.log('Starting automatic daily analysis...');
  
  // Check if we're in NFL season for automatic runs
  if (!isNFLSeason()) {
    console.log('Not in NFL season - skipping automatic analysis');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Offseason - no automatic analysis performed',
        season: false
      })
    };
  }
  
  try {
    // Get all active users
    const users = await getActiveUsers();
    console.log(`Found ${users.length} active users`);
    
    const results = [];
    
    // Process each user
    for (const user of users) {
      const result = await processUser(user);
      results.push(result);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily analysis complete',
        processed: users.length,
        results: results
      })
    };
    
  } catch (error) {
    console.error('Error in daily analyzer:', error);
    throw error;
  }
};

async function getActiveUsers() {
  const command = new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE,
    FilterExpression: 'active = :active',
    ExpressionAttributeValues: {
      ':active': true
    }
  });
  
  const response = await docClient.send(command);
  return response.Items || [];
}

async function invokeLambda(functionName, payload) {
  const environment = process.env.ENVIRONMENT || 'dev';
  const command = new InvokeCommand({
    FunctionName: `fantasy-football-${functionName}-${environment}`,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(payload)
  });
  
  const response = await lambdaClient.send(command);
  const result = JSON.parse(Buffer.from(response.Payload).toString());
  
  if (result.errorMessage) {
    throw new Error(result.errorMessage);
  }
  
  return JSON.parse(result.body);
}

function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Get season start for current year
  const seasonStart = getFirstThursdayOfSeptember(year);
  
  // If we're before September, use last year's season
  if (now.getMonth() < 8) {
    const lastYearStart = getFirstThursdayOfSeptember(year - 1);
    const diffTime = now - lastYearStart;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(Math.ceil(diffDays / 7), 22); // Include playoffs
  }
  
  const diffTime = now - seasonStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(Math.ceil(diffDays / 7), 22); // 18 regular + 4 playoff weeks
}

function isNFLSeason() {
  const now = new Date();
  const year = now.getFullYear();
  
  // NFL season runs September through early February
  // Regular season: Week 1 (early Sept) through Week 18 (early Jan)
  // Playoffs: Through Super Bowl (early Feb)
  
  // Season start: First Thursday of September
  const seasonStart = getFirstThursdayOfSeptember(year);
  
  // Season end: Super Bowl (typically first Sunday of February)
  const seasonEnd = new Date(year + 1, 1, 15); // Feb 15 to be safe
  
  // If we're before September, check last year's season
  if (now.getMonth() < 8) {
    const lastYearStart = getFirstThursdayOfSeptember(year - 1);
    const lastYearEnd = new Date(year, 1, 15);
    return now >= lastYearStart && now <= lastYearEnd;
  }
  
  // Otherwise check current year's season
  return now >= seasonStart && now <= seasonEnd;
}

async function processUser(user) {
  try {
    console.log(`Processing user: ${user.userId}`);
    
    // Fetch user's roster
    const rosterPayload = {
      userId: user.userId,
      platform: user.platform,
      leagueId: user.leagueId
    };
    
    // Add platform-specific credentials
    if (user.platform === 'espn') {
      rosterPayload.espnS2 = user.espnS2;
      rosterPayload.espnSwid = user.espnSwid;
    } else {
      rosterPayload.platformUserId = user.platformUserId;
    }
    
    const roster = await invokeLambda('fetch-roster', rosterPayload);
    console.log('Roster fetched:', JSON.stringify(roster));
    
    if (!roster || !roster.players || roster.players.length === 0) {
      throw new Error('No players found in roster');
    }
    
    // Fetch enhanced player data and web research in parallel
    const weekNumber = getCurrentWeek();
    const [playerData, webResearch] = await Promise.all([
      invokeLambda('fetch-player-data', {
        playerIds: roster.players.map(p => p.playerId),
        weekNumber: weekNumber
      }),
      invokeLambda('web-research', {
        players: roster.players.map(p => ({
          playerId: p.playerId,
          name: p.name,
          position: p.position,
          team: p.team
        })),
        weekNumber: weekNumber
      })
    ]);
    
    console.log('Enhanced data fetched - Player data quality:', playerData?.metadata?.sources?.length || 0, 'sources');
    console.log('Web research completed - Research sources:', webResearch?.metadata?.sources?.length || 0, 'sources');
    
    // Run enhanced AI analysis with all data sources
    const analysis = await invokeLambda('ai-analyzer', {
      roster: roster,
      playerData: playerData,
      webResearch: webResearch,
      weekNumber: weekNumber
    });
    
    // Store analysis results in DynamoDB
    await storeAnalysisResults(user.userId, analysis, roster);
    
    // Send notifications (only for automatic runs, not manual)
    if (!user.skipNotifications) {
      await invokeLambda('send-notifications', {
        userId: user.userId,
        email: user.email,
        analysis: analysis
      });
    }
    
    return {
      userId: user.userId,
      status: 'success',
      recommendations: analysis.recommendations.length
    };
    
  } catch (error) {
    console.error(`Error processing user ${user.userId}:`, error);
    return {
      userId: user.userId,
      status: 'error',
      error: error.message
    };
  }
}

async function storeAnalysisResults(userId, analysis, roster) {
  const command = new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE,
    Key: { userId },
    UpdateExpression: 'SET lastAnalysis = :timestamp, analysisData = :analysis, rosterData = :roster',
    ExpressionAttributeValues: {
      ':timestamp': new Date().toISOString(),
      ':analysis': analysis,
      ':roster': roster
    }
  });
  
  await docClient.send(command);
}

function getFirstThursdayOfSeptember(year) {
  const sept1 = new Date(year, 8, 1); // September 1
  const dayOfWeek = sept1.getDay();
  
  // Calculate days until Thursday (4)
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  if (daysUntilThursday === 0 && dayOfWeek !== 4) {
    daysUntilThursday = 7;
  }
  
  const firstThursday = new Date(year, 8, 1 + daysUntilThursday);
  return firstThursday;
}
