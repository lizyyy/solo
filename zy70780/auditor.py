import hashlib
import re
from typing import List, Dict, Tuple, Optional
import requests
from models import PackageStatus


class HashAuditor:
    def __init__(self):
        self.registry_endpoints = {
            "https://registry.npmjs.org": "https://registry.npmjs.org/{package}/{version}",
            "https://registry.yarnpkg.com": "https://registry.yarnpkg.com/{package}/-/{package}-{version}.tgz",
            "https://registry.npmmirror.com": "https://registry.npmmirror.com/{package}/{version}/file",
            "https://pypi.org/simple": "https://pypi.org/pypi/{package}/{version}/json",
        }

    def verify_hash(self, package_name: str, version: str, integrity_hash: str, registry: str) -> Tuple[bool, PackageStatus, Dict]:
        result = {
            "found": False,
            "hash_match": False,
            "error_message": None,
            "response_data": None
        }

        try:
            hash_type, expected_hash = self._parse_integrity(integrity_hash)
            if not hash_type:
                result["error_message"] = f"Invalid integrity format: {integrity_hash}"
                return False, PackageStatus.UNVERIFIED, result

            actual_hash = None
            if registry in self.registry_endpoints:
                actual_hash, result = self._fetch_from_registry(
                    package_name, version, registry, hash_type, result
                )

            result["found"] = actual_hash is not None

            if actual_hash:
                result["hash_match"] = actual_hash == expected_hash
                if result["hash_match"]:
                    return True, PackageStatus.NORMAL, result
                else:
                    return False, PackageStatus.ABNORMAL, result
            else:
                return False, PackageStatus.UNVERIFIED, result

        except Exception as e:
            result["error_message"] = str(e)
            return False, PackageStatus.UNVERIFIED, result

    def _parse_integrity(self, integrity: str) -> Tuple[Optional[str], Optional[str]]:
        if not integrity:
            return None, None

        patterns = [
            r"^(sha512|sha256|sha1)-([A-Za-z0-9+/=]+)$",
            r"^(sha512|sha256|sha1):([A-Za-z0-9+/=]+)$",
        ]

        for pattern in patterns:
            match = re.match(pattern, integrity)
            if match:
                return match.group(1).lower(), match.group(2)

        if len(integrity) == 64:
            return "sha256", integrity
        elif len(integrity) == 128:
            return "sha512", integrity
        elif len(integrity) == 40:
            return "sha1", integrity
        elif len(integrity) == 32:
            return "md5", integrity

        return None, None

    def _fetch_from_registry(self, package_name: str, version: str, registry: str,
                            hash_type: str, result: Dict) -> Tuple[Optional[str], Dict]:
        try:
            if "npm" in registry or "yarn" in registry:
                url = f"{registry}/{package_name}/{version}"
                resp = requests.get(url, timeout=10)
                result["response_data"] = resp.text[:500]

                if resp.status_code == 200:
                    data = resp.json()
                    dist = data.get("dist", {})
                    integrity = dist.get("integrity", "")
                    if integrity:
                        _, actual_hash = self._parse_integrity(integrity)
                        return actual_hash, result
                    shasum = dist.get("shasum", "")
                    if shasum:
                        return shasum, result

            elif "pypi" in registry:
                url = f"https://pypi.org/pypi/{package_name}/{version}/json"
                resp = requests.get(url, timeout=10)
                result["response_data"] = resp.text[:500]

                if resp.status_code == 200:
                    data = resp.json()
                    releases = data.get("releases", {}).get(version, [])
                    if not releases:
                        info = data.get("info", {})
                        if info:
                            result["error_message"] = f"No releases found for version {version}"
                            return None, result
                    for release in releases:
                        digests = release.get("digests", {})
                        digest = digests.get(hash_type.lower())
                        if digest:
                            return digest, result
                        if not digest and hash_type.lower() != "sha256":
                            digest = digests.get("sha256")
                            if digest:
                                return digest, result

        except Exception as e:
            result["error_message"] = f"Registry fetch error: {str(e)}"

        return None, result

    def check_registry_conflicts(self, packages: List[Dict]) -> List[Dict]:
        by_name_version = {}
        conflicts = []

        for pkg in packages:
            key = f"{pkg['package_name']}@{pkg['version']}"
            if key not in by_name_version:
                by_name_version[key] = []
            by_name_version[key].append(pkg)

        for key, pkg_list in by_name_version.items():
            if len(pkg_list) > 1:
                registries = set(p["registry"] for p in pkg_list)
                hashes = set(p["integrity_hash"] for p in pkg_list if p["integrity_hash"])

                if len(registries) > 1 or len(hashes) > 1:
                    conflicts.append({
                        "package_name": pkg_list[0]["package_name"],
                        "version": pkg_list[0]["version"],
                        "registries": list(registries),
                        "hashes": list(hashes),
                        "instances": pkg_list
                    })

        return conflicts

    def generate_audit_summary(self, packages: List) -> Dict:
        total = len(packages)
        status_counts = {
            PackageStatus.NORMAL: 0,
            PackageStatus.ABNORMAL: 0,
            PackageStatus.CONFLICT: 0,
            PackageStatus.UNVERIFIED: 0
        }

        by_registry = {}
        for pkg in packages:
            status_counts[pkg.status] = status_counts.get(pkg.status, 0) + 1
            if pkg.registry not in by_registry:
                by_registry[pkg.registry] = 0
            by_registry[pkg.registry] += 1

        return {
            "total_packages": total,
            "status_distribution": {k.value: v for k, v in status_counts.items()},
            "registry_distribution": by_registry,
            "issues_found": status_counts[PackageStatus.ABNORMAL] + status_counts[PackageStatus.CONFLICT]
        }
