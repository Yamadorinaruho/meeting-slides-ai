/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: {
        bodySizeLimit: '10mb',
      },
    },
    webpack: (config) => {
      config.externals = [...(config.externals || []), { canvas: 'canvas' }];
      return config;
    },
  };
  
  module.exports = nextConfig;