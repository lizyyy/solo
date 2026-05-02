"""
照片归档模块
负责重命名、目录组织和冲突处理
"""
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .config import PhotoMetadata, StoreRule, Issue


class PhotoArchiver:
    """照片归档器"""
    
    def __init__(self, output_dir: str, store_rules: List[StoreRule] = None):
        self.output_dir = Path(output_dir)
        self.store_rules = store_rules or []
        self.store_code_map = {rule.store_code.upper(): rule for rule in self.store_rules}
        
        # 用于追踪同名文件
        self.name_tracker: Dict[str, List[str]] = {}
        self.issues: List[Issue] = []
    
    def generate_archive_path(self, metadata: PhotoMetadata) -> Tuple[Path, str]:
        """
        生成归档路径和新文件名
        返回: (目标目录路径, 新文件名)
        """
        # 确定门店编码
        store_code = metadata.determined_store_code or "UNKNOWN"
        
        # 确定日期
        date_str = self._extract_date_from_time(metadata.determined_time)
        
        # 确定点位
        checkpoint = metadata.determined_checkpoint or "UNKNOWN"
        
        # 构建目录结构: 输出目录/门店编码/日期/点位/
        target_dir = self.output_dir / store_code / date_str / checkpoint
        
        # 生成新文件名
        new_filename = self._generate_filename(metadata, store_code, date_str, checkpoint)
        
        return target_dir, new_filename
    
    def _extract_date_from_time(self, time_str: Optional[str]) -> str:
        """从时间字符串中提取日期"""
        if not time_str:
            return "UNKNOWN_DATE"
        
        try:
            # 尝试解析多种格式
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d",
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(time_str, fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        except Exception:
            pass
        
        return "UNKNOWN_DATE"
    
    def _generate_filename(self, metadata: PhotoMetadata, 
                          store_code: str, date_str: str, 
                          checkpoint: str) -> str:
        """
        生成新文件名
        格式: 门店编码_日期_点位_序号.扩展名
        """
        original_path = Path(metadata.original_path)
        extension = original_path.suffix.lower()
        
        # 基础文件名
        base_name = f"{store_code}_{date_str}_{checkpoint}"
        
        # 检查是否有同名冲突
        conflict_key = f"{store_code}_{date_str}_{checkpoint}"
        
        if conflict_key not in self.name_tracker:
            self.name_tracker[conflict_key] = []
        
        # 生成序号
        sequence = len(self.name_tracker[conflict_key]) + 1
        new_filename = f"{base_name}_{sequence:03d}{extension}"
        
        # 检查是否真的会冲突（同名但内容不同）
        # 这里需要后续处理时再确认，先返回带序号的文件名
        
        return new_filename
    
    def archive_photo(self, metadata: PhotoMetadata, 
                     target_dir: Path, new_filename: str,
                     copy: bool = True) -> Tuple[Path, List[Issue]]:
        """
        归档照片
        Args:
            metadata: 照片元数据
            target_dir: 目标目录
            new_filename: 新文件名
            copy: True为复制，False为移动
        
        Returns:
            (目标文件路径, 问题列表)
        """
        issues = []
        original_path = Path(metadata.original_path)
        
        # 创建目标目录
        target_dir.mkdir(parents=True, exist_ok=True)
        
        target_path = target_dir / new_filename
        
        # 检查同名冲突
        if target_path.exists():
            # 比较文件内容
            existing_hash = self._calculate_file_hash(target_path)
            if existing_hash == metadata.file_hash:
                # 完全相同的文件，标记为重复
                issues.append(Issue(
                    issue_type="duplicate_photo",
                    severity="warning",
                    photo_metadata=metadata,
                    message=f"照片与已归档文件重复: {target_path}",
                    store_code=metadata.determined_store_code,
                    checkpoint=metadata.determined_checkpoint,
                    details={
                        "original_path": metadata.original_path,
                        "duplicate_path": str(target_path),
                        "file_hash": metadata.file_hash,
                    }
                ))
                # 不重复归档
                return target_path, issues
            else:
                # 同名但内容不同，需要添加序号
                conflict_key = f"{target_dir}_{new_filename}"
                if conflict_key not in self.name_tracker:
                    self.name_tracker[conflict_key] = [str(target_path)]
                
                # 生成新的序号
                sequence = len(self.name_tracker[conflict_key]) + 1
                stem = target_path.stem
                extension = target_path.suffix
                
                # 尝试去除已有的序号
                import re
                match = re.search(r'_(\d{3})$', stem)
                if match:
                    stem = stem[:-4]  # 去掉 _001 这样的后缀
                
                new_filename_with_seq = f"{stem}_{sequence:03d}{extension}"
                target_path = target_dir / new_filename_with_seq
                
                issues.append(Issue(
                    issue_type="name_conflict",
                    severity="warning",
                    photo_metadata=metadata,
                    message=f"文件名冲突，已重命名为: {new_filename_with_seq}",
                    store_code=metadata.determined_store_code,
                    checkpoint=metadata.determined_checkpoint,
                    details={
                        "original_path": metadata.original_path,
                        "original_name": new_filename,
                        "new_name": new_filename_with_seq,
                        "conflict_file": str(target_path.parent / new_filename),
                    }
                ))
                
                self.name_tracker[conflict_key].append(str(target_path))
        
        # 执行归档操作
        try:
            if copy:
                shutil.copy2(original_path, target_path)
            else:
                shutil.move(original_path, target_path)
        except Exception as e:
            issues.append(Issue(
                issue_type="archive_error",
                severity="critical",
                photo_metadata=metadata,
                message=f"归档失败: {str(e)}",
                store_code=metadata.determined_store_code,
                checkpoint=metadata.determined_checkpoint,
                details={
                    "original_path": metadata.original_path,
                    "target_path": str(target_path),
                    "error": str(e),
                }
            ))
        
        return target_path, issues
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """计算文件哈希"""
        import hashlib
        import os
        
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            file_size = file_path.stat().st_size
            hasher.update(str(file_size).encode())
            
            chunk_size = 8192
            chunk = f.read(chunk_size)
            hasher.update(chunk)
            
            if file_size > chunk_size * 2:
                f.seek(-chunk_size, os.SEEK_END)
                chunk = f.read(chunk_size)
                hasher.update(chunk)
        
        return hasher.hexdigest()
    
    def get_statistics(self) -> Dict:
        """获取归档统计信息"""
        stats = {
            "total_photos": 0,
            "by_store": {},
            "by_date": {},
            "by_checkpoint": {},
            "duplicates_found": 0,
            "conflicts_resolved": 0,
        }
        
        # 遍历输出目录统计
        if self.output_dir.exists():
            for store_dir in self.output_dir.iterdir():
                if store_dir.is_dir():
                    store_code = store_dir.name
                    stats["by_store"][store_code] = 0
                    
                    for date_dir in store_dir.iterdir():
                        if date_dir.is_dir():
                            date_str = date_dir.name
                            if date_str not in stats["by_date"]:
                                stats["by_date"][date_str] = 0
                            
                            for checkpoint_dir in date_dir.iterdir():
                                if checkpoint_dir.is_dir():
                                    checkpoint = checkpoint_dir.name
                                    if checkpoint not in stats["by_checkpoint"]:
                                        stats["by_checkpoint"][checkpoint] = 0
                                    
                                    # 统计照片数量
                                    photo_count = len(list(checkpoint_dir.glob("*")))
                                    stats["total_photos"] += photo_count
                                    stats["by_store"][store_code] += photo_count
                                    stats["by_date"][date_str] += photo_count
                                    stats["by_checkpoint"][checkpoint] += photo_count
        
        return stats
