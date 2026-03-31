'use strict';
/**
 * buildTemplate.js
 *
 * Builds the Mokwon EAP DOCX template from the Rabbi-filled reference doc.
 *
 * Strategy: YEASIN_RABBI_MOKWON_FILLED.docx is the visual/structural base.
 * Replace student-specific values with {placeholders}.
 * Keep Korean name blank, signature lines blank, photo area unchanged.
 *
 * Run once:  node scripts/buildTemplate.js
 */

const PizZip = require('pizzip');
const fs     = require('fs');
const path   = require('path');

const SRC  = path.join(__dirname, '..', 'YEASIN_RABBI_MOKWON_FILLED.docx');
const DEST = path.join(__dirname, '..', 'universities', 'mokwon', 'template.docx');

// ── Get a paragraph's XML slice by paraId ─────────────────────────────────────
function getParaXml(xml, paraId) {
  const idx = xml.indexOf(`paraId="${paraId}"`);
  if (idx === -1) return null;
  const end = xml.indexOf('</w:p>', idx) + 6;
  return { idx, end, slice: xml.slice(idx, end) };
}

// ── Replace exact text within a paragraph's w:t element ──────────────────────
function replaceTextInPara(xml, paraId, oldText, newText) {
  const para = getParaXml(xml, paraId);
  if (!para) { console.warn(`  [WARN] paraId ${paraId} not found`); return xml; }

  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const newSlice = para.slice.replace(
    new RegExp(`(<w:t[^>]*>)${escaped}(<\\/w:t>)`),
    `$1${newText}$2`
  );
  return xml.slice(0, para.idx) + newSlice + xml.slice(para.end);
}

// ── Replace first occurrence of specific text in a paragraph's w:t ───────────
function replaceFirstRunTextInPara(xml, paraId, oldText, newText) {
  const para = getParaXml(xml, paraId);
  if (!para) { console.warn(`  [WARN] paraId ${paraId} not found`); return xml; }

  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let replaced = false;
  const newSlice = para.slice.replace(
    new RegExp(`(<w:t[^>]*>)${escaped}`),
    (match, open) => {
      if (replaced) return match;
      replaced = true;
      return `${open}${newText}`;
    }
  );
  return xml.slice(0, para.idx) + newSlice + xml.slice(para.end);
}

// ── Inject a placeholder run into an empty paragraph ─────────────────────────
function run(placeholder) {
  return (
    '<w:r>' +
    '<w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman"' +
    ' w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
    '</w:rPr>' +
    '<w:t xml:space="preserve">' + placeholder + '</w:t>' +
    '</w:r>'
  );
}

function injectIntoEmptyPara(xml, paraId, placeholder) {
  const para = getParaXml(xml, paraId);
  if (!para) { console.warn(`  [WARN] paraId ${paraId} not found`); return xml; }

  const pPrEnd = para.slice.indexOf('</w:pPr>');
  let newSlice;
  if (pPrEnd === -1) {
    newSlice = para.slice.slice(0, -6) + run(placeholder) + '</w:p>';
  } else {
    const insertAt = pPrEnd + 8;
    newSlice = para.slice.slice(0, insertAt) + run(placeholder) + para.slice.slice(insertAt);
  }
  return xml.slice(0, para.idx) + newSlice + xml.slice(para.end);
}

