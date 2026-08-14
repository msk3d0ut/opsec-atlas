// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

// Base path stays at root in production; alternate hosts/previews may override it.
const base = process.env.BASE_PATH || '/';

// Canonical production origin. Preview/alternate deployments may override SITE_URL.
const site = process.env.SITE_URL || 'https://opsecatlas.com';

// Keep non-indexable utility roots out of XML discovery. Their leaf pages remain included.
const normalizeUrl = (url) => url.replace(/\/$/, '');
const sitemapExclusions = new Set(
  ['404', 'library', 'route', 'technique'].map((p) =>
    normalizeUrl(new URL(`${base}${p}`, site).href),
  ),
);

// https://astro.build/config
export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !sitemapExclusions.has(normalizeUrl(page)),
      xslURL: `${base}sitemap.xsl`,
      // OpsecAtlas does not publish news/video/i18n sitemap extensions; keep XML lean.
      namespaces: { news: false, xhtml: false, image: false, video: false },
    }),
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
