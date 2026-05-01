"""Manifest生成器"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Set
from datetime import datetime

from checker.config.models import Config, Manifest, ManifestEntry, ScanResult, FileReference
from checker.utils.helpers import compute_sha256, get_file_size


class ManifestGenerator:
    """Manifest生成器"""
    
    def __init__(self, config: Config, root_dir: str):
        self.config = config
        self.root_dir = Path(root_dir).resolve()
        self.dist_dir = Path(config.dist_dir)
    
    def generate(self, scan_result: ScanResult, files_to_include: List[str]) -> Manifest:
        """生成Manifest
        
        Args:
            scan_result: 扫描结果（用于获取引用来源）
            files_to_include: 要包含的文件列表（相对于root_dir）
        
        Returns:
            Manifest对象
        """
        manifest = Manifest()
        
        # 构建引用映射：目标文件 -> 来源文件列表
        reference_map = self._build_reference_map(scan_result.references)
        
        for rel_path in files_to_include:
            full_path = self.root_dir / rel_path
            
            if not full_path.exists():
                continue
            
            sha256_hash = compute_sha256(str(full_path))
            size = get_file_size(str(full_path))
            
            # 查找引用来源
            referenced_by = reference_map.get(str(rel_path), [])
            
            entry = ManifestEntry(
                path=str(rel_path),
                sha256=sha256_hash,
                size=size,
                referenced_by=referenced_by
            )
            
            manifest.entries.append(entry)
        
        manifest.total_files = len(manifest.entries)
        
        return manifest
    
    def _build_reference_map(self, references: List[FileReference]) -> Dict[str, List[str]]:
        """构建引用映射
        
        返回: Dict[目标文件相对路径, 来源文件列表]
        """
        reference_map: Dict[str, List[str]] = {}
        
        for ref in references:
            if not ref.target_path:
                continue
            
            try:
                target_path = Path(ref.target_path).resolve()
                rel_path = str(target_path.relative_to(self.root_dir))
                
                if rel_path not in reference_map:
                    reference_map[rel_path] = []
                
                if ref.source_file not in reference_map[rel_path]:
                    reference_map[rel_path].append(ref.source_file)
            except ValueError:
                continue
        
        return reference_map
    
    def save_manifest(self, manifest: Manifest, dist_path: Optional[str] = None) -> str:
        """保存Manifest到文件
        
        Args:
            manifest: Manifest对象
            dist_path: 输出目录（可选，默认为config中的dist_dir）
        
        Returns:
            Manifest文件的完整路径
        """
        if dist_path is None:
            dist_path = str(self.dist_dir)
        
        dist = Path(dist_path)
        dist.mkdir(parents=True, exist_ok=True)
        
        manifest_path = dist / "manifest.json"
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest.to_dict(), f, ensure_ascii=False, indent=2)
        
        return str(manifest_path)


def generate_manifest(
    config: Config,
    root_dir: str,
    scan_result: ScanResult,
    files_to_include: List[str]
) -> Manifest:
    """便捷函数：生成Manifest"""
    generator = ManifestGenerator(config, root_dir)
    return generator.generate(scan_result, files_to_include)
