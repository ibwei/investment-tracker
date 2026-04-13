import type { NormalizedAssetBalance, NormalizedAssetPosition } from "@/lib/assets/types";

export type AssetProviderErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_DOWN"
  | "BAD_CONFIG"
  | "UNKNOWN";

export class AssetProviderError extends Error {
  code: AssetProviderErrorCode;
  status?: number;

  constructor(message: string, code: AssetProviderErrorCode = "UNKNOWN", status?: number) {
    super(message);
    this.name = "AssetProviderError";
    this.code = code;
    this.status = status;
  }
}

export type CexConfig = {
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
  apiKeyVersion?: string | null;
  baseUrl?: string | null;
};

export type CexAdapter = {
  provider: string;
  testConnection(config: CexConfig): Promise<void>;
  getBalances(config: CexConfig): Promise<NormalizedAssetBalance[]>;
  getPositions?(config: CexConfig): Promise<NormalizedAssetPosition[]>;
};
