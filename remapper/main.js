(function() {
  var remapper = new Remapper.Engine(keymap);
  Remapper.hijack.onFocus.addListener(remapper.handleFocus.bind(remapper));
  Remapper.hijack.onKeyEvent.addListener(remapper.handleKeyEvent.bind(remapper));
})();
