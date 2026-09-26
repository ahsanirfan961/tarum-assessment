/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolved at runtime from node_modules, so the binary path it exports
  // points at the real file rather than into the server bundle.
  serverExternalPackages: ["ffmpeg-static"],
  images: {
    // Stand-in photography for the mocked backend. Real model output would be
    // served from our own storage origin.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default nextConfig;
