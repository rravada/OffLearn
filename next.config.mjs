/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        sharp: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        sharp: false,
        "onnxruntime-node": false,
      };
    }

    if (isServer) {
      config.externals = [...(config.externals || []), "onnxruntime-node", "sharp"];
    }

    return config;
  },
};

export default nextConfig;
