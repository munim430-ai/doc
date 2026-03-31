'use strict';

/**
 * bundledAssets.js
 * Reads the HTML files from public/ at startup and exports them as strings.
 * This allows server.js to serve them without Express static middleware,
 * which is important for the asar-packaged Electron build.
 */

const fs   = require('fs');
const path = require('path');

function readAsset(filename) {
  // Try multiple paths: works in dev, works when packaged
  const candidates = [
    path.join(__dirname, 'public', filename),
    path.join(process.resourcesPath || '', 'app', 'public', filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }

  throw new Error(`Asset not found: ${filename}`);
}

let _passwordHtml;
let _indexHtml;

function getPasswordHtml() {
  if (!_passwordHtml) _passwordHtml = readAsset('password.html');
  return _passwordHtml;
}

function getIndexHtml() {
  if (!_indexHtml) _indexHtml = readAsset('index.html');
  return _indexHtml;
}

module.exports = {
  get passwordHtml() { return getPasswordHtml(); },
  get indexHtml()    { return getIndexHtml(); },
};
