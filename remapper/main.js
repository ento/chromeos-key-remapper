(function() {
  var remapper = new Remapper.Engine(keymap);
  chrome.input.ime.onFocus.addListener(remapper.handleFocus.bind(remapper));
  // use a different property access method as a testcase of the transformer script
  chrome.input.ime["onKeyEvent"].addListener(remapper.handleKeyEvent.bind(remapper));
})();
