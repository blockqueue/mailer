'use strict';

async function processHtml(html) {
  return { html };
}

module.exports = { process: processHtml };
module.exports.default = module.exports;
module.exports.process = processHtml;
