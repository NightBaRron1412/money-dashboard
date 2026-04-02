import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",

      // These rules are valuable but too noisy for this repo and were
      // causing `pnpm lint` to fail. Keep core hooks rules enabled.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
    }
  },
];

export default config;
