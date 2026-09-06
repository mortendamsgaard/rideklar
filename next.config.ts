import type { NextConfig } from 'next';

// Static export: the app has no server logic, so GitHub Pages can serve
// dist/client directly. Paths stay root-absolute because rideklar.dk serves
// the site at the domain root.
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
