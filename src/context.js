import { randomUUID } from "node:crypto";

/**
 * Generates a LaunchDarkly user context simulating an iOS device.
 * Each context represents a unique app installation with a stable device ID.
 */
export const createUserContext = (overrides = {}) => ({
  kind: "user",
  key: randomUUID(),
  name: `user-${randomUUID().slice(0, 8)}`,
  custom: {
    platform: "ios",
    appVersion: "4.2.1",
    device: randomDevice(),
    ...overrides,
  },
});

const DEVICES = ["iPhone 15 Pro", "iPhone 14", "iPhone 13", "iPad Pro", "iPad Air"];

const randomDevice = () => DEVICES[Math.floor(Math.random() * DEVICES.length)];

/**
 * Creates a batch of user contexts.
 */
export const createUserBatch = (count) =>
  Array.from({ length: count }, () => createUserContext());
