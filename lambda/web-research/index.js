const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event) => {
  const { players, weekNumber } = event;
  console.log(`Researching web data for ${players?.length || 0} players for week ${weekNumber}`);
  
  try {
    // Research from multiple sources in parallel
    const [
      fantasyProsData,
      redditSentiment,
      twitterBuzz,
      newsArticles,
      podcastMentions,
      youtubeAnalysis
    ] = await Promise.all([
      scrapeFantasyPros(players, weekNumber),
      analyzeRedditSentiment(players),
      getTwitterBuzz(players),
      fetchNewsArticles(players),
      scrapePodcastMentions(players),
      getYouTubeAnalysis(players)
    ]);

    const researchResults = players.map(player => ({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      team: player.team,
      research: {
        expertConsensus: getExpertConsensus(player, fantasyProsData),
        socialSentiment: getSocialSentiment(player, redditSentiment, twitterBuzz),
        newsImpact: getNewsImpact(player, newsArticles),
        podcastBuzz: getPodcastBuzz(player, podcastMentions),
        videoAnalysis: getVideoAnalysis(player, youtubeAnalysis),
        overallBuzz: calculateOverallBuzz(player, {
          fantasyProsData, redditSentiment, twitterBuzz, 
          newsArticles, podcastMentions, youtubeAnalysis
        })
      }
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        researchResults,
        metadata: {
          weekNumber,
          researchTimestamp: new Date().toISOString(),
          sources: ['fantasypros', 'reddit', 'twitter', 'news', 'podcasts', 'youtube']
        }
      })
    };
  } catch (error) {
    console.error('Error in web research:', error);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        researchResults: players.map(player => ({
          playerId: player.playerId,
          name: player.name,
          research: {
            expertConsensus: { status: 'unavailable', reason: 'Research failed' },
            socialSentiment: { sentiment: 'neutral', confidence: 'low' },
            newsImpact: { impact: 'none', articles: [] },
            overallBuzz: { level: 'low', confidence: 'low' }
          }
        })),
        metadata: {
          weekNumber,
          researchTimestamp: new Date().toISOString(),
          error: true
        }
      })
    };
  }
};

async function scrapeFantasyPros(players, weekNumber) {
  try {
    // Mock FantasyPros data - in production, scrape actual rankings
    const rankings = {
      QB: generatePositionRankings(players.filter(p => p.position === 'QB'), 'QB'),
      RB: generatePositionRankings(players.filter(p => p.position === 'RB'), 'RB'),
      WR: generatePositionRankings(players.filter(p => p.position === 'WR'), 'WR'),
      TE: generatePositionRankings(players.filter(p => p.position === 'TE'), 'TE')
    };
    
    return {
      rankings,
      expertCount: 127, // Number of experts contributing
      lastUpdated: new Date().toISOString(),
      weekNumber
    };
  } catch (error) {
    console.error('Error scraping FantasyPros:', error);
    return { rankings: {}, expertCount: 0 };
  }
}

async function analyzeRedditSentiment(players) {
  try {
    // Mock Reddit sentiment analysis - in production, use Reddit API
    const sentiments = players.map(player => ({
      playerId: player.playerId,
      sentiment: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'][Math.floor(Math.random() * 5)],
      mentions: Math.floor(Math.random() * 50) + 5,
      keyPhrases: generateRedditPhrases(player),
      topComments: generateTopComments(player),
      subreddits: ['fantasyfootball', 'DynastyFF', player.team?.toLowerCase()].filter(Boolean)
    }));
    
    return sentiments;
  } catch (error) {
    console.error('Error analyzing Reddit sentiment:', error);
    return [];
  }
}

async function getTwitterBuzz(players) {
  try {
    // Mock Twitter analysis - in production, use Twitter API v2
    const twitterData = players.map(player => ({
      playerId: player.playerId,
      mentions: Math.floor(Math.random() * 200) + 10,
      sentiment: Math.random() * 2 - 1, // -1 to 1 scale
      trending: Math.random() > 0.8, // 20% chance of trending
      keyTweets: generateKeyTweets(player),
      influencerMentions: generateInfluencerMentions(player),
      hashtags: [`#${player.name?.replace(' ', '')}`, `#${player.team}`, '#FantasyFootball']
    }));
    
    return twitterData;
  } catch (error) {
    console.error('Error getting Twitter buzz:', error);
    return [];
  }
}

