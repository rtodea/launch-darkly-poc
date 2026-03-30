/**
 * Shared LaunchDarkly REST API utilities.
 * Used by both setup.js and cleanup.js.
 */

import {
  LD_API_KEY,
  LD_PROJECT_KEY,
  FLAG_KEY,
} from "./config.js";

const API_BASE = "https://app.launchdarkly.com/api/v2";

const headers = () => ({
  Authorization: LD_API_KEY,
  "Content-Type": "application/json",
});

/**
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreNotFound] - treat 404 as null (for cleanup)
 * @param {boolean} [opts.ignoreDuplicate] - treat 409/duplicate as null (for setup)
 */
export const apiCall = async (method, path, body, opts = {}) => {
  const url = `${API_BASE}${path}`;
  const options = { method, headers: headers() };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();

  if (opts.ignoreDuplicate && (res.status === 409 || (res.status === 400 && text.includes("duplicate")))) {
    console.log(`  Already exists (skipped): ${path}`);
    return null;
  }

  if (opts.ignoreNotFound && res.status === 404) {
    console.log(`  Not found (skipped): ${path}`);
    return null;
  }

  if (!res.ok) {
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
};

let cachedFlag = null;
let cachedMemberId = null;

export const getFlag = async ({ fresh = false } = {}) => {
  if (!cachedFlag || fresh) {
    cachedFlag = await apiCall("GET", `/flags/${LD_PROJECT_KEY}/${FLAG_KEY}`);
  }
  return cachedFlag;
};

export const resetCache = () => {
  cachedFlag = null;
  cachedMemberId = null;
};

export const getCurrentMemberId = async () => {
  if (!cachedMemberId) {
    const me = await apiCall("GET", "/members/me");
    cachedMemberId = me._id;
  }
  return cachedMemberId;
};
