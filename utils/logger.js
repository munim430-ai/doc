'use strict';

const levels = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

function log(level, message) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${levels[level] || level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

module.exports = {
  info:  (msg) => log('info', msg),
  warn:  (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
};
