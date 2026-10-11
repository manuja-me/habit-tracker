const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function createSvg(size = 512, hasBorder = true) {
  const flameTargetSize = size * 0.68;
  const scale = flameTargetSize / 24;
  const translate = (size - flameTargetSize) / 2;
  const borderWidth = Math.max(1, Math.round(size * 0.03));
  const borderMargin = borderWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1D2021" />
  ${hasBorder && size >= 48 ? `<rect x="${borderMargin}" y="${borderMargin}" width="${size - borderMargin * 2}" height="${size - borderMargin * 2}" fill="none" stroke="#3C3836" stroke-width="${borderWidth}" />` : ''}
  <g transform="translate(${translate}, ${translate}) scale(${scale})">
    <path 
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" 
      fill="#FE8019" 
      stroke="#FE8019" 
      stroke-width="0.5" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    />
  </g>
</svg>`;
}

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(img => img.buffer)]);
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const srcAppDir = path.join(root, 'src', 'app');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  console.log('Generating SVG favicon...');
  const baseSvg = createSvg(512, true);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), baseSvg);

  console.log('Rendering PNG buffers...');
  const sizes = [16, 32, 48, 64, 180, 192, 256, 512];
  const pngMap = {};

  for (const s of sizes) {
    const svgForSize = createSvg(s, s >= 48);
    pngMap[s] = await sharp(Buffer.from(svgForSize))
      .resize(s, s)
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  // Write static png files to public/
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), pngMap[192]);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), pngMap[512]);
  fs.writeFileSync(path.join(publicDir, 'icon.png'), pngMap[512]);
  fs.writeFileSync(path.join(publicDir, 'apple-icon.png'), pngMap[180]);

  // Pack ICO containing 16x16, 32x32, 48x48, 256x256
  const icoBuffers = [
    { width: 16, height: 16, buffer: pngMap[16] },
    { width: 32, height: 32, buffer: pngMap[32] },
    { width: 48, height: 48, buffer: pngMap[48] },
    { width: 256, height: 256, buffer: pngMap[256] },
  ];
  const icoData = createIco(icoBuffers);

  console.log(`Writing favicon.ico (${icoData.length} bytes)...`);
  fs.writeFileSync(path.join(srcAppDir, 'favicon.ico'), icoData);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoData);

  console.log('All favicons and app icons generated successfully!');
}

run().catch(err => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});
