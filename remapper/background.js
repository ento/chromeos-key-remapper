// Manifest V3 allows only a single background service worker, so this
// entry point pulls in the actual scripts with importScripts.
//
// The same list lives in background_scripts.json, which the build
// tooling (wscript) reads to know which scripts to stack when combining
// this remapper with fallback IMEs. Keep the two in sync.
importScripts(
  'preamble.js',
  'engine.js',
  'keymap.js',
  'main.js'
);
