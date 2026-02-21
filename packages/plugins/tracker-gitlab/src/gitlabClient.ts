import axios, { AxiosInstance } from "axios";

export type GitLabClientOptions = {
  baseUrl?: string; // e.g. https://gitlab.com
  token: string;
};

export class GitLabClient {
  private client: AxiosInstance;

  constructor(private opts: GitLabClientOptions) {
    const baseURL = opts.baseUrl ?? "https://gitlab.com/api/v4";
    this.client = axios.create({
      baseURL,
      headers: {
        "Private-Token": opts.token,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    // Simple retry/backoff can be added here (axios-retry or custom)
  }

  async get<T = any>(path: string, params?: any) {
    const res = await this.client.get<T>(path, { params });
    return res.data;
  }

  async post<T = any>(path: string, data?: any) {
    const res = await this.client.post<T>(path, data);
    return res.data;
  }

  async put<T = any>(path: string, data?: any) {
    const res = await this.client.put<T>(path, data);
    return res.data;
  }

  // helpers for pagination etc.
}