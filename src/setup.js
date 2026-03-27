/**
 * Automated LaunchDarkly setup via REST API.
 * Creates the feature flag, metric, and experiment programmatically
 * so there's no manual UI clicking required.
 *
 * Usage: node src/setup.js
 */

import {
  LD_API_KEY,
  LD_PROJECT_KEY,
  LD_ENVIRONMENT_KEY,
  FLAG_KEY,
  METRICS,
} from "./config.js";

const API_BASE = "https://app.launchdarkly.com/api/v2";

const headers = () => ({
  Authorization: LD_API_KEY,
  "Content-Type": "application/json",
});

const apiCall = async (method, path, body) => {
  const url = `${API_BASE}${path}`;
  const options = { method, headers: headers() };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (res.status === 409) {
    console.log(`  Already exists: ${path}`);
    return null;
  }

  if (!res.ok) {
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
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
  });
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
  });
};

const createExperiment = async () => {
  console.log("Creating experiment...");

  const iterations = [
    {
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
              variationId: await getFlagVariationId(0),
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
              variationId: await getFlagVariationId(1),
            },
          ],
        },
      ],
      flags: {
        [FLAG_KEY]: {
          ruleId: "fallthrough",
          flagConfigVersion: 1,
        },
      },
    },
  ];

  await apiCall(
    "POST",
    `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments`,
    {
      name: "Recommendations Row Engagement",
      description: "Measures whether the recommendations row increases content clicks",
      key: "recommendations-engagement",
      maintainerId: await getCurrentMemberId(),
      iteration: iterations[0],
    }
  );
};

const startExperiment = async () => {
  console.log("Starting experiment iteration...");
  const experiments = await apiCall(
    "GET",
    `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments?filter=key equals recommendations-engagement`
  );

  if (experiments?.items?.length > 0) {
    const experiment = experiments.items[0];
    const currentIteration = experiment.currentIteration;

    if (currentIteration && currentIteration.status === "not_started") {
      await apiCall(
        "POST",
        `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments/recommendations-engagement/iterations`,
        { action: "start" }
      );
      console.log("  Experiment started.");
    } else {
      console.log("  Experiment already running or no iteration found.");
    }
  }
};

const getFlagVariationId = async (index) => {
  const flag = await apiCall("GET", `/flags/${LD_PROJECT_KEY}/${FLAG_KEY}`);
  return flag.variations[index]._id;
};

const getCurrentMemberId = async () => {
  const me = await apiCall("GET", "/members/me");
  return me._id;
};

const main = async () => {
  console.log("Setting up LaunchDarkly resources...\n");

  if (!LD_API_KEY) {
    console.error("Error: LD_API_KEY is not set. Copy .env.example to .env and fill in your keys.");
    process.exit(1);
  }

  try {
    await createFlag();
    await enableFlag();
    await createMetric();
    await createExperiment();
    await startExperiment();

    console.log("\nSetup complete!");
    console.log("You can now run simulations:");
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
