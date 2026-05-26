import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public", // Destination directory for the service worker file
  register: true, // Register the service worker automatically
  skipWaiting: true, // Activate the new service worker as soon as it's installed
  disable: process.env.NODE_ENV === "development", // Disable PWA in development
  cacheOnFrontEndNav: true, // Cache pages on frontend navigation
  aggressiveFrontEndNavCaching: true, // Aggressively cache pages on frontend navigation
  reloadOnOnline: true, // Reload the app when it comes online
  swMinify: true, // Minify the service worker file
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default withPWA(config);
