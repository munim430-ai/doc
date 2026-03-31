'use strict';

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const logger = require('./utils/logger');
const registry = require('./utils/universityRegistryRuntime');
const { parseExcel } = require('./services/excelParser');
const { transformRow } = require('./services/transformer');
const { generateDoc } = require('./services/docGenerator');
const { passwordHtml, indexHtml } = require('./bundledAssets');

const DATA_ROOT = process.env.FOLIO_DATA_PATH || process.cwd();
const UNIVERSITIES_DIR = path.join(DATA_ROOT, 'universities');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads');
const OUTPUTS_DIR = path.join(DATA_ROOT, 'outputs');
const AUTH_COOKIE = 'folio_auth';
const AUTH_PASSWORD = process.env.FOLIO_PASSWORD || 'Torechudi0';
const authSessions = new Set();

function createApplicantFileName(applicantName, rowNum) {
  const safeBase = String(applicantName || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return `${safeBase || `applicant_${rowNum}`}.docx`;
}

[UNIVERSITIES_DIR, UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.xlsx') {
      return cb(new Error('Only .xlsx files are accepted.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((all, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return all;
      }

      const key = part.slice(0, separatorIndex);
      const value = decodeURIComponent(part.slice(separatorIndex + 1));
      all[key] = value;
      return all;
    }, {});
}

function getAuthToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE];
}

function isAuthenticated(req) {
  const token = getAuthToken(req);
  return Boolean(token && authSessions.has(token));
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  if (req.accepts('html')) {
    return res.redirect('/password');
  }

  return res.status(401).json({ success: false, error: 'Authentication required.' });
}

