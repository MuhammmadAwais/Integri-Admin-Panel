import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

import path from "path";
const resolvePath = (str) => path.resolve(__dirname, str);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const API_URL = env.VITE_APP_BASE_NAME || "/";
  const PORT = 3000;

  return {
    server: {
      // this ensures that the browser opens upon server start
      open: true,
      // this sets a default port to 3000
      port: PORT,
      host: true,
    },
    preview: {
      open: true,
      host: true,
    },
    define: {
      global: "window",
    },
    resolve: {
      alias: [
        { find: 'api', replacement: path.resolve(__dirname, 'src/api') },
        { find: 'components', replacement: path.resolve(__dirname, 'src/components') },
        { find: 'features', replacement: path.resolve(__dirname, 'src/features') },
        { find: 'layout', replacement: path.resolve(__dirname, 'src/layout') },
        { find: 'lib', replacement: path.resolve(__dirname, 'src/lib') },
        { find: 'pages', replacement: path.resolve(__dirname, 'src/pages') },
        { find: 'routes', replacement: path.resolve(__dirname, 'src/routes') },
        { find: 'contexts', replacement: path.resolve(__dirname, 'src/contexts') },
        { find: 'store', replacement: path.resolve(__dirname, 'src/store') },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          charset: false,
          verbose: true,
          quietDeps: true,
          silenceDeprecations: ['import'],
        },
        less: {
          charset: false,
        },
      },
      charset: false,
      postcss: {
        plugins: [
          {
            postcssPlugin: "internal:charset-removal",
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === "charset") {
                  atRule.remove();
                }
              },
            },
          },
        ],
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
      sourcemap: true,
      cssCodeSplit: true,
      rollupOptions: {
        input: {
          main: resolvePath("index.html"),
          legacy: resolvePath("index.html"),
        },
      },
    },
    base: API_URL,
    plugins: [react(), tsconfigPaths()],
  };
});
