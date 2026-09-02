import type { NextConfig } from "next";

// Not a static export. The route structure uses real dynamic segments
// (/cases/[caseId]), which cannot be pre-rendered because case ids are created
// at runtime. Deploy target is Cloud Run, whose always-free tier (2M requests
// per month) covers this comfortably — so server rendering costs nothing here.
const nextConfig: NextConfig = {};

export default nextConfig;
