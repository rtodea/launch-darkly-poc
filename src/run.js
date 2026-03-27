/**
 * Entry point — the imperative shell.
 * Parses CLI arguments, initializes the LD client, runs the selected
 * scenario(s), and prints results.
 *
 * Usage:
 *   node src/run.js --scenario=win
 *   node src/run.js --scenario=lose --staggered
 *   node src/run.js --scenario=all --staggered --wave-size=50 --delay=5000
 */

import { getClient, closeClient } from "./client.js";
import { getScenario, SCENARIOS } from "./scenarios.js";
import { simulateStaggered, simulateBurst, aggregateResults } from "./simulator.js";
import { logWaveProgress, logScenarioHeader, logFinalResults } from "./logger.js";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      parsed[key] = value ?? true;
    }
  }
  return {
    scenario: parsed.scenario || "win",
    staggered: "staggered" in parsed,
    waveSize: parseInt(parsed["wave-size"] || "100", 10),
    delayMs: parseInt(parsed["delay"] || "3000", 10),
  };
};

const runScenario = async (client, scenarioName, options) => {
  const scenario = getScenario(scenarioName);
  logScenarioHeader(scenario);

  let results;

  if (options.staggered) {
    results = await simulateStaggered(client, scenario, {
      waveSize: options.waveSize,
      delayMs: options.delayMs,
      onWave: logWaveProgress,
    });
  } else {
    results = await simulateBurst(client, scenario, {
      onBatch: logWaveProgress,
    });
  }

  const stats = aggregateResults(results);
  logFinalResults(stats);

  return stats;
};

const main = async () => {
  const options = parseArgs();
  const client = await getClient();

  console.log("LaunchDarkly client initialized.");
  console.log(`Mode: ${options.staggered ? "staggered (presentation)" : "burst (fast)"}`);

  try {
    if (options.scenario === "all") {
      for (const name of Object.keys(SCENARIOS)) {
        await runScenario(client, name, options);
      }
    } else {
      await runScenario(client, options.scenario, options);
    }

    console.log("Flushing final events to LaunchDarkly...");
    await closeClient(client);
    console.log("Done. Check the LaunchDarkly Experiments dashboard.");
  } catch (err) {
    console.error("Simulation failed:", err.message);
    await closeClient(client);
    process.exit(1);
  }
};

main();
