import yaml
from typing import List, Tuple, Any, Dict
from pathlib import Path

from .models import K8sResource, SourceLocation


class LineTrackingLoader(yaml.SafeLoader):
    pass


def construct_mapping(loader, node):
    mapping = yaml.SafeLoader.construct_mapping(loader, node)
    if isinstance(node, yaml.MappingNode):
        mapping['__line__'] = node.start_mark.line + 1
        if node.end_mark:
            mapping['__end_line__'] = node.end_mark.line + 1
    return mapping


LineTrackingLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    construct_mapping
)


class YamlParser:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def parse_file(self, file_path: str) -> List[K8sResource]:
        resources = []
        path = Path(file_path)

        if not path.exists():
            self.errors.append(f"File not found: {file_path}")
            return resources

        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            docs = yaml.load_all(content, Loader=LineTrackingLoader)

            for doc in docs:
                if doc is None:
                    continue

                try:
                    resource = self._parse_document(doc, file_path)
                    if resource:
                        resources.append(resource)
                except Exception as e:
                    line_num = doc.get('__line__', 'unknown') if isinstance(doc, dict) else 'unknown'
                    self.errors.append(f"Failed to parse document at {file_path}:{line_num}: {str(e)}")

        except yaml.YAMLError as e:
            self.errors.append(f"YAML parse error in {file_path}: {str(e)}")
        except Exception as e:
            self.errors.append(f"Error reading {file_path}: {str(e)}")

        return resources

    def _parse_document(self, doc: Dict[str, Any], file_path: str) -> K8sResource:
        if not isinstance(doc, dict):
            raise ValueError(f"Expected mapping, got {type(doc)}")

        kind = doc.get('kind')
        if not kind:
            line = doc.get('__line__', 'unknown')
            self.warnings.append(f"Skipping document without 'kind' at {file_path}:{line}")
            return None

        api_version = doc.get('apiVersion', '')
        metadata = doc.get('metadata', {}) or {}

        if not isinstance(metadata, dict):
            raise ValueError("metadata must be a mapping")

        name = metadata.get('name', '')
        namespace = metadata.get('namespace', 'default')

        if not name:
            line = doc.get('__line__', 'unknown')
            raise ValueError(f"Resource missing 'metadata.name' at {file_path}:{line}")

        start_line = doc.get('__line__', 1)
        end_line = doc.get('__end_line__')

        labels = metadata.get('labels', {}) or {}
        annotations = metadata.get('annotations', {}) or {}

        if not isinstance(labels, dict):
            labels = {}
        if not isinstance(annotations, dict):
            annotations = {}

        labels = {str(k): str(v) for k, v in labels.items()
                  if v is not None and k not in ('__line__', '__end_line__')}
        annotations = {str(k): str(v) for k, v in annotations.items()
                       if v is not None and k not in ('__line__', '__end_line__')}

        source = SourceLocation(
            file_path=file_path,
            start_line=start_line,
            end_line=end_line
        )

        raw = doc.copy()
        raw.pop('__line__', None)
        raw.pop('__end_line__', None)

        return K8sResource(
            kind=kind,
            api_version=api_version,
            name=name,
            namespace=namespace,
            labels=labels,
            annotations=annotations,
            spec=doc.get('spec', {}) or {},
            status=doc.get('status', {}) or {},
            source=source,
            raw=raw
        )

    def parse_directory(self, dir_path: str, recursive: bool = True) -> List[K8sResource]:
        resources = []
        path = Path(dir_path)

        if not path.is_dir():
            self.errors.append(f"Directory not found: {dir_path}")
            return resources

        pattern = '**/*.yaml' if recursive else '*.yaml'

        for yaml_file in path.glob(pattern):
            if yaml_file.suffix in ('.yaml', '.yml'):
                resources.extend(self.parse_file(str(yaml_file)))

        return resources
