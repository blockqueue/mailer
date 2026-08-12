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
  resolveConfig: async () => null,
  resolveConfigFile: async () => null,
  clearConfigCache: () => {},
  getFileInfo: async () => ({ ignored: false, inferredParser: null }),
  version: '3.9.6',
};
