import { requestJson } from "@/lib/client-request";

export const remoteInvestmentRepository = {
  async getSnapshot(options: { compact?: boolean; signal?: AbortSignal } = {}) {
    return requestJson(options.compact ? "/api/investments?response=delta" : "/api/investments", {
      signal: options.signal,
      method: "GET",
      cache: "no-store"
    });
  },

  async create(payload, options: { compact?: boolean; signal?: AbortSignal } = {}) {
    const result = await requestJson(`/api/investments${options.compact ? "?response=delta" : ""}`, {
      signal: options.signal,
      method: "POST",
      body: JSON.stringify(payload)
    });
    return options.compact ? (result.snapshot ?? result) : result.snapshot;
  },

  async update(id, payload, options: { compact?: boolean; signal?: AbortSignal } = {}) {
    const result = await requestJson(`/api/investments/${id}${options.compact ? "?response=delta" : ""}`, {
      signal: options.signal,
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return options.compact ? (result.snapshot ?? result) : result.snapshot;
  },

  async remove(id, confirmationText, options: { compact?: boolean; signal?: AbortSignal } = {}) {
    const result = await requestJson(`/api/investments/${id}${options.compact ? "?response=delta" : ""}`, {
      signal: options.signal,
      method: "DELETE",
      body: JSON.stringify({ confirmationText })
    });
    return options.compact ? (result.snapshot ?? result) : result.snapshot;
  },

  async earlyClose(id, payload, options: { compact?: boolean; signal?: AbortSignal } = {}) {
    const result = await requestJson(`/api/investments/${id}/finish${options.compact ? "?response=delta" : ""}`, {
      signal: options.signal,
      method: "POST",
      body: JSON.stringify(payload)
    });
    return options.compact ? (result.snapshot ?? result) : result.snapshot;
  },

  async clearAll(options: { compact?: boolean; signal?: AbortSignal } = {}) {
    const result = await requestJson(`/api/investments${options.compact ? "?response=delta" : ""}`, {
      signal: options.signal,
      method: "DELETE"
    });
    return options.compact ? (result.snapshot ?? result) : result.snapshot;
  }
};
