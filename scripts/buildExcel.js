'use strict';
/**
 * buildExcel.js
 * Generates the blank Excel template for Mokwon University.
 * Run once: node scripts/buildExcel.js
 */

const XLSX = require('xlsx');
const path = require('path');

const headers = [
  'Full Name',
  'Passport Number',
  'Nationality',
  'Place of Birth',
  'Birth Year',
  'Birth Month',
  'Birth Day',
  'Gender',
  'Address',
  'Phone',
  'School Name',
  'Agency Name',
  'Entering Quarter',
  'Consent Personal Info',
  'Consent Identification',
  'Consent Third Party',
  'Sponsor Name',
  'Sponsor Address',
  'Sponsor Occupation',
  'Sponsor Relation',
  'Sponsor Tel',
  'Sponsor HP',
];

// Example row showing what values to use
const exampleRow = {
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
};

const wb = XLSX.utils.book_new();

// Sheet 1: blank template with just the header row
const blankSheet = XLSX.utils.aoa_to_sheet([headers]);

// Set column widths
blankSheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));

// Add a formatting note row
const noteRow = headers.map((h, i) => {
  if (h === 'Gender') return 'Male or Female';
  if (h === 'Entering Quarter') return 'Spring / Summer / Fall / Winter';
  if (h.startsWith('Consent')) return 'Yes or No';
  if (h === 'Birth Year') return 'YYYY (e.g. 2000)';
  if (h === 'Birth Month') return 'MM (e.g. 05)';
  if (h === 'Birth Day') return 'DD (e.g. 15)';
  return '';
});

XLSX.utils.sheet_add_aoa(blankSheet, [noteRow], { origin: 1 });

XLSX.utils.book_append_sheet(wb, blankSheet, 'Students');

// Sheet 2: example data
const exampleSheet = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
exampleSheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 22) }));
XLSX.utils.book_append_sheet(wb, exampleSheet, 'Example');

const dest = path.join(__dirname, '..', 'universities', 'mokwon', 'excel_template.xlsx');
XLSX.writeFile(wb, dest);
console.log('Excel template written to:', dest);
