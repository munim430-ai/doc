'use strict';
/**
 * buildTemplate.js
 *
 * Reads the blank Mokwon DOCX, injects docxtemplater {placeholders} and
 * checkbox tags into the correct table cells (identified by their unique
 * w14:paraId attributes), then writes the result to:
 *   universities/mokwon/template.docx
 *
 * Run once:  node scripts/buildTemplate.js
 */

const PizZip = require('pizzip');
const fs     = require('fs');
const path   = require('path');

const SRC  = path.join(__dirname, '..', 'MOKWON UNIVERSITY EAP APPLICATION FORM.docx');
const DEST = path.join(__dirname, '..', 'universities', 'mokwon', 'template.docx');

// ── Font run wrapper (matches existing Times New Roman runs in the doc) ───────
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

// ── Inject a run into an EMPTY paragraph (identified by paraId) ───────────────
function injectIntoEmptyPara(xml, paraId, placeholder) {
  // Pattern: find the paragraph by its unique paraId and add a run after <w:pPr>...</w:pPr>
  const paraStart = new RegExp(
    `(w14:paraId="${paraId}"[^>]*>)((?:[\\s\\S]*?)<\\/w:pPr>)([\\s\\S]*?)(<\\/w:p>)`,
    'g'
  );

  return xml.replace(paraStart, (match, attrs, pPr, rest, end) => {
    // Only inject if the cell is currently empty (no existing w:r runs from text)
    if (rest.includes('<w:t>') || rest.includes('<w:t ')) {
      return match; // already has content, skip
    }
    return attrs + pPr + run(placeholder) + end;
  });
}

// ── Replace text content inside a specific paragraph ─────────────────────────
function replaceTextInPara(xml, paraId, oldText, newText) {
  const escapedOld = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const paraPattern = new RegExp(
    `(w14:paraId="${paraId}"[\\s\\S]*?)<\\/w:p>`,
    'g'
  );

  return xml.replace(paraPattern, (match) => {
    return match.replace(
      new RegExp(`<w:t[^>]*>${escapedOld}<\\/w:t>`),
      `<w:t xml:space="preserve">${newText}</w:t>`
    );
  });
}

// ── Replace JUST the checkbox char □ inside a paragraph ──────────────────────
function replaceCheckboxInPara(xml, paraId, placeholder) {
  return replaceTextInPara(xml, paraId, '□', placeholder);
}

