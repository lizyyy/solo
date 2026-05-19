import zipfile
import os
import re
import tempfile
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from packaging.requirements import Requirement, InvalidRequirement
from email.parser import Parser


class WheelParser:
    def __init__(self, wheel_path: str, original_filename: str = None):
        self.wheel_path = wheel_path
        self.original_filename = original_filename or os.path.basename(wheel_path)
        self.temp_dir = None
        self.extracted_path = None

    def __enter__(self):
        self.temp_dir = tempfile.mkdtemp()
        self.extracted_path = Path(self.temp_dir)
        with zipfile.ZipFile(self.wheel_path, 'r') as zf:
            zf.extractall(self.extracted_path)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        import shutil
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def get_file_hash(self) -> str:
        sha256_hash = hashlib.sha256()
        with open(self.wheel_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def get_file_size(self) -> int:
        return os.path.getsize(self.wheel_path)

    def parse_wheel_filename(self, filename: str) -> Dict:
        name_without_ext = filename.replace('.whl', '')
        parts = name_without_ext.split('-')
        result = {
            'package_name': '',
            'package_version': '',
            'python_version': '',
            'platform_tag': ''
        }

        if len(parts) >= 5:
            # Standard format: {name}-{version}-{python}-{abi}-{platform}
            # With build tag: {name}-{version}-{build}-{python}-{abi}-{platform}
            result['platform_tag'] = parts[-1]
            result['python_version'] = parts[-3]

            # Check if there's a build tag (per PEP 427)
            # Build tag format: \d+[a-z0-9]* - starts with digit, followed by alphanumeric
            # Position -4 is build tag if len >= 6 and it matches this pattern
            if len(parts) >= 6 and re.match(r'^\d+[a-zA-Z0-9]*$', parts[-4]):
                # Has build tag
                result['package_version'] = parts[-5]
                result['package_name'] = '-'.join(parts[:-5])
            else:
                # No build tag, standard format
                result['package_version'] = parts[-4]
                result['package_name'] = '-'.join(parts[:-4])
        elif len(parts) == 4:
            result['platform_tag'] = parts[-1]
            result['python_version'] = parts[-2]
            result['package_version'] = parts[-3]
            result['package_name'] = '-'.join(parts[:-3])
        elif len(parts) == 3:
            result['platform_tag'] = parts[-1]
            result['python_version'] = parts[-2]
            result['package_name'] = parts[0]
        elif len(parts) == 2:
            result['package_name'] = parts[0]

        return result

    def find_dist_info_dir(self) -> Optional[Path]:
        if not self.extracted_path:
            return None

        for item in self.extracted_path.iterdir():
            if item.is_dir() and item.name.endswith('.dist-info'):
                return item
        return None

    def parse_metadata(self) -> Dict:
        dist_info = self.find_dist_info_dir()
        if not dist_info:
            return {}

        metadata_file = dist_info / 'METADATA'
        if not metadata_file.exists():
            return {}

        with open(metadata_file, 'r', encoding='utf-8') as f:
            content = f.read()

        parser = Parser()
        msg = parser.parsestr(content)

        metadata = {
            'metadata_version': msg.get('Metadata-Version', ''),
            'name': msg.get('Name', ''),
            'version': msg.get('Version', ''),
            'summary': msg.get('Summary', ''),
            'description': msg.get_payload() if msg.is_multipart() else msg.get_payload(),
            'description_content_type': msg.get('Description-Content-Type', ''),
            'keywords': msg.get('Keywords', ''),
            'home_page': msg.get('Home-page', ''),
            'author': msg.get('Author', ''),
            'author_email': msg.get('Author-email', ''),
            'license': msg.get('License', ''),
            'classifier': '\n'.join(msg.get_all('Classifier', [])),
            'requires_python': msg.get('Requires-Python', ''),
            'raw_metadata': content
        }

        return metadata

    def parse_entry_points(self) -> List[Dict]:
        dist_info = self.find_dist_info_dir()
        if not dist_info:
            return []

        entry_points_file = dist_info / 'entry_points.txt'
        if not entry_points_file.exists():
            return []

        entry_points = []
        current_group = None

        with open(entry_points_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                if line.startswith('[') and line.endswith(']'):
                    current_group = line[1:-1]
                    continue

                if '=' in line and current_group:
                    name, rest = line.split('=', 1)
                    name = name.strip()
                    rest = rest.strip()

                    module = rest
                    attr = None
                    extras = None

                    if ':' in module:
                        module, attr = module.split(':', 1)

                    if '[' in rest and ']' in rest:
                        extras_start = rest.index('[')
                        extras_end = rest.index(']')
                        extras = rest[extras_start + 1:extras_end]
                        module = rest[:extras_start].strip()
                        if ':' in module:
                            module, attr = module.split(':', 1)

                    entry_points.append({
                        'group': current_group,
                        'name': name,
                        'module': module.strip(),
                        'attr': attr.strip() if attr else None,
                        'extras': extras
                    })

        return entry_points

    def parse_dependencies(self) -> List[Dict]:
        dist_info = self.find_dist_info_dir()
        if not dist_info:
            return []

        metadata_file = dist_info / 'METADATA'
        if not metadata_file.exists():
            return []

        with open(metadata_file, 'r', encoding='utf-8') as f:
            content = f.read()

        parser = Parser()
        msg = parser.parsestr(content)

        dependencies = []
        requires_dists = msg.get_all('Requires-Dist', [])

        for req_str in requires_dists:
            try:
                req = Requirement(req_str)
                dependencies.append({
                    'name': req.name,
                    'specifier': str(req.specifier),
                    'extras': ','.join(req.extras) if req.extras else None,
                    'environment_marker': str(req.marker) if req.marker else None
                })
            except InvalidRequirement:
                dependencies.append({
                    'name': req_str,
                    'specifier': '',
                    'extras': None,
                    'environment_marker': None,
                    'is_valid': False,
                    'validation_error': f'Invalid requirement format: {req_str}'
                })

        return dependencies

    def get_platform_tags(self) -> List[str]:
        parsed = self.parse_wheel_filename(self.original_filename)
        platform_tag = parsed.get('platform_tag', '')
        return platform_tag.split('.') if platform_tag else []

    def extract_all(self) -> Dict:
        parsed_filename = self.parse_wheel_filename(self.original_filename)

        return {
            'filename': self.original_filename,
            'file_hash': self.get_file_hash(),
            'file_size': self.get_file_size(),
            'package_name': parsed_filename['package_name'],
            'package_version': parsed_filename['package_version'],
            'python_version': parsed_filename['python_version'],
            'platform_tag': parsed_filename['platform_tag'],
            'platform_tags': self.get_platform_tags(),
            'metadata': self.parse_metadata(),
            'entry_points': self.parse_entry_points(),
            'dependencies': self.parse_dependencies()
        }