async function fetchNewsArticles(players) {
  try {
    // Mock news data - in production, use News API or scrape ESPN/NFL.com
    const newsData = players.map(player => ({
      playerId: player.playerId,
      articles: generateNewsArticles(player),
      breakingNews: Math.random() > 0.9, // 10% chance of breaking news
      injuryUpdates: generateInjuryUpdates(player),
      tradeRumors: Math.random() > 0.95 ? generateTradeRumors(player) : null
    }));
    
    return newsData;
  } catch (error) {
    console.error('Error fetching news articles:', error);
    return [];
  }
}

async function scrapePodcastMentions(players) {
  try {
    // Mock podcast data - in production, scrape podcast transcripts
    const podcastData = players.map(player => ({
      playerId: player.playerId,
      mentions: Math.floor(Math.random() * 10) + 1,
      podcasts: generatePodcastMentions(player),
      expertOpinions: generateExpertPodcastOpinions(player),
      consensus: ['start', 'sit', 'flex', 'avoid'][Math.floor(Math.random() * 4)]
    }));
    
    return podcastData;
  } catch (error) {
    console.error('Error scraping podcast mentions:', error);
    return [];
  }
}

async function getYouTubeAnalysis(players) {
  try {
    // Mock YouTube data - in production, use YouTube API
    const youtubeData = players.map(player => ({
      playerId: player.playerId,
      videos: generateYouTubeVideos(player),
      totalViews: Math.floor(Math.random() * 100000) + 5000,
      sentiment: Math.random() * 2 - 1,
      channels: ['FantasyFootballers', 'TheFantasyHeadliners', 'FantasyPros']
    }));
    
    return youtubeData;
  } catch (error) {
    console.error('Error getting YouTube analysis:', error);
    return [];
  }
}

function generatePositionRankings(players, position) {
  return players.map((player, index) => ({
    playerId: player.playerId,
    name: player.name,
    rank: index + Math.floor(Math.random() * 10) + 1,
    tier: Math.floor(index / 6) + 1,
    projection: generateProjection(position),
    confidence: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
    reasoning: generateExpertReasoning(player, position)
  }));
}

function generateProjection(position) {
  const projections = {
    QB: { points: Math.floor(Math.random() * 15) + 15, passing: Math.floor(Math.random() * 150) + 200, rushing: Math.floor(Math.random() * 30) },
    RB: { points: Math.floor(Math.random() * 12) + 8, rushing: Math.floor(Math.random() * 80) + 40, receiving: Math.floor(Math.random() * 40) },
    WR: { points: Math.floor(Math.random() * 15) + 5, receiving: Math.floor(Math.random() * 80) + 30, targets: Math.floor(Math.random() * 6) + 4 },
    TE: { points: Math.floor(Math.random() * 12) + 4, receiving: Math.floor(Math.random() * 60) + 20, targets: Math.floor(Math.random() * 4) + 3 }
  };
  
  return projections[position] || { points: Math.floor(Math.random() * 10) + 5 };
}

function generateExpertReasoning(player, position) {
  const reasons = {
    QB: [
      `Strong matchup against ${Math.floor(Math.random() * 32) + 1}th ranked pass defense`,
      'High implied team total suggests passing volume',
      'Rushing upside adds to floor and ceiling',
      'Home field advantage in favorable conditions',
      'Key weapons healthy and available'
    ],
    RB: [
      'Workhorse role with goal line carries expected',
      'Favorable game script for ground game',
      'Weak run defense allows for big day',
      'Pass-catching role adds PPR value',
      'Injury to backfield mate increases touches'
    ],
    WR: [
      'Primary target in high-volume passing attack',
      'Red zone looks trending upward',
      'Slot role provides target floor',
      'Deep threat with big play potential',
      'Favorable coverage matchup expected'
    ],
    TE: [
      'Red zone target with TD upside',
      'Consistent target share in offense',
      'Matchup against weak TE coverage',
      'Streaming option with decent floor',
      'Key role in game plan this week'
    ]
  };
  
  const positionReasons = reasons[position] || reasons.RB;
  return positionReasons[Math.floor(Math.random() * positionReasons.length)];
}

