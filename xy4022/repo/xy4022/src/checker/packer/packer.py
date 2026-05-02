"""文件打包器"""

import shutil
import os
from pathlib import Path
from typing import List, Dict, Optional, Set
from dataclasses import dataclass, field

from checker.config.models import Config, Manifest, ScanResult
from checker.manifest.generator import ManifestGenerator


@dataclass
class PackResult:
    """打包结果"""
    success: bool
    total_files: int = 0
    copied_files: int = 0
    skipped_files: int = 0
    dist_directory: str = ""
    manifest_path: str = ""
    errors: List[str] = field(default_factory=list)


class Packer:
    """文件打包器"""
    
    def __init__(self, config: Config, root_dir: str):
        self.config = config
        self.root_dir = Path(root_dir).resolve()
        self.dist_dir = Path(config.dist_dir).resolve()
    
    def pack(
        self,
        scan_result: ScanResult,
        files_to_pack: List[str],
        force: bool = False
    ) -> PackResult:
        """打包文件
        
        Args:
            scan_result: 扫描结果
            files_to_pack: 要打包的文件列表（相对于root_dir）
            force: 是否强制覆盖已存在的dist目录
        
        Returns:
            PackResult对象
        """
        result = PackResult(success=True, dist_directory=str(self.dist_dir))
        
        # 检查dist目录
        if self.dist_dir.exists() and not force:
            result.success = False
            result.errors.append(f"输出目录已存在: {self.dist_dir}，使用 --force 覆盖")
            return result
        
        # 清理或创建dist目录
        if self.dist_dir.exists():
            shutil.rmtree(self.dist_dir)
        self.dist_dir.mkdir(parents=True, exist_ok=True)
        
        # 复制文件
        copied = 0
        skipped = 0
        errors = []
        
        for rel_path in files_to_pack:
            source = self.root_dir / rel_path
            target = self.dist_dir / rel_path
            
            if not source.exists():
                errors.append(f"源文件不存在: {rel_path}")
                continue
            
            # 创建目标目录
            target.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                shutil.copy2(str(source), str(target))
                copied += 1
            except Exception as e:
                errors.append(f"复制文件失败: {rel_path} - {str(e)}")
                skipped += 1
        
        result.total_files = len(files_to_pack)
        result.copied_files = copied
        result.skipped_files = skipped
        result.errors = errors
        
        # 生成Manifest
        try:
            manifest_generator = ManifestGenerator(self.config, str(self.root_dir))
            manifest = manifest_generator.generate(scan_result, files_to_pack)
            result.manifest_path = manifest_generator.save_manifest(manifest, str(self.dist_dir))
        except Exception as e:
            errors.append(f"生成Manifest失败: {str(e)}")
            result.success = False
        
        if errors:
            result.success = False
        
        return result
    
    def get_files_to_pack(self, scan_result: ScanResult) -> List[str]:
        """根据扫描结果确定要打包的文件
        
        打包规则：
        1. 所有Markdown文件
        2. 所有被引用的非Markdown文件
        3. 不包含有错误引用的文件
        
        Returns:
            要打包的文件列表（相对于root_dir）
        """
        files_to_pack: Set[str] = set()
        
        # 添加所有实际存在的Markdown文件
        for file_path in scan_result.actual_files:
            if file_path.lower().endswith(('.md', '.markdown')):
                files_to_pack.add(file_path)
        
        # 添加所有被引用的文件
        for ref in scan_result.references:
            if ref.target_path:
                try:
                    target_path = Path(ref.target_path).resolve()
                    rel_path = str(target_path.relative_to(self.root_dir))
                    
                    # 检查文件是否实际存在
                    if any(
                        af == rel_path or 
                        af.lower() == rel_path.lower() 
                        for af in scan_result.actual_files
                    ):
                        # 找到正确的大小写路径
                        for af in scan_result.actual_files:
                            if af.lower() == rel_path.lower():
                                files_to_pack.add(af)
                                break
                except ValueError:
                    continue
        
        return sorted(files_to_pack)


def pack_files(
    config: Config,
    root_dir: str,
    scan_result: ScanResult,
    files_to_pack: List[str],
    force: bool = False
) -> PackResult:
    """便捷函数：打包文件"""
    packer = Packer(config, root_dir)
    return packer.pack(scan_result, files_to_pack, force)
