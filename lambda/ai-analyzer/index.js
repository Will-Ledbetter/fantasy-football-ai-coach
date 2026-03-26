const AWS = require('aws-sdk');
const bedrock = new AWS.BedrockRuntime({ region: 'us-east-1' });

exports.handler = async (event) => {
  const { roster, playerData, webResearch, weekNumber } = event;
  console.log(`AI analyzing roster for week ${weekNumber} with enhanced data and free agent suggestions`);
  
  try {
    // Combine all data sources for comprehensive analysis
    const enhancedRoster = enrichRosterWithData(roster, playerData, webResearch);
    
    // Generate AI-powered analysis using Claude
    const aiAnalysis = await generateAIAnalysis(enhancedRoster, weekNumber);
    
    // Create detailed recommendations
    const smartRecommendations = await generateSmartRecommendations(enhancedRoster, weekNumber);
    
    // Generate lineup optimizations
    const lineupOptimizations = generateLineupOptimizations(enhancedRoster, weekNumber);
    
    // Create waiver wire targets
    const waiverTargets = generateWaiverWireTargets(enhancedRoster, weekNumber);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        weekNumber,
        analysis: aiAnalysis,
        recommendations: smartRecommendations,
        lineupOptimizations,
        waiverTargets,
        dataQuality: assessDataQuality(playerData, webResearch),
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in AI analysis:', error);
    
    // Fallback to basic analysis if AI fails
    const basicAnalysis = createSmartAnalysis(roster, weekNumber);
    const basicRecommendations = createRecommendations(roster, weekNumber);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        weekNumber,
        analysis: basicAnalysis,
        recommendations: basicRecommendations,
        fallback: true,
        error: error.message
      })
    };
  }
};

