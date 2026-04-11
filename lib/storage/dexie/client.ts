import Dexie, { type Table } from "dexie";

export interface LocalInvestmentRecord {
  id?: number | string;
  userScope?: string;
  [key: string]: unknown;
}

class EarnCompassLocalDatabase extends Dexie {
  investments!: Table<LocalInvestmentRecord, number | string>;
}

export const localDatabase = new EarnCompassLocalDatabase("cefidefi-local");

localDatabase.version(1).stores({
  investments: "++id, project, type, status, startTime, endTime, createdAt, updatedAt",
  settings: "key"
});

localDatabase.version(2).stores({
  investments:
    "++id, userScope, [userScope+id], project, type, status, startTime, endTime, createdAt, updatedAt",
  settings: "key"
});
