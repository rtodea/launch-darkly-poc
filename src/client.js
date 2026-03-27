import LaunchDarkly from "@launchdarkly/node-server-sdk";
import { LD_SDK_KEY } from "./config.js";

let clientInstance = null;

/**
 * Initializes and returns a singleton LaunchDarkly server-side client.
 * The server SDK evaluates flags locally (no network call per evaluation),
 * making it ideal for high-throughput simulation.
 */
export const getClient = async () => {
  if (clientInstance) return clientInstance;

  clientInstance = LaunchDarkly.init(LD_SDK_KEY);
  await clientInstance.waitForInitialization({ timeout: 10 });
  return clientInstance;
};

/**
 * Evaluates the feature flag for a given user context.
 * Returns the boolean variation (true = treatment, false = control).
 */
export const evaluateFlag = async (client, flagKey, context) => {
  return client.variation(flagKey, context, false);
};

/**
 * Sends a custom track event for a user context.
 */
export const trackEvent = (client, eventKey, context, data) => {
  client.track(eventKey, context, data);
};

/**
 * Flushes pending events and closes the client connection.
 */
export const closeClient = async (client) => {
  await client.flush();
  await client.close();
  clientInstance = null;
};
