/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Stand-in photography for the mocked backend. Real model output would be
    // served from our own storage origin.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default nextConfig;
