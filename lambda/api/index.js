const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');

const client = new DynamoDBClient({ region: process.env.REGION || process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const kmsClient = new KMSClient({ region: process.env.REGION || process.env.AWS_REGION || 'us-east-1' });

const tableName = process.env.DYNAMODB_TABLE;
const KMS_KEY_ID = process.env.KMS_KEY_ID;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://main.d2usrsmdilcuki.amplifyapp.com';
const ANALYSIS_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// --- Input Validation ---

const VALID_PLATFORMS = ['sleeper', 'espn'];
const VALID_APPLE_PRODUCTS = [
  'com.helixastra.helixsideline.pro.monthly',
  'com.helixastra.helixsideline.elite.monthly'
];
const VALID_DEVICE_PLATFORMS = ['ios', 'android', 'web'];

function validateString(value, name, { maxLength = 500, pattern = null, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(`${name} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new ValidationError(`${name} must be a string`);
  if (value.length > maxLength) throw new ValidationError(`${name} exceeds maximum length of ${maxLength}`);
  if (pattern && !pattern.test(value)) throw new ValidationError(`${name} has invalid format`);
  return value.trim();
}

function validateEnum(value, name, allowed) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${name} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function validateBoolean(value, name, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'boolean') throw new ValidationError(`${name} must be a boolean`);
  return value;
}

function validateNumber(value, name, { min = 0, max = 100, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${name} is required`);
    return undefined;
  }
  const num = Number(value);
  if (isNaN(num)) throw new ValidationError(`${name} must be a number`);
  if (num < min || num > max) throw new ValidationError(`${name} must be between ${min} and ${max}`);
  return num;
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function safeParseBody(event) {
  if (!event.body) return {};
  try {
    const parsed = JSON.parse(event.body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ValidationError('Request body must be a JSON object');
    }
    return parsed;
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError('Invalid JSON in request body');
  }
}

// --- KMS Encryption for ESPN Credentials ---

async function encryptValue(plaintext) {
  if (!KMS_KEY_ID || !plaintext) return plaintext;
  try {
    const result = await kmsClient.send(new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext)
    }));
    return `ENC:${Buffer.from(result.CiphertextBlob).toString('base64')}`;
  } catch (err) {
    console.error('KMS encrypt error:', err.message);
    throw new Error('Failed to encrypt credentials');
  }
}

async function decryptValue(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith('ENC:')) return ciphertext;
  try {
    const encrypted = Buffer.from(ciphertext.slice(4), 'base64');
    const result = await kmsClient.send(new DecryptCommand({
      CiphertextBlob: encrypted
    }));
    return Buffer.from(result.Plaintext).toString();
  } catch (err) {
    console.error('KMS decrypt error:', err.message);
    throw new Error('Failed to decrypt credentials');
  }
}

// --- Tier Limits ---

const TIER_LIMITS = {
  free: { analysisRuns: 5, leagues: 1 },
  pro: { analysisRuns: Infinity, leagues: Infinity },
  elite: { analysisRuns: Infinity, leagues: Infinity }
};

function getEffectiveTier(subscription) {
  if (!subscription || !subscription.tier || subscription.tier === 'free') return 'free';
  if (subscription.status === 'active') return subscription.tier;
  if (subscription.status === 'cancelled' && subscription.periodEndDate) {
    if (new Date(subscription.periodEndDate) > new Date()) return subscription.tier;
  }
  return 'free';
}

// Remove encrypted credentials from a league entry before returning to the client
function stripLeagueSecrets(league) {
  if (!league) return league;
  const { espnS2, espnSwid, ...safe } = league;
  if (league.platform === 'espn' && (espnS2 || espnSwid)) safe.espnConnected = true;
  return safe;
}

exports.getEffectiveTier = getEffectiveTier;
exports.TIER_LIMITS = TIER_LIMITS;
exports.decryptValue = decryptValue;
exports.stripLeagueSecrets = stripLeagueSecrets;

