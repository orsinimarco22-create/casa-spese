// generate_icons.js - Generatore icone PNG standalone (senza dipendenze esterne)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Tabella CRC32 per chunk PNG
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = crc32(toCrc);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines: (1 byte filter (0) + width * 4 bytes RGBA) * height
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Disegna l'icona "Casa & Spese":
// Sfondo verde smeraldo (#10b981) con angoli arrotondati, casa stilizzata bianca e tetto caldo (#f59e0b)
function drawCasaSpese(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.22; // Raggio angoli

  // Distanza dagli angoli per rounded rectangle
  const pad = w * 0.04;
  const innerW = w - 2 * pad;
  const innerH = h - 2 * pad;
  const rx = Math.max(0, Math.abs(x - cx) - (innerW / 2 - radius));
  const ry = Math.max(0, Math.abs(y - cy) - (innerH / 2 - radius));
  const cornerDist = Math.sqrt(rx * rx + ry * ry);

  // Se fuori dal rettangolo arrotondato
  if (rx > 0 && ry > 0 && cornerDist > radius) {
    return [0, 0, 0, 0]; // Trasparente
  }
  if (x < pad || x > w - pad || y < pad || y > h - pad) {
    return [0, 0, 0, 0];
  }

  // Gradiente di sfondo smeraldo
  const normY = y / h;
  const rBg = Math.round(16 + normY * 10);
  const gBg = Math.round(185 - normY * 20);
  const bBg = Math.round(129 - normY * 25);

  // Coordinate casa al centro
  // Tetto: triangolo con vertice in alto (cx, cy - h*0.22), base da cx - w*0.26 a cx + w*0.26 a cy - h*0.02
  const roofTopY = cy - h * 0.22;
  const roofBaseY = cy - h * 0.02;
  const roofHalfWidth = w * 0.26;

  // Verifica se dentro il triangolo del tetto
  if (y >= roofTopY && y <= roofBaseY) {
    const progress = (y - roofTopY) / (roofBaseY - roofTopY);
    const halfWidthAtY = progress * roofHalfWidth;
    if (Math.abs(x - cx) <= halfWidthAtY) {
      // Bianco / panna chiaro per il tetto con bordo dorato
      return [255, 255, 255, 255];
    }
  }

  // Corpo della casa: rettangolo da roofBaseY a cy + h*0.24, larghezza cx - w*0.20 a cx + w*0.20
  const houseBottomY = cy + h * 0.24;
  const houseHalfWidth = w * 0.20;
  if (y >= roofBaseY && y <= houseBottomY && Math.abs(x - cx) <= houseHalfWidth) {
    // Porta al centro
    const doorTopY = cy + h * 0.06;
    const doorHalfWidth = w * 0.07;
    if (y >= doorTopY && Math.abs(x - cx) <= doorHalfWidth) {
      // Colore porta (legno / ambra dorato #d97706)
      return [217, 119, 6, 255];
    }
    // Pareti casa (bianco brillante)
    return [255, 255, 255, 255];
  }

  // Camino
  const chimneyLeft = cx + w * 0.10;
  const chimneyRight = cx + w * 0.16;
  const chimneyTop = cy - h * 0.24;
  if (x >= chimneyLeft && x <= chimneyRight && y >= chimneyTop && y <= roofBaseY) {
    return [255, 255, 255, 255];
  }

  // Moneta/Euro piccolo in alto a destra: cerchio oro (#fbbf24)
  const coinCx = cx + w * 0.24;
  const coinCy = cy - h * 0.18;
  const coinRadius = w * 0.09;
  const distCoin = Math.sqrt((x - coinCx) ** 2 + (y - coinCy) ** 2);
  if (distCoin <= coinRadius) {
    if (distCoin >= coinRadius - w * 0.02) {
      return [217, 119, 6, 255]; // Bordo scuro
    }
    return [251, 191, 36, 255]; // Oro interno
  }

  // Sfondo
  return [rBg, gBg, bBg, 255];
}

console.log('🖼️ Generazione icone PWA in corso...');
const icon512 = createPng(512, 512, drawCasaSpese);
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), icon512);
console.log('   ✅ Creata public/icon-512.png (512x512)');

const icon192 = createPng(192, 192, drawCasaSpese);
fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), icon192);
console.log('   ✅ Creata public/icon-192.png (192x192)');

fs.writeFileSync(path.join(__dirname, 'public', 'apple-touch-icon.png'), icon192);
console.log('   ✅ Creata public/apple-touch-icon.png (192x192)');
