import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from .models import PackageHash, HashCheckResult, PackageVersion
from .constants import HashAlgorithm, SUPPORTED_HASH_ALGORITHMS, PackageSource


class HashCalculator:
    @staticmethod
    def calculate_file_hash(file_path: str, algorithm: str = HashAlgorithm.SHA256) -> str:
        h = hashlib.new(algorithm.lower())
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def calculate_file_hashes(file_path: str, algorithms: Optional[List[str]] = None) -> Dict[str, str]:
        algorithms = algorithms or SUPPORTED_HASH_ALGORITHMS
        results = {}
        hashers = {algo: hashlib.new(algo.lower()) for algo in algorithms}
        
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                for h in hashers.values():
                    h.update(chunk)
        
        for algo, h in hashers.items():
            results[algo] = h.hexdigest()
        
        return results

    @staticmethod
    def parse_hash_string(hash_str: str) -> Tuple[str, str]:
        if ':' in hash_str:
            algorithm, value = hash_str.split(':', 1)
            return algorithm.lower().strip(), value.lower().strip()
        return HashAlgorithm.SHA256, hash_str.lower().strip()


class HashValidator:
    def __init__(self, strict: bool = True):
        self.strict = strict
        self.calculator = HashCalculator()

    def validate_hashes(
        self,
        expected_hashes: List[PackageHash],
        actual_hashes: List[PackageHash],
        package_name: str,
        version: str
    ) -> HashCheckResult:
        match = True
        mismatch_details: List[str] = []

        expected_by_algo: Dict[str, Set[str]] = {}
        actual_by_algo: Dict[str, Set[str]] = {}

        for h in expected_hashes:
            algo = h.algorithm.lower()
            if algo not in expected_by_algo:
                expected_by_algo[algo] = set()
            expected_by_algo[algo].add(h.value.lower())

        for h in actual_hashes:
            algo = h.algorithm.lower()
            if algo not in actual_by_algo:
                actual_by_algo[algo] = set()
            actual_by_algo[algo].add(h.value.lower())

        common_algorithms = set(expected_by_algo.keys()) & set(actual_by_algo.keys())
        
        if not common_algorithms:
            if self.strict and expected_hashes:
                match = False
                mismatch_details.append("没有找到共同的哈希算法进行比较")
        else:
            for algo in sorted(common_algorithms):
                expected = expected_by_algo[algo]
                actual = actual_by_algo[algo]
                
                if not (expected & actual):
                    match = False
                    expected_str = ', '.join(sorted(expected))
                    actual_str = ', '.join(sorted(actual))
                    mismatch_details.append(
                        f"{algo} 哈希不匹配: 期望 [{expected_str}], 实际 [{actual_str}]"
                    )

        return HashCheckResult(
            package_name=package_name,
            version=version,
            expected_hashes=expected_hashes,
            actual_hashes=actual_hashes,
            match=match,
            mismatch_details=mismatch_details
        )

    def validate_package_version(
        self,
        pkg_version: PackageVersion,
        expected_hashes: List[PackageHash],
        package_name: str
    ) -> HashCheckResult:
        actual_hashes = pkg_version.hashes
        
        if not actual_hashes and pkg_version.wheel_path:
            file_hashes = self.calculator.calculate_file_hashes(pkg_version.wheel_path)
            actual_hashes = [
                PackageHash(algorithm=algo, value=val, source=PackageSource.WHEELHOUSE, verified=True)
                for algo, val in file_hashes.items()
            ]
        
        return self.validate_hashes(
            expected_hashes=expected_hashes,
            actual_hashes=actual_hashes,
            package_name=package_name,
            version=pkg_version.version
        )


class HashChecker:
    def __init__(self, strict: bool = True):
        self.validator = HashValidator(strict=strict)
        self.calculator = HashCalculator()

    def check_requirement_against_package(
        self,
        requirement,
        package_version: Optional[PackageVersion]
    ) -> Tuple[HashCheckResult, bool]:
        if not requirement.hashes:
            return None, True

        if not package_version:
            result = HashCheckResult(
                package_name=requirement.name,
                version=requirement.specifier or "unknown",
                expected_hashes=requirement.hashes,
                actual_hashes=[],
                match=False,
                mismatch_details=["找不到匹配的包版本"]
            )
            return result, False

        result = self.validator.validate_package_version(
            pkg_version=package_version,
            expected_hashes=requirement.hashes,
            package_name=requirement.name
        )
        
        return result, result.match

    def check_hash_list(
        self,
        package_name: str,
        version: str,
        expected_hash_strings: List[str],
        actual_package: Optional[PackageVersion] = None,
        actual_file_path: Optional[str] = None
    ) -> HashCheckResult:
        expected_hashes: List[PackageHash] = []
        for hash_str in expected_hash_strings:
            algo, value = self.calculator.parse_hash_string(hash_str)
            expected_hashes.append(PackageHash(algorithm=algo, value=value, source="input"))

        actual_hashes: List[PackageHash] = []
        
        if actual_file_path and Path(actual_file_path).exists():
            file_hashes = self.calculator.calculate_file_hashes(actual_file_path)
            actual_hashes = [
                PackageHash(algorithm=algo, value=val, source=PackageSource.LOCAL, verified=True)
                for algo, val in file_hashes.items()
            ]
        elif actual_package:
            actual_hashes = actual_package.hashes

        return self.validator.validate_hashes(
            expected_hashes=expected_hashes,
            actual_hashes=actual_hashes,
            package_name=package_name,
            version=version
        )
