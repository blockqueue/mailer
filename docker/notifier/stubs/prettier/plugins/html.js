'use strict';

module.exports = {
  languages: [
    {
      name: 'HTML',
      parsers: ['html'],
      extensions: ['.html'],
    },
  ],
  parsers: {
    html: {
      parse: (text) => ({ type: 'root', children: [], value: text }),
      astFormat: 'html',
      locStart: () => 0,
      locEnd: (node) => (typeof node?.value === 'string' ? node.value.length : 0),
    },
  },
  printers: {
    html: {
      print: (path) => {
        const node = path.getValue?.() ?? path;
        return typeof node?.value === 'string' ? node.value : '';
      },
    },
  },
};
