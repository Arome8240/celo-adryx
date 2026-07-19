/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Alias away the React Native async-storage dep pulled in by MetaMask SDK
    // (browser build doesn't need it; aliasing to false tells webpack to skip it)
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      // Same story for Coinbase's optional x402 payment-facilitator modules,
      // pulled in transitively via wagmi/connectors' Base Account connector
      // (@base-org/account -> @coinbase/cdp-sdk) — unused here since this app
      // only configures the injected-wallet connector (MiniPay/RainbowKit).
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
    };

    // Suppress the "critical dependency: dynamic require" warning from ox/tempo
    // This is a transitive dep of viem used only in node environments
    config.module = config.module || {};
    config.module.exprContextCritical = false;

    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
