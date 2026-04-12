/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  webpack(config) {
    const isCloudflarePrismaBuild = process.env.PRISMA_RUNTIME === "cloudflare";

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@/lib/prisma-client$": isCloudflarePrismaBuild
        ? new URL("./lib/prisma-client.cloudflare.ts", import.meta.url).pathname
        : new URL("./lib/prisma-client.ts", import.meta.url).pathname
    };

    if (isCloudflarePrismaBuild) {
      config.experiments = {
        ...(config.experiments || {}),
        asyncWebAssembly: true
      };

      config.module.rules.push({
        test: /\.wasm$/,
        type: "webassembly/async"
      });
    }

    return config;
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false
      },
      {
        source: "/analysis",
        destination: "/analytics",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
