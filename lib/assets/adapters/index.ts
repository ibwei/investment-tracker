import type { CexAdapter } from "@/lib/assets/adapters/types";
import { binanceAdapter } from "@/lib/assets/adapters/cex/binance";
import { bitgetAdapter } from "@/lib/assets/adapters/cex/bitget";
import { bybitAdapter } from "@/lib/assets/adapters/cex/bybit";
import { gateAdapter } from "@/lib/assets/adapters/cex/gate";
import { htxAdapter } from "@/lib/assets/adapters/cex/htx";
import { kucoinAdapter } from "@/lib/assets/adapters/cex/kucoin";
import { okxAdapter } from "@/lib/assets/adapters/cex/okx";

const CEX_ADAPTERS = new Map<string, CexAdapter>([
  [binanceAdapter.provider, binanceAdapter],
  [okxAdapter.provider, okxAdapter],
  [bybitAdapter.provider, bybitAdapter],
  [bitgetAdapter.provider, bitgetAdapter],
  [gateAdapter.provider, gateAdapter],
  [htxAdapter.provider, htxAdapter],
  [kucoinAdapter.provider, kucoinAdapter],
]);

export function getCexAdapter(provider: string) {
  return CEX_ADAPTERS.get(provider.toUpperCase()) ?? null;
}

export type { CexConfig } from "@/lib/assets/adapters/types";
export { AssetProviderError } from "@/lib/assets/adapters/types";
