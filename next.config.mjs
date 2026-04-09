/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
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