function createSmartAnalysis(roster, weekNumber) {
  const playerCount = roster.players?.length || 0;
  const starters = roster.starters?.length || 0;
  const bench = roster.bench?.length || 0;
  
  // Analyze YOUR team specifically
  const injuredPlayers = roster.players?.filter(p => 
    p.status && p.status !== 'ACTIVE' && p.status !== 'healthy'
  ) || [];
  
  // Get YOUR players by position with detailed info
  const qbs = roster.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
  const rbs = roster.starters?.filter(p => p.position === 'RB') || [];
  const wrs = roster.starters?.filter(p => p.position === 'WR') || [];
  const tes = roster.starters?.filter(p => p.position === 'TE') || [];
  const kickers = roster.starters?.filter(p => p.position === 'K') || [];
  const defenses = roster.starters?.filter(p => p.position === 'D/ST') || [];
  
  // Get bench players by position
  const benchQBs = roster.bench?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
  const benchRBs = roster.bench?.filter(p => p.position === 'RB') || [];
  const benchWRs = roster.bench?.filter(p => p.position === 'WR') || [];
  const benchTEs = roster.bench?.filter(p => p.position === 'TE') || [];
  
  let analysis = `🏈 Week ${weekNumber} - DETAILED TEAM ANALYSIS\n\n`;
  
  if (roster.teamName && roster.teamName !== 'My Team') {
    analysis += `🏆 TEAM: ${roster.teamName}\n`;
  }
  if (roster.record && roster.record !== 'N/A') {
    analysis += `📈 RECORD: ${roster.record}\n`;
  }
  
  // Add opponent matchup info
  if (roster.opponent) {
    analysis += `⚔️ OPPONENT: ${roster.opponent.teamName} (${roster.opponent.record})\n`;
  }
  
  analysis += `📊 ROSTER: ${playerCount} players (${starters} starters, ${bench} bench)\n\n`;
  
  // Head-to-head matchup analysis
  if (roster.opponent) {
    analysis += `⚔️ HEAD-TO-HEAD MATCHUP ANALYSIS:\n`;
    analysis += analyzeMatchup(roster, roster.opponent);
    analysis += `\n`;
  }
  
  // DETAILED Starting lineup analysis with teams and insights
  analysis += `🎯 YOUR STARTING LINEUP BREAKDOWN:\n`;
  
  if (qbs.length > 0) {
    analysis += `📍 QUARTERBACK:\n`;
    qbs.forEach(qb => {
      analysis += `  • ${qb.name} (${qb.team || 'N/A'}) - ${getPlayerInsight(qb, 'QB', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  if (rbs.length > 0) {
    analysis += `🏃 RUNNING BACKS:\n`;
    rbs.forEach(rb => {
      analysis += `  • ${rb.name} (${rb.team || 'N/A'}) - ${getPlayerInsight(rb, 'RB', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  if (wrs.length > 0) {
    analysis += `🎯 WIDE RECEIVERS:\n`;
    wrs.forEach(wr => {
      analysis += `  • ${wr.name} (${wr.team || 'N/A'}) - ${getPlayerInsight(wr, 'WR', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  if (tes.length > 0) {
    analysis += `🎪 TIGHT ENDS:\n`;
    tes.forEach(te => {
      analysis += `  • ${te.name} (${te.team || 'N/A'}) - ${getPlayerInsight(te, 'TE', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  if (kickers.length > 0) {
    analysis += `🦵 KICKER:\n`;
    kickers.forEach(k => {
      analysis += `  • ${k.name} (${k.team || 'N/A'}) - ${getPlayerInsight(k, 'K', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  if (defenses.length > 0) {
    analysis += `🛡️ DEFENSE:\n`;
    defenses.forEach(def => {
      analysis += `  • ${def.name} - ${getPlayerInsight(def, 'D/ST', weekNumber)}\n`;
    });
    analysis += `\n`;
  }
  
  // BENCH ANALYSIS with specific recommendations
  if (roster.bench && roster.bench.length > 0) {
    analysis += `🪑 BENCH ANALYSIS & OPPORTUNITIES:\n`;
    
    if (benchQBs.length > 0) {
      analysis += `  📍 Backup QBs: ${benchQBs.map(p => `${p.name} (${p.team})`).join(', ')}\n`;
    }
    if (benchRBs.length > 0) {
      analysis += `  🏃 Bench RBs: `;
      benchRBs.forEach((rb, index) => {
        analysis += `${rb.name} (${rb.team}) - ${getBenchInsight(rb, 'RB')}`;
        if (index < benchRBs.length - 1) analysis += `, `;
      });
      analysis += `\n`;
    }
    if (benchWRs.length > 0) {
      analysis += `  🎯 Bench WRs: `;
      benchWRs.forEach((wr, index) => {
        analysis += `${wr.name} (${wr.team}) - ${getBenchInsight(wr, 'WR')}`;
        if (index < benchWRs.length - 1) analysis += `, `;
      });
      analysis += `\n`;
    }
    if (benchTEs.length > 0) {
      analysis += `  🎪 Bench TEs: ${benchTEs.map(p => `${p.name} (${p.team}) - ${getBenchInsight(p, 'TE')}`).join(', ')}\n`;
    }
    analysis += `\n`;
  }
  
  if (injuredPlayers.length > 0) {
    analysis += `🚨 INJURY REPORT & IMPACT:\n`;
    injuredPlayers.forEach(player => {
      const isStarter = roster.starters?.some(s => s.playerId === player.playerId);
      const impact = isStarter ? 'CRITICAL - Starting lineup affected' : 'Monitor for depth concerns';
      analysis += `  • ${player.name} (${player.team || 'N/A'} ${player.position}) - ${player.status}\n`;
      analysis += `    Impact: ${impact}\n`;
    });
    analysis += `\n`;
  }
  
  // TEAM STRENGTHS AND WEAKNESSES
  analysis += `💪 TEAM STRENGTHS & WEAKNESSES:\n`;
  analysis += analyzeTeamStrengths(roster, qbs, rbs, wrs, tes, benchQBs, benchRBs, benchWRs, benchTEs);
  analysis += `\n`;
  
  // WEEKLY STRATEGY BASED ON ROSTER COMPOSITION
  analysis += `🎯 WEEK ${weekNumber} STRATEGIC FOCUS:\n`;
  analysis += getWeeklyStrategy(roster, weekNumber, qbs, rbs, wrs, tes);
  
  return analysis;
}

function analyzeMatchup(userRoster, opponent) {
  let matchupAnalysis = '';
  
  // Compare team strengths
  const userQBs = userRoster.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
  const opponentQBs = opponent.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
  
  const userRBs = userRoster.starters?.filter(p => p.position === 'RB') || [];
  const opponentRBs = opponent.starters?.filter(p => p.position === 'RB') || [];
  
  const userWRs = userRoster.starters?.filter(p => p.position === 'WR') || [];
  const opponentWRs = opponent.starters?.filter(p => p.position === 'WR') || [];
  
  // Analyze positional advantages
  matchupAnalysis += `• QB Battle: You (${userQBs.map(p => p.name).join(', ')}) vs Them (${opponentQBs.map(p => p.name).join(', ')})\n`;
  matchupAnalysis += `• RB Depth: You have ${userRBs.length} vs Their ${opponentRBs.length} starting RBs\n`;
  matchupAnalysis += `• WR Corps: You have ${userWRs.length} vs Their ${opponentWRs.length} starting WRs\n`;
  
  // Strategic recommendations based on matchup
  if (userRBs.length > opponentRBs.length) {
    matchupAnalysis += `• ADVANTAGE: Your RB depth gives you an edge - start your best RBs\n`;
  }
  if (userWRs.length > opponentWRs.length) {
    matchupAnalysis += `• ADVANTAGE: Your WR depth is superior - consider high-upside plays\n`;
  }
  
  // Check for same-team players (stack opportunities)
  const userTeams = new Set(userRoster.starters?.map(p => p.team) || []);
  const opponentTeams = new Set(opponent.starters?.map(p => p.team) || []);
  const sharedTeams = [...userTeams].filter(team => opponentTeams.has(team));
  
  if (sharedTeams.length > 0) {
    matchupAnalysis += `• STACK OPPORTUNITY: Both teams have players from ${sharedTeams.join(', ')} - consider game script\n`;
  }
  
  return matchupAnalysis;
}

function createRecommendations(roster, weekNumber) {
  const recommendations = [];
  
  // Get YOUR specific players with detailed analysis
  const injuredPlayers = roster.players?.filter(p => 
    p.status && p.status !== 'ACTIVE' && p.status !== 'healthy'
  ) || [];
  
  const injuredStarters = injuredPlayers.filter(p => 
    roster.starters?.some(s => s.playerId === p.playerId)
  );
  
  const qbs = (roster.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [])
    .concat(roster.bench?.filter(p => p.position === 'QB' || p.position === 'TQB') || []);
  const rbs = (roster.starters?.filter(p => p.position === 'RB') || [])
    .concat(roster.bench?.filter(p => p.position === 'RB') || []);
  const wrs = (roster.starters?.filter(p => p.position === 'WR') || [])
    .concat(roster.bench?.filter(p => p.position === 'WR') || []);
  const tes = (roster.starters?.filter(p => p.position === 'TE') || [])
    .concat(roster.bench?.filter(p => p.position === 'TE') || []);
  
  // 1. CRITICAL: Injured starters with specific replacement advice
  if (injuredStarters.length > 0) {
    injuredStarters.forEach(injured => {
      const benchReplacements = roster.bench?.filter(p => 
        p.position === injured.position && p.status === 'ACTIVE'
      ) || [];
      
      let replacementText = `🚨 CRITICAL: ${injured.name} (${injured.team} ${injured.position}) is ${injured.status}. `;
      
      if (benchReplacements.length > 0) {
        replacementText += `Replace with ${benchReplacements[0].name} (${benchReplacements[0].team}) from your bench.`;
      } else {
        replacementText += `No bench replacement available - prioritize waiver wire ${injured.position}s immediately.`;
      }
      
      recommendations.push({
        type: 'Critical Injury Alert',
        priority: 'high',
        text: replacementText
      });
    });
  }
  
  // 2. LINEUP OPTIMIZATION with specific player comparisons
  const benchPlayers = roster.bench?.filter(p => 
    (p.status === 'ACTIVE' || !p.status) && !['K', 'D/ST'].includes(p.position)
  ) || [];
  
  if (benchPlayers.length > 0) {
    // Find potential starter upgrades
    const startersByPosition = {
      'QB': roster.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [],
      'RB': roster.starters?.filter(p => p.position === 'RB') || [],
      'WR': roster.starters?.filter(p => p.position === 'WR') || [],
      'TE': roster.starters?.filter(p => p.position === 'TE') || []
    };
    
    benchPlayers.slice(0, 2).forEach(benchPlayer => {
      const positionStarters = startersByPosition[benchPlayer.position] || [];
      if (positionStarters.length > 0) {
        recommendations.push({
          type: 'Lineup Optimization',
          priority: 'high',
          text: `💡 LINEUP DECISION: Consider ${benchPlayer.name} (${benchPlayer.team} ${benchPlayer.position}) over ${positionStarters[positionStarters.length - 1]?.name} based on matchups and recent usage.`
        });
      }
    });
  }
  
  // 3. Head-to-Head Matchup Strategy with player names
  if (roster.opponent) {
    const userQBs = roster.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
    const userRBs = roster.starters?.filter(p => p.position === 'RB') || [];
    const userWRs = roster.starters?.filter(p => p.position === 'WR') || [];
    
    const opponentQBs = roster.opponent.starters?.filter(p => p.position === 'QB' || p.position === 'TQB') || [];
    const opponentRBs = roster.opponent.starters?.filter(p => p.position === 'RB') || [];
    
    let matchupText = `⚔️ MATCHUP STRATEGY vs ${roster.opponent.teamName}: `;
    
    if (userRBs.length > opponentRBs.length) {
      matchupText += `Your RB advantage (${userRBs.map(p => p.name).join(', ')}) should provide a solid floor. `;
    } else if (opponentRBs.length > userRBs.length) {
      matchupText += `They have RB depth advantage - lean on ${userWRs.slice(0,2).map(p => p.name).join(' & ')} for ceiling plays. `;
    }
    
    if (userQBs.length > 0 && opponentQBs.length > 0) {
      matchupText += `QB battle: ${userQBs[0].name} vs ${opponentQBs[0].name} - target favorable game scripts.`;
    }
    
    recommendations.push({
      type: 'Head-to-Head Strategy',
      priority: 'high',
      text: matchupText
    });
  }
  
  // 4. WAIVER WIRE TARGETS with specific position needs
  const waiverTargets = [];
  
  if (qbs.length < 2) {
    const currentQB = qbs[0]?.name || 'your QB';
    waiverTargets.push({
      position: 'QB',
      text: `🎯 QB DEPTH: Add a backup QB to protect against ${currentQB} injury/bye. Target QBs with upcoming soft schedules.`
    });
  }
  
  if (rbs.length < 4) {
    const startingRBs = roster.starters?.filter(p => p.position === 'RB').map(p => p.name) || [];
    waiverTargets.push({
      position: 'RB',
      text: `🏃 RB DEPTH CRITICAL: Only ${rbs.length} RBs rostered. Target handcuffs for ${startingRBs.join('/')} or emerging committee backs.`
    });
  }
  
  if (wrs.length < 5) {
    waiverTargets.push({
      position: 'WR',
      text: `🎯 WR DEPTH NEEDED: Target WRs with increasing snap counts, red zone looks, or those benefiting from injuries to teammates.`
    });
  }
  
  if (tes.length < 2) {
    const currentTE = tes[0]?.name || 'your TE';
    waiverTargets.push({
      position: 'TE',
      text: `🎪 TE INSURANCE: Add TE depth behind ${currentTE}. Look for TEs with red zone usage or favorable upcoming matchups.`
    });
  }
  
  waiverTargets.forEach(target => {
    recommendations.push({
      type: `${target.position} Waiver Priority`,
      priority: 'medium',
      text: target.text
    });
  });
  
  // 5. WEEKLY STRATEGY based on your specific roster
  let weeklyStrategy = `📈 WEEK ${weekNumber} FOCUS: `;
  
  if (weekNumber >= 15) {
    const coreStarters = [
      ...(roster.starters?.filter(p => p.position === 'QB') || []),
      ...(roster.starters?.filter(p => p.position === 'RB').slice(0,2) || []),
      ...(roster.starters?.filter(p => p.position === 'WR').slice(0,2) || [])
    ];
    weeklyStrategy += `Playoff time - start your proven studs (${coreStarters.map(p => p.name).join(', ')}) over risky boom-bust options.`;
  } else if (weekNumber >= 12) {
    weeklyStrategy += `Late season - monitor snap counts for rest risk, especially for players on locked playoff teams.`;
  } else {
    weeklyStrategy += `Regular season - balance floor and ceiling based on your matchup needs.`;
  }
  
  if (roster.opponent) {
    const opponentRecord = roster.opponent.record || '';
    if (opponentRecord.includes('-0') || opponentRecord.includes('-1')) {
      weeklyStrategy += ` Against strong ${roster.opponent.teamName}, consider high-upside plays.`;
    } else if (opponentRecord.includes('0-') || opponentRecord.includes('1-')) {
      weeklyStrategy += ` Against struggling ${roster.opponent.teamName}, your reliable starters should suffice.`;
    }
  }
  
  recommendations.push({
    type: 'Weekly Game Plan',
    priority: 'medium',
    text: weeklyStrategy
  });
  
  // 6. TRADE OPPORTUNITIES with specific player suggestions
  if (roster.bench && roster.bench.length > 6) {
    const tradeCandidates = roster.bench.filter(p => 
      !['K', 'D/ST'].includes(p.position) && (p.status === 'ACTIVE' || !p.status)
    ).slice(0, 3);
    
    if (tradeCandidates.length >= 2) {
      recommendations.push({
        type: 'Trade Opportunity',
        priority: 'low',
        text: `🔄 TRADE PACKAGE: Consider bundling ${tradeCandidates.slice(0,2).map(p => `${p.name} (${p.position})`).join(' + ')} to upgrade a starter position before trade deadlines.`
      });
    }
  }
  
  // 7. STACK OPPORTUNITIES
  const starterTeams = roster.starters?.reduce((acc, player) => {
    if (player.team) {
      acc[player.team] = acc[player.team] || [];
      acc[player.team].push(player);
    }
    return acc;
  }, {}) || {};
  
  Object.entries(starterTeams).forEach(([team, players]) => {
    if (players.length >= 2) {
      const qbInStack = players.find(p => p.position === 'QB');
      const nonQBs = players.filter(p => p.position !== 'QB');
      
      if (qbInStack && nonQBs.length > 0) {
        recommendations.push({
          type: 'Stack Strategy',
          priority: 'low',
          text: `🔗 ${team} STACK: ${qbInStack.name} + ${nonQBs.map(p => p.name).join('/')} - high ceiling if ${team} has a big offensive game.`
        });
      }
    }
  });
  
  return recommendations;
}

function getPlayerInsight(player, position, weekNumber) {
  const status = player.status || 'ACTIVE';
  const team = player.team || 'N/A';
  
  // Base insights by position
  const insights = {
    'QB': [
      'Strong arm talent with rushing upside',
      'Pocket passer with high completion rate', 
      'Dual-threat QB with rushing floor',
      'Veteran presence with red zone efficiency',
      'Young QB with high ceiling potential'
    ],
    'RB': [
      'Workhorse back with goal line carries',
      'Pass-catching specialist with PPR value',
      'Power runner in strong offensive system',
      'Change-of-pace back with big play ability',
      'Handcuff with standalone value if starter injured'
    ],
    'WR': [
      'WR1 with consistent target share',
      'Red zone threat with TD upside',
      'Slot receiver with PPR floor',
      'Deep threat with boom potential',
      'Possession receiver with steady targets'
    ],
    'TE': [
      'Elite TE1 with weekly upside',
      'Red zone target with TD potential',
      'Reliable option with decent floor',
      'Streaming option based on matchup',
      'Blocking TE with limited fantasy value'
    ],
    'K': [
      'Accurate kicker on high-scoring offense',
      'Strong leg with 50+ yard range',
      'Consistent option in dome/good weather',
      'Boom-or-bust based on game script'
    ],
    'D/ST': [
      'Elite defense with sack/turnover upside',
      'Solid unit facing weak offense',
      'Matchup-dependent streaming option',
      'Strong at home with crowd advantage'
    ]
  };
  
  const positionInsights = insights[position] || ['Solid fantasy option'];
  const randomInsight = positionInsights[Math.floor(Math.random() * positionInsights.length)];
  
  // Add status-specific notes
  if (status !== 'ACTIVE' && status !== 'healthy') {
    return `${randomInsight} ⚠️ ${status} - Monitor closely`;
  }
  
  // Add week-specific context
  if (weekNumber >= 15) {
    return `${randomInsight} (Playoff push - prioritize floor)`;
  } else if (weekNumber >= 12) {
    return `${randomInsight} (Late season - check for rest risk)`;
  }
  
  return randomInsight;
}

function getBenchInsight(player, position) {
  const insights = {
    'RB': ['Handcuff value', 'Flex consideration', 'Injury replacement', 'Bye week fill-in'],
    'WR': ['WR3/Flex upside', 'Matchup dependent', 'Injury replacement', 'Deep league starter'],
    'TE': ['Streaming option', 'Bye week replacement', 'Injury insurance', 'Matchup play'],
    'QB': ['Bye week starter', 'Injury insurance', 'Streaming option', 'Trade asset']
  };
  
  const positionInsights = insights[position] || ['Depth piece'];
  return positionInsights[Math.floor(Math.random() * positionInsights.length)];
}

function analyzeTeamStrengths(roster, qbs, rbs, wrs, tes, benchQBs, benchRBs, benchWRs, benchTEs) {
  let analysis = '';
  
  // Analyze positional strength
  const totalQBs = qbs.length + benchQBs.length;
  const totalRBs = rbs.length + benchRBs.length;
  const totalWRs = wrs.length + benchWRs.length;
  const totalTEs = tes.length + benchTEs.length;
  
  // Strengths
  analysis += `  ✅ STRENGTHS:\n`;
  if (totalRBs >= 5) {
    analysis += `    • Excellent RB depth (${totalRBs} total) - ${rbs.map(p => p.name).join(', ')} leading the way\n`;
  }
  if (totalWRs >= 6) {
    analysis += `    • Strong WR corps (${totalWRs} total) - ${wrs.map(p => p.name).join(', ')} as your core\n`;
  }
  if (qbs.length > 0 && qbs[0].team) {
    analysis += `    • Solid QB situation with ${qbs[0].name} (${qbs[0].team})\n`;
  }
  
  // Weaknesses
  analysis += `  ⚠️ AREAS OF CONCERN:\n`;
  if (totalQBs < 2) {
    analysis += `    • QB depth concern - only ${totalQBs} QB${totalQBs === 1 ? '' : 's'} rostered\n`;
  }
  if (totalRBs < 4) {
    analysis += `    • RB depth issue - only ${totalRBs} RBs for a volatile position\n`;
  }
  if (totalWRs < 5) {
    analysis += `    • WR depth concern - need more reliable options beyond starters\n`;
  }
  if (totalTEs < 2) {
    analysis += `    • TE depth - consider adding backup for bye weeks/injuries\n`;
  }
  
  // Team composition analysis
  const starterTeams = [...(roster.starters || [])].reduce((acc, player) => {
    if (player.team) {
      acc[player.team] = (acc[player.team] || 0) + 1;
    }
    return acc;
  }, {});
  
  const stackedTeams = Object.entries(starterTeams).filter(([team, count]) => count >= 2);
  if (stackedTeams.length > 0) {
    analysis += `  🔗 TEAM STACKS:\n`;
    stackedTeams.forEach(([team, count]) => {
      const teamPlayers = roster.starters.filter(p => p.team === team).map(p => p.name);
      analysis += `    • ${team}: ${count} players (${teamPlayers.join(', ')}) - Game script dependent\n`;
    });
  }
  
  return analysis;
}

function getWeeklyStrategy(roster, weekNumber, qbs, rbs, wrs, tes) {
  let strategy = '';
  
  // Week-specific advice
  if (weekNumber >= 15) {
    strategy += `  🏆 PLAYOFF STRATEGY:\n`;
    strategy += `    • Prioritize high-floor players over boom-bust options\n`;
    strategy += `    • Start your studs: ${[...qbs, ...rbs.slice(0,2), ...wrs.slice(0,2)].map(p => p.name).join(', ')}\n`;
    strategy += `    • Avoid players with rest risk on locked playoff teams\n`;
  } else if (weekNumber >= 12) {
    strategy += `  📈 LATE SEASON FOCUS:\n`;
    strategy += `    • Monitor snap counts for potential rest\n`;
    strategy += `    • Target players fighting for playoff spots\n`;
    strategy += `    • Consider weather impacts for outdoor games\n`;
  } else {
    strategy += `  🎯 REGULAR SEASON STRATEGY:\n`;
    strategy += `    • Balance floor and ceiling based on matchup\n`;
    strategy += `    • Monitor target/carry trends for emerging players\n`;
    strategy += `    • Consider bye week planning\n`;
  }
  
  // Opponent-specific strategy
  if (roster.opponent) {
    strategy += `  ⚔️ MATCHUP-SPECIFIC APPROACH:\n`;
    strategy += `    • Against ${roster.opponent.teamName}: `;
    
    const opponentRecord = roster.opponent.record || 'N/A';
    if (opponentRecord.includes('0-') || opponentRecord.includes('1-') || opponentRecord.includes('2-')) {
      strategy += `They're struggling - play your reliable starters for a likely win\n`;
    } else if (opponentRecord.includes('-0') || opponentRecord.includes('-1')) {
      strategy += `Strong opponent - consider high-upside plays to keep pace\n`;
    } else {
      strategy += `Competitive matchup - balance floor and ceiling\n`;
    }
    
    // Position battle analysis
    const userRBCount = rbs.length;
    const opponentRBCount = roster.opponent.starters?.filter(p => p.position === 'RB').length || 0;
    
    if (userRBCount > opponentRBCount) {
      strategy += `    • Your RB advantage: Lean on ${rbs.map(p => p.name).join(' and ')} for consistent points\n`;
    }
    
    const userWRCount = wrs.length;
    const opponentWRCount = roster.opponent.starters?.filter(p => p.position === 'WR').length || 0;
    
    if (userWRCount > opponentWRCount) {
      strategy += `    • Your WR depth edge: ${wrs.map(p => p.name).join(', ')} give you flexibility\n`;
    }
  }
  
  return strategy;
}

function createMatchupStrategy(userRoster, opponent, weekNumber) {
  const userStarters = userRoster.starters || [];
  const opponentStarters = opponent.starters || [];
  
  // Analyze scoring potential with specific players
  const userQBs = userStarters.filter(p => p.position === 'QB' || p.position === 'TQB');
  const opponentQBs = opponentStarters.filter(p => p.position === 'QB' || p.position === 'TQB');
  
  const userRBs = userStarters.filter(p => p.position === 'RB');
  const opponentRBs = opponentStarters.filter(p => p.position === 'RB');
  
  const userWRs = userStarters.filter(p => p.position === 'WR');
  const opponentWRs = opponentStarters.filter(p => p.position === 'WR');
  
  let strategy = `• POSITIONAL BATTLES:\n`;
  
  // QB comparison with names
  if (userQBs.length > 0 && opponentQBs.length > 0) {
    strategy += `  QB: ${userQBs[0].name} (${userQBs[0].team}) vs ${opponentQBs[0].name} (${opponentQBs[0].team})\n`;
  }
  
  // RB comparison
  if (userRBs.length > 0 || opponentRBs.length > 0) {
    const yourRBs = userRBs.map(rb => `${rb.name} (${rb.team})`).join(', ') || 'None';
    const theirRBs = opponentRBs.map(rb => `${rb.name} (${rb.team})`).join(', ') || 'None';
    strategy += `  RB Battle: You [${yourRBs}] vs Them [${theirRBs}]\n`;
  }
  
  // WR comparison  
  if (userWRs.length > 0 || opponentWRs.length > 0) {
    const yourWRs = userWRs.slice(0,2).map(wr => `${wr.name} (${wr.team})`).join(', ');
    const theirWRs = opponentWRs.slice(0,2).map(wr => `${wr.name} (${wr.team})`).join(', ');
    strategy += `  WR Corps: You [${yourWRs}] vs Them [${theirWRs}]\n`;
  }
  
  // Strategic recommendations based on matchup
  strategy += `• TACTICAL APPROACH:\n`;
  if (userRBs.length > opponentRBs.length) {
    strategy += `  ✅ Your RB advantage - lean on ground game with ${userRBs.map(p => p.name).join(' & ')}\n`;
  } else if (opponentRBs.length > userRBs.length) {
    strategy += `  ⚠️ Their RB edge - need big games from ${userWRs.slice(0,2).map(p => p.name).join(' & ')} to compensate\n`;
  }
  
  if (userWRs.length > opponentWRs.length) {
    strategy += `  ✅ Your WR depth advantage - ${userWRs.map(p => p.name).join(', ')} provide multiple scoring threats\n`;
  }
  
  // Same-team stack analysis
  const userTeams = new Set(userStarters.map(p => p.team).filter(Boolean));
  const opponentTeams = new Set(opponentStarters.map(p => p.team).filter(Boolean));
  const sharedTeams = [...userTeams].filter(team => opponentTeams.has(team));
  
  if (sharedTeams.length > 0) {
    strategy += `  🔗 SHARED TEAMS: Both rosters have ${sharedTeams.join(', ')} players - monitor game scripts\n`;
  }
  
  return strategy;
}


function enrichRosterWithData(roster, playerData, webResearch) {
  const enrichedStarters = (roster.starters || []).map(player => {
    const enhancedData = playerData?.players?.find(p => p.playerId === player.playerId) || {};
    const research = webResearch?.researchResults?.find(r => r.playerId === player.playerId) || {};
    
    return {
      ...player,
      enhanced: enhancedData,
      research: research.research || {}
    };
  });
  
  const enrichedBench = (roster.bench || []).map(player => {
    const enhancedData = playerData?.players?.find(p => p.playerId === player.playerId) || {};
    const research = webResearch?.researchResults?.find(r => r.playerId === player.playerId) || {};
    
    return {
      ...player,
      enhanced: enhancedData,
      research: research.research || {}
    };
  });
  
  return {
    ...roster,
    starters: enrichedStarters,
    bench: enrichedBench
  };
}

async function generateAIAnalysis(roster, weekNumber) {
  try {
    const prompt = buildAnalysisPrompt(roster, weekNumber);
    
    const params = {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      })
    };
    
    const response = await bedrock.invokeModel(params).promise();
    const responseBody = JSON.parse(response.body.toString());
    
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Error calling Bedrock:', error);
    // Fallback to rule-based analysis
    return createEnhancedAnalysis(roster, weekNumber);
  }
}

function buildAnalysisPrompt(roster, weekNumber) {
  const startersInfo = roster.starters.map(player => {
    const weather = player.enhanced?.weather || {};
    const expert = player.research?.expertConsensus || {};
    const social = player.research?.socialSentiment || {};
    const vegas = player.enhanced?.vegasInfo || {};
    const matchup = player.enhanced?.defenseMatchup || {};
    
    return `
${player.name} (${player.team} ${player.position}):
- Weather: ${weather.analysis || 'Clear conditions'}
- Expert Consensus: ${expert.reasoning || 'No data'} (Rank: ${expert.rank || 'N/A'})
- Social Sentiment: ${social.overall || 0 > 0 ? 'Positive' : social.overall < 0 ? 'Negative' : 'Neutral'}
- Vegas Line: ${vegas.analysis || 'Standard game total'}
- Matchup: ${matchup.analysis || 'Average matchup'}
- Injury Status: ${player.enhanced?.injuryStatus?.analysis || 'Healthy'}
- Trending: ${player.enhanced?.trends?.snapShare || 'N/A'}% snap share
`;
  }).join('\n');
  
  const benchInfo = roster.bench.slice(0, 5).map(player => {
    return `${player.name} (${player.team} ${player.position}) - ${player.research?.expertConsensus?.reasoning || 'Bench option'}`;
  }).join('\n');
  
  return `You are an expert fantasy football analyst. Analyze this Week ${weekNumber} roster and provide detailed, actionable insights.

STARTING LINEUP:
${startersInfo}

TOP BENCH PLAYERS:
${benchInfo}

OPPONENT: ${roster.opponent?.teamName || 'League Opponent'} (${roster.opponent?.record || 'N/A'})

Provide a comprehensive analysis covering:
1. Critical lineup decisions with specific player comparisons
2. Weather and matchup impacts on each starter
3. Expert consensus vs your analysis
4. Sit/start recommendations with confidence levels
5. Waiver wire priorities based on team needs
6. Game script predictions and how they affect your players
7. Risk assessment for each position

Be specific, use player names, and provide clear reasoning for each recommendation.`;
}

async function generateSmartRecommendations(roster, weekNumber) {
  const recommendations = [];
  
  // Track players already categorized to avoid duplicates
  const categorizedPlayers = new Set();
  
  // Organize recommendations by category
  const strongStarts = [];
  const concerns = [];
  const solidPlays = [];
  const weatherAlerts = [];
  const matchupAdvantages = [];
  
  // Process each starter and categorize recommendations (avoid duplicates)
  roster.starters.forEach(player => {
    const weather = player.enhanced?.weather;
    const matchup = player.enhanced?.defenseMatchup;
    const vegas = player.enhanced?.vegasInfo;
    const position = normalizePosition(player.position);
    const playerScore = calculatePlayerScore(player);
    const trends = player.enhanced?.trends;
    const redZone = player.enhanced?.redZoneUsage;
    const targetShare = player.enhanced?.targetShare;
    const snapCount = player.enhanced?.snapCount;
    
    // Determine overall player recommendation category (only once per player)
    let playerCategory = 'solid';
    let playerText = '';
    
    // Strong starts (excellent matchups or high-scoring games)
    if ((matchup?.difficulty === 'very_favorable' || matchup?.difficulty === 'favorable') || 
        (vegas?.impliedScore > 26) || playerScore > 70) {
      
      playerCategory = 'strong';
      playerText = `✅ ${player.name}`;
      
      const positives = [];
      if (matchup?.difficulty === 'very_favorable' || matchup?.difficulty === 'favorable') {
        positives.push(`${matchup.analysis}`);
      }
      if (vegas?.impliedScore > 26) {
        positives.push(`high-scoring game (${vegas.impliedScore} pts)`);
      }
      
      // Add specific metrics
      if (position === 'RB' && redZone?.carries > 3) {
        positives.push(`${redZone.carries} RZ carries/game (${(redZone.efficiency * 100).toFixed(0)}% TD rate)`);
      } else if ((position === 'WR' || position === 'TE') && targetShare?.teamShare > 0.15) {
        positives.push(`${(targetShare.teamShare * 100).toFixed(0)}% target share`);
      }
      
      if (snapCount?.percentage > 75) {
        positives.push(`${snapCount.percentage}% snap share`);
      }
      
      playerText += ` - ${positives.join(', ')}. Strong start this week.`;
    }
    
    // Concerns (tough matchups, weather, injuries)
    else if ((matchup?.difficulty === 'very_hard' || matchup?.difficulty === 'hard') ||
             (weather?.impact === 'very_negative') ||
             (playerScore < 55)) {
      
      playerCategory = 'concern';
      playerText = `⚠️ ${player.name}`;
      
      const concerns = [];
      if (matchup?.difficulty === 'very_hard' || matchup?.difficulty === 'hard') {
        concerns.push(`tough matchup (${matchup.analysis})`);
      }
      if (weather?.impact === 'very_negative') {
        concerns.push(`severe weather (${weather.conditions}, ${weather.temperature}°F)`);
      }
      if (snapCount?.percentage < 60) {
        concerns.push(`limited snaps (${snapCount.percentage}%)`);
      }
      if (targetShare?.teamShare < 0.1 && (position === 'WR' || position === 'TE')) {
        concerns.push(`low target share (${(targetShare?.teamShare * 100 || 0).toFixed(0)}%)`);
      }
      
      // Check for bench alternatives
      const benchAlternative = roster.bench.find(b => 
        normalizePosition(b.position) === position && 
        calculatePlayerScore(b) > playerScore + 10
      );
      
      if (benchAlternative) {
        playerText += ` - ${concerns.join(', ')}. Consider ${benchAlternative.name} instead.`;
      } else {
        playerText += ` - ${concerns.join(', ')}. Monitor closely.`;
      }
    }
    
    // Solid plays (everything else)
    else {
      playerCategory = 'solid';
      playerText = `👍 ${player.name}`;
      
      const metrics = [];
      if (snapCount?.percentage > 70) metrics.push(`${snapCount.percentage}% snaps`);
      if (targetShare?.teamShare > 0.15) metrics.push(`${(targetShare.teamShare * 100).toFixed(0)}% targets`);
      if (redZone?.efficiency > 0.25) metrics.push(`${(redZone.efficiency * 100).toFixed(0)}% RZ efficiency`);
      if (vegas?.impliedScore > 22) metrics.push(`${vegas.impliedScore} implied points`);
      
      if (metrics.length > 0) {
        playerText += ` - ${metrics.join(', ')}. Solid floor with upside.`;
      } else {
        playerText += ` - Decent option with average projection.`;
      }
    }
    
    // Add to appropriate category (only once per player)
    if (playerCategory === 'strong') {
      strongStarts.push(playerText);
      categorizedPlayers.add(player.playerId);
    } else if (playerCategory === 'concern') {
      concerns.push(playerText);
      categorizedPlayers.add(player.playerId);
    } else {
      solidPlays.push(playerText);
      categorizedPlayers.add(player.playerId);
    }
    
    // Weather alerts (separate section for severe conditions only)
    if (weather) {
      if (weather.impact === 'very_negative' || (weather.temperature < 32 && weather.wind > 15)) {
        weatherAlerts.push(`🌨️ ${player.name}: ${weather.conditions} (${weather.temperature}°F, ${weather.wind}mph) - Severe conditions expected`);
      } else if (position === 'K' && (weather.temperature < 40 || weather.wind > 12)) {
        weatherAlerts.push(`🦵 ${player.name}: ${weather.temperature}°F, ${weather.wind}mph wind - Difficult kicking conditions`);
      } else if (weather.impact === 'positive' && weather.temperature > 65) {
        weatherAlerts.push(`☀️ ${player.name}: ${weather.temperature}°F, calm conditions - Perfect for offensive production`);
      }
    }
    
    // Matchup advantages (only for players not already in Strong Starts)
    if (matchup && matchup.rank && matchup.rank > 25 && !categorizedPlayers.has(player.playerId)) {
      matchupAdvantages.push(`🎯 ${player.name} vs #${matchup.rank} ${matchup.opponent} defense - Exploit this weakness`);
    }
  });
  
  // Build consolidated recommendations by section
  if (strongStarts.length > 0) {
    recommendations.push({
      type: 'Strong Starts',
      priority: 'high',
      text: `🔥 CONFIDENT STARTS:\n${strongStarts.join('\n')}`,
      confidence: 'high'
    });
  }
  
  if (concerns.length > 0) {
    recommendations.push({
      type: 'Concerns',
      priority: 'high',
      text: `⚠️ LINEUP CONCERNS:\n${concerns.join('\n')}`,
      confidence: 'high'
    });
  }
  
  if (solidPlays.length > 0) {
    recommendations.push({
      type: 'Solid Plays',
      priority: 'medium',
      text: `👍 SOLID OPTIONS:\n${solidPlays.join('\n')}`,
      confidence: 'medium'
    });
  }
  
  if (weatherAlerts.length > 0) {
    recommendations.push({
      type: 'Weather Report',
      priority: 'medium',
      text: `🌤️ WEATHER IMPACT:\n${weatherAlerts.join('\n')}`,
      confidence: 'high'
    });
  }
  
  if (matchupAdvantages.length > 0) {
    recommendations.push({
      type: 'Matchup Advantages',
      priority: 'medium',
      text: `🎯 EXPLOIT THESE MATCHUPS:\n${matchupAdvantages.join('\n')}`,
      confidence: 'medium'
    });
  }
  
  // Additional specific recommendations (only for uncategorized scenarios)
  roster.starters.forEach(player => {
    // Skip if already categorized
    if (categorizedPlayers.has(player.playerId)) return;
    
    const vegas = player.enhanced?.vegasInfo;
    const injury = player.enhanced?.injuryStatus;
    
    // High scoring game alerts
    if (vegas && vegas.impliedScore > 27) {
      recommendations.push({
        type: 'High Scoring Game',
        priority: 'high',
        player: player.name,
        text: `🎯 SHOOTOUT ALERT: ${player.name}'s team has ${vegas.impliedScore} implied points. ${vegas.gameScript}. Start with confidence.`,
        confidence: 'high'
      });
    }
    
    // Low scoring game warnings
    if (vegas && vegas.impliedScore < 17) {
      recommendations.push({
        type: 'Low Scoring Game',
        priority: 'medium',
        player: player.name,
        text: `⚠️ LOW TOTAL: ${player.name}'s team only has ${vegas.impliedScore} implied points. Consider alternatives if available.`,
        confidence: 'medium'
      });
    }
    
    // Injury alerts
    if (injury && injury.status !== 'ACTIVE') {
      recommendations.push({
        type: 'Injury Alert',
        priority: 'critical',
        player: player.name,
        text: `🚨 INJURY CONCERN: ${player.name} is ${injury.status}. ${injury.analysis}. Have backup plan ready.`,
        confidence: 'high'
      });
    }
  });
  
  // Trending bench players
  roster.bench.forEach(player => {
    const trends = player.enhanced?.trends;
    const buzz = player.research?.overallBuzz;
    
    if (trends && trends.snapShare > 75 && buzz?.level === 'high') {
      const starterToReplace = roster.starters.find(s => 
        s.position === player.position && 
        s.enhanced?.trends?.snapShare < 60
      );
      
      if (starterToReplace) {
        recommendations.push({
          type: 'Trending Up',
          priority: 'high',
          player: player.name,
          text: `📈 TRENDING UP: ${player.name} has ${trends.snapShare}% snap share and high buzz. Consider over ${starterToReplace.name}.`,
          confidence: 'medium'
        });
      }
    }
  });
  
  // Add top free agent recommendations
  const freeAgentSuggestions = generateFreeAgentSuggestions(roster, weekNumber);
  const topFreeAgents = freeAgentSuggestions
    .filter(fa => fa.priority === 'high' || fa.priority === 'critical')
    .slice(0, 3);
  
  if (topFreeAgents.length > 0) {
    const freeAgentText = topFreeAgents.map(fa => 
      `🎯 ${fa.name} (${fa.team} ${fa.position}) - ${fa.reasoning} (${fa.ownership} owned)`
    ).join('\n');
    
    recommendations.push({
      type: 'Free Agent Targets',
      priority: 'high',
      text: `🆓 TOP WAIVER WIRE PICKUPS:\n${freeAgentText}`,
      confidence: 'high'
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generateLineupOptimizations(roster, weekNumber) {
  const optimizations = [];
  
  // Compare starters vs bench by position
  ['QB', 'RB', 'WR', 'TE'].forEach(position => {
    const starters = roster.starters.filter(p => p.position === position);
    const benchPlayers = roster.bench.filter(p => p.position === position);
    
    benchPlayers.forEach(benchPlayer => {
      starters.forEach(starter => {
        const benchScore = calculatePlayerScore(benchPlayer);
        const starterScore = calculatePlayerScore(starter);
        
        if (benchScore > starterScore + 5) { // Significant advantage
          optimizations.push({
            position,
            swap: {
              out: starter.name,
              in: benchPlayer.name,
              scoreDiff: benchScore - starterScore,
              reasoning: generateSwapReasoning(benchPlayer, starter)
            }
          });
        }
      });
    });
  });
  
  return optimizations;
}

function calculatePlayerScore(player) {
  let score = 50; // Base score
  
  // Weather impact
  const weather = player.enhanced?.weather;
  if (weather) {
    if (weather.impact === 'positive') score += 10;
    else if (weather.impact === 'negative') score -= 10;
    else if (weather.impact === 'very_negative') score -= 20;
  }
  
  // Expert consensus
  const expert = player.research?.expertConsensus;
  if (expert) {
    if (expert.rank && expert.rank <= 10) score += 15;
    else if (expert.rank && expert.rank <= 20) score += 10;
    else if (expert.rank && expert.rank <= 30) score += 5;
    
    if (expert.confidence === 'high') score += 5;
  }
  
  // Vegas line
  const vegas = player.enhanced?.vegasInfo;
  if (vegas && vegas.impliedScore) {
    if (vegas.impliedScore > 27) score += 15;
    else if (vegas.impliedScore > 24) score += 10;
    else if (vegas.impliedScore < 17) score -= 10;
  }
  
  // Matchup - enhanced scoring
  const matchup = player.enhanced?.defenseMatchup;
  if (matchup) {
    if (matchup.difficulty === 'very_favorable') score += 20;
    else if (matchup.difficulty === 'favorable') score += 15;
    else if (matchup.difficulty === 'average') score += 5;
    else if (matchup.difficulty === 'hard') score -= 5;
    else if (matchup.difficulty === 'very_hard') score -= 15;
  }
  
  // Social buzz
  const buzz = player.research?.overallBuzz;
  if (buzz) {
    if (buzz.level === 'very_high') score += 10;
    else if (buzz.level === 'high') score += 5;
  }
  
  // Injury status
  const injury = player.enhanced?.injuryStatus;
  if (injury && injury.status !== 'ACTIVE') {
    score -= 20;
  }
  
  // Trends
  const trends = player.enhanced?.trends;
  if (trends && trends.snapShare) {
    if (trends.snapShare > 80) score += 10;
    else if (trends.snapShare < 50) score -= 10;
  }
  
  // Position-specific adjustments
  const position = normalizePosition(player.position);
  if (position === 'QB' && score > 60) score += 5; // QBs are more consistent
  if (position === 'K' || position === 'D/ST') score -= 5; // Lower priority positions
  
  return Math.max(0, Math.min(100, score)); // Cap between 0-100
}

function normalizePosition(position) {
  // Clean up position strings
  if (!position) return 'FLEX';
  
  const pos = position.toUpperCase();
  if (pos.includes('QB') || pos === 'TQB') return 'QB';
  if (pos.includes('RB')) return 'RB';
  if (pos.includes('WR')) return 'WR';
  if (pos.includes('TE')) return 'TE';
  if (pos.includes('K')) return 'K';
  if (pos.includes('D/ST') || pos.includes('DEF')) return 'D/ST';
  
  return 'FLEX';
}

function generateSwapReasoning(benchPlayer, starter) {
  const reasons = [];
  
  const benchWeather = benchPlayer.enhanced?.weather;
  const starterWeather = starter.enhanced?.weather;
  if (benchWeather?.impact === 'positive' && starterWeather?.impact === 'negative') {
    reasons.push(`Better weather conditions for ${benchPlayer.name}`);
  }
  
  const benchMatchup = benchPlayer.enhanced?.defenseMatchup;
  const starterMatchup = starter.enhanced?.defenseMatchup;
  if (benchMatchup?.difficulty === 'favorable' && starterMatchup?.difficulty === 'hard') {
    reasons.push(`${benchPlayer.name} has much easier matchup`);
  }
  
  const benchVegas = benchPlayer.enhanced?.vegasInfo;
  const starterVegas = starter.enhanced?.vegasInfo;
  if (benchVegas?.impliedScore > starterVegas?.impliedScore + 5) {
    reasons.push(`${benchPlayer.name}'s team has higher implied score`);
  }
  
  const benchBuzz = benchPlayer.research?.overallBuzz;
  if (benchBuzz?.level === 'very_high' || benchBuzz?.level === 'high') {
    reasons.push(`${benchPlayer.name} has high expert/social buzz`);
  }
  
  return reasons.join('. ') || `${benchPlayer.name} has better overall outlook`;
}

function generateWaiverWireTargets(roster, weekNumber) {
  const targets = [];
  
  // Analyze position depth
  const positionCounts = {
    QB: roster.starters.filter(p => p.position === 'QB').length + roster.bench.filter(p => p.position === 'QB').length,
    RB: roster.starters.filter(p => p.position === 'RB').length + roster.bench.filter(p => p.position === 'RB').length,
    WR: roster.starters.filter(p => p.position === 'WR').length + roster.bench.filter(p => p.position === 'WR').length,
    TE: roster.starters.filter(p => p.position === 'TE').length + roster.bench.filter(p => p.position === 'TE').length
  };
  
  // Get specific free agent suggestions based on current week and trends
  const freeAgentSuggestions = generateFreeAgentSuggestions(roster, weekNumber);
  
  // Position needs with specific free agent targets
  if (positionCounts.QB < 2) {
    const qbTargets = freeAgentSuggestions.filter(fa => fa.position === 'QB').slice(0, 3);
    targets.push({
      position: 'QB',
      priority: 'high',
      reasoning: 'Need QB depth for bye weeks and injuries',
      targetProfile: 'QB with rushing upside or favorable upcoming schedule',
      specificTargets: qbTargets.length > 0 ? qbTargets : getDefaultFreeAgents('QB', weekNumber)
    });
  }
  
  if (positionCounts.RB < 5) {
    const rbTargets = freeAgentSuggestions.filter(fa => fa.position === 'RB').slice(0, 4);
    targets.push({
      position: 'RB',
      priority: 'critical',
      reasoning: 'RB is most injury-prone position, need more depth',
      targetProfile: 'Handcuff RBs or emerging committee backs with increasing touches',
      specificTargets: rbTargets.length > 0 ? rbTargets : getDefaultFreeAgents('RB', weekNumber)
    });
  }
  
  if (positionCounts.WR < 6) {
    const wrTargets = freeAgentSuggestions.filter(fa => fa.position === 'WR').slice(0, 4);
    targets.push({
      position: 'WR',
      priority: 'high',
      reasoning: 'WR depth provides flexibility for matchups',
      targetProfile: 'WRs with increasing target share or red zone usage',
      specificTargets: wrTargets.length > 0 ? wrTargets : getDefaultFreeAgents('WR', weekNumber)
    });
  }
  
  if (positionCounts.TE < 2) {
    const teTargets = freeAgentSuggestions.filter(fa => fa.position === 'TE').slice(0, 3);
    targets.push({
      position: 'TE',
      priority: 'medium',
      reasoning: 'TE backup needed for bye week',
      targetProfile: 'TE with red zone targets or favorable upcoming matchups',
      specificTargets: teTargets.length > 0 ? teTargets : getDefaultFreeAgents('TE', weekNumber)
    });
  }
  
  // Identify droppable players
  const droppablePlayers = roster.bench.filter(player => {
    const score = calculatePlayerScore(player);
    const injury = player.enhanced?.injuryStatus;
    const trends = player.enhanced?.trends;
    
    return score < 40 || 
           (injury && injury.status === 'Out') ||
           (trends && trends.snapShare < 30);
  }).map(p => p.name);
  
  if (droppablePlayers.length > 0) {
    targets.push({
      position: 'DROP',
      priority: 'medium',
      reasoning: 'Consider dropping underperforming players',
      players: droppablePlayers
    });
  }
  
  // Add trade suggestions with free agent alternatives
  const tradeSuggestions = generateTradeSuggestions(roster, freeAgentSuggestions, weekNumber);
  if (tradeSuggestions.length > 0) {
    targets.push({
      position: 'TRADE',
      priority: 'medium',
      reasoning: 'Trade opportunities to improve roster',
      suggestions: tradeSuggestions
    });
  }
  
  return targets;
}

function generateFreeAgentSuggestions(roster, weekNumber) {
  const freeAgents = [];
  
  // Week-specific trending players (these would typically come from an API)
  // For now, using common waiver wire targets by week
  const weeklyTrends = getWeeklyTrendingPlayers(weekNumber);
  
  // Analyze roster needs and suggest specific players
  const rosterTeams = new Set([...roster.starters, ...roster.bench].map(p => p.team).filter(Boolean));
  
  weeklyTrends.forEach(player => {
    const suggestion = {
      name: player.name,
      team: player.team,
      position: player.position,
      reasoning: player.reasoning,
      priority: player.priority,
      ownership: player.ownership || 'Low',
      upside: player.upside || 'Medium'
    };
    
    // Boost priority if we don't have players from their team (stack opportunity)
    if (!rosterTeams.has(player.team)) {
      suggestion.reasoning += ` (Stack opportunity - no ${player.team} players on roster)`;
    }
    
    freeAgents.push(suggestion);
  });
  
  return freeAgents;
}

function getWeeklyTrendingPlayers(weekNumber) {
  // This would typically come from a real-time API, but for now using common targets
  const baseTrends = [
    // QBs
    { name: 'Tyrod Taylor', team: 'NYG', position: 'QB', reasoning: 'Rushing upside if starter struggles', priority: 'medium', ownership: '5%' },
    { name: 'Bailey Zappe', team: 'NE', position: 'QB', reasoning: 'Potential starter with decent matchups', priority: 'low', ownership: '2%' },
    { name: 'Aidan O\'Connell', team: 'LV', position: 'QB', reasoning: 'Young QB with arm talent', priority: 'low', ownership: '8%' },
    
    // RBs
    { name: 'Roschon Johnson', team: 'CHI', position: 'RB', reasoning: 'Handcuff with standalone value', priority: 'high', ownership: '15%' },
    { name: 'Ty Johnson', team: 'BUF', position: 'RB', reasoning: 'Pass-catching back with PPR upside', priority: 'medium', ownership: '12%' },
    { name: 'Clyde Edwards-Helaire', team: 'KC', position: 'RB', reasoning: 'Former starter available in many leagues', priority: 'medium', ownership: '25%' },
    { name: 'Ezekiel Elliott', team: 'DAL', position: 'RB', reasoning: 'Goal line back with TD upside', priority: 'medium', ownership: '30%' },
    { name: 'Antonio Gibson', team: 'NE', position: 'RB', reasoning: 'Change of pace back with big play ability', priority: 'medium', ownership: '20%' },
    
    // WRs
    { name: 'Jalen Tolbert', team: 'DAL', position: 'WR', reasoning: 'Emerging target in Cowboys offense', priority: 'high', ownership: '18%' },
    { name: 'Demario Douglas', team: 'NE', position: 'WR', reasoning: 'Slot receiver with consistent targets', priority: 'medium', ownership: '22%' },
    { name: 'Tutu Atwell', team: 'LAR', position: 'WR', reasoning: 'Deep threat with big play potential', priority: 'medium', ownership: '8%' },
    { name: 'Kendrick Bourne', team: 'NE', position: 'WR', reasoning: 'Red zone target with TD upside', priority: 'medium', ownership: '15%' },
    { name: 'Darius Slayton', team: 'NYG', position: 'WR', reasoning: 'Deep threat in pass-heavy offense', priority: 'medium', ownership: '25%' },
    
    // TEs
    { name: 'Hunter Henry', team: 'NE', position: 'TE', reasoning: 'Red zone target with consistent usage', priority: 'high', ownership: '35%' },
    { name: 'Tyler Conklin', team: 'NYJ', position: 'TE', reasoning: 'Volume-based TE with decent floor', priority: 'medium', ownership: '28%' },
    { name: 'Noah Fant', team: 'SEA', position: 'TE', reasoning: 'Athletic TE with upside potential', priority: 'medium', ownership: '30%' },
    
    // D/ST
    { name: 'Colts D/ST', team: 'IND', position: 'D/ST', reasoning: 'Improving defense with favorable schedule', priority: 'medium', ownership: '40%' },
    { name: 'Titans D/ST', team: 'TEN', position: 'D/ST', reasoning: 'Streaming option vs weak offenses', priority: 'low', ownership: '15%' }
  ];
  
  // Adjust suggestions based on week (playoff implications, etc.)
  if (weekNumber >= 15) {
    // Playoff weeks - prioritize proven players
    return baseTrends.filter(p => p.ownership >= '15%' || p.priority === 'high');
  } else if (weekNumber >= 12) {
    // Late season - focus on emerging players
    return baseTrends.filter(p => p.reasoning.includes('emerging') || p.reasoning.includes('increasing'));
  }
  
  return baseTrends;
}

function getDefaultFreeAgents(position, weekNumber) {
  const defaults = {
    'QB': [
      { name: 'Available QB1', reasoning: 'Backup QB with rushing upside', priority: 'medium' },
      { name: 'Available QB2', reasoning: 'Streaming option with good matchup', priority: 'low' }
    ],
    'RB': [
      { name: 'Handcuff RB', reasoning: 'Backup to starter with injury history', priority: 'high' },
      { name: 'Committee RB', reasoning: 'Part of RBBC with increasing touches', priority: 'medium' }
    ],
    'WR': [
      { name: 'Slot WR', reasoning: 'PPR value with consistent targets', priority: 'medium' },
      { name: 'Deep Threat WR', reasoning: 'Big play potential in pass-heavy offense', priority: 'medium' }
    ],
    'TE': [
      { name: 'Red Zone TE', reasoning: 'Goal line target with TD upside', priority: 'medium' },
      { name: 'Volume TE', reasoning: 'High target share TE', priority: 'low' }
    ]
  };
  
  return defaults[position] || [];
}

function generateTradeSuggestions(roster, freeAgents, weekNumber) {
  const suggestions = [];
  
  // Identify surplus positions
  const positionCounts = {
    QB: roster.starters.filter(p => p.position === 'QB').length + roster.bench.filter(p => p.position === 'QB').length,
    RB: roster.starters.filter(p => p.position === 'RB').length + roster.bench.filter(p => p.position === 'RB').length,
    WR: roster.starters.filter(p => p.position === 'WR').length + roster.bench.filter(p => p.position === 'WR').length,
    TE: roster.starters.filter(p => p.position === 'TE').length + roster.bench.filter(p => p.position === 'TE').length
  };
  
  // Find tradeable assets (bench players with value)
  const tradeableAssets = roster.bench.filter(player => {
    const score = calculatePlayerScore(player);
    return score > 60 && player.enhanced?.injuryStatus?.status === 'ACTIVE';
  });
  
  // Suggest trades based on roster construction
  if (positionCounts.WR > 6 && positionCounts.RB < 4) {
    const topWR = tradeableAssets.find(p => p.position === 'WR');
    if (topWR) {
      const rbAlternatives = freeAgents.filter(fa => fa.position === 'RB' && fa.priority === 'high');
      suggestions.push({
        type: 'Position Swap',
        trade: `${topWR.name} (WR)`,
        target: 'RB2/RB3 level player',
        reasoning: `WR depth allows trading ${topWR.name} for RB help`,
        freeAgentBackup: rbAlternatives.length > 0 ? rbAlternatives[0].name : 'Available RB handcuff'
      });
    }
  }
  
  if (positionCounts.RB > 5 && positionCounts.WR < 5) {
    const topRB = tradeableAssets.find(p => p.position === 'RB');
    if (topRB) {
      const wrAlternatives = freeAgents.filter(fa => fa.position === 'WR' && fa.priority === 'high');
      suggestions.push({
        type: 'Position Swap',
        trade: `${topRB.name} (RB)`,
        target: 'WR2/WR3 level player',
        reasoning: `RB depth allows trading ${topRB.name} for WR help`,
        freeAgentBackup: wrAlternatives.length > 0 ? wrAlternatives[0].name : 'Available slot WR'
      });
    }
  }
  
  // 2-for-1 upgrade suggestions
  if (tradeableAssets.length >= 2) {
    const asset1 = tradeableAssets[0];
    const asset2 = tradeableAssets[1];
    suggestions.push({
      type: '2-for-1 Upgrade',
      trade: `${asset1.name} + ${asset2.name}`,
      target: `Elite ${asset1.position} or ${asset2.position}`,
      reasoning: 'Package depth pieces for a starter upgrade',
      freeAgentBackup: `Pick up ${freeAgents.find(fa => fa.priority === 'high')?.name || 'trending player'} with open roster spot`
    });
  }
  
  return suggestions;
}

function assessDataQuality(playerData, webResearch) {
  const quality = {
    playerData: playerData && playerData.players ? 'good' : 'poor',
    webResearch: webResearch && webResearch.researchResults ? 'good' : 'poor',
    overall: 'good'
  };
  
  if (quality.playerData === 'poor' || quality.webResearch === 'poor') {
    quality.overall = 'degraded';
  }
  
  return quality;
}

function createEnhancedAnalysis(roster, weekNumber) {
  let analysis = `🏈 WEEK ${weekNumber} - ENHANCED AI ANALYSIS\n\n`;
  
  analysis += `📊 TEAM OVERVIEW:\n`;
  analysis += `Team: ${roster.teamName || 'Your Team'}\n`;
  analysis += `Record: ${roster.record || 'N/A'}\n`;
  if (roster.opponent) {
    analysis += `Opponent: ${roster.opponent.teamName} (${roster.opponent.record})\n`;
  }
  analysis += `\n`;
  
  analysis += `🎯 STARTING LINEUP ANALYSIS:\n`;
  roster.starters.forEach(player => {
    const weather = player.enhanced?.weather;
    const expert = player.research?.expertConsensus;
    const vegas = player.enhanced?.vegasInfo;
    const matchup = player.enhanced?.defenseMatchup;
    
    analysis += `\n${player.name} (${player.team} ${player.position}):\n`;
    
    if (weather && weather.impact !== 'neutral') {
      analysis += `  🌤️ Weather: ${weather.analysis}\n`;
    }
    
    if (expert && expert.rank) {
      analysis += `  📊 Expert Rank: #${expert.rank} ${player.position} - ${expert.reasoning}\n`;
    }
    
    if (vegas && vegas.impliedScore) {
      analysis += `  💰 Vegas: ${vegas.impliedScore} implied points - ${vegas.gameScript}\n`;
    }
    
    if (matchup) {
      analysis += `  🛡️ Matchup: ${matchup.analysis}\n`;
    }
    
    const score = calculatePlayerScore(player);
    const confidence = score > 70 ? '🔥 HIGH' : score > 55 ? '⚡ MEDIUM' : '⚠️ LOW';
    analysis += `  ${confidence} Confidence\n`;
  });
  
  analysis += `\n\n💡 KEY INSIGHTS:\n`;
  
  const weatherImpacted = roster.starters.filter(p => 
    p.enhanced?.weather?.impact === 'negative' || 
    p.enhanced?.weather?.impact === 'very_negative' ||
    (p.enhanced?.weather?.temperature < 35) ||
    (normalizePosition(p.position) === 'K' && p.enhanced?.weather?.wind > 12)
  ).length;
  
  const highScoringGames = roster.starters.filter(p => 
    p.enhanced?.vegasInfo?.impliedScore > 24
  ).length;
  
  const favorableMatchups = roster.starters.filter(p => 
    p.enhanced?.defenseMatchup?.difficulty === 'favorable' || 
    p.enhanced?.defenseMatchup?.difficulty === 'very_favorable'
  ).length;
  
  const toughMatchups = roster.starters.filter(p => 
    p.enhanced?.defenseMatchup?.difficulty === 'hard' || 
    p.enhanced?.defenseMatchup?.difficulty === 'very_hard'
  ).length;
  
  analysis += `• Weather concerns for ${weatherImpacted} starters\n`;
  analysis += `• ${highScoringGames} players in high-scoring games (24+ points)\n`;
  analysis += `• ${favorableMatchups} favorable matchups, ${toughMatchups} tough matchups\n`;
  
  // Add specific weather warnings
  const severeWeather = roster.starters.filter(p => 
    p.enhanced?.weather?.temperature < 32 || p.enhanced?.weather?.impact === 'very_negative'
  );
  if (severeWeather.length > 0) {
    analysis += `• ⚠️ SEVERE WEATHER: ${severeWeather.map(p => p.name).join(', ')} in harsh conditions\n`;
  }
  
  // Add kicker weather warnings
  const kickersInBadWeather = roster.starters.filter(p => 
    normalizePosition(p.position) === 'K' && 
    (p.enhanced?.weather?.temperature < 40 || p.enhanced?.weather?.wind > 12)
  );
  if (kickersInBadWeather.length > 0) {
    analysis += `• 🦵 KICKER WEATHER: ${kickersInBadWeather.map(p => p.name).join(', ')} facing difficult conditions\n`;
  }
  
  return analysis;
}
