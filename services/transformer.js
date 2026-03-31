'use strict';

/**
 * transformer.js
 * Converts a raw (normalised) Excel row into a docxtemplater-ready object.
 *
 * Checkbox fields output the actual Unicode characters:
 *   ☑  (U+2611) = checked
 *   □  (U+25A1) = unchecked
 */

const logger = require('../utils/logger');

const CHECKED   = '☑';
const UNCHECKED = '□';

const normalise = (val) => String(val ?? '').trim().toLowerCase();

function check(condition) {
  return condition ? CHECKED : UNCHECKED;
}

function resolveGender(raw) {
  const g = normalise(raw);
  if (g !== 'male' && g !== 'female') {
    logger.warn(`[Transformer] Unexpected gender value: "${raw}"`);
  }
  return {
    male_check:   check(g === 'male'),
    female_check: check(g === 'female'),
    // kept for backwards-compat
    is_male:   g === 'male',
    is_female: g === 'female',
  };
}

function resolveQuarter(raw) {
  const q = normalise(raw);
  const valid = ['spring', 'summer', 'fall', 'winter'];
  if (!valid.includes(q)) {
    logger.warn(`[Transformer] Unexpected quarter value: "${raw}"`);
  }
  return {
    spring_check: check(q === 'spring'),
    summer_check: check(q === 'summer'),
    fall_check:   check(q === 'fall'),
    winter_check: check(q === 'winter'),
    // kept for backwards-compat
    is_spring: q === 'spring',
    is_summer: q === 'summer',
    is_fall:   q === 'fall',
    is_winter: q === 'winter',
    entering_quarter: raw || '',
  };
}

function resolveConsent(raw, defaultVal = 'yes') {
  const v = normalise(raw) || normalise(defaultVal);
  const yes = v === 'yes';
  return { yes, no: !yes };
}

function transformRow(row, index) {
  logger.info(`[Transformer] Row ${index + 1}: ${row.full_name || '(no name)'}`);

  const gender  = resolveGender(row.gender);
  const quarter = resolveQuarter(row.entering_quarter);

  const pi  = resolveConsent(row.consent_personal_info,   'yes');
  const id  = resolveConsent(row.consent_identification,  'yes');
  const tp  = resolveConsent(row.consent_third_party,     'yes');

  // Affidavit consent defaults to yes
  const aff = resolveConsent(row.sponsor_consent || 'yes', 'yes');

  return {
    // Identity
    full_name:       row.full_name       || '',
    passport_number: row.passport_number || '',
    nationality:     row.nationality     || '',
    place_of_birth:  row.place_of_birth  || '',

    // Date of Birth
    birth_year:  row.birth_year  || '',
    birth_month: row.birth_month || '',
    birth_day:   row.birth_day   || '',

    // Contact
    address: row.address || '',
    phone:   row.phone   || '',

    // Academic
    school_name:     row.school_name     || '',
    agency_name:     row.agency_name     || '',

    // Quarter checkboxes
    ...quarter,

    // Gender checkboxes
    ...gender,

    // Consent checkboxes (Personal Info)
    consent_pi_yes_check: check(pi.yes),
    consent_pi_no_check:  check(pi.no),

    // Consent checkboxes (Identification)
    consent_id_yes_check: check(id.yes),
    consent_id_no_check:  check(id.no),

    // Consent checkboxes (Third Party)
    consent_tp_yes_check: check(tp.yes),
    consent_tp_no_check:  check(tp.no),

    // Old boolean fields (kept for any template that still uses them)
    consent_personal_info:      pi.yes,
    consent_identification:     id.yes,
    consent_third_party:        tp.yes,
    consent_personal_info_yes:  pi.yes,
    consent_personal_info_no:   pi.no,
    consent_identification_yes: id.yes,
    consent_identification_no:  id.no,
    consent_third_party_yes:    tp.yes,
    consent_third_party_no:     tp.no,

    // Sponsor / Guarantor
    sponsor_name:       row.sponsor_name       || '',
    sponsor_address:    row.sponsor_address    || '',
    sponsor_occupation: row.sponsor_occupation || '',
    sponsor_relation:   row.sponsor_relation   || '',
    sponsor_contact:    row.sponsor_contact    || '',
    sponsor_tel:        row.sponsor_tel        || row.sponsor_contact || '',
    sponsor_hp:         row.sponsor_hp         || '',

    // Affidavit consent
    sponsor_consent_yes_check: check(aff.yes),
    sponsor_consent_no_check:  check(aff.no),
  };
}

module.exports = { transformRow };
