Remapper.Engine = function (keymap) {
  var contextId = -1;
  var lastFocusedWindowUrl = null;
  const debug = false;

  // The MV3 service worker can be terminated at any time and revived
  // by a key event alone, in which case onFocus won't fire again.
  // Restore the state saved by the last handleFocus call so the event
  // can still be remapped.
  chrome.storage.session.get(['contextId', 'lastFocusedWindowUrl'], function(items) {
    if (contextId === -1 && typeof items.contextId === 'number') {
      contextId = items.contextId;
    }
    if (lastFocusedWindowUrl === null && items.lastFocusedWindowUrl) {
      lastFocusedWindowUrl = items.lastFocusedWindowUrl;
    }
  });

  // Restoring state isn't enough on its own: ChromeOS doesn't wait for a
  // terminated worker to wake up before dispatching a key event, so keys
  // pressed while the worker is asleep fall through to the browser's
  // default handling. Prevent the worker from idling out while the IME is
  // active by calling a cheap extension API every 20s; each call resets
  // Chrome's 30s idle timer.
  var keepAliveTimer = null;

  function startKeepAlive() {
    if (keepAliveTimer !== null) {
      return;
    }
    keepAliveTimer = setInterval(function() {
      chrome.runtime.getPlatformInfo(function() {});
    }, 20000);
  }

  function stopKeepAlive() {
    if (keepAliveTimer !== null) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  this.handleActivate = function() {
    startKeepAlive();
  }

  this.handleDeactivated = function() {
    stopKeepAlive();
  }

  // URL prefixes of windows in which no remapping should happen.
  const urlBlacklist = [
    // crosh as it appeared before ChromeOS moved it to a System Web App
    'chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/crosh.html',
    // crosh as a System Web App
    'chrome-untrusted://crosh/',
    // the Terminal app; a terminal wants raw keys for the same reason crosh does
    'chrome-untrusted://terminal/'
  ];

  function isBlacklisted(url) {
    return urlBlacklist.some(function(prefix) {
      return url.indexOf(prefix) === 0;
    });
  }

  const nullKeyData = {
    'altKey': false,
    'ctrlKey': false,
    'shiftKey': false,
    'key': '',
    'code': ''
  };

  const sequencePrefixToKeyDataAttribute = {
    'C-': 'ctrlKey',
    'S-': 'shiftKey',
    'M-': 'altKey'
  }

  function keyDataToSequenceString(keyData) {
    var sequence = '';
    if (keyData.ctrlKey) {
      sequence += 'C-';
    }
    if (keyData.shiftKey) {
      sequence += 'S-';
    }
    if (keyData.altKey) {
      sequence += 'M-';
    }
    sequence += keyData.key;
    return sequence;
  }

  function sequenceStringToKeyData(sequence) {
    var keyData = {};
    sequence.split(/(C-|M-|S-)/).forEach(function(part) {
      if (part.length == 0) {
        return;
      }
      var booleanAttribute = sequencePrefixToKeyDataAttribute[part];
      if (booleanAttribute) {
        keyData[booleanAttribute] = true;
        return;
      }
      // TODO: validate part is valid as code
      // Note: allegedly, only the `code` matters when using the `sendKeyEvents` API.
      keyData.code = part;
    });
    return keyData;
  }

  // grab the last focused window's URL for blacklisting. note that there will
  // be a delay due to the API being async.
  // Also (re)start the keepalive from focus and key events: they are the
  // wake-up paths when the worker somehow died while the IME was active,
  // in which case onActivate won't fire again.
  this.handleFocus = function(context) {
    startKeepAlive();
    contextId = context.contextID;
    chrome.storage.session.set({contextId: contextId});
    chrome.windows.getLastFocused({
      populate: true,
      windowTypes: ['popup', 'normal', 'panel', 'app', 'devtools']
    }, function(window) {
      if (window && window.tabs.length > 0) {
        lastFocusedWindowUrl = window.tabs[0].url;
        chrome.storage.session.set({lastFocusedWindowUrl: lastFocusedWindowUrl});
      }
    });
  }

  this.handleKeyEvent = function(engineID, keyData) {
    startKeepAlive();
    if (keyData.type === "keydown") {
      if (debug) {
        console.log(keyData.type, keyData.key, keyData.code, keyData);
      }
    }

    if (keyData.extensionId && (keyData.extensionId === chrome.runtime.id)) {
      // already remapped, pass it through
      return false;
    }

    if (lastFocusedWindowUrl && isBlacklisted(lastFocusedWindowUrl)) {
      // don't remap in blacklisted windows
      return false;
    }

    var handled = false;

    if (keyData.type === "keydown") {
      var encodedSequence = keyDataToSequenceString(keyData);

      // TODO: convert keymap to an object of {match: decodedSequences} for speed
      var activeMapping = keymap.find(function(candidate) {
        return encodedSequence === candidate.match;
      });

      if (activeMapping) {
        var newKeyData = activeMapping.emit.map(function(sequence) {
          var mappedKeyData = sequenceStringToKeyData(sequence);
          return Object.assign({}, keyData, nullKeyData, mappedKeyData);
        });
        chrome.input.ime.sendKeyEvents({"contextID": contextId, "keyData": newKeyData});
        handled = true;
      }
    }

    return handled;
  }
}
