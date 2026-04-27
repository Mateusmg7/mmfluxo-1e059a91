import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildTimestamp = Date.now();
  return {
    define: {
      'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildTimestamp),
      '__BUILD_TIMESTAMP__': JSON.stringify(buildTimestamp),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "immediate",
        devOptions: {
          enabled: false,
        },
        selfDestroying: false,
        includeAssets: ["pwa-icon-192.png", "pwa-icon-512.png", "placeholder.svg"],
        manifest: {
          name: "MM Fluxo - Fluxo de Caixa",
          short_name: "MM Fluxo",
          description: "Controle suas despesas e renda extra com o MM Fluxo.",
          start_url: "/",
          display: "standalone",
          background_color: "#0a0f1c",
          theme_color: "#00e5ff",
          orientation: "portrait-primary",
          icons: [
            {
              src: "/pwa-icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/pwa-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/futidralyhtqqhpahwrg\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
                networkTimeoutSeconds: 5,
              },
            },
          ],
        },
      }),
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-[hash]-${buildTimestamp}.js`,
          chunkFileNames: `assets/[name]-[hash]-${buildTimestamp}.js`,
          assetFileNames: `assets/[name]-[hash]-${buildTimestamp}.[ext]`,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
