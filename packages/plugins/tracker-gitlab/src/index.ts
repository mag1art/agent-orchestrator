import type { PluginModule, Tracker } from "@composio/ao-core";
import { createGitLabTracker } from "./adapter.js";

export const manifest = {
  name: "gitlab",
  slot: "tracker" as const,
  description: "Tracker plugin: GitLab Issues",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Tracker {
  // Accept plugin config via registry (token, baseUrl, webhookSecret, ...)
  // If token not supplied here, adapter will fallback to process.env.GITLAB_TOKEN
  return createGitLabTracker(config as any);
}

export default { manifest, create } satisfies PluginModule<Tracker>;