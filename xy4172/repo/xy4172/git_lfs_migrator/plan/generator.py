"""迁移计划生成器"""
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from git_lfs_migrator.models import (
    FileType,
    GitAttributeRule,
    GitFile,
    LFSMigrationPlan,
    LFSStatus,
    ScanResult,
)


DEFAULT_EXTENSION_PATTERNS = {
    "images": ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.bmp", "*.tiff", "*.webp", "*.ico", "*.svg"],
    "binaries": ["*.bin", "*.exe", "*.dll", "*.so", "*.dylib", "*.a", "*.lib", "*.obj", "*.o"],
    "archives": ["*.zip", "*.tar", "*.gz", "*.bz2", "*.7z", "*.rar"],
    "audio": ["*.mp3", "*.wav", "*.flac", "*.aac", "*.ogg"],
    "video": ["*.mp4", "*.avi", "*.mov", "*.mkv", "*.webm"],
    "fonts": ["*.ttf", "*.otf", "*.woff", "*.woff2", "*.eot"],
    "documents": ["*.pdf", "*.doc", "*.docx", "*.xls", "*.xlsx", "*.ppt", "*.pptx"],
    "java": ["*.jar", "*.war", "*.ear"],
    "python": ["*.pyc", "*.pyd", "*.so"],
}


class MigrationPlanGenerator:
    """LFS 迁移计划生成器"""
    
    def __init__(
        self,
        scan_result: ScanResult,
        large_file_threshold: int = 100 * 1024,
    ):
        self.scan_result = scan_result
        self.large_file_threshold = large_file_threshold
        self._extension_patterns: Dict[str, List[str]] = dict(DEFAULT_EXTENSION_PATTERNS)
    
    def add_custom_pattern(self, category: str, pattern: str) -> None:
        """添加自定义模式"""
        if category not in self._extension_patterns:
            self._extension_patterns[category] = []
        if pattern not in self._extension_patterns[category]:
            self._extension_patterns[category].append(pattern)
    
    def get_files_to_convert(self) -> List[GitFile]:
        """获取需要转换为 LFS 的文件列表"""
        to_convert: List[GitFile] = []
        
        for file_path, git_file in self.scan_result.file_sizes.items():
            if git_file.lfs_status == LFSStatus.IN_LFS:
                continue
            if git_file.lfs_status == LFSStatus.POINTER_FILE:
                continue
            
            if git_file.size >= self.large_file_threshold:
                to_convert.append(git_file)
            elif git_file.file_type == FileType.BINARY:
                to_convert.append(git_file)
            elif self._matches_extension_pattern(file_path):
                to_convert.append(git_file)
        
        return to_convert
    
    def get_files_unchanged(self) -> List[GitFile]:
        """获取不需要转换的文件列表"""
        to_convert_paths = {f.path for f in self.get_files_to_convert()}
        
        unchanged: List[GitFile] = []
        for file_path, git_file in self.scan_result.file_sizes.items():
            if file_path not in to_convert_paths:
                unchanged.append(git_file)
        
        return unchanged
    
    def _matches_extension_pattern(self, file_path: str) -> bool:
        """检查文件路径是否匹配任何扩展名模式"""
        import fnmatch
        
        lower_path = file_path.lower()
        for patterns in self._extension_patterns.values():
            for pattern in patterns:
                lower_pattern = pattern.lower()
                if fnmatch.fnmatch(lower_path, lower_pattern):
                    return True
                basename = lower_path.split("/")[-1]
                if fnmatch.fnmatch(basename, lower_pattern):
                    return True
        
        return False
    
    def generate_gitattributes_rules(self) -> List[GitAttributeRule]:
        """生成建议的 .gitattributes 规则"""
        import os
        
        to_convert = self.get_files_to_convert()
        rules: List[GitAttributeRule] = []
        existing_patterns = {rule.pattern for rule in self.scan_result.gitattributes_rules}
        
        extensions_map: Dict[str, Set[str]] = defaultdict(set)
        
        for git_file in to_convert:
            ext = os.path.splitext(git_file.path)[1].lower()
            if ext:
                extensions_map[ext].add(git_file.path)
        
        for ext, files in extensions_map.items():
            if len(files) >= 2:
                pattern = f"*{ext}"
                if pattern not in existing_patterns:
                    rules.append(GitAttributeRule(
                        pattern=pattern,
                        lfs_enabled=True,
                        other_attributes={},
                        raw_line=f"{pattern} filter=lfs diff=lfs merge=lfs -text",
                    ))
        
        single_files: Set[str] = set()
        for git_file in to_convert:
            ext = os.path.splitext(git_file.path)[1].lower()
            if ext and len(extensions_map.get(ext, [])) < 2:
                single_files.add(git_file.path)
            elif not ext:
                single_files.add(git_file.path)
        
        for file_path in sorted(single_files):
            if file_path not in existing_patterns:
                rules.append(GitAttributeRule(
                    pattern=file_path,
                    lfs_enabled=True,
                    other_attributes={},
                    raw_line=f"{file_path} filter=lfs diff=lfs merge=lfs -text",
                ))
        
        return rules
    
    def estimate_size_reduction(self) -> int:
        """估计仓库大小减少量"""
        to_convert = self.get_files_to_convert()
        return sum(f.size for f in to_convert)
    
    def generate_dry_run_output(self) -> Dict[str, Any]:
        """生成 dry-run 输出"""
        to_convert = self.get_files_to_convert()
        unchanged = self.get_files_unchanged()
        
        size_reduction = self.estimate_size_reduction()
        
        return {
            "files_to_convert_count": len(to_convert),
            "files_unchanged_count": len(unchanged),
            "estimated_size_reduction_bytes": size_reduction,
            "estimated_size_reduction_human": self._format_size(size_reduction),
            "gitattributes_rules_count": len(self.generate_gitattributes_rules()),
            "sample_files": [f.path for f in to_convert[:10]],
            "warnings": self._generate_warnings(),
        }
    
    def _generate_warnings(self) -> List[str]:
        """生成警告列表"""
        warnings: List[str] = []
        
        to_convert = self.get_files_to_convert()
        
        history_files = [f for f in to_convert if f.in_history]
        if history_files:
            warnings.append(
                f"发现 {len(history_files)} 个文件存在历史版本，需要使用 git lfs migrate import --everything"
            )
        
        binary_files = [f for f in to_convert if f.file_type == FileType.BINARY]
        if binary_files:
            warnings.append(
                f"发现 {len(binary_files)} 个二进制文件，建议在 LFS 迁移前确保工作区干净"
            )
        
        return warnings
    
    def _format_size(self, size: int) -> str:
        """格式化大小为可读格式"""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"
    
    def generate_plan(self) -> LFSMigrationPlan:
        """生成完整的迁移计划"""
        return LFSMigrationPlan(
            files_to_convert=self.get_files_to_convert(),
            files_unchanged=self.get_files_unchanged(),
            estimated_size_reduction=self.estimate_size_reduction(),
            gitattributes_changes=[
                rule.raw_line for rule in self.generate_gitattributes_rules()
            ],
            warnings=self._generate_warnings(),
            dry_run_output=self.generate_dry_run_output(),
        )


