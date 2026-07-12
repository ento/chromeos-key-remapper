import configparser
from collections import OrderedDict

from waflib import Task
from waflib.TaskGen import feature, after_method


top = '.'
out = 'build'

required_configs = [
    'name',
    'description',
    'language',
    'layout',
    'fallback_imes',
    'options_page',
]


def configure(ctx):
    ctx.find_program('jscodeshift')


def build(ctx):
    config = _read_config()
    for name in config:
        _build_ime(ctx, name, config[name])


def _read_config():
    parser = configparser.ConfigParser()
    parser.read('config.ini')
    config = OrderedDict()
    for name in parser.sections():
        spec = {}
        for prop in required_configs:
            # TODO: more human-friendly error
            spec[prop] = parser[name][prop]
        spec['fallback_imes'] = [ime_name.strip()
                                 for ime_name in spec['fallback_imes'].split(',')
                                 if len(ime_name.strip()) > 0]
        config[name] = spec
    return config


def _build_ime(ctx, name, spec):
    out = ctx.bldnode.find_or_declare(name)

    # copy / transform sources

    imes_root = ctx.path.find_dir('imes')
    transformer = ctx.path.find_node('hijack.js')

    # remapper must be the first in stack in order for hijacking to work.
    ime_stack = ['remapper'] + spec['fallback_imes']
    for ime_name in ime_stack:
        extension_root = imes_root.find_dir(ime_name)
        for extension_file in extension_root.ant_glob('**/*'):
            is_javascript = extension_file.suffix() == '.js'
            source = extension_file
            target = out.find_or_declare(extension_file.path_from(imes_root))
            if is_javascript:
                jscodeshift_env = ctx.env.derive()
                jscodeshift_env.TRANSFORMER = transformer.abspath()
                jscodeshift_task = jscodeshift(env=jscodeshift_env)
                jscodeshift_task.set_inputs(source)
                jscodeshift_task.set_outputs(target)
                ctx.add_to_group(jscodeshift_task)
                ctx.add_manual_dependency(source, transformer)
            else:
                ctx(features='subst',
                    is_copy=True,
                    source=source,
                    target=target)

    # build manifest

    manifests = []
    for ime_name in ime_stack:
        ime_out = out.find_or_declare(ime_name)
        manifests.append(ime_out.find_or_declare('manifest.json'))
        if imes_root.find_dir(ime_name).find_node('background_scripts.json'):
            manifests.append(ime_out.find_or_declare('background_scripts.json'))
    manifest_env = ctx.env.derive()
    manifest_env.identifier = name
    manifest_env.name = spec['name']
    manifest_env.description = spec['description']
    manifest_env.language = spec['language']
    manifest_env.layout = spec['layout']
    manifest_env.options_page = spec['options_page']
    manifest_task = manifest(env=manifest_env)
    manifest_task.set_inputs(manifests)
    manifest_task.set_outputs([out.find_or_declare('manifest.json'),
                               out.find_or_declare('background.js')])
    ctx.add_to_group(manifest_task)


class jscodeshift(Task.Task):
    run_str = 'node ${TRANSFORMER} ${SRC} ${TGT}'


class manifest(Task.Task):
    '''
    Builds a Manifest V3 manifest JSON and a background service worker by
    collecting background scripts and permissions from input files and
    reading the name, description, language, and layout from `self.env`.

    Manifest V3 only allows a single background service worker, so the
    collected scripts are loaded via importScripts from a generated
    background.js. The scripts of an IME are found, in order of
    precedence: in a background_scripts.json file next to its manifest
    (used by the remapper itself, whose MV3 manifest can't list them),
    under background.scripts (MV2 IMEs), or as the single
    background.service_worker script (MV3 IMEs).
    '''

    def run(self):
        target = self.outputs[0]
        background_target = self.outputs[1]
        out = target.parent
        submanifests = OrderedDict()
        script_lists = {}
        for path in self.inputs:
            if path.name == 'manifest.json':
                submanifests[path] = path.read_json()
            elif path.name == 'background_scripts.json':
                script_lists[path.parent] = path.read_json()

        def background_scripts(path, submanifest):
            if path.parent in script_lists:
                return script_lists[path.parent]
            background = submanifest.get('background', {})
            if 'scripts' in background:
                return background['scripts']
            if 'service_worker' in background:
                return [background['service_worker']]
            return []

        scripts = [path.parent.find_or_declare(script).path_from(out)
                   for path, submanifest in submanifests.items()
                   for script in background_scripts(path, submanifest)]

        permissions = [permission
                       for path, submanifest in submanifests.items()
                       for permission in submanifest['permissions']]

        input_component = {
            "name": self.env.name,
            "type": "ime",
            "id": "io.github.ento.cros_key_remapper." + self.env.identifier,
            "description": self.env.description,
            "language": self.env.language,
            "layouts": [self.env.layout],
        }
        manifest = {
            "name": self.env.name,
            "version": "1.0",
            "manifest_version": 3,
            "description": self.env.description,
            "background": {
                "service_worker": background_target.path_from(out),
            },
            "permissions": sorted(set(permissions)),
            "input_components": [
                input_component
            ]
        }
        if self.env.options_page:
            manifest['options_page'] = self.env.options_page
        target.write_json(manifest)

        imports = ',\n'.join("  '%s'" % script for script in scripts)
        background_target.write(
            '// Generated by wscript: Manifest V3 allows only a single\n'
            '// background service worker, so load each stacked IME\'s\n'
            '// scripts from here, remapper first.\n'
            'importScripts(\n%s\n);\n' % imports)


def imes(ctx):
    imes_root = ctx.path.find_dir('imes')
    for extension_root in imes.ant_glob('*', src=False, dir=True):
        print(extension_root.path_from(imes_root))
