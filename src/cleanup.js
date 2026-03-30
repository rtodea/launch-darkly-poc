/**
 * Tears down LaunchDarkly experiments created by setup.js.
 * Archives all experiments linked to our flag.
 *
 * Note: Flag and metric are intentionally kept — archived experiments
 * still reference the metric, preventing deletion. The flag and metric
 * are reused across runs.
 *
 * Usage: node src/cleanup.js
 *
 * Safe to run multiple times.
 */

import {
  LD_API_KEY,
  LD_PROJECT_KEY,
  LD_ENVIRONMENT_KEY,
  FLAG_KEY,
} from "./config.js";
import { apiCall, getFlag } from "./api.js";

const archiveAllExperiments = async () => {
  console.log("Looking for active experiments...");

  // List endpoint only returns non-archived experiments
  const result = await apiCall(
    "GET",
    `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments`
  );

  if (!result?.items?.length) {
    console.log("  No active experiments found.");
    return;
  }

  const ours = result.items.filter(
    (e) => e.currentIteration?.flags?.[FLAG_KEY] || e.draftIteration?.flags?.[FLAG_KEY] || e.key.startsWith("rec-engagement-")
  );

  if (!ours.length) {
    console.log("  No matching experiments found.");
    return;
  }

  for (const exp of ours) {
    // Stop running iterations first
    if (exp.currentIteration?.status === "running") {
      console.log(`  Stopping: ${exp.key}`);

      // Fetch the full experiment to get treatment IDs
      const full = await apiCall(
        "GET",
        `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments/${exp.key}`,
        null,
        { ignoreNotFound: true }
      );
      const treatments = full?.currentIteration?.treatments || [];
      let winningId = treatments.find((t) => t.baseline)?._id || treatments[0]?._id;

      // Fallback: use the flag's control variation ID
      if (!winningId) {
        const flag = await getFlag();
        winningId = flag?.variations?.[0]?._id;
      }

      await apiCall(
        "PATCH",
        `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments/${exp.key}`,
        {
          instructions: [{
            kind: "stopIteration",
            winningTreatmentId: winningId,
            winningReason: "cleanup",
          }],
        },
        { ignoreNotFound: true }
      );
    }

    console.log(`  Archiving: ${exp.key}`);
    await apiCall(
      "PATCH",
      `/projects/${LD_PROJECT_KEY}/environments/${LD_ENVIRONMENT_KEY}/experiments/${exp.key}`,
      {
        instructions: [{ kind: "archiveExperiment" }],
      },
      { ignoreNotFound: true }
    );
  }
};

const main = async () => {
  console.log("Cleaning up LaunchDarkly resources...\n");

  if (!LD_API_KEY) {
    console.error("Error: LD_API_KEY is not set.");
    process.exit(1);
  }

  try {
    await archiveAllExperiments();

    console.log("\nCleanup complete!");
    console.log("Run 'npm run setup' to create a fresh experiment.");
  } catch (err) {
    console.error("\nCleanup failed:", err.message);
    process.exit(1);
  }
};

main();
