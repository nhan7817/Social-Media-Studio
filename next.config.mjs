/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'fluent-ffmpeg',
      '@ffmpeg-installer/ffmpeg',
      'sharp',
      'yt-dlp-wrap'
    ]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
        '@ffmpeg-installer/ffmpeg': 'commonjs @ffmpeg-installer/ffmpeg',
        'sharp': 'commonjs sharp',
        'yt-dlp-wrap': 'commonjs yt-dlp-wrap'
      });
    }
    return config;
  }
};

export default nextConfig;
