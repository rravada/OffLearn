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
        canvas: false,
        encoding: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        sharp: false,
        "onnxruntime-node": false,
        canvas: false,
      };

      config.module.rules.push({
        test: /node_modules[\\/]pdfjs-dist[\\/]build[\\/]pdf\.js$/,
        loader: "null-loader",
        issuerLayer: "server",
      });
    }

    if (isServer) {
      config.externals = [...(config.externals || []), "onnxruntime-node", "sharp", "canvas"];
    }

    return config;
  },
};

export default nextConfig;
