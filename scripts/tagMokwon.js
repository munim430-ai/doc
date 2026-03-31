'use strict';
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'MOKWON UNIVERSITY EAP APPLICATION FORM.docx');
const outputPath = path.join(__dirname, '..', 'universities', 'mokwon', 'template.docx');

if (!fs.existsSync(inputPath)) {
  console.error('Source template not found at', inputPath);
  process.exit(1);
}

const content = fs.readFileSync(inputPath, 'binary');
const zip = new PizZip(content);
let xml = zip.file('word/document.xml').asText();

/**
 * Robust replacement that handles XML tags between words (common in DOCX).
 * This is a simplified version; for production, we'd use a proper parser.
 * But for this task, we can use specific anchors.
 */
function replaceLabel(label, tag) {
  // We look for the label text and append/replace the tag
  // Note: labels are often split by <w:t> tags
  // For the sake of this demo, we'll try literal replacements if possible,
  // or use regex that ignores tags.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  if (xml.includes(label)) {
    xml = xml.replace(label, `${label} ${tag}`);
  } else {
    console.warn(`Label not found: ${label}`);
  }
}

// 1. Quarters (Table 0 R2/R3)
// We have 4 □ characters in R2.
// This is tricky. Let's just replace the first 4 occurrences of □ with the tags.
let quarterCount = 0;
const quarterTags = ['{#is_spring}V{/is_spring}', '{#is_summer}V{/is_summer}', '{#is_fall}V{/is_fall}', '{#is_winter}V{/is_winter}'];
xml = xml.replace(/□/g, (match) => {
  quarterCount++;
  if (quarterCount <= 4) return quarterTags[quarterCount - 1];
  if (quarterCount === 5) return '{#is_male}V{/is_male}';
  if (quarterCount === 6) return '{#is_female}V{/is_female}';
  // Consent checkboxes
  if (quarterCount === 7) return '{#consent_personal_info_yes}V{/consent_personal_info_yes}';
  if (quarterCount === 8) return '{#consent_personal_info_no}V{/consent_personal_info_no}';
  if (quarterCount === 9) return '{#consent_identification_yes}V{/consent_identification_yes}';
  if (quarterCount === 10) return '{#consent_identification_no}V{/consent_identification_no}';
  if (quarterCount === 11) return '{#consent_third_party_yes}V{/consent_third_party_yes}';
  if (quarterCount === 12) return '{#consent_third_party_no}V{/consent_third_party_no}';
  if (quarterCount === 13) return '{#sponsor_consent_yes}V{/sponsor_consent_yes}';
  if (quarterCount === 14) return '{#sponsor_consent_no}V{/sponsor_consent_no}';
  return match;
});

// 2. Identity
replaceLabel('(English)', '{full_name}');
replaceLabel('성명 ( 한국어 )', '{full_name_kr}');
replaceLabel('국적 /Nationality', '{nationality}');
replaceLabel('여권번호 /Passport No.', '{passport_number}');
replaceLabel('출생지 /Place of Birth( Country)', '{place_of_birth}');
replaceLabel('주소 /Home Add', '{address}');
replaceLabel('전화번호 /Phone', '{phone}');
replaceLabel('출신 고등학교 또는 대학교 /Name of Graduating High Shchool or College( University)', '{school_name}');
replaceLabel('추천 기관 /Name of Recommend agency', '{agency_name}');

// Date of Birth
replaceLabel('년/Year', '{birth_year}');
replaceLabel('월/Month', '{birth_month}');
replaceLabel('일/Day', '{birth_day}');

// Sponsor
replaceLabel('재정보증인 성 명 Name of Sponsor', '{sponsor_name}');
replaceLabel('재정보증인 주 소 Address', '{sponsor_address}');
replaceLabel('재정보증인 직 업 Occupation', '{sponsor_occupation}');
replaceLabel('관계 Relations', '{sponsor_relation}');
replaceLabel('연락처 Contact info', '{sponsor_contact}');

zip.file('word/document.xml', xml);
const out = zip.generate({ type: 'nodebuffer' });
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, out);

console.log('Tagged template written to', outputPath);
