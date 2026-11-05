/**
 * Downloads Clash Display and Satoshi at build time. Their license allows self-hosting on your own
 * site but not publishing the files in a public repository, so public/fonts is git-ignored.
 * Locally a failed download only warns, and the site uses a system font. On Vercel it stops the
 * build, so the last good deployment stays live.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const FONTS = [
  ['clash-display', 'ClashDisplay', [500, 600]],
  ['satoshi', 'Satoshi', [400, 500]],
];
const folder = 'public/fonts';
mkdirSync(folder, { recursive: true });

for (const [family, name, weights] of FONTS) {
  for (const weight of weights) {
    const file = `${folder}/${name}-${weight}.woff2`;
    if (existsSync(file)) continue;
    try {
      const css = await (await fetch(`https://api.fontshare.com/v2/css?f[]=${family}@${weight}&display=swap`)).text();
      const url = css.match(/url\('(\/\/cdn\.fontshare\.com\/[^']+\.woff2)'\)/)?.[1];
      if (!url) throw new Error('no font URL in the response');
      const font = await fetch(`https:${url}`);
      if (!font.ok) throw new Error(`HTTP ${font.status}`);
      writeFileSync(file, Buffer.from(await font.arrayBuffer()));
      console.log(`fetched ${file}`);
    } catch (error) {
      console.warn(`Could not fetch ${file}: ${error.message}.`);
      if (process.env.VERCEL) process.exitCode = 1;
    }
  }
}
