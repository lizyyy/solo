import json
import re
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from .database import LockfileType


@dataclass
class ParsedDependency:
    name: str
    version: Optional[str] = None
    license_name: Optional[str] = None
    license_url: Optional[str] = None
    description: Optional[str] = None


class LockfileParser:
    @staticmethod
    def detect_lockfile_type(file_path: str) -> Optional[LockfileType]:
        filename = os.path.basename(file_path)
        if filename == "Pipfile.lock":
            return LockfileType.PIPFILE_LOCK
        elif filename == "poetry.lock":
            return LockfileType.POETRY_LOCK
        elif filename == "package.json" or filename == "package-lock.json":
            return LockfileType.PACKAGE_JSON
        elif filename == "Cargo.lock":
            return LockfileType.CARGO_LOCK
        elif "requirements" in filename and filename.endswith(".txt"):
            return LockfileType.REQUIREMENTS_TXT
        return None

    @staticmethod
    def parse(file_path: str, lockfile_type: Optional[LockfileType] = None) -> Tuple[List[ParsedDependency], List[str]]:
        if not lockfile_type:
            lockfile_type = LockfileParser.detect_lockfile_type(file_path)

        if not lockfile_type:
            raise ValueError(f"Could not determine lockfile type for {file_path}")

        parsers = {
            LockfileType.PIPFILE_LOCK: LockfileParser._parse_pipfile_lock,
            LockfileType.POETRY_LOCK: LockfileParser._parse_poetry_lock,
            LockfileType.PACKAGE_JSON: LockfileParser._parse_package_json,
            LockfileType.CARGO_LOCK: LockfileParser._parse_cargo_lock,
            LockfileType.REQUIREMENTS_TXT: LockfileParser._parse_requirements_txt,
        }

        parser = parsers.get(lockfile_type)
        if not parser:
            raise ValueError(f"No parser available for lockfile type: {lockfile_type}")

        return parser(file_path)

    @staticmethod
    def _parse_pipfile_lock(file_path: str) -> Tuple[List[ParsedDependency], List[str]]:
        dependencies = []
        warnings = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for section in ['default', 'develop']:
                if section not in data:
                    continue
                for name, info in data[section].items():
                    version = info.get('version', '').replace('==', '')
                    dependencies.append(ParsedDependency(
                        name=name,
                        version=version if version else None,
                    ))
        except Exception as e:
            warnings.append(f"Error parsing Pipfile.lock: {str(e)}")

        return dependencies, warnings

    @staticmethod
    def _parse_poetry_lock(file_path: str) -> Tuple[List[ParsedDependency], List[str]]:
        dependencies = []
        warnings = []

        try:
            import tomllib
            with open(file_path, 'rb') as f:
                data = tomllib.load(f)

            for pkg in data.get('package', []):
                dependencies.append(ParsedDependency(
                    name=pkg.get('name'),
                    version=pkg.get('version'),
                    description=pkg.get('description'),
                ))
        except ImportError:
            try:
                import pytomlpp as toml
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = toml.load(f)

                for pkg in data.get('package', []):
                    dependencies.append(ParsedDependency(
                        name=pkg.get('name'),
                        version=pkg.get('version'),
                        description=pkg.get('description'),
                    ))
            except Exception as e:
                warnings.append(f"Error parsing poetry.lock: {str(e)}")
        except Exception as e:
            warnings.append(f"Error parsing poetry.lock: {str(e)}")

        return dependencies, warnings

    @staticmethod
    def _parse_package_json(file_path: str) -> Tuple[List[ParsedDependency], List[str]]:
        dependencies = []
        warnings = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for dep_section in ['dependencies', 'devDependencies', 'peerDependencies']:
                if dep_section not in data:
                    continue
                for name, version in data[dep_section].items():
                    dependencies.append(ParsedDependency(
                        name=name,
                        version=version,
                    ))
        except Exception as e:
            warnings.append(f"Error parsing package.json: {str(e)}")

        return dependencies, warnings

    @staticmethod
    def _parse_cargo_lock(file_path: str) -> Tuple[List[ParsedDependency], List[str]]:
        dependencies = []
        warnings = []

        try:
            import tomllib
            with open(file_path, 'rb') as f:
                data = tomllib.load(f)

            for pkg in data.get('package', []):
                dependencies.append(ParsedDependency(
                    name=pkg.get('name'),
                    version=pkg.get('version'),
                ))
        except ImportError:
            try:
                import pytomlpp as toml
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = toml.load(f)

                for pkg in data.get('package', []):
                    dependencies.append(ParsedDependency(
                        name=pkg.get('name'),
                        version=pkg.get('version'),
                    ))
            except Exception as e:
                warnings.append(f"Error parsing Cargo.lock: {str(e)}")
        except Exception as e:
            warnings.append(f"Error parsing Cargo.lock: {str(e)}")

        return dependencies, warnings

    @staticmethod
    def _parse_requirements_txt(file_path: str) -> Tuple[List[ParsedDependency], List[str]]:
        dependencies = []
        warnings = []
        pattern = re.compile(r'^([a-zA-Z0-9_-]+)([<>=!]+.*)?')

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue

                    match = pattern.match(line.split('#')[0].strip())
                    if match:
                        name = match.group(1)
                        version = match.group(2)
                        if version:
                            version = version.strip()
                        dependencies.append(ParsedDependency(
                            name=name,
                            version=version,
                        ))
        except Exception as e:
            warnings.append(f"Error parsing requirements.txt: {str(e)}")

        return dependencies, warnings
