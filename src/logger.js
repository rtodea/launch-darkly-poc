/**
 * Formats and prints simulation progress to the console.
 * Provides real-time feedback during presentations.
 */

export const logWaveProgress = (wave, totalWaves, stats) => {
  const pct = ((wave / totalWaves) * 100).toFixed(0);
  const bar = progressBar(wave, totalWaves);

  console.log(
    `  ${bar} ${pct}% | ` +
    `Users: ${stats.total} | ` +
    `Control: ${formatRate(stats.control)} | ` +
    `Treatment: ${formatRate(stats.treatment)}`
  );
};

export const logScenarioHeader = (scenario) => {
  console.log("");
  console.log("=".repeat(70));
  console.log(`  Scenario: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`  Simulating ${scenario.userCount} users...`);
  console.log("=".repeat(70));
  console.log("");
};

export const logFinalResults = (stats) => {
  console.log("");
  console.log("-".repeat(70));
  console.log("  Final Results:");
  console.log(`    Control:   ${stats.control.conversions}/${stats.control.count} conversions (${(stats.control.rate * 100).toFixed(1)}%)`);
  console.log(`    Treatment: ${stats.treatment.conversions}/${stats.treatment.count} conversions (${(stats.treatment.rate * 100).toFixed(1)}%)`);
  console.log(`    Lift:      ${calculateLift(stats.control.rate, stats.treatment.rate)}`);
  console.log("-".repeat(70));
  console.log("");
};

const formatRate = ({ conversions, count, rate }) =>
  `${conversions}/${count} (${(rate * 100).toFixed(1)}%)`;

const calculateLift = (controlRate, treatmentRate) => {
  if (controlRate === 0) return "N/A (no control conversions)";
  const lift = ((treatmentRate - controlRate) / controlRate) * 100;
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${lift.toFixed(1)}%`;
};

const progressBar = (current, total, width = 20) => {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `[${"#".repeat(filled)}${".".repeat(empty)}]`;
};
