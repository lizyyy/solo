import os
from collections import defaultdict
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class AnomalyType(Enum):
    MISSING_IN_TARGET = "missing_in_target"
    EXTRA_IN_TARGET = "extra_in_target"
    POSSIBLE_DUPLICATE = "possible_duplicate"
    HASH_MISMATCH = "hash_mismatch"


@dataclass
class ComparisonResult:
    missing_in_target: List[Dict[str, Any]]
    extra_in_target: List[Dict[str, Any]]
    possible_duplicates: List[Dict[str, Any]]
    hash_mismatches: List[Dict[str, Any]]
    source_count: int
    target_count: int


class BackupComparator:
    def __init__(self, hash_type: str = 'md5', compare_hash: bool = True):
        self.hash_type = hash_type
        self.compare_hash = compare_hash

    def compare(self, source_files: List[Dict[str, Any]], 
                target_files: List[Dict[str, Any]]) -> ComparisonResult:
        source_by_relpath: Dict[str, Dict[str, Any]] = {}
        source_by_hash: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for f in source_files:
            rel_path = f['relative_path']
            source_by_relpath[rel_path] = f
            hash_key = f.get(f'hash_{self.hash_type}')
            if hash_key:
                source_by_hash[hash_key].append(f)
        
        target_by_relpath: Dict[str, Dict[str, Any]] = {}
        target_by_hash: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for f in target_files:
            rel_path = f['relative_path']
            target_by_relpath[rel_path] = f
            hash_key = f.get(f'hash_{self.hash_type}')
            if hash_key:
                target_by_hash[hash_key].append(f)
        
        missing_in_target = []
        hash_mismatches = []
        
        for rel_path, source_file in source_by_relpath.items():
            if rel_path not in target_by_relpath:
                missing_in_target.append(source_file)
            elif self.compare_hash:
                target_file = target_by_relpath[rel_path]
                source_hash = source_file.get(f'hash_{self.hash_type}')
                target_hash = target_file.get(f'hash_{self.hash_type}')
                
                if source_hash and target_hash and source_hash != target_hash:
                    hash_mismatches.append({
                        'source': source_file,
                        'target': target_file,
                        'source_hash': source_hash,
                        'target_hash': target_hash,
                    })
        
        extra_in_target = []
        for rel_path, target_file in target_by_relpath.items():
            if rel_path not in source_by_relpath:
                extra_in_target.append(target_file)
        
        possible_duplicates = []
        
        duplicate_hashes = []
        for hash_key, files in source_by_hash.items():
            if len(files) > 1:
                duplicate_hashes.append({
                    'hash': hash_key,
                    'files': files,
                    'location': 'source',
                })
        
        for hash_key, files in target_by_hash.items():
            if len(files) > 1:
                duplicate_hashes.append({
                    'hash': hash_key,
                    'files': files,
                    'location': 'target',
                })
        
        possible_duplicates = duplicate_hashes
        
        return ComparisonResult(
            missing_in_target=missing_in_target,
            extra_in_target=extra_in_target,
            possible_duplicates=possible_duplicates,
            hash_mismatches=hash_mismatches,
            source_count=len(source_files),
            target_count=len(target_files),
        )

    def compare_with_size_fallback(self, source_files: List[Dict[str, Any]],
                                    target_files: List[Dict[str, Any]]) -> ComparisonResult:
        source_by_size_name: Dict[Tuple[int, str], Dict[str, Any]] = {}
        target_by_size_name: Dict[Tuple[int, str], Dict[str, Any]] = {}
        
        for f in source_files:
            key = (f['size'], f['filename'])
            source_by_size_name[key] = f
        
        for f in target_files:
            key = (f['size'], f['filename'])
            target_by_size_name[key] = f
        
        source_by_relpath: Dict[str, Dict[str, Any]] = {
            f['relative_path']: f for f in source_files
        }
        target_by_relpath: Dict[str, Dict[str, Any]] = {
            f['relative_path']: f for f in target_files
        }
        
        missing_in_target = []
        extra_in_target = []
        
        for rel_path, source_file in source_by_relpath.items():
            if rel_path not in target_by_relpath:
                size_name_key = (source_file['size'], source_file['filename'])
                if size_name_key not in target_by_size_name:
                    missing_in_target.append(source_file)
        
        for rel_path, target_file in target_by_relpath.items():
            if rel_path not in source_by_relpath:
                size_name_key = (target_file['size'], target_file['filename'])
                if size_name_key not in source_by_size_name:
                    extra_in_target.append(target_file)
        
        return ComparisonResult(
            missing_in_target=missing_in_target,
            extra_in_target=extra_in_target,
            possible_duplicates=[],
            hash_mismatches=[],
            source_count=len(source_files),
            target_count=len(target_files),
        )


def format_file_size(size_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"