def generate_migration_plan(
    scan_result: ScanResult,
    large_file_threshold: int = 100 * 1024,
) -> LFSMigrationPlan:
    """
    生成 LFS 迁移计划
    
    Args:
        scan_result: 扫描结果
        large_file_threshold: 大文件阈值（字节）
    
    Returns:
        LFSMigrationPlan
    """
    generator = MigrationPlanGenerator(scan_result, large_file_threshold)
    return generator.generate_plan()


def generate_gitattributes_suggestions(
    scan_result: ScanResult,
    large_file_threshold: int = 100 * 1024,
) -> List[str]:
    """
    生成 .gitattributes 建议
    
    Args:
        scan_result: 扫描结果
        large_file_threshold: 大文件阈值
    
    Returns:
        建议的 .gitattributes 规则列表
    """
    generator = MigrationPlanGenerator(scan_result, large_file_threshold)
    rules = generator.generate_gitattributes_rules()
    return [rule.raw_line for rule in rules]


def generate_migration_command(
    migration_plan: LFSMigrationPlan,
    include_history: bool = True,
    include_tags: bool = False,
    dry_run: bool = True,
) -> str:
    """
    生成 git lfs migrate 命令
    
    Args:
        migration_plan: 迁移计划
        include_history: 是否包含历史
        include_tags: 是否包含标签
        dry_run: 是否为 dry-run 模式
    
    Returns:
        命令字符串
    """
    cmd_parts = ["git lfs migrate"]
    
    if dry_run:
        cmd_parts.append("info")
    else:
        cmd_parts.append("import")
    
    if include_history:
        cmd_parts.append("--everything")
    
    if include_tags:
        cmd_parts.append("--include-tags")
    
    if migration_plan.gitattributes_changes:
        for rule in migration_plan.gitattributes_changes:
            pattern = rule.split()[0] if rule.split() else ""
            if pattern:
                cmd_parts.extend(["--include", f"'{pattern}'"])
    
    return " ".join(cmd_parts)
