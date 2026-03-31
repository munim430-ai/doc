'use strict';
/**
 * testGenerate.js — end-to-end pipeline test without the HTTP server.
 * Creates a test Excel, parses it, transforms it, generates a DOCX, and verifies.
 */

const path = require('path');
const fs   = require('fs');
const XLSX = require('xlsx');

// Set env before requiring logger/registry
process.env.FOLIO_DATA_PATH = path.join(__dirname, '..', 'universities');

const { parseExcel }   = require('../services/excelParser');
const { transformRow } = require('../services/transformer');
const { generateDoc }  = require('../services/docGenerator');

// ── Write a test Excel file ───────────────────────────────────────────────────
const testData = [{
  'Full Name':              'YEASIN RABBI',
  'Passport Number':        'BD1234567',
  'Nationality':            'Bangladeshi',
  'Place of Birth':         'Bangladesh',
  'Birth Year':             '2000',
  'Birth Month':            '05',
  'Birth Day':              '15',
  'Gender':                 'Male',
  'Address':                '123 Dhaka Road, Dhaka, Bangladesh',
  'Phone':                  '+8801712345678',
  'School Name':            'Dhaka College',
  'Agency Name':            'Keystone Education Consultancy',
  'Entering Quarter':       'Spring',
  'Consent Personal Info':  'Yes',
  'Consent Identification': 'Yes',
  'Consent Third Party':    'Yes',
  'Sponsor Name':           'MD RABBI',
  'Sponsor Address':        '123 Dhaka Road, Dhaka, Bangladesh',
  'Sponsor Occupation':     'Business',
  'Sponsor Relation':       'Father',
  'Sponsor Tel':            '+8801700000000',
  'Sponsor HP':             '+8801700000001',
}];

const headers = Object.keys(testData[0]);
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(testData, { header: headers });
XLSX.utils.book_append_sheet(wb, ws, 'Students');

const testExcelPath = path.join(__dirname, 'test_input.xlsx');
XLSX.writeFile(wb, testExcelPath);
console.log('Test Excel written:', testExcelPath);

// ── Parse ─────────────────────────────────────────────────────────────────────
const config = require('../universities/mokwon/config.json');
const { rows, errors } = parseExcel(testExcelPath, config.excelHeaders);
console.log(`Parsed ${rows.length} row(s). Warnings:`, errors);

// ── Transform ─────────────────────────────────────────────────────────────────
const data = transformRow(rows[0], 0);
console.log('Transformed data:');
Object.entries(data).forEach(([k, v]) => console.log(' ', k, '=', JSON.stringify(v)));

// ── Generate ──────────────────────────────────────────────────────────────────
const templatePath = path.join(__dirname, '..', 'universities', 'mokwon', 'template.docx');
const outPath      = path.join(__dirname, 'test_output.docx');

generateDoc(templatePath, data, outPath);
const stat = fs.statSync(outPath);
console.log(`\nOutput written: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
console.log('\n✓ All tests passed!');
