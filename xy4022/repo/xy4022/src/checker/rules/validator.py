"""规则校验引擎"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Set, Any, Optional
from collections import defaultdict

from checker.config.models import (
    Config,
    CheckIssue,
    IssueLevel,
    IssueType,
    FileReference,
    ScanResult,
)
from checker.markdown_parser.parser import HeadingInfo, MarkdownParser
from checker.utils.helpers import is_case_sensitive, check_case_sensitivity, get_file_size, format_file_size


@dataclass
class ValidationContext:
    """校验上下文"""
    config: Config
    root_dir: str
    all_files: List[str] = field(default_factory=list)
    markdown_files: List[str] = field(default_factory=list)
    file_headings: Dict[str, List[HeadingInfo]] = field(default_factory=dict)
    file_anchors: Dict[str, Set[str]] = field(default_factory=dict)


class Validator:
    """规则校验器"""
    
    def __init__(self, config: Config, root_dir: str):
        self.config = config
        self.context = ValidationContext(config=config, root_dir=root_dir)
    
    def validate_all(self, scan_result: ScanResult) -> List[CheckIssue]:
        """执行所有规则校验"""
        issues: List[CheckIssue] = []
        
        self._collect_files()
        self._parse_all_markdown_headings()
        
        issues.extend(self.check_path_traversal(scan_result.references))
        issues.extend(self.check_case_mismatch(scan_result.references))
        issues.extend(self.check_missing_files(scan_result.references))
        issues.extend(self.check_duplicate_files())
        issues.extend(self.check_unused_large_files(scan_result.referenced_files))
        issues.extend(self.check_heading_level_jumps())
        issues.extend(self.check_invalid_anchors(scan_result.references))
        
        return issues
    
    def _collect_files(self):
        """收集所有文件"""
        root_path = Path(self.context.root_dir)
        
        for filepath in root_path.rglob('*'):
            if filepath.is_file():
                rel_path = str(filepath.relative_to(root_path))
                self.context.all_files.append(rel_path)
                
                if filepath.suffix.lower() in ('.md', '.markdown'):
                    self.context.markdown_files.append(rel_path)
    
    def _parse_all_markdown_headings(self):
        """解析所有Markdown文件的标题"""
        root_path = Path(self.context.root_dir)
        
        for md_file in self.context.markdown_files:
            full_path = str(root_path / md_file)
            try:
                parser = MarkdownParser(full_path, self.context.root_dir)
                _, _, headings = parser.parse()
                
                self.context.file_headings[md_file] = headings
                
                anchors = set()
                for heading in headings:
                    anchors.add(heading.anchor)
                self.context.file_anchors[md_file] = anchors
            except Exception:
                continue
    
    def check_path_traversal(self, references: List[FileReference]) -> List[CheckIssue]:
        """检查路径遍历（引用跳出根目录）
        
        检测目标路径是否在根目录之外，这是一种安全风险
        """
        issues: List[CheckIssue] = []
        root_path = Path(self.context.root_dir).resolve()
        
        for ref in references:
            if not ref.target_path:
                continue
            
            try:
                target_abs = Path(ref.target_path).resolve()
                
                # 检查是否在根目录内
                try:
                    target_abs.relative_to(root_path)
                except ValueError:
                    issues.append(CheckIssue(
                        level=IssueLevel.ERROR,
                        issue_type=IssueType.PATH_TRAVERSAL,
                        message=f"引用路径跳出根目录: {ref.raw_path}",
                        source_file=ref.source_file,
                        line_number=ref.line_number,
                        details={
                            "raw_path": ref.raw_path,
                            "resolved_path": str(target_abs),
                            "root_dir": str(root_path),
                        }
                    ))
            except Exception:
                # 路径解析出错时跳过
                continue
        
        return issues
    
    def check_case_mismatch(self, references: List[FileReference]) -> List[CheckIssue]:
        """检查路径大小写不一致
        
        在不区分大小写的文件系统上，检查引用的路径与实际文件的大小写是否一致
        """
        issues: List[CheckIssue] = []
        root_path = Path(self.context.root_dir)
        
        # 构建实际文件路径的大小写映射
        actual_files_map: Dict[str, str] = {}  # 小写路径 -> 实际路径
        for rel_path in self.context.all_files:
            actual_files_map[rel_path.lower()] = rel_path
        
        # 还需要检查目录大小写
        for ref in references:
            if not ref.target_path:
                continue
            
            try:
                # 获取相对于根目录的路径
                ref_abs = Path(ref.target_path).resolve()
                root_abs = root_path.resolve()
                
                try:
                    ref_rel = str(ref_abs.relative_to(root_abs))
                except ValueError:
                    continue
                
                # 检查文件是否存在（大小写不敏感）
                ref_rel_lower = ref_rel.lower()
                
                # 检查是否存在但大小写不同
                if ref_rel_lower in actual_files_map:
                    actual_path = actual_files_map[ref_rel_lower]
                    if actual_path != ref_rel:
                        issues.append(CheckIssue(
                            level=IssueLevel.WARNING,
                            issue_type=IssueType.CASE_MISMATCH,
                            message=f"路径大小写不一致: 引用 '{ref.raw_path}' 实际是 '{actual_path}'",
                            source_file=ref.source_file,
                            line_number=ref.line_number,
                            details={
                                "referenced_path": ref_rel,
                                "actual_path": actual_path,
                                "raw_path": ref.raw_path,
                            }
                        ))
            except Exception:
                continue
        
        return issues
    
    def check_missing_files(self, references: List[FileReference]) -> List[CheckIssue]:
        """检查缺失文件
        
        检测引用的文件是否存在
        """
        issues: List[CheckIssue] = []
        root_path = Path(self.context.root_dir)
        
        # 构建存在的文件集合（小写，用于大小写不敏感检查）
        existing_files_lower = {f.lower() for f in self.context.all_files}
        
        for ref in references:
            if not ref.target_path:
                continue
            
            try:
                ref_abs = Path(ref.target_path).resolve()
                root_abs = root_path.resolve()
                
                try:
                    ref_rel = str(ref_abs.relative_to(root_abs))
                except ValueError:
                    continue
                
                # 检查文件是否存在（大小写不敏感）
                if ref_rel.lower() not in existing_files_lower:
                    issues.append(CheckIssue(
                        level=IssueLevel.ERROR,
                        issue_type=IssueType.MISSING_FILE,
                        message=f"引用的文件不存在: {ref.raw_path}",
                        source_file=ref.source_file,
                        line_number=ref.line_number,
                        details={
                            "raw_path": ref.raw_path,
                            "resolved_path": ref_rel,
                        }
                    ))
            except Exception:
                continue
        
        return issues
    
    def check_duplicate_files(self) -> List[CheckIssue]:
        """检查同名附件冲突
        
        检测是否存在文件名相同但路径不同的文件
        """
        issues: List[CheckIssue] = []
        filename_map: Dict[str, List[str]] = defaultdict(list)
        
        for file_path in self.context.all_files:
            filename = Path(file_path).name
            filename_map[filename].append(file_path)
        
        for filename, paths in filename_map.items():
            if len(paths) > 1:
                issues.append(CheckIssue(
                    level=IssueLevel.WARNING,
                    issue_type=IssueType.DUPLICATE_FILE,
                    message=f"存在同名文件: '{filename}' 在以下路径: {', '.join(paths)}",
                    details={
                        "filename": filename,
                        "paths": paths,
                    }
                ))
        
        return issues
    
    def check_unused_large_files(self, referenced_files: List[str]) -> List[CheckIssue]:
        """检查未被引用的大文件
        
        检测超过阈值且未被任何文档引用的文件
        """
        issues: List[CheckIssue] = []
        root_path = Path(self.context.root_dir)
        threshold = self.config.large_file_threshold
        
        # 构建被引用的文件集合（小写）
        referenced_lower = {Path(f).name.lower() for f in referenced_files if f}
        
        for file_path in self.context.all_files:
            # 跳过Markdown文件本身
            if file_path.lower().endswith(('.md', '.markdown')):
                continue
            
            full_path = str(root_path / file_path)
            try:
                size = get_file_size(full_path)
                
                if size > threshold:
                    filename = Path(file_path).name
                    if filename.lower() not in referenced_lower:
                        issues.append(CheckIssue(
                            level=IssueLevel.WARNING,
                            issue_type=IssueType.UNUSED_LARGE_FILE,
                            message=f"大文件未被引用: '{file_path}' ({format_file_size(size)})",
                            details={
                                "file_path": file_path,
                                "size_bytes": size,
                                "size_readable": format_file_size(size),
                                "threshold_bytes": threshold,
                            }
                        ))
            except Exception:
                continue
        
        return issues
    
    def check_heading_level_jumps(self) -> List[CheckIssue]:
        """检查标题层级跳跃
        
        检测标题层级是否连续（如从 h1 直接跳到 h3）
        """
        issues: List[CheckIssue] = []
        
        for md_file, headings in self.context.file_headings.items():
            if not headings:
                continue
            
            # 按行号排序
            sorted_headings = sorted(headings, key=lambda h: h.line_number)
            
            prev_level = 0
            for heading in sorted_headings:
                current_level = heading.level
                
                if prev_level > 0:
                    # 检查是否跳跃超过1级
                    if current_level > prev_level + 1:
                        issues.append(CheckIssue(
                            level=IssueLevel.WARNING,
                            issue_type=IssueType.HEADING_LEVEL_JUMP,
                            message=f"标题层级跳跃: 从 h{prev_level} 跳到 h{current_level} - '{heading.text}'",
                            source_file=md_file,
                            line_number=heading.line_number,
                            details={
                                "prev_level": prev_level,
                                "current_level": current_level,
                                "heading_text": heading.text,
                            }
                        ))
                
                prev_level = current_level
        
        return issues
    
    def check_invalid_anchors(self, references: List[FileReference]) -> List[CheckIssue]:
        """检查无效的标题锚点
        
        检测引用的锚点是否在目标文件中存在
        """
        issues: List[CheckIssue] = []
        root_path = Path(self.context.root_dir)
        
        for ref in references:
            if ref.reference_type != "anchor":
                continue
            
            # 获取目标文件和锚点
            # FileReference中如果是锚点，target_path可能为空，需要从raw_path解析
            source_path = Path(ref.source_file)
            source_dir = source_path.parent
            
            # 解析引用：可能是 #anchor (同文件) 或 path#anchor (跨文件)
            raw_path = ref.raw_path
            
            # 分离文件路径和锚点
            if '#' in raw_path:
                file_part, anchor = raw_path.split('#', 1)
            else:
                continue  # 没有锚点
            
            # 确定目标文件
            if not file_part:
                # 同文件锚点
                target_file = ref.source_file
            else:
                # 跨文件锚点
                target_abs = (root_path / source_dir / file_part).resolve()
                try:
                    target_file = str(target_abs.relative_to(root_path.resolve()))
                except ValueError:
                    continue
            
            # 检查目标文件的锚点是否存在
            if target_file in self.context.file_anchors:
                anchors = self.context.file_anchors[target_file]
                if anchor not in anchors:
                    # 尝试查找类似的锚点（大小写不同）
                    similar = [a for a in anchors if a.lower() == anchor.lower()]
                    
                    issues.append(CheckIssue(
                        level=IssueLevel.WARNING,
                        issue_type=IssueType.INVALID_ANCHOR,
                        message=f"无效的锚点引用: '#{anchor}' 在文件 '{target_file}' 中不存在",
                        source_file=ref.source_file,
                        line_number=ref.line_number,
                        details={
                            "anchor": anchor,
                            "target_file": target_file,
                            "available_anchors": sorted(anchors) if anchors else [],
                            "similar_matches": similar,
                        }
                    ))
        
        return issues


def check_path_traversal(references: List[FileReference], root_dir: str) -> List[CheckIssue]:
    """便捷函数：检查路径遍历"""
    config = Config(root_dir=root_dir, dist_dir="dist", cache_dir=".checker_cache")
    validator = Validator(config, root_dir)
    return validator.check_path_traversal(references)


def check_case_mismatch(references: List[FileReference], all_files: List[str], root_dir: str) -> List[CheckIssue]:
    """便捷函数：检查大小写不一致"""
    config = Config(root_dir=root_dir, dist_dir="dist", cache_dir=".checker_cache")
    validator = Validator(config, root_dir)
    validator.context.all_files = all_files
    return validator.check_case_mismatch(references)


def check_missing_files(references: List[FileReference], all_files: List[str], root_dir: str) -> List[CheckIssue]:
    """便捷函数：检查缺失文件"""
    config = Config(root_dir=root_dir, dist_dir="dist", cache_dir=".checker_cache")
    validator = Validator(config, root_dir)
    validator.context.all_files = all_files
    return validator.check_missing_files(references)


def check_duplicate_files(all_files: List[str]) -> List[CheckIssue]:
    """便捷函数：检查同名文件"""
    issues: List[CheckIssue] = []
    filename_map: Dict[str, List[str]] = defaultdict(list)
    
    for file_path in all_files:
        filename = Path(file_path).name
        filename_map[filename].append(file_path)
    
    for filename, paths in filename_map.items():
        if len(paths) > 1:
            issues.append(CheckIssue(
                level=IssueLevel.WARNING,
                issue_type=IssueType.DUPLICATE_FILE,
                message=f"存在同名文件: '{filename}' 在以下路径: {', '.join(paths)}",
                details={
                    "filename": filename,
                    "paths": paths,
                }
            ))
    
    return issues


def check_unused_large_files(
    all_files: List[str],
    referenced_files: List[str],
    root_dir: str,
    threshold: int = 5 * 1024 * 1024
) -> List[CheckIssue]:
    """便捷函数：检查未被引用的大文件"""
    config = Config(
        root_dir=root_dir, 
        dist_dir="dist", 
        cache_dir=".checker_cache",
        large_file_threshold=threshold
    )
    validator = Validator(config, root_dir)
    validator.context.all_files = all_files
    return validator.check_unused_large_files(referenced_files)


def check_heading_level_jumps(
    file_headings: Dict[str, List[HeadingInfo]]
) -> List[CheckIssue]:
    """便捷函数：检查标题层级跳跃"""
    issues: List[CheckIssue] = []
    
    for md_file, headings in file_headings.items():
        if not headings:
            continue
        
        sorted_headings = sorted(headings, key=lambda h: h.line_number)
        
        prev_level = 0
        for heading in sorted_headings:
            current_level = heading.level
            
            if prev_level > 0:
                if current_level > prev_level + 1:
                    issues.append(CheckIssue(
                        level=IssueLevel.WARNING,
                        issue_type=IssueType.HEADING_LEVEL_JUMP,
                        message=f"标题层级跳跃: 从 h{prev_level} 跳到 h{current_level} - '{heading.text}'",
                        source_file=md_file,
                        line_number=heading.line_number,
                        details={
                            "prev_level": prev_level,
                            "current_level": current_level,
                            "heading_text": heading.text,
                        }
                    ))
            
            prev_level = current_level
    
    return issues