function issueAuthCookie(res) {
  const token = crypto.randomBytes(24).toString('hex');
  authSessions.add(token);
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`);
}

function clearAuthCookie(req, res) {
  const token = getAuthToken(req);
  if (token) {
    authSessions.delete(token);
  }
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static assets from public/ (app.js, style.css, etc.) — index: false
// so that GET / still goes through the auth redirect logic below.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', (req, res) => {
  res.redirect(isAuthenticated(req) ? '/app' : '/password');
});

app.get('/password', (_req, res) => {
  res.type('html').send(passwordHtml);
});

app.post('/auth/login', (req, res) => {
  if ((req.body?.password || '') !== AUTH_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid password.' });
  }

  issueAuthCookie(res);
  return res.json({ success: true, redirect: '/app' });
});

app.post('/auth/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true });
});

app.get('/app', requireAuth, (_req, res) => {
  const universities = registry.list();
  const optionMarkup = [
    '<option value="" data-i18n="selInst">Select institution...</option>',
    ...universities.map((university) => (
      `<option value="${university.id}">${university.displayName || university.id}</option>`
    )),
  ].join('');

  const renderedHtml = indexHtml.replace(
    '<option value="" data-i18n="selInst">Select institution...</option>',
    optionMarkup,
  );

  res.type('html').send(renderedHtml);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', (_req, res) => {
  const version = require('./package.json').version;
  const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  res.json({ version: `v${version}-native`, memory: `${memoryMB} MB` });
});

app.post('/open-templates', requireAuth, (_req, res) => {
  exec(`start "" "${UNIVERSITIES_DIR}"`);
  res.json({ success: true });
});

app.post('/open-outputs', requireAuth, (_req, res) => {
  exec(`start "" "${OUTPUTS_DIR}"`);
  res.json({ success: true });
});

// Download the blank Excel template for a given university
app.get('/excel-template/:universityId', requireAuth, (req, res) => {
  const uni = registry.get(req.params.universityId);
  if (!uni) {
    return res.status(404).json({ success: false, error: 'University not found.' });
  }

  const xlsxPath = path.join(path.dirname(uni.templatePath), 'excel_template.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    return res.status(404).json({ success: false, error: 'Excel template not found.' });
  }

  return res.download(xlsxPath, `${uni.id}_student_template.xlsx`, (err) => {
    if (err) logger.error(`[GET /excel-template] ${err.message}`);
  });
});

// Download all generated files as a ZIP
app.get('/download-all', requireAuth, (req, res) => {
  const files = fs.readdirSync(OUTPUTS_DIR).filter((f) => f.endsWith('.docx'));

  if (files.length === 0) {
    return res.status(404).json({ success: false, error: 'No generated files.' });
  }

  // Build a simple ZIP using PizZip (already a dependency)
  const PizZip = require('pizzip');
  const zip = new PizZip();

  files.forEach((filename) => {
    const content = fs.readFileSync(path.join(OUTPUTS_DIR, filename));
    zip.file(filename, content);
  });

  const zipBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="generated_forms.zip"');
  return res.send(zipBuf);
});

app.get('/universities', requireAuth, (_req, res) => {
  const list = registry.list();
  logger.info(`[GET /universities] Returning ${list.length} universit(ies).`);
  res.json({ universities: list });
});

app.post('/generate', requireAuth, upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const universityId = (req.body.university || '').toLowerCase().trim();

  if (!universityId) {
    return res.status(400).json({ success: false, error: 'Field "university" is required.' });
  }

  if (!registry.has(universityId)) {
    return res.status(400).json({
      success: false,
      error: `Unknown university "${universityId}". Available: ${registry.list().map((u) => u.id).join(', ')}`,
    });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No Excel file uploaded.' });
  }

  const uni = registry.get(universityId);
  logger.info(`[POST /generate] University="${uni.displayName}", file="${req.file.originalname}"`);

  let rows;
  let parseWarnings;

  try {
    const result = parseExcel(req.file.path, uni.excelHeaders);
    rows = result.rows;
    parseWarnings = filterDefaultedWarnings(result.errors, uni.defaults);
  } catch (error) {
    logger.error(`[POST /generate] Excel parse error: ${error.message}`);
    return res.status(422).json({ success: false, error: error.message });
  }

  if (rows.length === 0) {
    return res.status(422).json({ success: false, error: 'Excel file contains no data rows.' });
  }

  try {
    fs.readdirSync(OUTPUTS_DIR)
      .filter((fileName) => fileName.endsWith('.docx'))
      .forEach((fileName) => fs.unlinkSync(path.join(OUTPUTS_DIR, fileName)));
  } catch {}

  const generatedFiles = [];
  const generationErrors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const rowNum = index + 1;
    const rawRow = rows[index];
    const applicantName = rawRow.full_name || `Applicant ${rowNum}`;
    const outName = createApplicantFileName(applicantName, rowNum);
    const outPath = path.join(OUTPUTS_DIR, outName);

    try {
      const data = transformRow(rawRow, index);
      generateDoc(uni.templatePath, data, outPath);
      generatedFiles.push({
        index: rowNum,
        applicant: applicantName,
        filename: outName,
        path: `/download/${outName}`,
      });
      logger.info(`[POST /generate] Row ${rowNum} -> ${outName}`);
    } catch (error) {
      logger.error(`[POST /generate] Row ${rowNum} failed: ${error.message}`);
      generationErrors.push(`Row ${rowNum} (${rawRow.full_name || '?' }): ${error.message}`);
    }
  }

  try {
    fs.unlinkSync(req.file.path);
  } catch {}

  const elapsed = Date.now() - startTime;
  logger.info(`[POST /generate] Done. ${generatedFiles.length}/${rows.length} file(s) in ${elapsed}ms.`);

  return res.json({
    success: generationErrors.length === 0,
    university: uni.displayName,
    totalRows: rows.length,
    generated: generatedFiles.length,
    files: generatedFiles,
    warnings: [...parseWarnings, ...generationErrors],
    elapsedMs: elapsed,
  });
});

app.get('/download/:filename', requireAuth, (req, res) => {
  const safeName = path.basename(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = path.join(OUTPUTS_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: `File "${safeName}" not found.` });
  }

  return res.download(filePath, safeName, (error) => {
    if (error) {
      logger.error(`[GET /download] Error sending ${safeName}: ${error.message}`);
    }
  });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    logger.error(`[Multer] ${err.message}`);
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err) {
    logger.error(`[Server] Uncaught error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }

  return res.status(500).json({ success: false, error: 'Unknown server error.' });
});

function startServer(port = process.env.PORT || 3000) {
  return app.listen(port, () => {
    logger.info('------------------------------------------------');
    logger.info(` Folio API -> http://127.0.0.1:${port}`);
    logger.info(` Universities loaded : ${registry.list().length}`);
    logger.info('------------------------------------------------');
  });
}

function filterDefaultedWarnings(warnings, defaults = {}) {
  const defaultedFields = new Set(Object.keys(defaults));
  if (defaultedFields.size === 0) {
    return warnings;
  }

  return warnings.filter((warning) => {
    const match = warning.match(/field "([^"]+)"/);
    if (!match) {
      return true;
    }

    return !defaultedFields.has(match[1]);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
