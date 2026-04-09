import Dexie from "dexie";

export const localDatabase = new Dexie("cefidefi-local");

localDatabase.version(1).stores({
  investments: "++id, project, type, status, startTime, endTime, createdAt, updatedAt",
  settings: "key"
});