exports.handler = async (event) => {
  console.log('API request:', event.httpMethod, event.path);

  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.execute-api.us-east-1.amazonaws.com https://api.sleeper.app",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const path = event.path || event.resource;
    const method = event.httpMethod;
    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // POST /user/setup - Save/add a league configuration (multi-league aware)
    if (path.includes('/user/setup') && method === 'POST') {
      const body = safeParseBody(event);
      const platform = validateEnum(validateString(body.platform, 'platform', { maxLength: 10 }), 'platform', VALID_PLATFORMS);
      const leagueId = validateString(body.leagueId, 'leagueId', { maxLength: 30, pattern: /^[a-zA-Z0-9_-]+$/ });
      const leagueType = validateString(body.leagueType, 'leagueType', { maxLength: 10, required: false }) || 'redraft';
      const leagueName = validateString(body.leagueName, 'leagueName', { maxLength: 100, required: false }) || '';
      const email = event.requestContext?.authorizer?.claims?.email;

      // Load existing record to determine tier + existing leagues
      const existing = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const existingItem = existing.Item || {};
      const existingLeagues = Array.isArray(existingItem.leagues) ? existingItem.leagues : [];

      // Tier gating for number of leagues
      const effectiveTier = getEffectiveTier(existingItem.subscription);
      const leagueLimit = TIER_LIMITS[effectiveTier]?.leagues ?? 1;
      const isNewLeague = !existingLeagues.some(l => l.leagueId === leagueId);
      if (isNewLeague && existingLeagues.length >= leagueLimit) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: `Your ${effectiveTier} plan allows ${leagueLimit} league${leagueLimit === 1 ? '' : 's'}. Upgrade to Pro for unlimited leagues.`,
            limitReached: true,
            leagueLimit
          })
        };
      }

      // Build the active-league fields (kept top-level for analyzer compatibility)
      const item = {
        ...existingItem,
        userId, email, platform, leagueId, leagueType,
        activeLeagueId: leagueId,
        active: true,
        updatedAt: new Date().toISOString()
      };

      // Clear any previous active-league ESPN creds; set fresh if provided
      delete item.espnS2;
      delete item.espnSwid;
      delete item.platformUserId;

      const leagueEntry = { leagueId, platform, leagueType, name: leagueName };

      if (platform === 'espn') {
        const espnS2 = validateString(body.espnS2, 'espnS2', { maxLength: 1500, required: false });
        const espnSwid = validateString(body.espnSwid, 'espnSwid', { maxLength: 60, required: false, pattern: /^\{?[a-fA-F0-9-]+\}?$/ });
        if (espnS2) item.espnS2 = await encryptValue(espnS2);
        if (espnSwid) item.espnSwid = await encryptValue(espnSwid);
        // Persist encrypted creds on the league entry too so switching back works
        if (item.espnS2) leagueEntry.espnS2 = item.espnS2;
        if (item.espnSwid) leagueEntry.espnSwid = item.espnSwid;
      } else {
        const platformUserId = validateString(body.platformUserId, 'platformUserId', { maxLength: 50, pattern: /^[a-zA-Z0-9_-]+$/ });
        item.platformUserId = platformUserId;
        leagueEntry.platformUserId = platformUserId;
      }

      // Upsert into the leagues array
      const updatedLeagues = isNewLeague
        ? [...existingLeagues, leagueEntry]
        : existingLeagues.map(l => (l.leagueId === leagueId ? { ...l, ...leagueEntry } : l));
      item.leagues = updatedLeagues;

      await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'League connected successfully', leagues: updatedLeagues.map(stripLeagueSecrets) }) };
    }

    // GET /user/leagues - List all leagues for the user (no secrets)
    if (path.includes('/user/leagues') && method === 'GET') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const itm = result.Item || {};
      let leagues = Array.isArray(itm.leagues) ? itm.leagues : [];
      // Backfill: if user has an old single-league record but no leagues array, synthesize one
      if (leagues.length === 0 && itm.leagueId) {
        leagues = [{ leagueId: itm.leagueId, platform: itm.platform, leagueType: itm.leagueType || 'redraft', name: '' }];
      }
      return { statusCode: 200, headers, body: JSON.stringify({ leagues: leagues.map(stripLeagueSecrets), activeLeagueId: itm.activeLeagueId || itm.leagueId || null }) };
    }

    // POST /user/leagues/activate - Switch the active league
    if (path.includes('/user/leagues/activate') && method === 'POST') {
      const body = safeParseBody(event);
      const targetId = validateString(body.leagueId, 'leagueId', { maxLength: 30, pattern: /^[a-zA-Z0-9_-]+$/ });
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const itm = result.Item || {};
      const leagues = Array.isArray(itm.leagues) ? itm.leagues : [];
      const target = leagues.find(l => l.leagueId === targetId);
      if (!target) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'League not found' }) };
      }
      // Promote the target league to active (copy its fields to top level)
      const item = {
        ...itm,
        platform: target.platform,
        leagueId: target.leagueId,
        leagueType: target.leagueType || 'redraft',
        activeLeagueId: target.leagueId,
        updatedAt: new Date().toISOString()
      };
      delete item.espnS2;
      delete item.espnSwid;
      delete item.platformUserId;
      if (target.platform === 'espn') {
        if (target.espnS2) item.espnS2 = target.espnS2;
        if (target.espnSwid) item.espnSwid = target.espnSwid;
      } else if (target.platformUserId) {
        item.platformUserId = target.platformUserId;
      }
      await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, activeLeagueId: target.leagueId }) };
    }

    // DELETE /user/leagues - Remove a league (body: { leagueId })
    if (path.includes('/user/leagues') && method === 'DELETE') {
      const body = safeParseBody(event);
      const targetId = validateString(body.leagueId, 'leagueId', { maxLength: 30, pattern: /^[a-zA-Z0-9_-]+$/ });
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const itm = result.Item || {};
      const leagues = (Array.isArray(itm.leagues) ? itm.leagues : []).filter(l => l.leagueId !== targetId);
      const item = { ...itm, leagues, updatedAt: new Date().toISOString() };
      // If we removed the active league, promote the first remaining one (or clear)
      if (itm.activeLeagueId === targetId || itm.leagueId === targetId) {
        const next = leagues[0];
        if (next) {
          item.platform = next.platform;
          item.leagueId = next.leagueId;
          item.leagueType = next.leagueType || 'redraft';
          item.activeLeagueId = next.leagueId;
          delete item.espnS2; delete item.espnSwid; delete item.platformUserId;
          if (next.platform === 'espn') { if (next.espnS2) item.espnS2 = next.espnS2; if (next.espnSwid) item.espnSwid = next.espnSwid; }
          else if (next.platformUserId) item.platformUserId = next.platformUserId;
        } else {
          delete item.leagueId; delete item.activeLeagueId; delete item.platform;
          delete item.espnS2; delete item.espnSwid; delete item.platformUserId;
          item.active = false;
        }
      }
      await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, leagues: leagues.map(stripLeagueSecrets), activeLeagueId: item.activeLeagueId || null }) };
    }

    // GET /user/config - Get user's configuration (strip encrypted creds from response)
    if (path.includes('/user/config') && method === 'GET') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      if (!result.Item) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'User configuration not found' }) };
      }
      // Never return encrypted credentials to the frontend
      const safeItem = { ...result.Item };
      delete safeItem.espnS2;
      delete safeItem.espnSwid;
      if (safeItem.platform === 'espn') safeItem.espnConnected = true;
      return { statusCode: 200, headers, body: JSON.stringify(safeItem) };
    }

    // GET /analysis/latest - Get latest analysis
    if (path.includes('/analysis/latest') && method === 'GET') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      if (!result.Item || !result.Item.analysisData) {
        return { statusCode: 200, headers, body: JSON.stringify({ recommendations: [], analysis: null, message: 'No analysis available yet. Run the daily analyzer to generate recommendations.' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ...result.Item.analysisData, lastUpdated: result.Item.lastAnalysis }) };
    }

    // GET /roster - Get current roster
    if (path.includes('/roster') && method === 'GET') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      if (!result.Item || !result.Item.rosterData) {
        return { statusCode: 200, headers, body: JSON.stringify({ starters: [], bench: [], message: 'Roster data will be available after first analysis run.' }) };
      }
      const roster = result.Item.rosterData;
      return { statusCode: 200, headers, body: JSON.stringify({ platform: roster.platform, leagueId: roster.leagueId, players: roster.players || [], teamCount: roster.teamCount, lastUpdated: result.Item.lastAnalysis }) };
    }

    // POST /analysis/run - Trigger analysis with rate limiting
    if (path.includes('/analysis/run') && method === 'POST') {
      try {
        const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
        if (!result.Item) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'User configuration not found. Please set up your league first.' }) };
        }

        // Rate limiting: 5 minute cooldown
        const lastRunAt = result.Item.lastAnalysisRunAt;
        if (lastRunAt) {
          const elapsed = Date.now() - new Date(lastRunAt).getTime();
          if (elapsed < ANALYSIS_COOLDOWN_MS) {
            const retryAfter = Math.ceil((ANALYSIS_COOLDOWN_MS - elapsed) / 1000);
            return { statusCode: 429, headers: { ...headers, 'Retry-After': String(retryAfter) }, body: JSON.stringify({ error: 'Please wait before running another analysis.', retryAfter }) };
          }
        }

        // Tier limits
        const subscription = result.Item.subscription || { tier: 'free' };
        const effectiveTier = getEffectiveTier(subscription);
        const limits = TIER_LIMITS[effectiveTier];
        const analysisCount = result.Item.analysisCount || 0;

        if (analysisCount >= limits.analysisRuns) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Free tier limit reached. Upgrade to Pro for unlimited analysis.', limitReached: true, analysisCount, limit: limits.analysisRuns }) };
        }

        const body = safeParseBody(event);
        const requestedLeagueId = body.leagueId ? validateString(body.leagueId, 'leagueId', { maxLength: 30, pattern: /^[a-zA-Z0-9_-]+$/ }) : result.Item.leagueId;

        if (effectiveTier === 'free' && limits.leagues === 1) {
          const leagueHistory = result.Item.leagueHistory || [];
          if (requestedLeagueId && leagueHistory.length >= 1 && !leagueHistory.includes(requestedLeagueId)) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Free tier is limited to 1 league. Upgrade to Pro for unlimited leagues.', limitReached: true, leagueLimit: limits.leagues }) };
          }
        }

        // Update count, cooldown timestamp, and league history
        const updateExprParts = ['analysisCount = if_not_exists(analysisCount, :zero) + :one', 'lastAnalysisRunAt = :now'];
        const exprValues = { ':zero': 0, ':one': 1, ':now': new Date().toISOString() };

        if (requestedLeagueId) {
          const leagueHistory = result.Item.leagueHistory || [];
          if (!leagueHistory.includes(requestedLeagueId)) {
            updateExprParts.push('leagueHistory = list_append(if_not_exists(leagueHistory, :emptyList), :newLeague)');
            exprValues[':emptyList'] = [];
            exprValues[':newLeague'] = [requestedLeagueId];
          }
        }

        await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET ' + updateExprParts.join(', '), ExpressionAttributeValues: exprValues }));

        // Decrypt ESPN creds before passing to analyzer
        const userConfig = { ...result.Item };
        if (userConfig.espnS2) userConfig.espnS2 = await decryptValue(userConfig.espnS2);
        if (userConfig.espnSwid) userConfig.espnSwid = await decryptValue(userConfig.espnSwid);

        const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
        const lambdaClient = new LambdaClient({});
        const requestedWeek = validateNumber(body.week, 'week', { min: 1, max: 22, required: false });
        const requestedSeason = validateNumber(body.season, 'season', { min: 2020, max: 2030, required: false });

        const payload = { userId, triggerType: 'manual', userConfig, ...(requestedWeek && { weekOverride: requestedWeek }), ...(requestedSeason && { seasonOverride: requestedSeason }) };
        await lambdaClient.send(new InvokeCommand({ FunctionName: `fantasy-football-daily-analyzer-${process.env.ENVIRONMENT || 'dev'}`, InvocationType: 'Event', Payload: JSON.stringify(payload) }));

        return { statusCode: 200, headers, body: JSON.stringify({ message: 'Analysis started', status: 'running' }) };
      } catch (error) {
        if (error instanceof ValidationError) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
        console.error('Error triggering analysis:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to start analysis. Please try again.' }) };
      }
    }
   
 // POST /user/device - Register push notification device token
    if (path.includes('/user/device') && method === 'POST') {
      const body = safeParseBody(event);
      const deviceToken = validateString(body.deviceToken, 'deviceToken', { maxLength: 500 });
      const devicePlatform = validateEnum(validateString(body.platform, 'platform', { maxLength: 10 }), 'platform', VALID_DEVICE_PLATFORMS);

      let endpointArn = null;
      const snsAppArn = process.env.SNS_PLATFORM_APP_ARN;
      if (snsAppArn) {
        const { SNSClient, CreatePlatformEndpointCommand } = require('@aws-sdk/client-sns');
        const snsClient = new SNSClient({ region: process.env.REGION || 'us-east-1' });
        const snsResult = await snsClient.send(new CreatePlatformEndpointCommand({ PlatformApplicationArn: snsAppArn, Token: deviceToken, CustomUserData: userId }));
        endpointArn = snsResult.EndpointArn;
      }

      await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET deviceToken = :token, devicePlatform = :platform, snsEndpointArn = :arn, updatedAt = :now', ExpressionAttributeValues: { ':token': deviceToken, ':platform': devicePlatform, ':arn': endpointArn, ':now': new Date().toISOString() } }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, endpointArn }) };
    }

    // PUT /user/rulebook - Save league rulebook text
    if (path.includes('/user/rulebook') && method === 'PUT') {
      const body = safeParseBody(event);
      const rulebookText = validateString(body.rulebook, 'rulebook', { maxLength: 50000, required: false }) || '';
      await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET rulebook = :rb, updatedAt = :now', ExpressionAttributeValues: { ':rb': rulebookText, ':now': new Date().toISOString() } }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // PUT /user/preferences - Update notification preferences
    if (path.includes('/user/preferences') && method === 'PUT') {
      const body = safeParseBody(event);
      const prefs = {
        pushEnabled: validateBoolean(body.pushEnabled, 'pushEnabled', true),
        emailEnabled: validateBoolean(body.emailEnabled, 'emailEnabled', true),
        dailyAnalysis: validateBoolean(body.dailyAnalysis, 'dailyAnalysis', true),
        injuryAlerts: validateBoolean(body.injuryAlerts, 'injuryAlerts', true),
        waiverSuggestions: validateBoolean(body.waiverSuggestions, 'waiverSuggestions', false)
      };

      await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET preferences = :prefs, updatedAt = :now', ExpressionAttributeValues: { ':prefs': prefs, ':now': new Date().toISOString() } }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET /user/subscription - Get subscription tier
    if (path.includes('/user/subscription') && !path.includes('/cancel') && !path.includes('/verify') && method === 'GET') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const sub = result.Item?.subscription || { tier: 'free', expiresAt: null };
      return { statusCode: 200, headers, body: JSON.stringify(sub) };
    }

    // POST /user/subscription/cancel - Cancel subscription
    if (path.includes('/user/subscription/cancel') && method === 'POST') {
      const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
      const subscription = result.Item?.subscription;

      if (!subscription || subscription.status === 'none' || subscription.status === 'expired' || !subscription.status) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No active subscription to cancel' }) };
      }
      if (subscription.status === 'cancelled') {
        return { statusCode: 200, headers, body: JSON.stringify(subscription) };
      }

      const startedAt = subscription.startedAt ? new Date(subscription.startedAt) : new Date();
      const periodEndDate = new Date(startedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const updatedSubscription = { ...subscription, status: 'cancelled', cancelledAt: new Date().toISOString(), periodEndDate: periodEndDate.toISOString() };

      await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET subscription = :sub, updatedAt = :now', ExpressionAttributeValues: { ':sub': updatedSubscription, ':now': new Date().toISOString() } }));
      return { statusCode: 200, headers, body: JSON.stringify(updatedSubscription) };
    }

    // POST /user/subscription/verify - Verify Apple IAP receipt (with server-side validation stub)
    if (path.includes('/user/subscription/verify') && method === 'POST') {
      const body = safeParseBody(event);
      const transactionId = validateString(body.transactionId, 'transactionId', { maxLength: 200 });
      const productId = validateEnum(validateString(body.productId, 'productId', { maxLength: 100 }), 'productId', VALID_APPLE_PRODUCTS);
      const originalTransactionId = validateString(body.originalTransactionId, 'originalTransactionId', { maxLength: 200, required: false }) || transactionId;

      const tierMap = { 'com.helixastra.helixsideline.pro.monthly': 'pro', 'com.helixastra.helixsideline.elite.monthly': 'elite' };
      const tier = tierMap[productId];

      // TODO: Validate with Apple App Store Server API v2
      // 1. Verify the signed transaction JWT using Apple's public key
      // 2. Confirm the transaction belongs to this user
      // 3. Check the transaction hasn't been revoked
      // For now, store as pending verification and log for manual review
      const verified = false;
      console.warn(`IAP verification pending — userId: ${userId}, transactionId: ${transactionId}, productId: ${productId}`);

      await docClient.send(new UpdateCommand({ TableName: tableName, Key: { userId }, UpdateExpression: 'SET subscription = :sub, updatedAt = :now', ExpressionAttributeValues: { ':sub': { tier, status: verified ? 'active' : 'pending_verification', productId, transactionId, originalTransactionId, verified, startedAt: new Date().toISOString() }, ':now': new Date().toISOString() } }));
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, tier, status: verified ? 'active' : 'pending_verification', verified }) };
    }

    // POST /chat - Dynasty AI advisor chat
    if (path.includes('/chat') && method === 'POST') {
      try {
        const body = safeParseBody(event);
        const message = validateString(body.message, 'message', { maxLength: 2000 });
        const context = body.context || {};

        // Get user data for context
        const result = await docClient.send(new GetCommand({ TableName: tableName, Key: { userId } }));
        const userData = result.Item || {};

        // Build context for the AI
        const analysisData = context.analysis || userData.analysisData || {};
        const rosterData = userData.rosterData || {};
        const conversationHistory = (context.conversationHistory || []).slice(-8);
        const rulebookData = userData.rulebook || '';

        const startersStr = (rosterData.starters || []).map(p => p.name + ' (' + p.position + ', ' + p.team + ', age ' + (p.age || '?') + ')').join(', ') || 'Not loaded';
        const benchStr = (rosterData.bench || []).map(p => p.name + ' (' + p.position + ', ' + p.team + ', age ' + (p.age || '?') + ')').join(', ') || 'Not loaded';
        const recsStr = JSON.stringify((analysisData.recommendations || []).slice(0, 5).map(r => r.text));
        const dynastyStr = JSON.stringify(analysisData.dynastyTradeInsights || 'Not available');
        const draftOwnedStr = JSON.stringify(rosterData.draftCapital?.owned || []);
        const draftTradedStr = JSON.stringify(rosterData.draftCapital?.tradedAway || []);

        const systemPrompt = `You are a dynasty fantasy football advisor for Helix Sideline. You specialize in dynasty/keeper league strategy on Sleeper.

Your user's team data:
- Team: ${rosterData.teamName || 'Unknown'}
- Record: ${rosterData.record || 'N/A'}
- Platform: Sleeper (Dynasty League)
- League: ${rosterData.leagueName || 'Dynasty League'}

Their roster starters: ${startersStr}

Their bench: ${benchStr}

Draft Capital Owned From Others: ${draftOwnedStr}
Draft Capital Traded Away: ${draftTradedStr}

Latest analysis recommendations: ${recsStr}

Dynasty trade insights: ${dynastyStr}

Be conversational, specific, and strategic. Reference their actual players by name. For dynasty advice, consider player age, long-term value, win-now vs rebuild decisions, and draft pick values. Keep responses concise but insightful.

IMPORTANT: Do NOT use markdown formatting. No asterisks, no ## headers, no bold/italic markers. Use plain text only. Use line breaks and dashes for lists. Use ALL CAPS for section headers if needed.${rulebookData ? '\n\nLEAGUE RULEBOOK (use this for rule-specific questions):\n' + rulebookData.slice(0, 8000) : ''}`;

        const messages = [];
        conversationHistory.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
        messages.push({ role: 'user', content: message });

        const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
        const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

        const chatModelId = 'us.anthropic.claude-sonnet-4-6';
        const command = new InvokeModelCommand({
          modelId: chatModelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1500,
            system: systemPrompt,
            messages: messages,
            temperature: 0.7
          })
        });

        const response = await bedrock.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const aiResponse = responseBody.content[0].text;

        return { statusCode: 200, headers, body: JSON.stringify({ response: aiResponse }) };
      } catch (error) {
        console.error('Chat error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Chat failed', response: 'Sorry, I had trouble processing that. Try again.' }) };
      }
    }

    // DELETE /user/account - Delete user account and data
    if (path.includes('/user/account') && method === 'DELETE') {
      try {
        // Delete user data from DynamoDB
        await docClient.send(new DeleteCommand({ TableName: tableName, Key: { userId } }));

        // Disable user in Cognito
        const { CognitoIdentityProviderClient, AdminDisableUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
        const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION || 'us-east-1' });
        const userPoolId = process.env.USER_POOL_ID;
        if (userPoolId) {
          const username = event.requestContext?.authorizer?.claims?.['cognito:username'] || event.requestContext?.authorizer?.claims?.email;
          if (username) {
            await cognitoClient.send(new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username }));
          }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Account deleted' }) };
      } catch (error) {
        console.error('Error deleting account:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to delete account' }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    if (error instanceof ValidationError) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }, body: JSON.stringify({ error: error.message }) };
    }
    console.error('Error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};