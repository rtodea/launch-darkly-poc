import { createUserContext } from "./context.js";
import { evaluateFlag, trackEvent } from "./client.js";
import { shouldConvert } from "./scenarios.js";
import { FLAG_KEY, METRICS } from "./config.js";

/**
 * Simulates a single user session:
 * 1. Creates a unique user context (device)
 * 2. Evaluates the feature flag (bucket assignment)
 * 3. Probabilistically triggers a conversion event
 *
 * Returns a result object for logging/aggregation.
 */
export const simulateUser = async (client, scenario) => {
  const context = createUserContext();
  const flagValue = await evaluateFlag(client, FLAG_KEY, context);
  const converted = shouldConvert(flagValue, scenario);

  if (converted) {
    trackEvent(client, METRICS.contentClicked, context);
  }

  return {
    userId: context.key,
    variation: flagValue ? "treatment" : "control",
    converted,
  };
};

/**
 * Runs a batch of concurrent user simulations.
 * Returns aggregated results.
 */
export const simulateBatch = async (client, scenario, batchSize) => {
  const promises = Array.from({ length: batchSize }, () =>
    simulateUser(client, scenario)
  );
  return Promise.all(promises);
};

/**
 * Runs the full simulation in waves (staggered mode).
 * Each wave sends a batch of users, then pauses to let LD process events.
 * This creates the real-time dashboard effect during presentations.
 */
export const simulateStaggered = async (client, scenario, { waveSize = 100, delayMs = 3000, onWave } = {}) => {
  const totalUsers = scenario.userCount;
  const waves = Math.ceil(totalUsers / waveSize);
  const allResults = [];

  for (let i = 0; i < waves; i++) {
    const remaining = totalUsers - i * waveSize;
    const currentBatchSize = Math.min(waveSize, remaining);

    const results = await simulateBatch(client, scenario, currentBatchSize);
    allResults.push(...results);

    // Flush after each wave so LD dashboard updates in real time
    await client.flush();

    const stats = aggregateResults(allResults);
    if (onWave) onWave(i + 1, waves, stats);

    // Pause between waves (except after the last one)
    if (i < waves - 1) {
      await sleep(delayMs);
    }
  }

  return allResults;
};

/**
 * Runs the full simulation as a single burst (fast mode).
 */
export const simulateBurst = async (client, scenario, { batchSize = 200, onBatch } = {}) => {
  const totalUsers = scenario.userCount;
  const batches = Math.ceil(totalUsers / batchSize);
  const allResults = [];

  for (let i = 0; i < batches; i++) {
    const remaining = totalUsers - i * batchSize;
    const currentBatchSize = Math.min(batchSize, remaining);

    const results = await simulateBatch(client, scenario, currentBatchSize);
    allResults.push(...results);

    if (onBatch) {
      const stats = aggregateResults(allResults);
      onBatch(i + 1, batches, stats);
    }
  }

  return allResults;
};

/**
 * Pure function: aggregates simulation results into summary statistics.
 */
export const aggregateResults = (results) => {
  const control = results.filter((r) => r.variation === "control");
  const treatment = results.filter((r) => r.variation === "treatment");

  return {
    total: results.length,
    control: {
      count: control.length,
      conversions: control.filter((r) => r.converted).length,
      rate: control.length > 0
        ? control.filter((r) => r.converted).length / control.length
        : 0,
    },
    treatment: {
      count: treatment.length,
      conversions: treatment.filter((r) => r.converted).length,
      rate: treatment.length > 0
        ? treatment.filter((r) => r.converted).length / treatment.length
        : 0,
    },
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
