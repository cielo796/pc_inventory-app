import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    const projectNodeModules = path.resolve(__dirname, "node_modules");
    config.resolve = config.resolve ?? {};
    const modules = config.resolve.modules ?? [];
    if (!modules.includes(projectNodeModules)) {
      modules.unshift(projectNodeModules);
    }
    config.resolve.modules = modules;
    return config;
  },
};

export default nextConfig;
