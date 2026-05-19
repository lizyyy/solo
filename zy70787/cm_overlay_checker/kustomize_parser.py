import os
from typing import Dict, List, Optional, Tuple
import logging
from .yaml_loader import YAMLLoader
from .models import OverlayLayer, ConfigMapKeyValue

logger = logging.getLogger(__name__)


class KustomizeParser:
    def __init__(self, base_dir: str, layers: Optional[List[str]] = None):
        self.base_dir = base_dir
        self.layers = layers or ['base', 'staging', 'prod']
        self.layer_data: Dict[str, OverlayLayer] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def discover_layers(self) -> List[str]:
        if not os.path.isdir(self.base_dir):
            self.errors.append(f"Base directory not found: {self.base_dir}")
            return []

        discovered = []
        for layer in self.layers:
            layer_path = os.path.join(self.base_dir, layer)
            if os.path.isdir(layer_path):
                discovered.append(layer)
            else:
                self.warnings.append(f"Layer directory not found: {layer}")

        return discovered

    def parse_layer(self, layer_name: str, layer_order: int) -> Optional[OverlayLayer]:
        layer_path = os.path.join(self.base_dir, layer_name)

        if not os.path.isdir(layer_path):
            self.errors.append(f"Layer directory not found: {layer_path}")
            return None

        docs, load_errors = YAMLLoader.load_all_yaml_files(layer_path)
        self.errors.extend(load_errors)

        layer = OverlayLayer(
            name=layer_name,
            path=layer_path,
            layer_order=layer_order
        )

        for doc in docs:
            if YAMLLoader.is_configmap(doc):
                cm_name, namespace, data = YAMLLoader.extract_configmap_data(doc)
                source_file = doc.get('_source_file', 'unknown')

                if cm_name:
                    cm_key = f"{namespace}/{cm_name}"
                    if cm_key not in layer.configmaps:
                        layer.configmaps[cm_key] = {}

                    for key, value in data.items():
                        if key in layer.configmaps[cm_key]:
                            conflict_msg = (
                                f"Key '{key}' in ConfigMap '{cm_key}' "
                                f"defined multiple times in layer '{layer_name}': "
                                f"previous: {layer.configmaps[cm_key][key].source_file}, "
                                f"current: {source_file}"
                            )
                            self.warnings.append(conflict_msg)

                        layer.configmaps[cm_key][key] = ConfigMapKeyValue(
                            key=key,
                            value=value,
                            source_file=source_file,
                            layer=layer_name
                        )

        return layer

    def parse_all_layers(self) -> Dict[str, OverlayLayer]:
        discovered_layers = self.discover_layers()

        for idx, layer_name in enumerate(discovered_layers):
            layer = self.parse_layer(layer_name, idx)
            if layer:
                self.layer_data[layer_name] = layer

        return self.layer_data

    def get_kustomization_resources(self, layer_path: str) -> List[str]:
        kustomization_paths = [
            os.path.join(layer_path, 'kustomization.yaml'),
            os.path.join(layer_path, 'kustomization.yml')
        ]

        for kustomization_path in kustomization_paths:
            if os.path.exists(kustomization_path):
                content, errors = YAMLLoader.load_yaml_file(kustomization_path)
                if content:
                    resources = content.get('resources', [])
                    if isinstance(resources, list):
                        return resources
                break

        return []
