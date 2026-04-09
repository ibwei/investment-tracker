import { localDatabase } from "@/lib/storage/dexie/client";
import { buildDashboardSnapshot } from "@/lib/snapshot";

function normalizeId(id) {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : id;
}

function ensureTimestamps(payload, current = {}) {
  const now = new Date().toISOString();

  return {
    ...current,
    ...payload,
    createdAt: current.createdAt ?? now,
    updatedAt: now
  };
}

export const localInvestmentRepository = {
  async getSnapshot() {
    const records = await localDatabase.investments.toArray();
    return buildDashboardSnapshot(records);
  },

  async create(payload) {
    const record = ensureTimestamps(payload, {
      status: payload.status || "ONGOING"
    });
    await localDatabase.investments.add(record);
    return this.getSnapshot();
  },

  async update(id, payload) {
    const recordId = normalizeId(id);
    const current = await localDatabase.investments.get(recordId);
    await localDatabase.investments.update(recordId, ensureTimestamps(payload, current));
    return this.getSnapshot();
  },

  async remove(id) {
    const recordId = normalizeId(id);
    const current = await localDatabase.investments.get(recordId);
    await localDatabase.investments.update(recordId, {
      ...current,
      isDeleted: true,
      updatedAt: new Date().toISOString()
    });
    return this.getSnapshot();
  },

  async earlyClose(id, payload) {
    const recordId = normalizeId(id);
    const current = await localDatabase.investments.get(recordId);
    await localDatabase.investments.update(recordId, ensureTimestamps({
      ...current,
      ...payload,
      status: payload.status || "EARLY_ENDED"
    }, current));
    return this.getSnapshot();
  },

  async clearAll() {
    await localDatabase.investments.clear();
    return this.getSnapshot();
  }
};
