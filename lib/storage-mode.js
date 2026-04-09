export const STORAGE_MODES = {
  LOCAL: "local",
  REMOTE: "remote"
};

export function getStorageModeLabel(mode) {
  return mode === STORAGE_MODES.REMOTE ? "远程模式" : "本地模式";
}
