// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import AstroPWA from '@vite-pwa/astro';

// Base path: root locally; the `/opsec-atlas/` subpath is a deploy-time concern
// we switch on when we actually ship. Not deploying yet (Z's standing rule).
const base = process.env.BASE_PATH || '/';

// Canonical origin, used to build ABSOLUTE og:image / og:url / canonical links
// (link-preview cards on LinkedIn/X/WhatsApp/Discord/Telegram require absolute
// URLs). Placeholder until the domain is bought; at deploy set SITE_URL to the
// real origin (e.g. https://opsecatlas.com, or https://<user>.github.io for Pages).
const site = process.env.SITE_URL || 'https://opsecatlas.com';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    preact(),
    AstroPWA({
      registerType: 'autoUpdate',
      // We wire the manifest link + SW registration manually in Base.astro (the
      // integration does not inject them into Astro's per-page HTML), so keep the
      // plugin from also injecting a registration script.
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'OpsecAtlas',
        short_name: 'OpsecAtlas',
        description: 'The offensive-security atlas that routes you from what you hold to the next move.',
        theme_color: '#0e100e',
        background_color: '#0e100e',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${base}maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the shell + generated data + icons so the whole reference is air-gap ready.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
      },
      devOptions: { enabled: false },
    }),
  ],
});
