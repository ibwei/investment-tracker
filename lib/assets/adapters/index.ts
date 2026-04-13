import type { CexAdapter } from "@/lib/assets/adapters/types";
import { kucoinAdapter } from "@/lib/assets/adapters/cex/kucoin";

const CEX_ADAPTERS = new Map<string, CexAdapter>([
  [kucoinAdapter.provider, kucoinAdapter],
]);

export function getCexAdapter(provider: string) {
  return CEX_ADAPTERS.get(provider.toUpperCase()) ?? null;
}

export type { CexConfig } from "@/lib/assets/adapters/types";
export { AssetProviderError } from "@/lib/assets/adapters/types";