// ── Main ──────────────────────────────────────────────────────────────────────
function buildTemplate() {
  console.log('Reading Rabbi-filled DOCX as structural base…');
  const binary = fs.readFileSync(SRC, 'binary');
  const zip    = new PizZip(binary);
  let   docXml = zip.file('word/document.xml').asText();

  console.log('Replacing student-specific fields with {placeholders}…');

  // ── English name (Korean name cell 6F047129 intentionally left blank) ──────
  docXml = replaceTextInPara(docXml, '7F8FFEB5', 'YEASIN RABBI', '{full_name}');

  // ── Quarter checkboxes ──────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '1DFDC8A7', '☑', '{spring_check}');
  docXml = replaceTextInPara(docXml, '2C076C8F', '□', '{summer_check}');
  docXml = replaceTextInPara(docXml, '33DC8523', '□', '{fall_check}');
  docXml = replaceTextInPara(docXml, '2DEC6BBA', '□', '{winter_check}');

  // ── Gender checkboxes (each cell has 3 runs: checkbox | korean | /English) ─
  docXml = replaceFirstRunTextInPara(docXml, '1863850F', '☑ ', '{male_check} ');
  docXml = replaceFirstRunTextInPara(docXml, '3CF448B9', '□ ', '{female_check} ');

  // ── Date of Birth (Rabbi doc uses value-then-label order) ──────────────────
  // 227A15BA = year  (Rabbi: "2005")
  // 5EE22C0B = month (Rabbi: "12")
  // 6888E24D = day   (Rabbi: "05")
  docXml = replaceTextInPara(docXml, '227A15BA', '2005', '{birth_year}');
  docXml = replaceTextInPara(docXml, '5EE22C0B', '12',   '{birth_month}');
  docXml = replaceTextInPara(docXml, '6888E24D', '05',   '{birth_day}');

  // ── Nationality ─────────────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '789239C0', 'BANGLADESH', '{nationality}');

  // ── Passport Number ─────────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '4F85F6BC', 'A14039347', '{passport_number}');

  // ── Place of Birth ──────────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '7D3D656C', 'BANGLADESH', '{place_of_birth}');

  // ── Address ─────────────────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '125D3336',
    'SHIBRAMPUR, BURICHONG, BURICHONG - 3520, CUMILLA', '{address}');

  // ── Phone ───────────────────────────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '634A6B36', '+8801763613581', '{phone}');

  // ── School Name (Rabbi doc: 2F4E0883 — differs from blank form's 375ABE94) ─
  docXml = replaceTextInPara(docXml, '2F4E0883',
    'Mosharrof Hossain Khan Chowdhury Degree College', '{school_name}');

  // ── Agency Name (Rabbi doc: 19844208 — differs from blank form's 59CC9BDD) ─
  docXml = replaceTextInPara(docXml, '19844208',
    'Keystone Education Consultancy', '{agency_name}');

  // ── Consent page 1 — Personal Info ─────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '5E6CF235', '☑', '{consent_pi_yes_check}');
  docXml = replaceTextInPara(docXml, '1494BEE9', '□', '{consent_pi_no_check}');

  // ── Consent page 2 — Identification ────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '7BF3349F', '☑', '{consent_id_yes_check}');
  docXml = replaceTextInPara(docXml, '3C36C407', '□', '{consent_id_no_check}');

  // ── Consent page 3 — Third Party ───────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '30CD4F0B', '☑', '{consent_tp_yes_check}');
  docXml = replaceTextInPara(docXml, '4F5E2F3D', '□', '{consent_tp_no_check}');

  // ── Affidavit — Sponsor fields ──────────────────────────────────────────────
  docXml = replaceTextInPara(docXml, '54C0A82E', 'MOMTAZ BEGUM',                             '{sponsor_name}');
  docXml = replaceTextInPara(docXml, '527FAFF0',
    'SHIBRAMPUR, BURICHONG, BURICHONG - 3520, CUMILLA', '{sponsor_address}');
  docXml = replaceTextInPara(docXml, '6B05DE58', 'BUSINESS',   '{sponsor_occupation}');
  docXml = replaceTextInPara(docXml, '458777C7', 'MOTHER',     '{sponsor_relation}');
  docXml = replaceTextInPara(docXml, '7F7B4E3C', '+8801763613581', '{sponsor_tel}');

  // ── Sponsor HP (empty in Rabbi's form — inject placeholder) ─────────────────
  docXml = injectIntoEmptyPara(docXml, '4776947B', '{sponsor_hp}');

  // ── Affidavit consent checkbox ──────────────────────────────────────────────
  // 6345B7F5 runs: "□ 예(" | "Yes)   " | "      □ " | "아니오" | "(No)"
  docXml = replaceFirstRunTextInPara(docXml, '6345B7F5', '□ 예(', '{sponsor_consent_yes_check} 예(');
  docXml = replaceFirstRunTextInPara(docXml, '6345B7F5', '      □ ', '      {sponsor_consent_no_check} ');

  // ── Write modified XML back into zip ────────────────────────────────────────
  zip.file('word/document.xml', docXml);
  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, outBuf);

  console.log('Template written to:', DEST);
  console.log('Done.');
}

buildTemplate();
