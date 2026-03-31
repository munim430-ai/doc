'use strict';
/**
 * Dumps word/document.xml from the blank Mokwon DOCX so we can
 * understand the exact XML structure before adding placeholders.
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const docxPath = path.join(__dirname, '..', 'MOKWON UNIVERSITY EAP APPLICATION FORM.docx');
const content = fs.readFileSync(docxPath, 'binary');
const zip = new PizZip(content);

const xml = zip.file('word/document.xml').asText();
fs.writeFileSync(path.join(__dirname, 'document.xml'), xml, 'utf8');
console.log('Dumped word/document.xml to scripts/document.xml');
console.log('Length:', xml.length, 'chars');