function generateRedditPhrases(player) {
  const phrases = [
    `${player.name} is a must-start this week`,
    `Fade ${player.name} in tough matchup`,
    `${player.name} has sneaky upside`,
    `Volume play with ${player.name}`,
    `${player.name} or bust this week`
  ];
  
  return phrases.slice(0, Math.floor(Math.random() * 3) + 1);
}

function generateTopComments(player) {
  return [
    {
      comment: `${player.name} has been getting more red zone looks lately`,
      upvotes: Math.floor(Math.random() * 100) + 20,
      sentiment: 'positive'
    },
    {
      comment: `Weather could be a factor for ${player.team} this week`,
      upvotes: Math.floor(Math.random() * 50) + 10,
      sentiment: 'neutral'
    }
  ];
}

function generateKeyTweets(player) {
  return [
    {
      text: `${player.name} looking like a strong play this week #FantasyFootball`,
      author: '@FantasyExpert',
      likes: Math.floor(Math.random() * 500) + 50,
      retweets: Math.floor(Math.random() * 100) + 10
    }
  ];
}

function generateInfluencerMentions(player) {
  const influencers = ['@FantasyPros', '@TheFantasyHeadliners', '@FantasyFootballers'];
  return influencers.slice(0, Math.floor(Math.random() * 2) + 1).map(handle => ({
    handle,
    mention: `${player.name} is my sleeper pick this week`,
    followers: Math.floor(Math.random() * 100000) + 10000
  }));
}

function generateNewsArticles(player) {
  return [
    {
      title: `${player.name} Expected to Have Expanded Role`,
      source: 'ESPN',
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      impact: 'positive'
    },
    {
      title: `${player.team} Injury Report: ${player.name} Listed as Probable`,
      source: 'NFL.com',
      timestamp: new Date(Date.now() - Math.random() * 43200000).toISOString(),
      impact: 'neutral'
    }
  ].slice(0, Math.floor(Math.random() * 2) + 1);
}

function generateInjuryUpdates(player) {
  if (Math.random() > 0.7) {
    return {
      status: ['Questionable', 'Probable', 'Doubtful'][Math.floor(Math.random() * 3)],
      injury: ['Ankle', 'Hamstring', 'Shoulder', 'Knee'][Math.floor(Math.random() * 4)],
      lastUpdate: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      impact: 'Monitor practice reports'
    };
  }
  return null;
}

function generateTradeRumors(player) {
  return {
    rumor: `${player.name} mentioned in trade discussions`,
    source: 'NFL Insider',
    likelihood: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
    impact: 'Could change role significantly'
  };
}

function generatePodcastMentions(player) {
  return [
    {
      podcast: 'The Fantasy Footballers',
      episode: `Week ${Math.floor(Math.random() * 18) + 1} Waiver Wire`,
      mention: `${player.name} is a strong add this week`,
      timestamp: '15:32'
    },
    {
      podcast: 'Fantasy Headliners',
      episode: 'Start/Sit Decisions',
      mention: `I'm starting ${player.name} with confidence`,
      timestamp: '8:45'
    }
  ].slice(0, Math.floor(Math.random() * 2) + 1);
}

function generateExpertPodcastOpinions(player) {
  return [
    {
      expert: 'Mike Wright',
      opinion: `${player.name} has a great matchup this week`,
      confidence: 'High',
      reasoning: 'Favorable game script and target share'
    }
  ];
}

function generateYouTubeVideos(player) {
  return [
    {
      title: `${player.name} Week ${Math.floor(Math.random() * 18) + 1} Analysis`,
      channel: 'FantasyPros',
      views: Math.floor(Math.random() * 50000) + 5000,
      likes: Math.floor(Math.random() * 1000) + 100,
      sentiment: 'positive'
    }
  ].slice(0, Math.floor(Math.random() * 2) + 1);
}

