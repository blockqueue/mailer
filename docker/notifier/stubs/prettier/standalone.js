'use strict';

async function format(source) {
  return source;
}

module.exports = {
  format,
  formatWithCursor: async (source, options = {}) => ({
    formatted: source,
    cursorOffset: options.cursorOffset ?? 0,
  }),
  check: async () => true,
  version: '3.9.6',
};
