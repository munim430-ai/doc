/**
 * excelParser.js
 * Reads an Excel (.xlsx) file, parses the first sheet,
 * and returns an array of row objects.
 * Validates headers against expected columns before returning.
 */

const XLSX = require('xlsx');
const logger = require('../utils/logger');

/**
 * Parse an Excel file and return an array of row objects.
 *
 * @param {string} filePath  – Absolute path to the uploaded .xlsx file
 * @param {string[]} expectedHeaders – Ordered list of expected column names
 * @returns {{ rows: object[], errors: string[] }}
 */
function parseExcel(filePath, expectedHeaders) {
  let workbook;

  try {
    workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  } catch (err) {
    throw new Error(`Failed to read Excel file: ${err.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',       // fill empty cells with empty string
    raw: false,       // keep all values as strings
  });

  if (rawRows.length === 0) {
    return { rows: [], errors: ['Excel file is empty or has no data rows.'] };
  }

  // ── Header Validation ─────────────────────────────────────────────────────
  const actualHeaders = Object.keys(rawRows[0]).map(h => h.trim().toLowerCase());
  const normalizedExpected = expectedHeaders.map(h => h.trim().toLowerCase());

  const missing = normalizedExpected.filter(h => !actualHeaders.includes(h));
  const extra   = actualHeaders.filter(h => !normalizedExpected.includes(h));

  if (missing.length > 0) {
    throw new Error(
      `Excel header mismatch.\n  Missing columns : ${missing.join(', ')}\n  Extra columns   : ${extra.length > 0 ? extra.join(', ') : 'none'}`
    );
  }

  logger.info(`[ExcelParser] Parsed ${rawRows.length} row(s) from sheet "${sheetName}".`);

  // ── Row Validation & Normalisation ────────────────────────────────────────
  const errors = [];
  // Normalize expected headers to underscore format (matches cleanKey below)
  const underscoredExpected = normalizedExpected.map(h => h.replace(/\s+/g, '_'));

  const rows = rawRows.map((raw, idx) => {
    const rowNum = idx + 2; // +1 for 1-index, +1 for header row
    const normalised = {};

    // Normalize keys to lowercase with underscores
    for (const [key, value] of Object.entries(raw)) {
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalised[cleanKey] = typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    // Required field check: any column that is empty counts as a warning
    for (const header of underscoredExpected) {
      if (!normalised[header] && normalised[header] !== '0') {
        errors.push(`Row ${rowNum}: field "${header}" is empty.`);
      }
    }

    return normalised;
  });

  return { rows, errors };
}

module.exports = { parseExcel };