function getExpertConsensus(player, fantasyProsData) {
  const playerRanking = fantasyProsData.rankings[player.position]?.find(r => r.playerId === player.playerId);
  
  if (!playerRanking) {
    return { status: 'unranked', confidence: 'low' };
  }
  
  return {
    rank: playerRanking.rank,
    tier: playerRanking.tier,
    projection: playerRanking.projection,
    confidence: playerRanking.confidence,
    reasoning: playerRanking.reasoning,
    expertCount: fantasyProsData.expertCount
  };
}

function getSocialSentiment(player, redditData, twitterData) {
  const reddit = redditData.find(r => r.playerId === player.playerId);
  const twitter = twitterData.find(t => t.playerId === player.playerId);
  
  const redditScore = reddit ? getSentimentScore(reddit.sentiment) : 0;
  const twitterScore = twitter ? twitter.sentiment : 0;
  
  const overallSentiment = (redditScore + twitterScore) / 2;
  
  return {
    overall: overallSentiment,
    reddit: {
      sentiment: reddit?.sentiment || 'neutral',
      mentions: reddit?.mentions || 0,
      keyPhrases: reddit?.keyPhrases || []
    },
    twitter: {
      sentiment: twitterScore,
      mentions: twitter?.mentions || 0,
      trending: twitter?.trending || false
    }
  };
}

function getSentimentScore(sentiment) {
  const scores = {
    'very_positive': 1,
    'positive': 0.5,
    'neutral': 0,
    'negative': -0.5,
    'very_negative': -1
  };
  return scores[sentiment] || 0;
}

function getNewsImpact(player, newsData) {
  const playerNews = newsData.find(n => n.playerId === player.playerId);
  
  if (!playerNews) {
    return { impact: 'none', articles: [] };
  }
  
  return {
    impact: playerNews.breakingNews ? 'high' : 'medium',
    articles: playerNews.articles,
    injuryUpdates: playerNews.injuryUpdates,
    tradeRumors: playerNews.tradeRumors
  };
}

function getPodcastBuzz(player, podcastData) {
  const playerPodcasts = podcastData.find(p => p.playerId === player.playerId);
  
  if (!playerPodcasts) {
    return { buzz: 'low', mentions: 0 };
  }
  
  return {
    buzz: playerPodcasts.mentions > 5 ? 'high' : 'medium',
    mentions: playerPodcasts.mentions,
    podcasts: playerPodcasts.podcasts,
    consensus: playerPodcasts.consensus
  };
}

function getVideoAnalysis(player, youtubeData) {
  const playerVideos = youtubeData.find(y => y.playerId === player.playerId);
  
  if (!playerVideos) {
    return { analysis: 'limited', views: 0 };
  }
  
  return {
    analysis: playerVideos.totalViews > 50000 ? 'extensive' : 'moderate',
    totalViews: playerVideos.totalViews,
    sentiment: playerVideos.sentiment,
    videos: playerVideos.videos
  };
}

function calculateOverallBuzz(player, allData) {
  const { fantasyProsData, redditSentiment, twitterBuzz, newsArticles, podcastMentions, youtubeAnalysis } = allData;
  
  let buzzScore = 0;
  let factors = 0;
  
  // Expert ranking factor
  const ranking = fantasyProsData.rankings[player.position]?.find(r => r.playerId === player.playerId);
  if (ranking && ranking.rank <= 20) {
    buzzScore += 2;
    factors++;
  }
  
  // Social media factor
  const reddit = redditSentiment.find(r => r.playerId === player.playerId);
  const twitter = twitterBuzz.find(t => t.playerId === player.playerId);
  
  if (reddit && reddit.mentions > 20) {
    buzzScore += 1;
    factors++;
  }
  
  if (twitter && twitter.mentions > 100) {
    buzzScore += 1;
    factors++;
  }
  
  // News factor
  const news = newsArticles.find(n => n.playerId === player.playerId);
  if (news && news.breakingNews) {
    buzzScore += 3;
    factors++;
  }
  
  const averageBuzz = factors > 0 ? buzzScore / factors : 0;
  
  let level = 'low';
  if (averageBuzz >= 2) level = 'very_high';
  else if (averageBuzz >= 1.5) level = 'high';
  else if (averageBuzz >= 1) level = 'medium';
  
  return {
    level,
    score: averageBuzz,
    confidence: factors >= 3 ? 'high' : factors >= 2 ? 'medium' : 'low'
  };
}