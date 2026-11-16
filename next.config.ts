import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo dataset is read at runtime, so it must ship with
  // every server route that can run the pipeline (tick, Run now, pages' actions).
  outputFileTracingIncludes: {
    "/**": ["./fixture/*.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
