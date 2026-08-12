'use strict';

const plugin = () => ({
  postcssPlugin: 'cssnano-stub',
  Once() {},
});

plugin.postcss = true;
module.exports = plugin;
