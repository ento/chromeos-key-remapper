const Remapper = {};

// Acts as a middleman that accepts an chrome.input.ime event and
// feeds it to registered event listeners. First listener to register
// gets to handle the event first.
Remapper.EventHandler = function EventHandler(name) {
  this.name = name
  this.listeners = []
};

Remapper.EventHandler.prototype.addListener = function(fn) {
  this.listeners.push(fn)
};

Remapper.EventHandler.prototype.handleEvent = function() {
  let handled = false;
  console.log('>', this.name, arguments);
  for (let listener of this.listeners) {
    handled = listener.apply(null, arguments);
    if (handled) break;
  }
  return handled;
};

// Array of events to hijack.
// see: https://developer.chrome.com/extensions/input_ime
Remapper.events = [
  'onActivate',
  'onDeactivated',
  'onFocus',
  'onBlur',
  'onInputContextUpdate',
  'onKeyEvent',
  'onCandidateClicked',
  'onMenuItemActivated',
  'onSurroundingTextChanged',
  'onReset'
//  'onCompositionBoundsChanged' // appears to be private
];

// Name must match what's in hijack.js
Remapper.hijack = {};

Remapper.events.forEach(function(event) {
  const handler = new Remapper.EventHandler(event)
  Remapper.hijack[event] = handler;
  // The entire plot hinges on this `addListener` call not being
  // picked up by hijack.js, because this extension is just another
  // ime to be composed together with fallback imes.
  chrome.input.ime[event].addListener(handler.handleEvent.bind(handler));
})
