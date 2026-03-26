/**
 * Season Checker Lambda
 * Simple endpoint to check if we're in NFL season
 * Used by frontend to show/hide features
 */

exports.handler = async (event) => {
  const inSeason = isNFLSeason();
  const currentWeek = inSeason ? getCurrentWeek() : null;
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      inSeason: inSeason,
      currentWeek: currentWeek,
      seasonStart: getSeasonDates().start,
      seasonEnd: getSeasonDates().end,
      message: inSeason 
        ? `Week ${currentWeek} of NFL season` 
        : 'NFL offseason - see you in September!'
    })
  };
};

function isNFLSeason() {
  const now = new Date();
  const year = now.getFullYear();
  
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
  
  return now >= seasonStart && now <= seasonEnd;
}

function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const seasonStart = getFirstThursdayOfSeptember(
    now.getMonth() < 8 ? year - 1 : year
  );
  
  const diffTime = now - seasonStart;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(Math.ceil(diffDays / 7), 1), 18);
}

function getSeasonDates() {
  const now = new Date();
  const year = now.getFullYear();
  
  if (now.getMonth() < 8) {
    // We're in last year's season or offseason
    return {
      start: getFirstThursdayOfSeptember(year - 1).toISOString().split('T')[0],
      end: new Date(year, 1, 15).toISOString().split('T')[0]
    };
  }
  
  return {
    start: getFirstThursdayOfSeptember(year).toISOString().split('T')[0],
    end: new Date(year + 1, 1, 15).toISOString().split('T')[0]
  };
}

function getFirstThursdayOfSeptember(year) {
  const sept1 = new Date(year, 8, 1);
  const dayOfWeek = sept1.getDay();
  
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  if (daysUntilThursday === 0 && dayOfWeek !== 4) {
    daysUntilThursday = 7;
  }
  
  return new Date(year, 8, 1 + daysUntilThursday);
}
