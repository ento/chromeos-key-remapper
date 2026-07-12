(function() {
  var remapper = new Remapper.Engine(keymap);
  // handleActivate and handleDeactivated return undefined so that the
  // events keep propagating to fallback IMEs.
  Remapper.hijack.onActivate.addListener(remapper.handleActivate.bind(remapper));
  Remapper.hijack.onDeactivated.addListener(remapper.handleDeactivated.bind(remapper));
  Remapper.hijack.onFocus.addListener(remapper.handleFocus.bind(remapper));
  Remapper.hijack.onKeyEvent.addListener(remapper.handleKeyEvent.bind(remapper));
})();
