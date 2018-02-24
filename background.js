/*
hterm's options keybindings:

String.fromCharCode("K".charCodeAt(0) - 64)

```
{
  "Shift-END": "'\u000b'"
}
```
 */

var keymap = [
    {'match': 'C-a', 'emit': ['Home']},
    {'match': 'C-e', 'emit': ['End']},
    {'match': 'C-f', 'emit': ['ArrowRight']}, // todo: C-x C-f doesn't work in crosh
    {'match': 'C-b', 'emit': ['ArrowLeft']},
    {'match': 'C-p', 'emit': ['ArrowUp']},
    {'match': 'C-n', 'emit': ['ArrowDown']},
    {'match': 'C-k', 'emit': ['S-End']},
    {'match': 'C-h', 'emit': ['Backspace']},
    {'match': 'C-d', 'emit': ['Delete']},
    {'match': 'M-a', 'emit': ['C-KeyA']}, // for select all
    {'match': 'M-b', 'emit': ['C-KeyB']}, // for boldening text on paper
    {'match': 'M-n', 'emit': ['C-KeyN']}, // for opening a new window
    {'match': 'M-k', 'emit': ['C-KeyK']} // for Slack channel switcher
];

(function() {
    var remapper = new Remapper(keymap);

    chrome.input.ime.onFocus.addListener(remapper.handleFocus.bind(remapper));
    chrome.input.ime.onKeyEvent.addListener(remapper.handleKeyEvent.bind(Remapper));
})();
