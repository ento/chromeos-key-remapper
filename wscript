# -*- mode: python -*-
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
    ctx.find_program('node')


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

    manifests = [out.find_or_declare(ime_name).find_or_declare('manifest.json')
                    for ime_name in ime_stack]
    manifest_env = ctx.env.derive()
    manifest_env.identifier = name
    manifest_env.name = spec['name']
    manifest_env.description = spec['description']
    manifest_env.language = spec['language']
    manifest_env.layout = spec['layout']
    manifest_env.options_page = spec['options_page']
    manifest_task = manifest(env=manifest_env)
    manifest_task.set_inputs(manifests)
    manifest_task.set_outputs(out.find_or_declare('manifest.json'))
    ctx.add_to_group(manifest_task)


class jscodeshift(Task.Task):
    run_str = 'node ${TRANSFORMER} ${SRC} ${TGT}'


class manifest(Task.Task):
    '''
    Builds a manifest JSON by collecting background scripts and permissions
    from input files and reading the name, description, language, and layout
    from `self.env`.
    '''

    def run(self):
        target = self.outputs[0]
        out_dir = target.parent
        submanifests = OrderedDict([(path, path.read_json()) for path in self.inputs])

        scripts = [submanifest_path.parent.find_or_declare(script).path_from(out_dir)
                   for submanifest_path, submanifest in submanifests.items()
                   for script in submanifest['background']['scripts']]

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
            "manifest_version": 2,
            "description": self.env.description,
            "background": {
                "scripts": scripts,
            },
            "permissions": list(set(permissions)),
            "input_components": [
                input_component
            ]
        }
        if self.env.options_page:
            manifest['options_page'] = self.env.options_page
        target.write_json(manifest)


def imes(ctx):
    imes_root = ctx.path.find_dir('imes')
    for extension_root in imes.ant_glob('*', src=False, dir=True):
        print(extension_root.path_from(imes_root))
