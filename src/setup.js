/**
 * Automated LaunchDarkly setup via REST API.
 * Creates the feature flag, metric, and experiment programmatically.
 *
 * Usage: node src/setup.js
 *
 * Run `npm run cleanup` first if you need a fresh start.
 * Each run creates a uniquely-timestamped experiment.
 */

import {
  LD_API_KEY,
  LD_PROJECT_KEY,
  LD_ENVIRONMENT_KEY,
  FLAG_KEY,
  METRICS,
} from "./config.js";
import { apiCall, getFlag, getCurrentMemberId } from "./api.js";

const timestamp = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}_${pad(now.getMinutes())}`;
};

const createFlag = async () => {
  console.log("Creating feature flag...");
  await apiCall("POST", `/flags/${LD_PROJECT_KEY}`, {
    key: FLAG_KEY,
    name: "Show Recommendations",
    description: "Controls the recommendations row in the iOS streaming app",
    kind: "boolean",
    variations: [
      { value: false, name: "Control", description: "Standard UI without recommendations" },
      { value: true, name: "Treatment", description: "UI with recommendations row" },
    ],
    defaults: {
      onVariation: 1,
      offVariation: 0,
    },
    clientSideAvailability: {
      usingMobileKey: true,
      usingEnvironmentId: true,
    },
  }, { ignoreDuplicate: true });
};

const enableFlag = async () => {
  console.log("Enabling flag with 50/50 rollout...");
  await apiCall(
    "PATCH",
    `/flags/${LD_PROJECT_KEY}/${FLAG_KEY}`,
    {
      patch: [
        {
          op: "replace",
          path: `/environments/${LD_ENVIRONMENT_KEY}/on`,
          value: true,
        },
        {
          op: "replace",
          path: `/environments/${LD_ENVIRONMENT_KEY}/fallthrough`,
          value: {
            rollout: {
              variations: [
                { variation: 0, weight: 50000 },
                { variation: 1, weight: 50000 },
              ],
            },
          },
        },
      ],
      comment: "Enable flag with 50/50 rollout for A/B test",
    }
  );
};

const createMetric = async () => {
  console.log("Creating conversion metric...");
  await apiCall("POST", `/metrics/${LD_PROJECT_KEY}`, {
    key: METRICS.contentClicked,
    name: "Content Clicked",
    description: "Tracks when a user taps on a content tile in the streaming app",
    kind: "custom",
    eventKey: METRICS.contentClicked,
    isNumeric: false,
    successCriteria: "HigherThanBaseline",
  }, { ignoreDuplicate: true });
};

const buildIterationInput = async () => {
  // Must fetch fresh — enableFlag() bumps the version
  const flag = await getFlag({ fresh: true });
  return {
    hypothesis: "Adding a recommendations row will increase content engagement by at least 10%",
    canReshuffleTraffic: true,
    metrics: [
      {
        key: METRICS.contentClicked,
        isGroup: false,
      },
    ],
    primarySingleMetricKey: METRICS.contentClicked,
    treatments: [
      {
        name: "Control",
        baseline: true,
        allocationPercent: "50",
        parameters: [
          {
            flagKey: FLAG_KEY,
            variationId: flag.variations[0]._id,
          },
        ],
      },
      {
        name: "Treatment",
        baseline: false,
        allocationPercent: "50",
        parameters: [
          {
            flagKey: FLAG_KEY,
            variationId: flag.variations[1]._id,
          },
        ],
      },
    ],
    flags: {
      [FLAG_KEY]: {
        ruleId: "fallthrough",
        flagConfigVersion: flag.environments[LD_ENVIRONMENT_KEY].version,
      },
    },
  };
};

const createExperiment = async (experimentKey) => {
  console.log(`Creating experiment: ${experimentKey}`);

  const memberId = await getCurrentMemberId();
  const iterationInput = await buildIterationInput();

  await apiCall(
    "POST",
    `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments`,
    {
      name: `Recommendations Engagement (${experimentKey.split("-").slice(-1)[0].replace("_", ":")})`,
      description: "Measures whether the recommendations row increases content clicks",
      key: experimentKey,
      maintainerId: memberId,
      iteration: iterationInput,
    }
  );

  return experimentKey;
};

const startExperiment = async (experimentKey) => {
  console.log("Starting experiment...");
  await apiCall(
    "PATCH",
    `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments/${experimentKey}`,
    {
      instructions: [{ kind: "startIteration" }],
    }
  );
  console.log("  Experiment started.");
};

const main = async () => {
  console.log("Setting up LaunchDarkly resources...\n");

  if (!LD_API_KEY) {
    console.error("Error: LD_API_KEY is not set. Copy .env.example to .env and fill in your keys.");
    process.exit(1);
  }

  const experimentKey = `rec-engagement-${timestamp()}`;

  try {
    await createFlag();
    await enableFlag();
    await createMetric();
    await createExperiment(experimentKey);
    await startExperiment(experimentKey);

    console.log("\nSetup complete!");
    console.log(`Experiment key: ${experimentKey}`);
    console.log("\nYou can now run simulations:");
    console.log("  npm run simulate:win");
    console.log("  npm run simulate:lose");
    console.log("  npm run simulate:inconclusive");
    console.log("  npm run demo  (staggered, for live presentations)");
  } catch (err) {
    console.error("\nSetup failed:", err.message);
    process.exit(1);
  }
};

main();
