const fc = require('fast-check');

/**
 * Feature: helix-sideline-ui-overhaul
 * Property tests for animation timing (Properties 1, 2)
 *
 * Tests the pure animation delay calculation logic extracted from Dashboard.jsx:
 *   const staggerDelay = Math.min(i * 50, 200);
 *
 * Animation tokens from design:
 *   staggerBase: 50ms (delay between cards)
 *   cardDuration: 400ms (per card animation)
 *   maxTotal: 600ms (max total stagger time)
 */

// --- Pure function under test ---

const STAGGER_BASE = 50;
const CARD_DURATION = 400;
const MAX_TOTAL = 600;
const MAX_DELAY = MAX_TOTAL - CARD_DURATION; // 200ms

function calculateStaggerDelay(index) {
  return Math.min(index * STAGGER_BASE, MAX_DELAY);
}

// --- Generators ---

/** Card index where delay is still proportional (i * 50 <= 200, so i <= 4) */
const proportionalIndexArb = fc.integer({ min: 0, max: 4 });

/** Any non-negative card index (0 to 100 cards) */
const cardIndexArb = fc.integer({ min: 0, max: 99 });

/** Number of visible cards (1 to 100) */
const cardCountArb = fc.integer({ min: 1, max: 100 });

// --- Property 1: Stagger animation delay is proportional to card index ---

describe('Feature: helix-sideline-ui-overhaul, Property 1: Stagger animation delay is proportional to card index', () => {
  /**
   * Validates: Requirements 3.1
   *
   * For any list of N recommendation cards, the animation delay applied to
   * card at index i SHALL equal i × 50ms.
   *
   * This holds for indices where i * 50 <= 200 (the cap). For i in [0..4],
   * the delay is exactly i * 50ms.
   */
  test('delay equals index × 50ms for indices within proportional range', () => {
    fc.assert(
      fc.property(proportionalIndexArb, (index) => {
        const delay = calculateStaggerDelay(index);
        expect(delay).toBe(index * STAGGER_BASE);
      }),
      { numRuns: 100 }
    );
  });

  test('delay is capped at 200ms for indices beyond proportional range', () => {
    const highIndexArb = fc.integer({ min: 5, max: 99 });

    fc.assert(
      fc.property(highIndexArb, (index) => {
        const delay = calculateStaggerDelay(index);
        expect(delay).toBe(MAX_DELAY);
      }),
      { numRuns: 100 }
    );
  });

  test('delay is always non-negative for any valid index', () => {
    fc.assert(
      fc.property(cardIndexArb, (index) => {
        const delay = calculateStaggerDelay(index);
        expect(delay).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 2: Total animation duration is capped ---

describe('Feature: helix-sideline-ui-overhaul, Property 2: Total animation duration is capped', () => {
  /**
   * Validates: Requirements 3.3
   *
   * For any number of visible recommendation cards N, the last card's
   * animation start time (delay) plus its animation duration SHALL NOT
   * exceed 600ms total.
   *
   * Last card delay = calculateStaggerDelay(N - 1)
   * Total = delay + CARD_DURATION <= MAX_TOTAL (600ms)
   */
  test('last card delay + card duration never exceeds 600ms', () => {
    fc.assert(
      fc.property(cardCountArb, (numCards) => {
        const lastIndex = numCards - 1;
        const lastDelay = calculateStaggerDelay(lastIndex);
        const totalDuration = lastDelay + CARD_DURATION;

        expect(totalDuration).toBeLessThanOrEqual(MAX_TOTAL);
      }),
      { numRuns: 100 }
    );
  });

  test('every card delay + card duration never exceeds 600ms', () => {
    fc.assert(
      fc.property(cardCountArb, (numCards) => {
        for (let i = 0; i < numCards; i++) {
          const delay = calculateStaggerDelay(i);
          const total = delay + CARD_DURATION;
          expect(total).toBeLessThanOrEqual(MAX_TOTAL);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('total duration equals exactly 600ms at the cap boundary', () => {
    // At index 4: delay = 4 * 50 = 200, total = 200 + 400 = 600
    const delay = calculateStaggerDelay(4);
    expect(delay + CARD_DURATION).toBe(MAX_TOTAL);
  });
});
