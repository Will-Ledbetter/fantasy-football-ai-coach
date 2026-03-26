/**
 * Fetch Fantasy Roster
 * Retrieves user's roster from their fantasy platform
 */

const https = require('https');

exports.handler = async (event) => {
  const { userId, platform, leagueId, espnS2, espnSwid, platformUserId } = event;
  
  console.log(`Fetching roster for user ${userId} from ${platform}`);
  
  try {
    let roster;
    
    if (platform === 'sleeper') {
      roster = await fetchSleeperRoster(leagueId, platformUserId);
    } else if (platform === 'espn') {
      roster = await fetchESPNRoster(leagueId, espnS2, espnSwid);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify(roster)
    };
    
  } catch (error) {
    console.error('Error fetching roster:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function fetchSleeperRoster(leagueId, userId) {
  // Get rosters for the league
  const rosters = await makeRequest(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
  
  // Find user's roster
  const userRoster = rosters.find(r => r.owner_id === userId);
  
  if (!userRoster) {
    throw new Error('User roster not found');
  }
  
  // Get player details
  const players = await makeRequest('https://api.sleeper.app/v1/players/nfl');
  
  // Map roster to player details
  const rosterPlayers = userRoster.players.map(playerId => {
    const player = players[playerId];
    return {
      playerId: playerId,
      name: `${player.first_name} ${player.last_name}`,
      position: player.position,
      team: player.team,
      status: player.injury_status || 'healthy'
    };
  });
  
  return {
    leagueId: leagueId,
    userId: userId,
    players: rosterPlayers,
    starters: userRoster.starters,
    bench: userRoster.players.filter(p => !userRoster.starters.includes(p))
  };
}

async function fetchESPNRoster(leagueId, espnS2, espnSwid) {
  const year = new Date().getFullYear();
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mRoster&view=mTeam&view=mSchedule&view=mMatchup`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Cookie': `espn_s2=${espnS2}; SWID=${espnSwid}`
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const league = JSON.parse(data);
          const teams = league.teams || [];
          const schedule = league.schedule || [];
          
          // Try multiple methods to find the user's team
          let userTeam = null;
          
          // Method 1: Match by SWID in owners array
          if (espnSwid) {
            userTeam = teams.find(team => 
              team.owners && team.owners.some(owner => owner === espnSwid)
            );
          }
          
          // Method 2: If SWID doesn't work, try to find by primaryOwner
          if (!userTeam && espnSwid) {
            userTeam = teams.find(team => team.primaryOwner === espnSwid);
          }
          
          // Method 3: If still not found, use the first team with a roster (fallback)
          if (!userTeam) {
            console.log('Could not find user team by SWID, using first team with roster as fallback');
            userTeam = teams.find(team => team.roster && team.roster.entries && team.roster.entries.length > 0);
          }
          
          // Method 4: Last resort - use first team
          if (!userTeam) {
            console.log('Using first team as last resort');
            userTeam = teams[0];
          }
          
          if (!userTeam) {
            throw new Error('No teams found in league');
          }
          
          // Find current week's opponent
          const currentWeek = getCurrentWeek();
          const currentMatchup = schedule.find(matchup => 
            matchup.matchupPeriodId === currentWeek &&
            (matchup.home?.teamId === userTeam.id || matchup.away?.teamId === userTeam.id)
          );
          
          let opponent = null;
          if (currentMatchup) {
            const opponentId = currentMatchup.home?.teamId === userTeam.id 
              ? currentMatchup.away?.teamId 
              : currentMatchup.home?.teamId;
            opponent = teams.find(team => team.id === opponentId);
          }
          
          resolve(processUserTeamWithOpponent(userTeam, opponent, leagueId, teams.length, currentWeek));
          
        } catch (error) {
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
}

function processUserTeamWithOpponent(team, opponent, leagueId, teamCount, currentWeek) {
  const players = [];
  const starters = [];
  const bench = [];
  
  if (team.roster && team.roster.entries) {
    team.roster.entries.forEach(entry => {
      const player = entry.playerPoolEntry?.player;
      const playerData = {
        playerId: entry.playerId,
        name: player?.fullName || 'Unknown',
        position: getPositionName(player?.defaultPositionId),
        team: getTeamName(player?.proTeamId),
        status: player?.injuryStatus || 'ACTIVE',
        lineupSlot: entry.lineupSlotId
      };
      
      players.push(playerData);
      
      // Check if player is in starting lineup
      // lineupSlotId 20 = Bench, 21 = IR, others are starting positions
      if (entry.lineupSlotId < 20) {
        starters.push(playerData);
      } else {
        bench.push(playerData);
      }
    });
  }
  
  // Process opponent data
  let opponentData = null;
  if (opponent) {
    const opponentPlayers = [];
    const opponentStarters = [];
    
    if (opponent.roster && opponent.roster.entries) {
      opponent.roster.entries.forEach(entry => {
        const player = entry.playerPoolEntry?.player;
        const playerData = {
          playerId: entry.playerId,
          name: player?.fullName || 'Unknown',
          position: getPositionName(player?.defaultPositionId),
          team: getTeamName(player?.proTeamId),
          status: player?.injuryStatus || 'ACTIVE',
          lineupSlot: entry.lineupSlotId
        };
        
        opponentPlayers.push(playerData);
        
        if (entry.lineupSlotId < 20) {
          opponentStarters.push(playerData);
        }
      });
    }
    
    // Safely construct opponent team name
    let opponentName = 'Opponent';
    if (opponent.location && opponent.nickname) {
      opponentName = `${opponent.location} ${opponent.nickname}`;
    } else if (opponent.location) {
      opponentName = opponent.location;
    } else if (opponent.nickname) {
      opponentName = opponent.nickname;
    }
    
    // Safely get opponent record
    let opponentRecord = 'N/A';
    if (opponent.record && opponent.record.overall) {
      opponentRecord = `${opponent.record.overall.wins || 0}-${opponent.record.overall.losses || 0}`;
    }
    
    opponentData = {
      teamName: opponentName,
      record: opponentRecord,
      players: opponentPlayers,
      starters: opponentStarters
    };
  }
  
  // Safely construct team name
  let teamName = 'My Team';
  if (team.location && team.nickname) {
    teamName = `${team.location} ${team.nickname}`;
  } else if (team.location) {
    teamName = team.location;
  } else if (team.nickname) {
    teamName = team.nickname;
  } else if (team.name) {
    teamName = team.name;
  }
  
  // Safely get record
  let record = 'N/A';
  if (team.record && team.record.overall) {
    record = `${team.record.overall.wins || 0}-${team.record.overall.losses || 0}`;
  }
  
  return {
    leagueId: leagueId,
    platform: 'espn',
    teamName: teamName,
    players: players,
    starters: starters,
    bench: bench,
    teamCount: teamCount,
    record: record,
    currentWeek: currentWeek,
    opponent: opponentData
  };
}

// Keep the old function for backward compatibility
function processUserTeam(team, leagueId, teamCount) {
  return processUserTeamWithOpponent(team, null, leagueId, teamCount, getCurrentWeek());
}

function getPositionName(posId) {
  const positions = {
    0: 'QB', 1: 'TQB', 2: 'RB', 3: 'RB/WR', 4: 'WR',
    5: 'WR/TE', 6: 'TE', 7: 'OP', 8: 'DT', 9: 'DE',
    10: 'LB', 11: 'DL', 12: 'CB', 13: 'S', 14: 'DB',
    15: 'DP', 16: 'D/ST', 17: 'K', 18: 'P', 19: 'HC',
    20: 'BE', 21: 'IR', 22: '', 23: 'RB/WR/TE', 24: 'ER', 25: 'Rookie'
  };
  return positions[posId] || 'Unknown';
}

function getTeamName(teamId) {
  const teams = {
    0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE',
    6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN',
    11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
    16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ',
    21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF',
    26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX',
    33: 'BAL', 34: 'HOU'
  };
  return teams[teamId] || 'FA';
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

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
}
