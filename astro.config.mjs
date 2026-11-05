import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const onVercel = Boolean(process.env.VERCEL);
if (onVercel && !process.env.SITE_ORIGIN) throw new Error('Set SITE_ORIGIN in the Vercel project settings.');
const appOrigin = process.env.SITE_ORIGIN ?? 'http://localhost:4321';
const { protocol, hostname } = new URL(appOrigin);

// The Keystatic integration isn't used, because its page relies on inline scripts that the Content
// Security Policy forbids. src/pages/keystatic and src/pages/api/keystatic mount the same editor.
export default defineConfig({
  // Canonical links and the sitemap name the public pages' address, which can differ from the app's.
  site: process.env.PUBLIC_SITE_ORIGIN || appOrigin,
  output: 'static',
  adapter: onVercel ? vercel() : node({ mode: 'standalone' }),
  integrations: [
    react(),
    sitemap({ filter: (page) => !/\/(dashboard|keystatic|api)(\/|$)/i.test(new URL(page).pathname) }),
  ],
  devToolbar: { enabled: false },
  security: {
    checkOrigin: true,
    // Astro trusts forwarded headers only for listed domains. That's right on Vercel, whose platform
    // sets them. The local server has no proxy, so it uses the real connection instead.
    allowedDomains: onVercel ? [{ hostname, protocol: protocol.replace(':', '') }] : [],
  },
  // No inline CSS or JS in the build, so the Content Security Policy can forbid inline code entirely.
  build: { inlineStylesheets: 'never' },
  vite: {
    plugins: [tailwindcss()],
    // The limit covers the content editor's bundle, which only the signed-in owner ever downloads.
    build: { assetsInlineLimit: 0, sourcemap: false, chunkSizeWarningLimit: 3000 },
    // On Vercel, content is edited through GitHub. Local storage can't reach production by accident.
    define: { 'import.meta.env.PUBLIC_KEYSTATIC_GITHUB': JSON.stringify(onVercel ? 'true' : 'false') },
  },
});
