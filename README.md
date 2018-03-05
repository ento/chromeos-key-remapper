# chromeos-key-remapper

This repo contains:

1. An unpublished Chrome OS IME that lets you use emacs-like cursor movement
   keys with a US English keyboard. `C-a` and `C-k`, to name a few.
2. Tooling to build a custom IME that combines the remapper engine and other 3rd party IMEs.

## Limitations

- All the combined IMEs share the same JavaScript scope. Name collision
  can happen.
- The options page of the custom IME can only display the options page of a
  single IME.
- Keys can be only remapped to other key combinations.

## Prerequisites / assumptions

For the premade IME:

- You don't want to remap when you're in crosh window

Additionally, for the make-your-own route:

- python (I use 3.x; 2.x _probably_ works)
- [`waf` command](https://waf.io/book/#_download_and_installation)
  - `waf*` is gitignored in this repo; I have it downloaded to the root of my local clone
- [`jscodeshift` command](https://github.com/facebook/jscodeshift)
  - `npm install` in this repo and add `./node_module/.bin` to `$PATH` when invoking `waf`
  - or: `npm install -g jscodeshift`

## How to install

First, download this repo as a zip file and unpack it or clone the repo.
Chrome OS needs to have access to the file system where your local copy resides.

Go to chrome://extensions and enable developer mode.

### Using the premade IME

In chrome://extensions, click the "Load unpacked extension..." button
and pick the `remapper` directory in your local copy of the repo.

Open Settings, then search for "manage input methods." Click the highlighted row
with that label. There should be a row named "US x emacs"; check to enable it.

Now, pressing <kbd>Ctrl-Shift-Space</kbd> will cycle through all the
IMEs that are enabled. Hit <kbd>Ctrl-Space</kbd> to switch back and forth
between the previously selected IME.

There's an indicator next to the notification indicator that shows the active
IME: make sure you've activated the IME you just installed and try out
a few bindings like `C-f`, `C-b` in a text field.

See [`remapper/keymap.js`](./remapper/keymap.js) for the keybindings.
If you want different bindings, edit this file and reload the extension.

### Making your own with a different language and/or layout

You need to create a `config.ini` file. `config.ini.sample` is a good
starting point:

```sh
cp config.ini.sample config.ini
```

The config file can contain multiple sections. Each section, when
built, will result in a directory under `./build` that contains an
IME extension.  An IME extension can potentially hold multiple
IMEs; however, this tooling only supports a single IME per extension.

Here's what a section looks like:

```ini
[us_emacs]
name = EN x emacs
description = US keyboard with emacs-like cursor movement
language = en-US
layout = us
fallback_imes =
options_page =
```

`[us_emacs]` is the section name, which will become the name of the directory.

`name` and `description` will become the name and description of both the extension
and the IME you see in Settings.

`language` and `layout` dictate which language and layout the IME will be for.
Change these to make an IME for your preferred language and layout. I'm not sure
what values are accepted here. The [extra keyboards repo][extra-keyboard] may
be a good resource.

`fallback_imes` and `options_page` are irrelevant to what we're doing now; we'll
come back to it later.

To build an IME out of this config file, run `waf`:

```sh
python waf configure build
```

This should create a directory `./build/us_emacs/`, which you can install
like the premade one above.

### Making your own by combining other IMEs

The basic steps are the same as the above: create `config.ini` and run `waf`.

This time, we actually make use of `fallback_imes` and `options_page`.

`fallback_imes` is a comma-separated list of directory names you put
in `./imes`.  Said directories must contain an IME extension. All
files in the directory will be copied to
`build/[config_section_name]/[fallback_ime_name]/`, with `.js` files
getting special treatment to make all this work.

`options_page` should be the path to the options page to use, relative
to the built extension's root: `[fallback_ime_name]/options.html`, for example.

How you place an IME extension under `./imes` is up to you. You could
clone a repo there, or symlink to a directory outside the repo.

Let's see an example of how all this fits together.

I want to use my emacs keybindings on top of [Chrome SKK][skk], a Japanese
IME, so here's what I do:

```
chrome-skk/
chrome-key-remapper/
  config.ini
  imes/
    skk -> ../../chrome-skk/extension
  remapper/
    ..
```

With a config like:

```
[skk_remapped]
name = SKK x emacs
description = SKK with emacs-like cursor movement
language = ja
layout = us
fallback_imes = skk
options_page = skk/options.html
```

When I invoke `python waf configure build`, an IME extension gets built in `./build/`:

```
chrome-key-remapper/
  build/
    skk_remapped/
      manifest.json
      remapper/
        main.js
        ..
      skk/
        main.js
        ..
```

With this hybrid IME enabled and active, any key event not handled by
the remapper will get passed onto SKK, enabling me to input Japanese
text while enjoying the familiar emacs-like cursor movement keys.

  [extra-keyboard]: https://github.com/google/extra-keyboards-for-chrome-os
  [skk]: https://github.com/jmuk/chrome-skk
