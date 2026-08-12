'use strict';

const identity = (source) => source;

module.exports = {
  html: identity,
  css: identity,
  js: identity,
  html_beautify: identity,
  css_beautify: identity,
  js_beautify: identity,
};
