export const STORAGE_MODES = {
  LOCAL: "local",
  REMOTE: "remote"
} as const;

export type StorageMode = (typeof STORAGE_MODES)[keyof typeof STORAGE_MODES];

export function getStorageModeLabel(mode: StorageMode) {
  return mode === STORAGE_MODES.REMOTE ? "远程模式" : "本地模式";
}
