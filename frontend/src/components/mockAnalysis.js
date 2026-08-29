// Mock analysis data for demo/testing mode

const MOCK_DATASETS = {
  strong: {
    lastUpdated: new Date().toISOString(),
    lineupGrade: {
      overallGrade: 'A-',
      overallScore: 87,
      positionGrades: [
        { position: 'QB', grade: 'A', score: 92, summary: 'Elite matchup vs bottom-5 pass defense' },
        { position: 'RB', grade: 'B+', score: 83, summary: 'Strong volume, positive game script' },
        { position: 'WR', grade: 'A-', score: 88, summary: 'Top target share with favorable coverage' },
        { position: 'TE', grade: 'B', score: 76, summary: 'Solid floor in high-scoring affair' },
        { position: 'K', grade: 'A', score: 91, summary: 'Dome game, high over/under' },
        { position: 'D/ST', grade: 'B+', score: 82, summary: 'Facing turnover-prone rookie QB' },
      ],
    },
    recommendations: [
      { type: 'Must Start', priority: 'high', text: 'Jalen Hurts is a must-start this week against a Cowboys defense allowing the most fantasy points to QBs over the last 4 weeks. His rushing floor alone gives him top-3 upside, and the Eagles are favored by 7 points in a dome environment.' },
      { type: 'Lineup Change', priority: 'high', text: 'Start Jayden Daniels over Trevor Lawrence at QB2. Daniels has averaged 22.4 fantasy points over his last 3 games with 60+ rushing yards in each, while Lawrence faces the league\'s top pass rush.' },
      { type: 'Sit Alert', priority: 'high', text: 'Bench Davante Adams this week. He draws shadow coverage from Sauce Gardner and the Jets have allowed the fewest WR1 fantasy points this season. Pivot to Courtland Sutton who has a plus matchup.' },
      { type: 'Waiver Target', priority: 'medium', text: 'Pick up Bucky Irving if available. Tampa Bay\'s lead back has seen 18+ touches in 3 straight games and faces a Raiders run defense allowing 5.1 YPC. He\'s a strong RB2 play this week.' },
      { type: 'Trade Target', priority: 'medium', text: 'Buy low on Amon-Ra St. Brown. His owner may be frustrated by two quiet weeks, but his target share remains elite at 28% and Detroit\'s schedule softens significantly after the bye.' },
    ],
    analysis: 'WEEK 14 FANTASY FOOTBALL REPORT\n\nOVERVIEW\nYour lineup grades out as one of the strongest in your league this week. The combination of elite QB play, strong RB volume, and favorable matchups across the board gives you a high floor with significant ceiling.\n\nQUARTERBACK ANALYSIS\nJalen Hurts (PHI) vs DAL - Confidence: HIGH\nHurts is in a smash spot this week. Dallas has allowed the most fantasy points to quarterbacks over the last month, and this game has a 51.5 over/under. Hurts has rushed for 40+ yards in 8 of his last 10 games, providing a rock-solid floor. The Eagles are 7-point favorites, which means they should be in positive game script throughout.\n\nRUNNING BACK ANALYSIS\nSaquon Barkley (PHI) vs DAL - Confidence: HIGH\nBarkley continues to be a workhorse with 22+ touches in every game this season. The Cowboys allow the 5th most rushing yards per game and Barkley should see goal-line work in what projects as a blowout.\n\nDerrick Henry (BAL) vs PIT - Confidence: MEDIUM\nHenry faces a tough Steelers front, but his volume is guaranteed. Baltimore is a 3-point favorite and should lean on the run game. Expect 20+ carries with TD upside despite the matchup.\n\nWIDE RECEIVER ANALYSIS\nJa\'Marr Chase (CIN) vs CLE - Confidence: HIGH\nChase has been the WR1 overall and faces a Browns secondary missing their top corner. Burrow is locked in and this game has shootout potential with a 48-point total.\n\nRISK ASSESSMENT\nLowest floor this week: Courtland Sutton - Denver\'s passing game is inconsistent and Sutton could see 4 targets or 12. He\'s matchup-dependent.\n\nCEILING PLAYS\nHighest upside: Ja\'Marr Chase - 40+ point ceiling in a potential shootout against Cleveland.',
  },

  average: {
    lastUpdated: new Date().toISOString(),
    lineupGrade: {
      overallGrade: 'B-',
      overallScore: 72,
      positionGrades: [
        { position: 'QB', grade: 'C+', score: 67, summary: 'Tough matchup, limited rushing upside' },
        { position: 'RB', grade: 'B', score: 78, summary: 'Good volume but negative game script risk' },
        { position: 'WR', grade: 'B+', score: 81, summary: 'Strong target share, favorable coverage' },
        { position: 'TE', grade: 'C', score: 62, summary: 'Boom-or-bust with low target floor' },
        { position: 'K', grade: 'B-', score: 71, summary: 'Outdoor game, moderate scoring expected' },
        { position: 'D/ST', grade: 'B', score: 77, summary: 'Solid matchup vs struggling offense' },
      ],
    },
    recommendations: [
      { type: 'Lineup Change', priority: 'high', text: 'Swap Kirk Cousins for Sam Darnold at QB. Cousins faces the league\'s 3rd-best pass defense and has thrown 5 interceptions in his last 3 games. Darnold has a plus matchup against Chicago\'s 28th-ranked secondary.' },
      { type: 'Must Start', priority: 'high', text: 'Josh Jacobs is locked in as your RB1 despite a middling matchup. Green Bay is committed to the run and Jacobs has 20+ touches in 6 straight games. Volume is king in fantasy.' },
      { type: 'Sit Alert', priority: 'medium', text: 'Consider benching Dalton Kincaid this week. The Bills TE has seen only 3 targets in 2 of his last 4 games and faces a Dolphins defense that limits tight end production.' },
      { type: 'Weather Impact', priority: 'medium', text: 'Monitor wind conditions for the Bills-Dolphins game. Forecasts show 20+ mph gusts which could limit the passing game and make Kincaid even riskier.' },
    ],
    analysis: 'WEEK 14 FANTASY FOOTBALL REPORT\n\nOVERVIEW\nYour lineup has some strong pieces but a few concerning matchups drag down the overall grade. The QB situation is the biggest weakness this week.\n\nQUARTERBACK ANALYSIS\nKirk Cousins (ATL) vs BUF - Confidence: LOW\nCousins has been struggling and now faces Buffalo\'s elite defense. The Bills allow the 3rd fewest fantasy points to QBs and generate pressure on 38% of dropbacks. Consider streaming options.\n\nRUNNING BACK ANALYSIS\nJosh Jacobs (GB) vs DET - Confidence: HIGH\nJacobs is matchup-proof at this point. 20+ touches guaranteed with goal-line work. Detroit allows 4.5 YPC to RBs.\n\nRISK ASSESSMENT\nBiggest concern: Kirk Cousins could put up a single-digit performance against Buffalo. Have a backup plan ready.',
  },

  weak: {
    lastUpdated: new Date().toISOString(),
    lineupGrade: {
      overallGrade: 'D',
      overallScore: 48,
      positionGrades: [
        { position: 'QB', grade: 'D', score: 45, summary: 'Injured, limited practice all week' },
        { position: 'RB', grade: 'C-', score: 55, summary: 'Committee backfield, negative game script' },
        { position: 'WR', grade: 'C', score: 61, summary: 'Decent talent but brutal matchups' },
        { position: 'TE', grade: 'F', score: 38, summary: 'Backup TE with minimal target share' },
        { position: 'K', grade: 'C+', score: 66, summary: 'Low-scoring game projection' },
        { position: 'D/ST', grade: 'D', score: 50, summary: 'Facing top-3 offense on the road' },
      ],
    },
    recommendations: [
      { type: 'Sit Alert', priority: 'high', text: 'Do NOT start Deshaun Watson this week. He\'s been limited in practice with a shoulder injury and faces the Ravens\' top-5 pass rush. Stream literally anyone else — even Jacoby Brissett has a better matchup.' },
      { type: 'Lineup Change', priority: 'high', text: 'You need to find a TE replacement immediately. Your current starter has 6 targets in the last 3 weeks combined. Check waivers for Cade Otton, Jonnu Smith, or Tyler Conklin.' },
      { type: 'Must Start', priority: 'high', text: 'Despite the overall weak lineup, Nico Collins is still a must-start. He\'s the WR4 overall and his talent transcends matchup concerns. Lock him in and build around him.' },
      { type: 'Waiver Target', priority: 'high', text: 'This is a must-win week for waiver moves. Target a streaming QB (Darnold, Goff, Stafford) and a TE with a pulse. Your current lineup projects bottom-3 in the league.' },
      { type: 'Trade Target', priority: 'medium', text: 'If you\'re still in playoff contention, consider trading future draft picks for immediate help. Your RB and TE positions need urgent upgrades.' },
    ],
    analysis: 'WEEK 14 FANTASY FOOTBALL REPORT\n\nOVERVIEW\nThis is a rough week for your lineup. Multiple injuries, bad matchups, and thin depth create a perfect storm of low projections. Urgent action needed.\n\nQUARTERBACK ANALYSIS\nDeshaun Watson (CLE) vs BAL - Confidence: VERY LOW\nWatson has been awful this season and now faces Baltimore\'s elite defense while nursing a shoulder injury. He\'s averaged 8.3 fantasy points over his last 4 games. You need to stream.\n\nRISK ASSESSMENT\nThis lineup has bust potential at nearly every position. The TE spot is essentially a zero and the QB could easily put up under 10 points. Make moves now.',
  },
};

export default MOCK_DATASETS;
