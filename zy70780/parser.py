import json
import re
from typing import List, Dict, Tuple, Optional
from packaging.version import parse as parse_version

try:
    import tomllib
except ImportError:
    import tomli as tomllib


class LockfileParser:
    def __init__(self):
        self.known_registries = [
            "https://registry.npmjs.org",
            "https://registry.yarnpkg.com",
            "https://npm.taobao.org",
            "https://registry.npmmirror.com",
            "https://pypi.org/simple",
            "https://pypi.tuna.tsinghua.edu.cn/simple",
        ]

    def parse(self, content: str, lockfile_type: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            if lockfile_type.lower() == "package-lock.json":
                packages, errors = self._parse_package_lock_json(content)
            elif lockfile_type.lower() == "yarn.lock":
                packages, errors = self._parse_yarn_lock(content)
            elif lockfile_type.lower() == "pnpm-lock.yaml":
                packages, errors = self._parse_pnpm_lock(content)
            elif lockfile_type.lower() == "poetry.lock":
                packages, errors = self._parse_poetry_lock(content)
            elif lockfile_type.lower() == "pipfile.lock":
                packages, errors = self._parse_pipfile_lock(content)
            else:
                errors.append(f"Unsupported lockfile type: {lockfile_type}")
        except Exception as e:
            errors.append(f"Parse error: {str(e)}")

        return packages, errors

    def _parse_package_lock_json(self, content: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            data = json.loads(content)
            lockfile_version = data.get("lockfileVersion", 1)

            if lockfile_version >= 2:
                deps = data.get("packages", {})
                for path, info in deps.items():
                    if path == "":
                        continue
                    name = info.get("name")
                    if not name:
                        path_parts = path.split("/")
                        if len(path_parts) >= 2 and path_parts[-2].startswith("@"):
                            name = "/".join(path_parts[-2:])
                        else:
                            name = path_parts[-1]
                    pkg = {
                        "package_name": name,
                        "version": info.get("version", ""),
                        "registry": self._extract_registry(info.get("resolved", "")),
                        "integrity_hash": info.get("integrity", ""),
                        "resolved": info.get("resolved", "")
                    }
                    packages.append(pkg)
            else:
                deps = data.get("dependencies", {})
                for name, info in deps.items():
                    pkg = {
                        "package_name": name,
                        "version": info.get("version", ""),
                        "registry": self._extract_registry(info.get("resolved", "")),
                        "integrity_hash": info.get("integrity", ""),
                        "resolved": info.get("resolved", "")
                    }
                    packages.append(pkg)

        except Exception as e:
            errors.append(f"package-lock.json parse error: {str(e)}")

        return packages, errors

    def _parse_yarn_lock(self, content: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            pattern = r'(.+?)@(.+?):\s*version "(.+?)"\s*resolved "(.+?)"\s*integrity (.+?)(?:\s|$)'
            matches = re.findall(pattern, content, re.DOTALL)

            for name, version_spec, version, resolved, integrity in matches:
                pkg = {
                    "package_name": name.strip(),
                    "version": version.strip(),
                    "registry": self._extract_registry(resolved.strip()),
                    "integrity_hash": integrity.strip(),
                    "resolved": resolved.strip()
                }
                packages.append(pkg)

        except Exception as e:
            errors.append(f"yarn.lock parse error: {str(e)}")

        return packages, errors

    def _parse_pnpm_lock(self, content: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            import yaml
            data = yaml.safe_load(content)
            deps = data.get("packages", {})

            for path, info in deps.items():
                if not info or not isinstance(info, dict):
                    continue
                name = info.get("name")
                if not name:
                    match = re.search(r"/(@[^/]+/[^/@]+)", path)
                    if match:
                        name = match.group(1)
                    else:
                        match = re.search(r"/([^/@]+)", path)
                        name = match.group(1) if match else path.split("/")[-1].split("@")[0]

                pkg = {
                    "package_name": name,
                    "version": info.get("version", path.split("/")[-1].split("@")[-1]),
                    "registry": self._extract_registry(info.get("resolution", {}).get("tarball", "")),
                    "integrity_hash": info.get("integrity", ""),
                    "resolved": info.get("resolution", {}).get("tarball", "")
                }
                packages.append(pkg)

        except ImportError:
            errors.append("PyYAML is required for pnpm-lock.yaml parsing")
        except Exception as e:
            errors.append(f"pnpm-lock.yaml parse error: {str(e)}")

        return packages, errors

    def _parse_poetry_lock(self, content: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            data = tomllib.loads(content)
            deps = data.get("package", [])

            for info in deps:
                package_name = info.get("name", "")
                version = info.get("version", "")
                files = info.get("files", [])
                integrity_hash = ""
                if files and len(files) > 0:
                    for f in files:
                        file_hash = f.get("hash", "")
                        if file_hash.startswith("sha256:"):
                            integrity_hash = file_hash
                            break
                    if not integrity_hash:
                        integrity_hash = files[0].get("hash", "")
                source = info.get("source", {})
                registry = source.get("url", "https://pypi.org/simple") if source else "https://pypi.org/simple"

                pkg = {
                    "package_name": package_name,
                    "version": version,
                    "registry": registry,
                    "integrity_hash": integrity_hash,
                }
                packages.append(pkg)

        except Exception as e:
            errors.append(f"poetry.lock parse error: {str(e)}")

        return packages, errors

    def _parse_pipfile_lock(self, content: str) -> Tuple[List[Dict], List[str]]:
        packages = []
        errors = []

        try:
            data = json.loads(content)
            default = data.get("default", {})
            develop = data.get("develop", {})
            all_deps = {**default, **develop}

            for name, info in all_deps.items():
                version = info.get("version", "").replace("==", "")
                hashes = info.get("hashes", [])
                integrity_hash = ""
                if hashes and len(hashes) > 0:
                    for h in hashes:
                        if h.startswith("sha256:"):
                            integrity_hash = h
                            break
                    if not integrity_hash:
                        integrity_hash = hashes[0]
                index = info.get("index", "pypi")
                if index == "pypi":
                    registry = "https://pypi.org/simple"
                else:
                    registry = index

                pkg = {
                    "package_name": name,
                    "version": version,
                    "registry": registry,
                    "integrity_hash": integrity_hash,
                }
                packages.append(pkg)

        except Exception as e:
            errors.append(f"Pipfile.lock parse error: {str(e)}")

        return packages, errors

    def _extract_registry(self, resolved: str) -> str:
        if not resolved:
            return "unknown"

        for registry in self.known_registries:
            if registry in resolved or resolved.startswith(registry):
                return registry

        match = re.match(r"(https?://[^/]+)/", resolved)
        if match:
            return match.group(1)

        return "unknown"

    def merge_registries(self, packages: List[Dict]) -> Dict[str, List[Dict]]:
        by_registry = {}
        for pkg in packages:
            registry = pkg["registry"]
            if registry not in by_registry:
                by_registry[registry] = []
            by_registry[registry].append(pkg)
        return by_registry
