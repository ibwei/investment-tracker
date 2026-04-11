import {
  localDatabase,
  type LocalInvestmentRecord
} from "@/lib/storage/dexie/client";
import { getLocalUserScope } from "@/lib/storage/local-user-scope";
import { buildDashboardSnapshot } from "@/lib/snapshot";

function normalizeId(id) {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : id;
}

function ensureTimestamps(
  payload: LocalInvestmentRecord,
  current: LocalInvestmentRecord = {}
) {
  const now = new Date().toISOString();
  const userScope = current.userScope ?? getLocalUserScope();

  return {
    ...current,
    ...payload,
    userScope,
    createdAt: current.createdAt ?? now,
    updatedAt: now
  };
}

function getInvestmentTable() {
  return localDatabase.investments.where("userScope").equals(getLocalUserScope());
}

async function getScopedRecord(recordId) {
  return getInvestmentTable().and((record) => record.id === recordId).first();
}

function assertRecord(record) {
  if (!record) {
    throw new Error("记录不存在。");
  }
}

export const localInvestmentRepository = {
  async getSnapshot() {
    const records = await getInvestmentTable().toArray();
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
    const current = await getScopedRecord(recordId);
    assertRecord(current);
    await localDatabase.investments.update(recordId, ensureTimestamps(payload, current));
    return this.getSnapshot();
  },

  async remove(id) {
    const recordId = normalizeId(id);
    const current = await getScopedRecord(recordId);
    assertRecord(current);
    await localDatabase.investments.update(recordId, {
      ...current,
      isDeleted: true,
      updatedAt: new Date().toISOString()
    });
    return this.getSnapshot();
  },

  async earlyClose(id, payload) {
    const recordId = normalizeId(id);
    const current = await getScopedRecord(recordId);
    assertRecord(current);
    await localDatabase.investments.update(recordId, ensureTimestamps({
      ...current,
      ...payload,
      status: payload.status || "EARLY_ENDED"
    }, current));
    return this.getSnapshot();
  },

  async clearAll() {
    await getInvestmentTable().delete();
    return this.getSnapshot();
  }
};
