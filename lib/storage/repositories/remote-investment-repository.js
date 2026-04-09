async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "远程请求失败。");
  }

  return payload;
}

export const remoteInvestmentRepository = {
  async getSnapshot() {
    return request("/api/investments", {
      method: "GET",
      cache: "no-store"
    });
  },

  async create(payload) {
    const result = await request("/api/investments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return result.snapshot;
  },

  async update(id, payload) {
    const result = await request(`/api/investments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return result.snapshot;
  },

  async remove(id, confirmationText) {
    const result = await request(`/api/investments/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmationText })
    });
    return result.snapshot;
  },

  async earlyClose(id, payload) {
    const result = await request(`/api/investments/${id}/finish`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return result.snapshot;
  },

  async clearAll() {
    const result = await request("/api/investments", {
      method: "DELETE"
    });
    return result.snapshot;
  }
};
