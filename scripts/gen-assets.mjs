/**
 * Generates the OG share image, favicons, and schema logo from the brand mark.
 * Run with: node scripts/gen-assets.mjs   (also wired as a prebuild safety net)
 */
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = join(root, 'src/assets/revvia-logo.png');
const ogDir = join(root, 'public/og');

const BG = '#0A0A0C';
const GRAD_STOPS = `
  <stop offset="0%" stop-color="#8A0FAD"/>
  <stop offset="38%" stop-color="#D6248F"/>
  <stop offset="64%" stop-color="#EC4F65"/>
  <stop offset="100%" stop-color="#FE9C1C"/>`;

const logoBuf = await readFile(logoPath);
const logoB64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
await mkdir(ogDir, { recursive: true });

// ---- 1200×630 OG share image ----
const og = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${GRAD_STOPS}</linearGradient>
    <radialGradient id="glow1" cx="85%" cy="5%" r="55%">
      <stop offset="0%" stop-color="#FE9C1C" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#FE9C1C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="5%" cy="100%" r="60%">
      <stop offset="0%" stop-color="#8A0FAD" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#8A0FAD" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <image href="${logoB64}" x="96" y="150" width="150" height="121"/>
  <text x="270" y="262" font-family="Inter, Arial, sans-serif" font-size="120" font-weight="800" fill="#FFFFFF" letter-spacing="-3">Revvia</text>
  <text x="100" y="400" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700" fill="#FFFFFF" letter-spacing="-0.5">We run the whole stack — so your brand actually grows.</text>
  <text x="100" y="470" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="url(#g)">Marketing how it should be.</text>
  <text x="100" y="540" font-family="Inter, Arial, sans-serif" font-size="24" fill="#A7ADBA">DTC Growth Studio · Carlsbad, CA</text>
  <rect x="0" y="620" width="1200" height="10" fill="url(#g)"/>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(join(ogDir, 'revvia-og.png'));

// ---- square logo on dark (schema logo/image) ----
const squareLogo = `
<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="600" fill="${BG}"/>
  <image href="${logoB64}" x="150" y="178" width="300" height="242"/>
</svg>`;
await sharp(Buffer.from(squareLogo)).png().toFile(join(ogDir, 'revvia-logo.png'));

// ---- favicons ----
const iconBg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#15161D"/>
  <image href="${logoB64}" x="${size * 0.16}" y="${size * 0.22}" width="${size * 0.68}" height="${size * 0.55}"/>
</svg>`;
await sharp(Buffer.from(iconBg(512))).png().toFile(join(root, 'public/favicon.png'));
await sharp(Buffer.from(iconBg(180))).png().toFile(join(root, 'public/apple-touch-icon.png'));

// ---- crisp SVG favicon (rounded gradient tile + the mark) ----
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${GRAD_STOPS}</linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="#15161D"/>
  <image href="${logoB64}" x="10" y="14" width="44" height="36"/>
</svg>`;
await writeFile(join(root, 'public/favicon.svg'), faviconSvg, 'utf8');

console.log('Generated: public/og/revvia-og.png, public/og/revvia-logo.png, public/favicon.png, public/apple-touch-icon.png, public/favicon.svg');
