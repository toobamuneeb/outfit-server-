import path from 'node:path';
import type { NextConfig } from 'next';

// API only: the mobile app calls the routes in app/api.
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // The app's own lockfile sits one folder up; this server is a separate project.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
