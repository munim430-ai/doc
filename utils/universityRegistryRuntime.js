'use strict';

/**
 * universityRegistryRuntime.js
 *
 * Discovers university configs at runtime from the universities/ directory.
 * Each subdirectory must contain a config.json with at minimum:
 *   { "id", "displayName", "templateFile", "excelHeaders" }
 *
 * Adding a new university = drop a new folder + config.json + template.docx.
 * No code changes required.
 */

const fs   = require('fs');
const path = require('path');
const logger = require('./logger');

// Resolve the universities root — works both in dev and inside an asar
function resolveUniversitiesDir() {
  // When packaged with electron-builder, extraResources lands in process.resourcesPath
  if (process.resourcesPath) {
    const resourcesDir = path.join(process.resourcesPath, 'universities');
    if (fs.existsSync(resourcesDir)) return resourcesDir;
  }
  // Dev / plain Node path
  return path.join(__dirname, '..', 'universities');
}

const UNIVERSITIES_DIR = resolveUniversitiesDir();

// ── Registry Cache ────────────────────────────────────────────────────────────
const _cache = new Map();

function load() {
  _cache.clear();

  if (!fs.existsSync(UNIVERSITIES_DIR)) {
    logger.warn(`[Registry] Universities directory not found: ${UNIVERSITIES_DIR}`);
    return;
  }

  const entries = fs.readdirSync(UNIVERSITIES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const configPath = path.join(UNIVERSITIES_DIR, entry.name, 'config.json');
    if (!fs.existsSync(configPath)) {
      logger.warn(`[Registry] Skipping "${entry.name}" — config.json missing.`);
      continue;
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      logger.error(`[Registry] Failed to parse config for "${entry.name}": ${err.message}`);
      continue;
    }

    const id = (config.id || entry.name).toLowerCase().trim();
    const templateFile = config.templateFile || 'template.docx';
    const templatePath = path.join(UNIVERSITIES_DIR, entry.name, templateFile);

    if (!fs.existsSync(templatePath)) {
      logger.warn(`[Registry] Template not found for "${id}": ${templatePath}`);
      continue;
    }

    _cache.set(id, {
      id,
      displayName:  config.displayName  || id,
      templatePath,
      excelHeaders: config.excelHeaders || [],
      defaults:     config.defaults     || {},
    });

    logger.info(`[Registry] Loaded university: ${id} → ${templatePath}`);
  }

  logger.info(`[Registry] ${_cache.size} universit(ies) loaded.`);
}

// Load on startup
load();

module.exports = {
  list: () => Array.from(_cache.values()),
  get:  (id) => _cache.get(id.toLowerCase()),
  has:  (id) => _cache.has(id.toLowerCase()),
  reload: load,
};
