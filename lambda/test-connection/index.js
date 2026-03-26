const AWS = require('aws-sdk');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const { platform, leagueId, platformUserId, espnS2, espnSwid } = JSON.parse(event.body);

        let testResult;
        
        if (platform === 'sleeper') {
            testResult = await testSleeperConnection(leagueId, platformUserId);
        } else if (platform === 'espn') {
            testResult = await testEspnConnection(leagueId, espnS2, espnSwid);
        } else {
            throw new Error('Unsupported platform');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                leagueInfo: testResult
            })
        };

    } catch (error) {
        console.error('Connection test failed:', error);
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message || 'Connection test failed'
            })
        };
    }
};

async function testSleeperConnection(leagueId, userId) {
    try {
        // Test league access
        const leagueResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
        if (!leagueResponse.ok) {
            throw new Error('League not found or not accessible');
        }
        const leagueData = await leagueResponse.json();

        // Test user access
        const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
        if (!usersResponse.ok) {
            throw new Error('Unable to fetch league users');
        }
        const users = await usersResponse.json();
        
        const user = users.find(u => u.user_id === userId);
        if (!user) {
            throw new Error('User not found in this league');
        }

        // Test roster access
        const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
        if (!rostersResponse.ok) {
            throw new Error('Unable to fetch league rosters');
        }
        const rosters = await rostersResponse.json();
        
        const userRoster = rosters.find(r => r.owner_id === userId);
        if (!userRoster) {
            throw new Error('No roster found for this user');
        }

        return {
            leagueName: leagueData.name,
            season: leagueData.season,
            totalRosters: leagueData.total_rosters,
            userName: user.display_name,
            rosterSize: userRoster.players?.length || 0
        };

    } catch (error) {
        throw new Error(`Sleeper connection failed: ${error.message}`);
    }
}

async function testEspnConnection(leagueId, espnS2, espnSwid) {
    try {
        const currentYear = new Date().getFullYear();
        const url = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${currentYear}/segments/0/leagues/${leagueId}`;
        
        const headers = {
            'Cookie': `espn_s2=${espnS2}; SWID=${espnSwid}`
        };

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid ESPN cookies or league is private');
            }
            throw new Error(`ESPN API error: ${response.status}`);
        }

        const leagueData = await response.json();
        
        // Find the user's team
        const teams = leagueData.teams || [];
        const userTeam = teams.find(team => 
            team.owners && team.owners.some(owner => owner.includes(espnSwid.replace(/[{}]/g, '')))
        );

        if (!userTeam) {
            throw new Error('Your team not found in this league');
        }

        return {
            leagueName: leagueData.settings?.name || 'ESPN League',
            season: leagueData.seasonId,
            totalTeams: teams.length,
            teamName: userTeam.name || userTeam.location + ' ' + userTeam.nickname,
            teamId: userTeam.id
        };

    } catch (error) {
        throw new Error(`ESPN connection failed: ${error.message}`);
    }
}