/**
 * Frontend app — mock iOS streaming interface.
 * Integrates with LaunchDarkly client-side SDK to demonstrate
 * real-time flag evaluation and event tracking.
 *
 * The LD client-side ID is injected via a global variable or
 * read from the URL query parameter: ?clientId=YOUR_CLIENT_SIDE_ID
 */

const getClientSideId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("clientId") || window.LD_CLIENT_SIDE_ID || null;
};

const generateDeviceId = () => {
  const stored = localStorage.getItem("zeam-device-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
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

const trackContentClick = (client, context, contentId) => {
  client.track("content-clicked", context.key);
  eventCount++;
  updateDebug({ events: eventCount });
  client.flush();
};

const showRecommendations = () => {
  const row = document.getElementById("recommendations");
  if (row) row.classList.add("visible");
};

const bindTileClicks = (client, context) => {
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const contentId = tile.dataset.content;
      trackContentClick(client, context, contentId);

      // Visual feedback
      tile.style.boxShadow = "0 0 20px rgba(102, 126, 234, 0.6)";
      setTimeout(() => (tile.style.boxShadow = ""), 300);
    });
  });
};

const init = async () => {
  const clientSideId = getClientSideId();

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

  try {
    updateDebug({ status: "Connecting..." });

    const client = LDClient.initialize(clientSideId, context);
    await client.waitForInitialization();

    updateDebug({ status: "Connected" });

    const showRecs = client.variation("show-recommendations", false);
    updateDebug({ flag: showRecs ? "treatment" : "control" });

    if (showRecs) {
      showRecommendations();
    }

    bindTileClicks(client, context);

    // Listen for flag changes in real time
    client.on("change:show-recommendations", (value) => {
      updateDebug({ flag: value ? "treatment" : "control" });
      if (value) {
        showRecommendations();
      } else {
        const row = document.getElementById("recommendations");
        if (row) row.classList.remove("visible");
      }
    });
  } catch (err) {
    updateDebug({ status: "Error: " + err.message });
    console.error("LD initialization failed:", err);
  }
};

// Load the LD client-side SDK from CDN, then initialize
const script = document.createElement("script");
script.src = "https://unpkg.com/launchdarkly-js-client-sdk@3";
script.onload = init;
script.onerror = () => updateDebug({ status: "Failed to load LD SDK" });
document.head.appendChild(script);
