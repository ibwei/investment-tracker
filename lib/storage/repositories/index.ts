import { STORAGE_MODES } from "@/lib/storage-mode";
const localMethod = (name: string) => async (...args: any[]) => {
  const { localInvestmentRepository } = await import("@/lib/storage/repositories/local-investment-repository");
  return localInvestmentRepository[name].apply(localInvestmentRepository, args);
};
const localInvestmentRepository = {
  getSnapshot: localMethod('getSnapshot'), create: localMethod('create'),
  update: localMethod('update'), remove: localMethod('remove'),
  earlyClose: localMethod('earlyClose'), clearAll: localMethod('clearAll'),
};
import { remoteInvestmentRepository } from "@/lib/storage/repositories/remote-investment-repository";

export function getInvestmentRepository(storageMode) {
  return storageMode === STORAGE_MODES.REMOTE
    ? remoteInvestmentRepository
    : localInvestmentRepository;
}
