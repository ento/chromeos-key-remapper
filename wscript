# -*- mode: python -*-
import configparser
import os.path
import shutil
import tempfile
import zipfile
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


def _build_extension_dir(ctx, out_dir, imes_root, extension_root):
    transformer = ctx.path.find_node('hijack.js')
    for extension_file in extension_root.ant_glob('**/*'):
        source = extension_file
        source_relative_to_extension_root = source.path_from(extension_root)
        target = out_dir.find_or_declare(source_relative_to_extension_root)
        is_javascript = extension_file.suffix() == '.js'
        if is_javascript:
            jscodeshift_env = ctx.env.derive()
            jscodeshift_env.transformer = transformer.abspath()
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


def _build_extension_archive(ctx, out_dir, imes_root, extension_archive):
    transformer = ctx.path.find_node('hijack.js')
    with zipfile.ZipFile(extension_archive.abspath()) as extzip:
        for extension_file in extzip.namelist():
            target = out_dir.find_or_declare(extension_file)
            is_javascript = target.suffix() == '.js'
            if is_javascript:
                jscodeshift_env = ctx.env.derive()
                jscodeshift_env.transformer = transformer.abspath()
                jscodeshift_env.input_is_zipfile = True
                jscodeshift_env.input_member = extension_file
                jscodeshift_task = jscodeshift(env=jscodeshift_env)
                jscodeshift_task.set_inputs(extension_archive)
                jscodeshift_task.set_outputs(target)
                ctx.add_to_group(jscodeshift_task)
                ctx.add_manual_dependency(extension_archive, transformer)
            else:
                extract_env = ctx.env.derive()
                extract_env.input_member = extension_file
                extract_task = extract(env=extract_env)
                extract_task.set_inputs(extension_archive)
                extract_task.set_outputs(target)
                ctx.add_to_group(extract_task)


def _build_ime(ctx, ime_name, spec):
    out_dir = ctx.bldnode.find_or_declare(ime_name)

    # copy / transform sources

    imes_root = ctx.path.find_dir('imes')

    # remapper must be the first in stack in order for hijacking to work.
    ime_stack = ['remapper'] + spec['fallback_imes']
    built_ime_stack = []
    for stacked_ime_name in ime_stack:
        extension_dir = imes_root.find_dir(stacked_ime_name)
        if extension_dir:
            _build_extension_dir(ctx, out_dir.find_or_declare(stacked_ime_name), imes_root, extension_dir)
            built_ime_stack.append(stacked_ime_name)
            continue
        extension_archive = imes_root.find_resource(stacked_ime_name)
        if extension_archive:
            archive_basename = os.path.splitext(stacked_ime_name)[0]
            _build_extension_archive(ctx, out_dir.find_or_declare(archive_basename), imes_root, extension_archive)
            built_ime_stack.append(archive_basename)
            continue
        assert False, f"Fallback IME {stacked_ime_name} not found in {imes_root}"

    # build manifest

    manifests = [out_dir.find_or_declare(stacked_ime_name).find_or_declare('manifest.json')
                    for stacked_ime_name in built_ime_stack]
    manifest_env = ctx.env.derive()
    manifest_env.identifier = ime_name
    manifest_env.name = spec['name']
    manifest_env.description = spec['description']
    manifest_env.language = spec['language']
    manifest_env.layout = spec['layout']
    manifest_env.options_page = spec['options_page']
    manifest_task = manifest(env=manifest_env)
    manifest_task.set_inputs(manifests)
    manifest_task.set_outputs(out_dir.find_or_declare('manifest.json'))
    ctx.add_to_group(manifest_task)


class jscodeshift(Task.Task):
    def run(self):
        source = self.inputs[0]
        target = self.outputs[0]
        if self.env.input_is_zipfile:
            with tempfile.TemporaryDirectory() as temp_dir, zipfile.ZipFile(source.abspath()) as input_zipfile:
                input_zipfile.extract(self.env.input_member, path=temp_dir)
                self.exec_command([self.env.NODE[0], self.env.transformer, os.path.join(temp_dir, self.env.input_member), target.abspath()])
        else:
            self.exec_command([self.env.NODE[0], self.env.transformer, source.abspath(), target.abspath()])


class extract(Task.Task):
    def run(self):
        source = self.inputs[0]
        target = self.outputs[0]
        with tempfile.TemporaryDirectory() as temp_dir, zipfile.ZipFile(source.abspath()) as input_zipfile:
            input_zipfile.extract(self.env.input_member, path=temp_dir)
            shutil.move(os.path.join(temp_dir, self.env.input_member), target.abspath())


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
