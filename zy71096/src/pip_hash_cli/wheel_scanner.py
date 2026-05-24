import os
import re
import zipfile
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from packaging.utils import parse_wheel_filename
from packaging.version import Version

from .models import PackageVersion, PackageHash, SourceAttribution
from .constants import PackageSource, HashAlgorithm, SUPPORTED_HASH_ALGORITHMS


class WheelScanner:
    WHEEL_PATTERN = re.compile(r'^.*\.whl$', re.IGNORECASE)
    DIST_INFO_PATTERN = re.compile(r'^([^-]+)-([^-]+)\.dist-info$')

    def __init__(self, wheelhouse_dir: str):
        self.wheelhouse_dir = Path(wheelhouse_dir).resolve() if wheelhouse_dir else None
        self._wheel_cache: Dict[str, Dict[str, PackageVersion]] = {}
        self._scanned = False

    def scan(self) -> Dict[str, Dict[str, PackageVersion]]:
        if self._scanned:
            return self._wheel_cache

        if not self.wheelhouse_dir or not self.wheelhouse_dir.exists():
            self._scanned = True
            return self._wheel_cache

        for wheel_file in self.wheelhouse_dir.rglob('*.whl'):
            self._process_wheel(wheel_file)

        self._scanned = True
        return self._wheel_cache

    def _process_wheel(self, wheel_path: Path):
        try:
            name, version, build, tags = parse_wheel_filename(wheel_path.name)
            canonical_name = name.lower().replace('-', '_').replace('.', '_')
            version_str = str(version)

            if canonical_name not in self._wheel_cache:
                self._wheel_cache[canonical_name] = {}

            if version_str not in self._wheel_cache[canonical_name]:
                pkg_version = PackageVersion(
                    version=version_str,
                    source=PackageSource.WHEELHOUSE,
                    wheel_path=str(wheel_path)
                )
                self._wheel_cache[canonical_name][version_str] = pkg_version
            else:
                pkg_version = self._wheel_cache[canonical_name][version_str]
                if not pkg_version.wheel_path:
                    pkg_version.wheel_path = str(wheel_path)
                pkg_version.source = PackageSource.WHEELHOUSE

            hashes = self._calculate_hashes(wheel_path)
            for algo, hash_val in hashes.items():
                pkg_version.add_hash(algo, hash_val, PackageSource.WHEELHOUSE)

        except Exception as e:
            pass

    def _calculate_hashes(self, file_path: Path) -> Dict[str, str]:
        hashes = {}
        file_size = file_path.stat().st_size
        
        for algo in SUPPORTED_HASH_ALGORITHMS:
            try:
                h = hashlib.new(algo)
                with open(file_path, 'rb') as f:
                    while chunk := f.read(8192):
                        h.update(chunk)
                hashes[algo] = h.hexdigest()
            except Exception:
                pass
        
        return hashes

    def get_package_version(self, package_name: str, version: Optional[str] = None) -> Optional[PackageVersion]:
        canonical = package_name.lower().replace('-', '_').replace('.', '_')
        versions = self._wheel_cache.get(canonical, {})
        
        if version:
            return versions.get(version)
        
        if versions:
            latest = max(versions.keys(), key=lambda v: Version(v) if v else Version('0'))
            return versions.get(latest)
        
        return None


class PackageIndexClient:
    def __init__(self, index_url: Optional[str] = None, extra_index_urls: Optional[List[str]] = None):
        self.index_url = index_url or "https://pypi.org/simple/"
        self.extra_index_urls = extra_index_urls or []
        self._package_cache: Dict[str, Dict[str, Dict[str, List[str]]]] = {}

    def get_package_hashes(self, package_name: str, version: str) -> Dict[str, List[str]]:
        return {}


class SourceAttributor:
    def __init__(
        self,
        wheel_scanner: Optional[WheelScanner] = None,
        index_client: Optional[PackageIndexClient] = None
    ):
        self.wheel_scanner = wheel_scanner
        self.index_client = index_client

    def attribute_source(
        self,
        package_name: str,
        version: str,
        hashes: List[PackageHash]
    ) -> SourceAttribution:
        all_sources: Set[str] = set()
        primary_source = PackageSource.UNKNOWN
        wheelhouse_match: Optional[str] = None
        custom_index_match: Optional[str] = None
        confidence = 0.0

        if self.wheel_scanner:
            wheel_pkg = self.wheel_scanner.get_package_version(package_name, version)
            if wheel_pkg and wheel_pkg.hashes:
                wheel_hashes = {f"{h.algorithm}:{h.value}" for h in wheel_pkg.hashes}
                input_hashes = {f"{h.algorithm}:{h.value}" for h in hashes}
                
                if input_hashes & wheel_hashes:
                    all_sources.add(PackageSource.WHEELHOUSE)
                    wheelhouse_match = wheel_pkg.wheel_path
                    confidence = 0.9

        for pkg_hash in hashes:
            if pkg_hash.source == PackageSource.REQUIREMENTS:
                all_sources.add(PackageSource.REQUIREMENTS)
            elif pkg_hash.source == PackageSource.CONSTRAINTS:
                all_sources.add(PackageSource.CONSTRAINTS)

        if PackageSource.WHEELHOUSE in all_sources:
            primary_source = PackageSource.WHEELHOUSE
        elif PackageSource.REQUIREMENTS in all_sources:
            primary_source = PackageSource.REQUIREMENTS
            confidence = max(confidence, 0.5)
        elif PackageSource.CONSTRAINTS in all_sources:
            primary_source = PackageSource.CONSTRAINTS
            confidence = max(confidence, 0.5)

        return SourceAttribution(
            package_name=package_name,
            version=version,
            primary_source=primary_source,
            all_sources=sorted(list(all_sources)),
            wheelhouse_match=wheelhouse_match,
            custom_index_match=custom_index_match,
            confidence=confidence
        )

    def merge_package_sources(
        self,
        wheel_packages: Dict[str, Dict[str, PackageVersion]],
        requirements: List
    ) -> Dict[str, Dict[str, PackageVersion]]:
        merged: Dict[str, Dict[str, PackageVersion]] = {}

        for name, versions in wheel_packages.items():
            merged[name] = dict(versions)

        for req in requirements:
            canonical = req.canonical_name()
            if canonical not in merged:
                merged[canonical] = {}
            
            if req.specifier and req.specifier.startswith('=='):
                version = req.specifier[2:].strip()
                if version not in merged[canonical]:
                    merged[canonical][version] = PackageVersion(
                        version=version,
                        source=PackageSource.UNKNOWN
                    )
                
                pkg_ver = merged[canonical][version]
                pkg_ver.extras.update(req.extras)

        return merged
