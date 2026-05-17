"""核心分析整合模块"""

from pathlib import Path
from typing import List, Dict
from collections import Counter
from .archive_reader import ArchiveReader
from .path_normalizer import PathNormalizer
from .duplicate_detector import DuplicateDetector
from .models import PurificationResult, PurificationRules, ExitCode, FileEntry, PathIssueType


class ArchiveAnalyzer:
    """归档包分析器 - 整合所有净化功能"""
    
    def __init__(self, archive_path: str, rules: PurificationRules = None):
        self.archive_path = Path(archive_path)
        self.rules = rules or PurificationRules()
        self.reader: ArchiveReader = None
    
    def analyze(self, dry_run: bool = True, output_dir: Path = None) -> PurificationResult:
        """执行完整分析和净化流程"""
        
        with ArchiveReader(self.archive_path) as reader:
            self.reader = reader
            
            archive_info = reader.get_info()
            entries = list(reader.iter_entries())
            
            normalizer = PathNormalizer(self.rules)
            entries = normalizer.normalize_all(entries)
            
            detector = DuplicateDetector(self.rules.deduplicate_strategy)
            duplicate_groups = detector.detect_by_path(entries)
            detector.resolve_duplicates(duplicate_groups)
            
            issues_count = self._count_issues(entries)
            files_with_issues = sum(1 for e in entries if e.issues)
            files_cleaned = sum(1 for e in entries if e.issues and not e.is_directory)
            
            exit_code = self._determine_exit_code(entries)
            
            result = PurificationResult(
                archive_info=archive_info,
                total_files=len(entries),
                issues_count={k.value: v for k, v in issues_count.items()},
                duplicate_groups=len(duplicate_groups),
                files_with_issues=files_with_issues,
                files_cleaned=files_cleaned,
                files_skipped=0,
                entries=entries,
                rules=self.rules,
                output_directory=str(output_dir) if output_dir else None,
                exit_code=exit_code,
                success=exit_code in (ExitCode.SUCCESS, ExitCode.WARNINGS)
            )
            
            if not dry_run and output_dir:
                self._extract_files(entries, output_dir)
            
            return result
    
    def preview_extraction(self, output_dir: Path) -> List[Dict]:
        """预演解包，不实际提取文件"""
        preview = []
        with ArchiveReader(self.archive_path) as reader:
            entries = list(reader.iter_entries())
            normalizer = PathNormalizer(self.rules)
            entries = normalizer.normalize_all(entries)
            
            for entry in entries:
                if not entry.is_directory:
                    target_path = output_dir / entry.normalized_path
                    preview.append({
                        'original': entry.original_path,
                        'target': str(target_path),
                        'size': entry.file_size,
                        'will_overwrite': target_path.exists()
                    })
        return preview
    
    def _extract_files(self, entries: List[FileEntry], output_dir: Path) -> None:
        """实际提取文件到目标目录"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        for entry in entries:
            if entry.is_directory:
                continue
            
            target_path = output_dir / entry.normalized_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                self.reader.extract_file(entry.original_path, target_path)
            except Exception as e:
                entry.error_message = f"提取失败: {str(e)}"
    
    def _count_issues(self, entries: List[FileEntry]) -> Counter:
        """统计问题类型数量"""
        counter: Counter = Counter()
        for entry in entries:
            for issue in entry.issues:
                counter[issue] += 1
        return counter
    
    def _determine_exit_code(self, entries: List[FileEntry]) -> ExitCode:
        """根据分析结果确定退出码"""
        has_errors = any(e.error_message for e in entries)
        has_warnings = any(e.issues for e in entries)
        
        if has_errors:
            return ExitCode.ERRORS
        elif has_warnings:
            return ExitCode.WARNINGS
        else:
            return ExitCode.SUCCESS
