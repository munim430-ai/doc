'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const findFreePort = require('find-free-port');

const documentsRoot = path.join(process.env.USERPROFILE || os.homedir(), 'Documents', 'Folio');
const bundledRoot = path.join(__dirname, 'universities', 'mokwon');
const userMokwonRoot = path.join(documentsRoot, 'universities', 'mokwon');

process.env.FOLIO_DATA_PATH = documentsRoot;
process.env.FOLIO_PASSWORD = process.env.FOLIO_PASSWORD || 'Torechudi0';

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyIfMissing(fileName) {
  const sourcePath = path.join(bundledRoot, fileName);
  const destinationPath = path.join(userMokwonRoot, fileName);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const sourceBuffer = fs.readFileSync(sourcePath);
  if (fs.existsSync(destinationPath)) {
    const destinationBuffer = fs.readFileSync(destinationPath);
    if (Buffer.compare(sourceBuffer, destinationBuffer) === 0) {
      return;
    }
  }

  fs.writeFileSync(destinationPath, sourceBuffer);
}

function ensureUserFiles() {
  [
    documentsRoot,
    path.join(documentsRoot, 'uploads'),
    path.join(documentsRoot, 'outputs'),
    path.join(documentsRoot, 'universities'),
    userMokwonRoot,
  ].forEach(ensureDir);

  ['template.docx', 'excel_template.xlsx', 'config.json'].forEach(copyIfMissing);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    findFreePort(3210, 3299, (error, port) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Array.isArray(port) ? port[0] : port);
    });
  });
}

function openBrowser(url) {
  exec(`start "" "${url}"`);
}

async function bootstrap() {
  ensureUserFiles();

  const port = await getFreePort();
  process.env.PORT = String(port);

  const { startServer } = require('./server');
  const server = startServer(port);

  server.once('listening', () => {
    openBrowser(`http://127.0.0.1:${port}/password`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