// ── Main ──────────────────────────────────────────────────────────────────────
function buildTemplate() {
  console.log('Reading blank DOCX…');
  const binary  = fs.readFileSync(SRC, 'binary');
  const zip     = new PizZip(binary);
  let   docXml  = zip.file('word/document.xml').asText();

  // ── Quarter checkboxes (row 1) ──────────────────────────────────────────
  docXml = replaceCheckboxInPara(docXml, '1DFDC8A7', '{spring_check}');
  docXml = replaceCheckboxInPara(docXml, '2C076C8F', '{summer_check}');
  docXml = replaceCheckboxInPara(docXml, '33DC8523', '{fall_check}');
  docXml = replaceCheckboxInPara(docXml, '2DEC6BBA', '{winter_check}');

  // ── Name fields ─────────────────────────────────────────────────────────
  // 6F047129 = Korean name cell (empty, after "(한국어)")
  docXml = injectIntoEmptyPara(docXml, '6F047129', '{full_name}');
  // 7F8FFEB5 = English name cell (empty, after "(English)")
  docXml = injectIntoEmptyPara(docXml, '7F8FFEB5', '{full_name}');

  // ── Gender checkboxes ───────────────────────────────────────────────────
  // 1863850F text is ["□ ", "남", "/Male"] — replace first w:t "□ " only
  docXml = replaceFirstRunTextInPara(docXml, '1863850F', '□ ', '{male_check} ');
  // 3CF448B9 text is ["□ ", "여", "/Female"] — replace first w:t "□ " only
  docXml = replaceFirstRunTextInPara(docXml, '3CF448B9', '□ ', '{female_check} ');

  // ── Date of Birth ───────────────────────────────────────────────────────
  // 5EE22C0B = empty cell between "년/Year" label and "월/Month" label
  docXml = injectIntoEmptyPara(docXml, '5EE22C0B', '{birth_year}');
  // 6888E24D = empty cell after "월/Month" label
  docXml = injectIntoEmptyPara(docXml, '6888E24D', '{birth_month}');
  // 7BC577AC = empty cell after "일/Day" label
  docXml = injectIntoEmptyPara(docXml, '7BC577AC', '{birth_day}');

  // ── Nationality ─────────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '789239C0', '{nationality}');

  // ── Passport Number ─────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '4F85F6BC', '{passport_number}');

  // ── Place of Birth ──────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '7D3D656C', '{place_of_birth}');

  // ── Address ─────────────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '125D3336', '{address}');

  // ── Phone ───────────────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '634A6B36', '{phone}');

  // ── School Name ─────────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '375ABE94', '{school_name}');

  // ── Agency Name ─────────────────────────────────────────────────────────
  docXml = injectIntoEmptyPara(docXml, '59CC9BDD', '{agency_name}');

  // ── Applicant signature line (page 1) ───────────────────────────────────
  // 1C17C11B text is [": ", "spaces", "  ", " (", "Signature)"]
  // Replace the large-whitespace run with {full_name}
  docXml = replaceSpacesRunInPara(docXml, '1C17C11B', '{full_name}');

  // ── Consent page 1 — Personal Info (Yes / No) ───────────────────────────
  // 5E6CF235 = first □ (Yes)
  docXml = replaceCheckboxInPara(docXml, '5E6CF235', '{consent_pi_yes_check}');
  // 1494BEE9 = second □ (No)
  docXml = replaceCheckboxInPara(docXml, '1494BEE9', '{consent_pi_no_check}');

  // ── Consent page 2 — Identification (Yes / No) ──────────────────────────
  // 7BF3349F = first □ (Yes)
  docXml = replaceCheckboxInPara(docXml, '7BF3349F', '{consent_id_yes_check}');
  // 3C36C407 = second □ (No)
  docXml = replaceCheckboxInPara(docXml, '3C36C407', '{consent_id_no_check}');

  // ── Consent page 3 — Third Party (Yes / No) ─────────────────────────────
  // 30CD4F0B = first □ (Yes)
  docXml = replaceCheckboxInPara(docXml, '30CD4F0B', '{consent_tp_yes_check}');
  // 4F5E2F3D = second □ (No)
  docXml = replaceCheckboxInPara(docXml, '4F5E2F3D', '{consent_tp_no_check}');

  // ── Consent page 2 signature ────────────────────────────────────────────
  // 7E19F301 text is [": ", "spaces", "  ", " (", "Signature)"]
  docXml = replaceSpacesRunInPara(docXml, '7E19F301', '{full_name}');

  // ── Affidavit — Sponsor fields ──────────────────────────────────────────
  // 54C0A82E = empty after "Name of Sponsor"
  docXml = injectIntoEmptyPara(docXml, '54C0A82E', '{sponsor_name}');
  // 527FAFF0 = empty after "Address"
  docXml = injectIntoEmptyPara(docXml, '527FAFF0', '{sponsor_address}');
  // 6B05DE58 = empty after "Occupation"
  docXml = injectIntoEmptyPara(docXml, '6B05DE58', '{sponsor_occupation}');
  // 458777C7 = empty after "Relations"
  docXml = injectIntoEmptyPara(docXml, '458777C7', '{sponsor_relation}');
  // TEL field (7F7B4E3C = empty after TEL label)
  docXml = injectIntoEmptyPara(docXml, '7F7B4E3C', '{sponsor_tel}');
  // HP field (4776947B = empty after HP label)
  docXml = injectIntoEmptyPara(docXml, '4776947B', '{sponsor_hp}');

  // ── Affidavit consent checkbox ──────────────────────────────────────────
  // 6345B7F5 = ["□ 예(", "Yes)   ", "      □ ", "아니오", "(No)"]
  docXml = replaceFirstRunTextInPara(docXml, '6345B7F5', '□ 예(', '{sponsor_consent_yes_check} 예(');
  docXml = replaceFirstRunTextInPara(docXml, '6345B7F5', '      □ ', '      {sponsor_consent_no_check} ');

  // ── Affidavit signer name ───────────────────────────────────────────────
  // 4A4B848C = ["이름", "(", "NAME)", " : ", "spaces", "(SIGNATURE)"]
  // Replace the large-whitespace run with {sponsor_name}
  docXml = replaceSpacesRunInPara(docXml, '4A4B848C', '{sponsor_name}');

  // ── Write modified XML back into zip ────────────────────────────────────
  zip.file('word/document.xml', docXml);

  const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, outBuf);

  console.log('Template written to:', DEST);
  console.log('Done.');
}

// ── Helpers for specific complex replacements ─────────────────────────────────

/**
 * Replace the FIRST occurrence of a specific text value in a specific paragraph's w:t elements.
 */
function replaceFirstRunTextInPara(xml, paraId, oldText, newText) {
  const idx = xml.indexOf(`paraId="${paraId}"`);
  if (idx === -1) return xml;
  const end = xml.indexOf('</w:p>', idx);
  if (end === -1) return xml;
  const paraXml = xml.slice(idx, end + 6);

  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const newParaXml = paraXml.replace(
    new RegExp(`(<w:t[^>]*>)${escaped}`),
    (match, open) => `${open}${newText}`
  );

  return xml.slice(0, idx) + newParaXml + xml.slice(end + 6);
}

/**
 * Replace the FIRST large whitespace-only run in a paragraph with a placeholder.
 * Used for signature lines like ": [lots of spaces] (Signature)".
 */
function replaceSpacesRunInPara(xml, paraId, placeholder) {
  const idx = xml.indexOf(`paraId="${paraId}"`);
  if (idx === -1) return xml;
  const end = xml.indexOf('</w:p>', idx);
  if (end === -1) return xml;
  const paraXml = xml.slice(idx, end + 6);

  let replaced = false;
  const newParaXml = paraXml.replace(
    /(<w:t[^>]*>)([ \u00a0]{4,})(<\/w:t>)/,
    (match, open, spaces, close) => {
      if (replaced) return match;
      replaced = true;
      return `${open}${placeholder}${close}`;
    }
  );

  return xml.slice(0, idx) + newParaXml + xml.slice(end + 6);
}

// ── Run ───────────────────────────────────────────────────────────────────────
buildTemplate();
