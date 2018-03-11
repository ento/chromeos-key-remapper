// bindings for emacs-like cursor movements.
// variable name must match what's referenced in main.js.
// TODO: better documentation on what values are accepted.
const keymap = [
  {'match': 'C-a', 'emit': ['Home']}, // cursor: beginning of line
  {'match': 'C-e', 'emit': ['End']}, // cursor: end of line
  {'match': 'C-f', 'emit': ['ArrowRight']}, // cursor: forward one character
  {'match': 'C-b', 'emit': ['ArrowLeft']}, // cursor: back one character
  {'match': 'C-p', 'emit': ['ArrowUp']}, // cursor: previous line
  {'match': 'C-n', 'emit': ['ArrowDown']}, // cursor: next line
  {'match': 'C-k', 'emit': ['S-End', 'Backspace']}, // cursor: cut to end of line
  {'match': 'C-h', 'emit': ['Backspace']}, // cursor: backspace
  {'match': 'C-d', 'emit': ['Delete']}, // cursor: delete one char
  {'match': 'M-a', 'emit': ['C-KeyA']}, // C-a replacement: for select all
  {'match': 'M-b', 'emit': ['C-KeyB']}, // C-b replacement: for boldening text on paper
  {'match': 'M-n', 'emit': ['C-KeyN']}, // C-n replacement: for opening a new window
  {'match': 'M-k', 'emit': ['C-KeyK']} // C-k replacement: for Slack channel switcher
];
