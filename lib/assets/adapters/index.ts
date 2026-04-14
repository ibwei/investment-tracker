import type { CexAdapter, OnchainAdapter } from "@/lib/assets/adapters/types";
import { binanceAdapter } from "@/lib/assets/adapters/cex/binance";
import { bitgetAdapter } from "@/lib/assets/adapters/cex/bitget";
import { bybitAdapter } from "@/lib/assets/adapters/cex/bybit";
import { gateAdapter } from "@/lib/assets/adapters/cex/gate";
import { htxAdapter } from "@/lib/assets/adapters/cex/htx";
import { kucoinAdapter } from "@/lib/assets/adapters/cex/kucoin";
import { okxAdapter } from "@/lib/assets/adapters/cex/okx";
import { okxWeb3Adapter } from "@/lib/assets/adapters/onchain/okx-web3";

const CEX_ADAPTERS = new Map<string, CexAdapter>([
  [binanceAdapter.provider, binanceAdapter],
  [okxAdapter.provider, okxAdapter],
  [bybitAdapter.provider, bybitAdapter],
  [bitgetAdapter.provider, bitgetAdapter],
  [gateAdapter.provider, gateAdapter],
  [htxAdapter.provider, htxAdapter],
  [kucoinAdapter.provider, kucoinAdapter],
]);

const ONCHAIN_ADAPTERS = new Map<string, OnchainAdapter>();

for (const adapter of [okxWeb3Adapter]) {
  ONCHAIN_ADAPTERS.set(adapter.provider, adapter);
  for (const alias of adapter.aliases ?? []) {
    ONCHAIN_ADAPTERS.set(alias.toUpperCase(), adapter);
  }
}

export function getCexAdapter(provider: string) {
  return CEX_ADAPTERS.get(provider.toUpperCase()) ?? null;
}

export function getOnchainAdapter(provider: string) {
  return ONCHAIN_ADAPTERS.get(provider.toUpperCase()) ?? null;
}

export type { CexConfig, OnchainConfig } from "@/lib/assets/adapters/types";
export { AssetProviderError } from "@/lib/assets/adapters/types";
