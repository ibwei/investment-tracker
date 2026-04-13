import { ProxyAgent } from "undici";

export function getDevelopmentProxyAgent() {
  if (process.env.NODE_ENV !== "development") {
    return undefined;
  }

  const proxyUrl =
    process.env.LOCAL_ASSET_SYNC_PROXY_URL ||
    process.env.ASSET_SYNC_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  return proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
}
