Remapper.Engine = function (keymap) {
  var contextId = -1;
  var lastFocusedWindowUrl = null;
  const debug = false;

  const urlBlacklist = [
    'chrome-extension://pnhechapfaindjhompbnflcldabbghjo/html/crosh.html'
  ];

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
  this.handleFocus = function(context) {
    contextId = context.contextID;
    chrome.windows.getLastFocused({
      populate: true,
      windowTypes: ['popup', 'normal', 'panel', 'app', 'devtools']
    }, function(window) {
      if (window && window.tabs.length > 0) {
        lastFocusedWindowUrl = window.tabs[0].url;
      }
    });
  }

  this.handleKeyEvent = function(engineID, keyData) {
    if (keyData.type === "keydown") {
      if (debug) {
        console.log(keyData.type, keyData.key, keyData.code, keyData);
      }
    }

    if (keyData.extensionId && (keyData.extensionId === chrome.runtime.id)) {
      // already remapped, pass it through
      return false;
    }

    if (lastFocusedWindowUrl && urlBlacklist.indexOf(lastFocusedWindowUrl) !== -1) {
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
