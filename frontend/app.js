/**
 * Frontend app — mock iOS streaming interface.
 * Integrates with LaunchDarkly client-side SDK to demonstrate
 * real-time flag evaluation and event tracking.
 *
 * URL parameters:
 *   ?clientId=YOUR_CLIENT_SIDE_ID   (required)
 *   ?variation=control              (force control — no recommendations)
 *   ?variation=treatment            (force treatment — show recommendations)
 *
 * To show A/B side by side, open two tabs:
 *   Tab 1: ?clientId=XXX&variation=control
 *   Tab 2: ?clientId=XXX&variation=treatment
 */

const getParam = (key) => new URLSearchParams(window.location.search).get(key);

const getClientSideId = () => getParam("clientId") || window.LD_CLIENT_SIDE_ID || null;

const getForcedVariation = () => {
  const v = getParam("variation");
  if (v === "control") return false;
  if (v === "treatment") return true;
  return null;
};

const generateDeviceId = () => {
  const stored = localStorage.getItem("zeam-device-id");
  if (stored) return stored;
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
  localStorage.setItem("zeam-device-id", id);
  return id;
};

const updateDebug = (fields) => {
  for (const [key, value] of Object.entries(fields)) {
    const el = document.getElementById(`debug-${key}`);
    if (el) el.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
  }
};

let eventCount = 0;

const trackContentClick = (client, context) => {
  client.track("content-clicked", context.key);
  eventCount++;
  updateDebug({ events: eventCount });
  client.flush();
};

const showRecommendations = () => {
  const row = document.getElementById("recommendations");
  if (row) row.classList.add("visible");
};

const hideRecommendations = () => {
  const row = document.getElementById("recommendations");
  if (row) row.classList.remove("visible");
};

const applyVariation = (showRecs) => {
  updateDebug({ flag: showRecs ? "treatment" : "control" });
  if (showRecs) {
    showRecommendations();
  } else {
    hideRecommendations();
  }
};

const bindTileClicks = (client, context) => {
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      trackContentClick(client, context);

      // Visual feedback
      tile.style.boxShadow = "0 0 20px rgba(102, 126, 234, 0.6)";
      setTimeout(() => (tile.style.boxShadow = ""), 300);
    });
  });
};

const init = async () => {
  const clientSideId = getClientSideId();
  const forcedVariation = getForcedVariation();

  if (!clientSideId) {
    updateDebug({
      status: "Missing client ID",
      user: "—",
      flag: "—",
    });
    console.error(
      "No LD client-side ID found. Pass it as: ?clientId=YOUR_ID"
    );
    return;
  }

  const deviceId = generateDeviceId();
  updateDebug({ user: deviceId.slice(0, 8) + "..." });

  const context = {
    kind: "user",
    key: deviceId,
    name: `ios-user-${deviceId.slice(0, 8)}`,
    custom: {
      platform: "ios",
      appVersion: "4.2.1",
    },
  };

  // Apply forced variation immediately (no LD dependency)
  if (forcedVariation !== null) {
    updateDebug({ status: "Forced mode", flag: (forcedVariation ? "treatment" : "control") + " (forced)" });
    applyVariation(forcedVariation);
  }

  try {
    updateDebug({ status: "Connecting..." });

    const client = LDClient.initialize(clientSideId, context);
    await client.waitForInitialization();

    updateDebug({ status: "Connected" });

    // Only use LD evaluation when not forcing
    if (forcedVariation === null) {
      const showRecs = client.variation("show-recommendations", false);
      applyVariation(showRecs);

      client.on("change:show-recommendations", (value) => {
        applyVariation(value);
      });
    }

    bindTileClicks(client, context);
  } catch (err) {
    updateDebug({ status: forcedVariation !== null ? "Forced mode (LD offline)" : "Error: " + err.message });
    console.error("LD initialization failed:", err);
  }
};

// Load the LD client-side SDK from CDN, then initialize
const script = document.createElement("script");
script.src = "https://unpkg.com/launchdarkly-js-client-sdk@3";
script.onload = init;
script.onerror = () => updateDebug({ status: "Failed to load LD SDK" });
document.head.appendChild(script);
