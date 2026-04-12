import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const prismaClientEntry = path.join(projectRoot, "lib/prisma-client.ts");
const prismaClientNodeEntry = path.join(projectRoot, "lib/prisma-client.node.ts");
const prismaClientCloudflareEntry = path.join(projectRoot, "lib/prisma-client.cloudflare.ts");
const prismaCompilerWasmEntry = path.join(projectRoot, "lib/prisma-query-compiler-wasm.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  webpack(config, { webpack }) {
    const isCloudflarePrismaBuild = process.env.PRISMA_RUNTIME === "cloudflare";
    const prismaClientTarget = isCloudflarePrismaBuild
      ? prismaClientCloudflareEntry
      : prismaClientEntry;

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@/lib/prisma-client": prismaClientTarget,
      "@/lib/prisma-client$": prismaClientTarget,
      "@/lib/prisma-client.ts": prismaClientTarget,
      [prismaClientEntry]: prismaClientTarget,
      ...(isCloudflarePrismaBuild
        ? {
            "@/lib/prisma-client.node": prismaClientCloudflareEntry,
            "@/lib/prisma-client.node$": prismaClientCloudflareEntry,
            [prismaClientNodeEntry]: prismaClientCloudflareEntry
          }
        : {})
    };

    if (isCloudflarePrismaBuild) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /query_compiler_bg\.wasm\?module$/,
          prismaCompilerWasmEntry
        )
      );

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
