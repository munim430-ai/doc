'use strict';
/**
 * Creates a minimal valid ICO file for Folio.
 * This is a 32×32 white "F" on dark background encoded as ICO.
 *
 * For production, replace assets/icon.ico with a proper high-res icon.
 */

const fs   = require('fs');
const path = require('path');

// Create a simple 32x32 ICO by writing a valid minimal ICO structure
// We'll generate a BMP-based ICO with a simple design

const SIZE = 32;
const pixels = Buffer.alloc(SIZE * SIZE * 4); // BGRA

// Dark navy background
const bg = { b: 0x1e, g: 0x0a, r: 0x08, a: 0xff };
// White / blue accent
const fg = { b: 0xff, g: 0xff, r: 0xff, a: 0xff };

// Fill background
for (let i = 0; i < SIZE * SIZE; i++) {
  const off = i * 4;
  pixels[off]     = bg.b;
  pixels[off + 1] = bg.g;
  pixels[off + 2] = bg.r;
  pixels[off + 3] = bg.a;
}

// Draw a simple "F" letter
function setPixel(x, y, color) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const off = (y * SIZE + x) * 4;
  pixels[off]     = color.b;
  pixels[off + 1] = color.g;
  pixels[off + 2] = color.r;
  pixels[off + 3] = color.a;
}

// F shape (scaled to ~18px tall, centered)
const startX = 9, startY = 7;
// Vertical stroke
for (let y = 0; y < 18; y++) setPixel(startX, startY + y, fg);
for (let y = 0; y < 18; y++) setPixel(startX + 1, startY + y, fg);
// Top horizontal
for (let x = 0; x < 12; x++) setPixel(startX + x, startY, fg);
for (let x = 0; x < 12; x++) setPixel(startX + x, startY + 1, fg);
// Middle horizontal
for (let x = 0; x < 9; x++) setPixel(startX + x, startY + 8, fg);
for (let x = 0; x < 9; x++) setPixel(startX + x, startY + 9, fg);

// Build ICO file manually
// ICO header (6 bytes) + directory entry (16 bytes) + BMP info header (40 bytes) + pixels

const BMP_INFO_SIZE = 40;
const PIXEL_DATA_SIZE = SIZE * SIZE * 4;
const AND_MASK_SIZE = SIZE * (SIZE / 8); // XOR mask (all transparent)
const IMAGE_SIZE = BMP_INFO_SIZE + PIXEL_DATA_SIZE + AND_MASK_SIZE;

const buf = Buffer.alloc(6 + 16 + IMAGE_SIZE);
let pos = 0;

// ICO file header
buf.writeUInt16LE(0, pos); pos += 2;         // Reserved
buf.writeUInt16LE(1, pos); pos += 2;         // Type: 1 = ICO
buf.writeUInt16LE(1, pos); pos += 2;         // Count: 1 image

// Directory entry
buf.writeUInt8(SIZE, pos); pos += 1;         // Width
buf.writeUInt8(SIZE, pos); pos += 1;         // Height
buf.writeUInt8(0, pos); pos += 1;            // Color count (0 = no palette)
buf.writeUInt8(0, pos); pos += 1;            // Reserved
buf.writeUInt16LE(1, pos); pos += 2;         // Color planes
buf.writeUInt16LE(32, pos); pos += 2;        // Bits per pixel
buf.writeUInt32LE(IMAGE_SIZE, pos); pos += 4; // Size of image data
buf.writeUInt32LE(22, pos); pos += 4;        // Offset of image data (6 + 16 = 22)

// BMP info header (BITMAPINFOHEADER)
buf.writeUInt32LE(BMP_INFO_SIZE, pos); pos += 4;     // Size of this header
buf.writeInt32LE(SIZE, pos); pos += 4;               // Width
buf.writeInt32LE(SIZE * 2, pos); pos += 4;           // Height * 2 (ICO convention)
buf.writeUInt16LE(1, pos); pos += 2;                 // Color planes
buf.writeUInt16LE(32, pos); pos += 2;                // Bits per pixel
buf.writeUInt32LE(0, pos); pos += 4;                 // Compression: BI_RGB
buf.writeUInt32LE(PIXEL_DATA_SIZE, pos); pos += 4;   // Image size
buf.writeInt32LE(0, pos); pos += 4;                  // X pixels per meter
buf.writeInt32LE(0, pos); pos += 4;                  // Y pixels per meter
buf.writeUInt32LE(0, pos); pos += 4;                 // Colors in table
buf.writeUInt32LE(0, pos); pos += 4;                 // Important color count

// BMP pixels (bottom-up row order for BMP)
for (let y = SIZE - 1; y >= 0; y--) {
  for (let x = 0; x < SIZE; x++) {
    const srcOff = (y * SIZE + x) * 4;
    buf[pos++] = pixels[srcOff];     // B
    buf[pos++] = pixels[srcOff + 1]; // G
    buf[pos++] = pixels[srcOff + 2]; // R
    buf[pos++] = pixels[srcOff + 3]; // A
  }
}

// AND mask (all zeros = opaque)
for (let i = 0; i < AND_MASK_SIZE; i++) buf[pos++] = 0;

const outPath = path.join(__dirname, '..', 'assets', 'icon.ico');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log('Icon created:', outPath, '(', buf.length, 'bytes)');
