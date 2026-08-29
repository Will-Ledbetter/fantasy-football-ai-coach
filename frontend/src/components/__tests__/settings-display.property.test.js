const fc = require('fast-check');

/**
 * Feature: helix-sideline-ui-overhaul
 * Property tests for settings display logic (Properties 3, 4, 5, 6)
 *
 * Tests pure display logic extracted from Settings.jsx:
 *   - League config field display (Property 3)
 *   - Subscription tier name display (Property 4)
 *   - Downgrade option visibility (Property 5)
 *   - Cancelled subscription period end date display (Property 6)
 *
 * NO React rendering — pure function tests only.
 */

// --- Pure display logic functions (mirrors Settings.jsx) ---

/**
 * Given a config object, returns the league display fields if a league is connected.
 * Mirrors the Settings.jsx league section: shows platform, leagueId, updatedAt when
 * config exists and has a leagueId.
 */
function getLeagueDisplayFields(config) {
  if (!config || !config.leagueId) return null;
  return {
    platform: config.platform,
    leagueId: config.leagueId,
    connectionDate: config.updatedAt,
  };
}

/**
 * Given a subscription, returns the display name for the tier.
 * Mirrors: tier.charAt(0).toUpperCase() + tier.slice(1)
 */
function getTierDisplayName(subscription) {
  const tier = subscription?.tier || 'free';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Given a subscription, determines if the "Downgrade to Free" button should be visible.
 * Mirrors: const isPaid = tier !== 'free' && subStatus === 'active';
 */
function shouldShowDowngrade(subscription) {
  return (
    subscription != null &&
    subscription.tier !== 'free' &&
    subscription.status === 'active'
  );
}

/**
 * Given a subscription, determines if the period end date notice should be shown.
 * Mirrors: isCancelled && periodEndDate check in Settings.jsx
 */
function shouldShowPeriodEndDate(subscription) {
  return (
    subscription != null &&
    subscription.status === 'cancelled' &&
    subscription.periodEndDate != null &&
    new Date(subscription.periodEndDate) > new Date()
  );
}

// --- Generators ---

/** Generates a non-empty alphanumeric string (1-50 chars) */
const nonEmptyStringArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

/** Generates a platform name */
const platformArb = fc.constantFrom('sleeper', 'espn', 'yahoo', 'nfl');

/** Generates a valid ISO date string */
const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(
  (d) => d.toISOString()
);

/** Generates a valid user config with league connected */
const validConfigArb = fc.record({
  platform: platformArb,
  leagueId: nonEmptyStringArb,
  updatedAt: isoDateArb,
});

/** Generates a valid subscription tier */
const tierArb = fc.constantFrom('free', 'pro', 'elite');

/** Generates a paid tier */
const paidTierArb = fc.constantFrom('pro', 'elite');

/** Generates a future ISO date string (1 hour to 365 days from now) */
const futureDateArb = fc.integer({ min: 1, max: 365 * 24 }).map((hoursAhead) => {
  const d = new Date();
  d.setHours(d.getHours() + hoursAhead);
  return d.toISOString();
});

// --- Property 3: Settings page displays all league config fields ---

describe('Feature: helix-sideline-ui-overhaul, Property 3: Settings page displays all league config fields', () => {
  /**
   * Validates: Requirements 4.1
   *
   * For any valid user configuration object containing platform, leagueId,
   * and updatedAt, the rendered Settings page SHALL contain all three values
   * in its output.
   */
  test('all three league fields are present for any valid config', () => {
    fc.assert(
      fc.property(validConfigArb, (config) => {
        const fields = getLeagueDisplayFields(config);

        expect(fields).not.toBeNull();
        expect(fields.platform).toBe(config.platform);
        expect(fields.leagueId).toBe(config.leagueId);
        expect(fields.connectionDate).toBe(config.updatedAt);
      }),
      { numRuns: 100 }
    );
  });

  test('returns null when config is missing or has no leagueId', () => {
    const invalidConfigArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant({}),
      fc.constant({ platform: 'sleeper' }),
      fc.constant({ platform: 'espn', leagueId: '' }),
    );

    fc.assert(
      fc.property(invalidConfigArb, (config) => {
        const fields = getLeagueDisplayFields(config);
        expect(fields).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 4: Subscription tier is correctly displayed ---

describe('Feature: helix-sideline-ui-overhaul, Property 4: Subscription tier is correctly displayed', () => {
  /**
   * Validates: Requirements 5.1
   *
   * For any subscription object with a tier value of 'free', 'pro', or 'elite',
   * the rendered Settings page SHALL display that tier name.
   */
  test('tier display name is capitalized version of tier for any valid tier', () => {
    fc.assert(
      fc.property(tierArb, (tier) => {
        const subscription = { tier, status: 'active' };
        const displayName = getTierDisplayName(subscription);

        const expected = tier.charAt(0).toUpperCase() + tier.slice(1);
        expect(displayName).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  test('defaults to "Free" when subscription is null or has no tier', () => {
    const nullishSubArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant({}),
    );

    fc.assert(
      fc.property(nullishSubArb, (subscription) => {
        const displayName = getTierDisplayName(subscription);
        expect(displayName).toBe('Free');
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Downgrade option visibility for paid subscriptions ---

describe('Feature: helix-sideline-ui-overhaul, Property 5: Downgrade option visibility for paid subscriptions', () => {
  /**
   * Validates: Requirements 5.3
   *
   * For any subscription with tier != 'free' and status == 'active',
   * the Settings page SHALL render a "Downgrade to Free" option.
   */
  test('downgrade is visible for any active paid subscription', () => {
    fc.assert(
      fc.property(paidTierArb, (tier) => {
        const subscription = { tier, status: 'active' };
        expect(shouldShowDowngrade(subscription)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('downgrade is NOT visible for free tier', () => {
    const freeSubArb = fc.constantFrom(
      { tier: 'free', status: 'active' },
      { tier: 'free', status: 'none' },
      null,
      undefined,
    );

    fc.assert(
      fc.property(freeSubArb, (subscription) => {
        expect(shouldShowDowngrade(subscription)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('downgrade is NOT visible for cancelled paid subscriptions', () => {
    fc.assert(
      fc.property(paidTierArb, (tier) => {
        const subscription = { tier, status: 'cancelled' };
        expect(shouldShowDowngrade(subscription)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Cancelled subscription shows period end date ---

describe('Feature: helix-sideline-ui-overhaul, Property 6: Cancelled subscription shows period end date', () => {
  /**
   * Validates: Requirements 5.4
   *
   * For any subscription with status == 'cancelled' and a periodEndDate
   * in the future, the Settings page SHALL display the period end date.
   */
  test('period end date is shown for cancelled sub with future end date', () => {
    fc.assert(
      fc.property(
        fc.record({
          tier: paidTierArb,
          status: fc.constant('cancelled'),
          periodEndDate: futureDateArb,
        }),
        (subscription) => {
          expect(shouldShowPeriodEndDate(subscription)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('period end date is NOT shown for active subscriptions', () => {
    fc.assert(
      fc.property(paidTierArb, (tier) => {
        const subscription = { tier, status: 'active' };
        expect(shouldShowPeriodEndDate(subscription)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('period end date is NOT shown when periodEndDate is missing', () => {
    fc.assert(
      fc.property(paidTierArb, (tier) => {
        const subscription = { tier, status: 'cancelled' };
        expect(shouldShowPeriodEndDate(subscription)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
