/**
 * Scenario definitions for A/B test simulations.
 *
 * Each scenario defines the probability of a "content-clicked" conversion
 * event for each variation (control vs treatment). The simulator uses these
 * probabilities to generate biased traffic that produces a predictable
 * experiment outcome on the LaunchDarkly dashboard.
 *
 * The probabilities are chosen to produce statistically significant (or
 * insignificant) results within the given sample size.
 */

export const SCENARIOS = {
  /**
   * Treatment wins decisively.
   * The recommendations row drives significantly more engagement.
   * Expected: ~95%+ confidence, treatment declared winner.
   */
  win: {
    name: "Treatment Wins",
    description: "Recommendations row drives 2x more engagement",
    userCount: 2000,
    controlConversionRate: 0.12,
    treatmentConversionRate: 0.24,
  },

  /**
   * Treatment loses.
   * The recommendations row actually hurts engagement — users find it
   * distracting and click less on content overall.
   * Expected: ~95%+ confidence, control declared winner.
   */
  lose: {
    name: "Treatment Loses",
    description: "Recommendations row distracts users, reducing engagement",
    userCount: 2000,
    controlConversionRate: 0.25,
    treatmentConversionRate: 0.13,
  },

  /**
   * Inconclusive result.
   * Both variations perform nearly identically — no meaningful difference.
   * Expected: Low confidence, no winner declared.
   */
  inconclusive: {
    name: "Inconclusive",
    description: "No meaningful difference between variations",
    userCount: 2000,
    controlConversionRate: 0.18,
    treatmentConversionRate: 0.19,
  },
};

/**
 * Determines whether a simulated user converts based on their flag variation.
 * Pure function — no side effects.
 */
export const shouldConvert = (flagValue, scenario) => {
  const rate = flagValue
    ? scenario.treatmentConversionRate
    : scenario.controlConversionRate;
  return Math.random() < rate;
};

/**
 * Returns the scenario config by name, or throws.
 */
export const getScenario = (name) => {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    const valid = Object.keys(SCENARIOS).join(", ");
    throw new Error(`Unknown scenario "${name}". Valid: ${valid}`);
  }
  return scenario;
};
