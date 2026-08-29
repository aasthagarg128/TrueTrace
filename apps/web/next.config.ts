import type { NextConfig } from "next";

// Static export keeps the app on Firebase Hosting's free Spark tier. It works
// because no route is server-rendered: the case id travels as a query
// parameter, not a path segment.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
