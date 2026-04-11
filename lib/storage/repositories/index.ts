import { STORAGE_MODES } from "@/lib/storage-mode";
import { localInvestmentRepository } from "@/lib/storage/repositories/local-investment-repository";
import { remoteInvestmentRepository } from "@/lib/storage/repositories/remote-investment-repository";

export function getInvestmentRepository(storageMode) {
  return storageMode === STORAGE_MODES.REMOTE
    ? remoteInvestmentRepository
    : localInvestmentRepository;
}
