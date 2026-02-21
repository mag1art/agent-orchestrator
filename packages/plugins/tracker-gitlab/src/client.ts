import { setTimeout } from "node:timers/promises";

export type GitLabClientOptions = {
  baseUrl?: string; // e.g. https://gitlab.com/api/v4 or https://gitlab.example.com/api/v4
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
};

function defaultBaseUrl(url?: string): string {
  if (!url) return "https://gitlab.com/api/v4";
  // Allow users to pass base without /api/v4
  if (url.endsWith("/api/v4")) return url;
  if (url.endsWith("/")) return `${url}api/v4`;
  return `${url}/api/v4`;
}

/**
 * Minimal REST client for GitLab using global fetch (Node 20+).
 * Implements simple retry/backoff for 429/5xx.
 */
export class GitLabClient {
  readonly baseUrl: string;
  readonly token: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;

  constructor(opts: GitLabClientOptions) {
    this.baseUrl = defaultBaseUrl(opts.baseUrl);
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    // Build URL
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(this.timeoutMs).then(() => controller.abort());

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        // Use Private-Token header which works for PATs, fallback to Bearer if provided
        headers["Private-Token"] = this.token;

        const res = await fetch(url.toString(), {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        // clear timeout promise by allowing it to settle (no-op)
        // fetch will have thrown if aborted

        const text = await res.text().catch(() => "");

        if (res.status >= 200 && res.status < 300) {
          // Try parse JSON, return text on empty
          if (!text) return undefined as unknown as T;
          return JSON.parse(text) as T;
        }

        // Retry on 429 or 5xx
        if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
          const backoff = 100 * 2 ** (attempt - 1);
          const jitter = Math.floor(Math.random() * 100);
          await setTimeout(backoff + jitter);
          continue;
        }

        // Unrecoverable error
        throw new Error(`GitLab API ${res.status} ${res.statusText}: ${text.slice(0, 1000)}`);
      } catch (err) {
        // fetch throws on abort and some network errors
        const isAbort = (err as Error).name === "AbortError";
        if ((isAbort || (err as any)?.code === "ECONNRESET" || (err as any)?.code === "ENOTFOUND") && attempt < this.maxRetries) {
          const backoff = 100 * 2 ** (attempt - 1);
          await setTimeout(backoff + Math.floor(Math.random() * 100));
          continue;
        }
        throw err;
      }
    }
  }

  async get<T = any>(path: string, query?: Record<string, string | number | undefined>) {
    return this.request<T>("GET", path, undefined, query);
  }

  async post<T = any>(path: string, data?: unknown) {
    return this.request<T>("POST", path, data);
  }

  async put<T = any>(path: string, data?: unknown) {
    return this.request<T>("PUT", path, data);
  }

  async patch<T = any>(path: string, data?: unknown) {
    return this.request<T>("PATCH", path, data);
  }
}