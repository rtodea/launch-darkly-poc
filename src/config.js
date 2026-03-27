import { config } from "dotenv";

config();

export const LD_SDK_KEY = process.env.LD_SDK_KEY;
export const LD_CLIENT_SIDE_ID = process.env.LD_CLIENT_SIDE_ID;
export const LD_API_KEY = process.env.LD_API_KEY;
export const LD_PROJECT_KEY = process.env.LD_PROJECT_KEY || "launch-darkly-poc";
export const LD_ENVIRONMENT_KEY = process.env.LD_ENVIRONMENT_KEY || "production";

export const FLAG_KEY = "show-recommendations";

export const METRICS = {
  contentClicked: "content-clicked",
  watchTime: "watch-time",
};
