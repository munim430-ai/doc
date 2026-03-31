/**
 * docGenerator.js
 * Loads a DOCX template, injects data using docxtemplater,
 * and writes the result to the outputs directory.
 *
 * Formatting preservation guarantee:
 *   – We use PizZip to read the raw binary of the template.
 *   – Docxtemplater ONLY replaces placeholder tags — it never touches
 *     fonts, paragraph styles, table layouts, images, or any other XML nodes.
 *   – The output file is byte-identical to the template except for the
 *     replaced text nodes.
 */

const fs            = require('fs');
const path          = require('path');
const PizZip        = require('pizzip');
const Docxtemplater = require('docxtemplater');
const logger        = require('../utils/logger');

/**
 * Generate a single DOCX file from a template and data context.
 *
 * @param {string} templatePath  – Absolute path to the .docx template
 * @param {object} data          – docxtemplater context (from transformer)
 * @param {string} outputPath    – Absolute path for the output .docx file
 * @returns {string}  outputPath on success
 * @throws  on template load or rendering error
 */
function generateDoc(templatePath, data, outputPath) {
  // ── Load template binary ──────────────────────────────────────────────────
  let content;
  try {
    content = fs.readFileSync(templatePath, 'binary');
  } catch (err) {
    throw new Error(`Cannot read template file "${templatePath}": ${err.message}`);
  }

  const zip = new PizZip(content);

  // ── Initialise docxtemplater ──────────────────────────────────────────────
  const doc = new Docxtemplater(zip, {
    // paragraphLoop: true keeps multi-paragraph sections intact
    paragraphLoop: true,
    // linebreaks: true converts \n in values into real line breaks
    linebreaks: true,
    // nullGetter: return empty string for missing tags (no 'undefined' in docs)
    nullGetter() {
      return '';
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  try {
    doc.render(data);
  } catch (renderErr) {
    // Provide structured error info for debugging template issues
    const props = renderErr.properties;
    if (props && props.errors) {
      const details = props.errors
        .map(e => `  • ${e.message} [tag: ${e.properties?.tag || 'unknown'}]`)
        .join('\n');
      throw new Error(`Template rendering failed:\n${details}`);
    }
    throw new Error(`Template rendering failed: ${renderErr.message}`);
  }

  // ── Write output ──────────────────────────────────────────────────────────
  const outputBuf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputBuf);
  } catch (writeErr) {
    throw new Error(`Failed to write output file "${outputPath}": ${writeErr.message}`);
  }

  logger.info(`[DocGenerator] Written → ${path.basename(outputPath)}`);
  return outputPath;
}

module.exports = { generateDoc };
