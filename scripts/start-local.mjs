/** Runs the production build on this machine only. Run `npm run build` first. */
process.env.HOST = '127.0.0.1';
process.env.PORT ??= '4321';
process.env.SITE_ORIGIN ??= `http://localhost:${process.env.PORT}`;

await import('../dist/server/entry.mjs');
