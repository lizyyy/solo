import os
import yaml
from typing import Dict, List, Any, Optional, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class YAMLLoadError(Exception):
    pass


class YAMLLoader:
    @staticmethod
    def load_yaml_file(file_path: str) -> Tuple[Optional[Dict], List[str]]:
        errors = []
        if not os.path.exists(file_path):
            errors.append(f"File not found: {file_path}")
            return None, errors

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                try:
                    content = yaml.safe_load(f)
                    if content is None:
                        errors.append(f"Empty YAML file: {file_path}")
                        return None, errors
                    return content, errors
                except yaml.YAMLError as e:
                    errors.append(f"YAML parse error in {file_path}: {str(e)}")
                    return None, errors
        except UnicodeDecodeError:
            errors.append(f"File encoding error (not UTF-8): {file_path}")
            return None, errors
        except IOError as e:
            errors.append(f"File read error in {file_path}: {str(e)}")
            return None, errors

    @staticmethod
    def load_all_yaml_files(dir_path: str) -> Tuple[List[Dict], List[str]]:
        all_docs = []
        all_errors = []

        if not os.path.isdir(dir_path):
            all_errors.append(f"Directory not found: {dir_path}")
            return all_docs, all_errors

        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.yaml', '.yml')):
                    file_path = os.path.join(root, file)
                    content, errors = YAMLLoader.load_yaml_file(file_path)
                    all_errors.extend(errors)
                    if content:
                        if isinstance(content, list):
                            for doc in content:
                                if isinstance(doc, dict):
                                    doc['_source_file'] = file_path
                                    all_docs.append(doc)
                        elif isinstance(content, dict):
                            content['_source_file'] = file_path
                            all_docs.append(content)

        return all_docs, all_errors

    @staticmethod
    def is_configmap(doc: Dict) -> bool:
        kind = doc.get('kind', '')
        return kind == 'ConfigMap'

    @staticmethod
    def extract_configmap_data(doc: Dict) -> Tuple[Optional[str], Optional[str], Dict[str, Any]]:
        metadata = doc.get('metadata', {})
        name = metadata.get('name')
        namespace = metadata.get('namespace', 'default')
        data = doc.get('data', {}) or {}

        if not name:
            return None, namespace, {}

        if not isinstance(data, dict):
            return name, namespace, {}

        return name, namespace, data
