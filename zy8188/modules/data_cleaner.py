from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from .data_loader import DataLoader, OCRToken, PageInfo, TemplateRule


@dataclass
class DirtyDataIssue:
    issue_type: str
    archive_id: str
    page_num: int
    description: str
    severity: str
    token_id: Optional[str] = None
    original_value: Optional[Any] = None
    suggested_fix: Optional[str] = None
    needs_manual_review: bool = True


@dataclass
class CleanedToken:
    original_token: OCRToken
    is_cleaned: bool = False
    cleaning_type: Optional[str] = None
    cleaned_x1: Optional[int] = None
    cleaned_y1: Optional[int] = None
    cleaned_x2: Optional[int] = None
    cleaned_y2: Optional[int] = None
    cleaned_confidence: Optional[float] = None


@dataclass
class CleanedPage:
    archive_id: str
    page_num: int
    original_rotation: int
    normalized_rotation: int = 0
    is_rotated: bool = False
    issues: List[DirtyDataIssue] = field(default_factory=list)
    cleaned_tokens: List[CleanedToken] = field(default_factory=list)


@dataclass
class ArchiveCleaningReport:
    archive_id: str
    missing_pages: List[int] = field(default_factory=list)
    rotated_pages: List[int] = field(default_factory=list)
    out_of_bounds_tokens: List[Tuple[int, str]] = field(default_factory=list)
    total_issues: int = 0
    critical_issues: int = 0
    pages: Dict[int, CleanedPage] = field(default_factory=dict)


class DataCleaner:
    def __init__(self, data_loader: DataLoader):
        self.data_loader = data_loader
        self.archives_report: Dict[str, ArchiveCleaningReport] = {}
        self.all_issues: List[DirtyDataIssue] = []
    
    def clean_all(self) -> Dict[str, ArchiveCleaningReport]:
        if not self.data_loader.is_data_loaded():
            raise ValueError("Data not loaded. Please load data first.")
        
        archive_ids = self.data_loader.get_all_archive_ids()
        
        for archive_id in archive_ids:
            report = self._clean_archive(archive_id)
            self.archives_report[archive_id] = report
        
        return self.archives_report
    
    def _clean_archive(self, archive_id: str) -> ArchiveCleaningReport:
        report = ArchiveCleaningReport(archive_id=archive_id)
        
        pages = self.data_loader.get_archive_pages(archive_id)
        page_numbers = self.data_loader.get_archive_page_numbers(archive_id)
        
        expected_page_numbers = list(range(1, max(page_numbers) + 1)) if page_numbers else []
        missing_pages = [p for p in expected_page_numbers if p not in page_numbers]
        report.missing_pages = missing_pages
        
        if missing_pages:
            for mp in missing_pages:
                issue = DirtyDataIssue(
                    issue_type='missing_page',
                    archive_id=archive_id,
                    page_num=mp,
                    description=f"案卷 {archive_id} 缺少第 {mp} 页",
                    severity='critical',
                    needs_manual_review=True
                )
                self.all_issues.append(issue)
                report.total_issues += 1
                report.critical_issues += 1
        
        for page in pages:
            cleaned_page = self._clean_page(page)
            report.pages[page.page_num] = cleaned_page
            
            if cleaned_page.is_rotated:
                report.rotated_pages.append(page.page_num)
            
            report.total_issues += len(cleaned_page.issues)
            report.critical_issues += sum(
                1 for i in cleaned_page.issues if i.severity == 'critical'
            )
            
            for token in cleaned_page.cleaned_tokens:
                if token.is_cleaned:
                    report.out_of_bounds_tokens.append((page.page_num, token.original_token.token_id))
        
        return report
    
    def _clean_page(self, page: PageInfo) -> CleanedPage:
        cleaned_page = CleanedPage(
            archive_id=page.archive_id,
            page_num=page.page_num,
            original_rotation=page.rotation
        )
        
        if page.rotation != 0:
            cleaned_page.is_rotated = True
            cleaned_page.normalized_rotation = 0
            
            rotation_desc = {
                90: "顺时针旋转90度",
                180: "倒置180度",
                270: "逆时针旋转90度(或顺时针270度)"
            }.get(page.rotation, f"旋转{page.rotation}度")
            
            issue = DirtyDataIssue(
                issue_type='rotation',
                archive_id=page.archive_id,
                page_num=page.page_num,
                description=f"页面{rotation_desc}，需要校正",
                severity='high',
                original_value=page.rotation,
                suggested_fix=f"旋转 {-page.rotation} 度",
                needs_manual_review=True
            )
            cleaned_page.issues.append(issue)
            self.all_issues.append(issue)
        
        tokens = self.data_loader.get_page_tokens(page.archive_id, page.page_num)
        
        for token in tokens:
            cleaned_token = CleanedToken(original_token=token)
            
            bounds_issue = self._check_token_bounds(token, page)
            if bounds_issue:
                cleaned_page.issues.append(bounds_issue)
                self.all_issues.append(bounds_issue)
                cleaned_token.is_cleaned = True
                cleaned_token.cleaning_type = 'bounds_clamp'
                
                clamped = self._clamp_token_to_bounds(token, page)
                cleaned_token.cleaned_x1 = clamped['x1']
                cleaned_token.cleaned_y1 = clamped['y1']
                cleaned_token.cleaned_x2 = clamped['x2']
                cleaned_token.cleaned_y2 = clamped['y2']
            
            if token.confidence <= 0:
                issue = DirtyDataIssue(
                    issue_type='invalid_confidence',
                    archive_id=page.archive_id,
                    page_num=page.page_num,
                    description=f"Token '{token.text}' 置信度无效: {token.confidence}",
                    severity='medium',
                    token_id=token.token_id,
                    original_value=token.confidence,
                    suggested_fix="建议手动核实或重新OCR",
                    needs_manual_review=True
                )
                cleaned_page.issues.append(issue)
                self.all_issues.append(issue)
                cleaned_token.is_cleaned = True
                cleaned_token.cleaning_type = 'confidence_normalize'
                cleaned_token.cleaned_confidence = 0.5
            
            cleaned_page.cleaned_tokens.append(cleaned_token)
        
        return cleaned_page
    
    def _check_token_bounds(self, token: OCRToken, page: PageInfo) -> Optional[DirtyDataIssue]:
        page_width = page.width
        page_height = page.height
        
        issues = []
        
        if token.x1 < 0 or token.x1 > page_width:
            issues.append(f"x1={token.x1}")
        if token.x2 < 0 or token.x2 > page_width:
            issues.append(f"x2={token.x2}")
        if token.y1 < 0 or token.y1 > page_height:
            issues.append(f"y1={token.y1}")
        if token.y2 < 0 or token.y2 > page_height:
            issues.append(f"y2={token.y2}")
        
        if token.x1 >= token.x2:
            issues.append(f"x1 >= x2 ({token.x1} >= {token.x2})")
        if token.y1 >= token.y2:
            issues.append(f"y1 >= y2 ({token.y1} >= {token.y2})")
        
        if issues:
            return DirtyDataIssue(
                issue_type='out_of_bounds',
                archive_id=page.archive_id,
                page_num=page.page_num,
                description=f"Token '{token.text}' 坐标越界或无效: {', '.join(issues)} (页面尺寸: {page_width}x{page_height})",
                severity='high',
                token_id=token.token_id,
                original_value={
                    'x1': token.x1, 'y1': token.y1,
                    'x2': token.x2, 'y2': token.y2
                },
                suggested_fix="建议裁剪到页面边界或手动调整",
                needs_manual_review=True
            )
        
        return None
    
    def _clamp_token_to_bounds(self, token: OCRToken, page: PageInfo) -> Dict[str, int]:
        page_width = page.width
        page_height = page.height
        
        x1 = max(0, min(token.x1, page_width - 1))
        y1 = max(0, min(token.y1, page_height - 1))
        x2 = max(1, min(token.x2, page_width))
        y2 = max(1, min(token.y2, page_height))
        
        if x1 >= x2:
            x2 = x1 + 1
        if y1 >= y2:
            y2 = y1 + 1
        
        return {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}
    
    def get_issues_by_type(self, issue_type: str) -> List[DirtyDataIssue]:
        return [i for i in self.all_issues if i.issue_type == issue_type]
    
    def get_issues_by_severity(self, severity: str) -> List[DirtyDataIssue]:
        return [i for i in self.all_issues if i.severity == severity]
    
    def get_issues_by_archive(self, archive_id: str) -> List[DirtyDataIssue]:
        return [i for i in self.all_issues if i.archive_id == archive_id]
    
    def get_cleaning_summary(self) -> Dict[str, Any]:
        total_archives = len(self.archives_report)
        archives_with_issues = sum(
            1 for r in self.archives_report.values() if r.total_issues > 0
        )
        
        issue_type_counts = {}
        for issue in self.all_issues:
            itype = issue.issue_type
            issue_type_counts[itype] = issue_type_counts.get(itype, 0) + 1
        
        severity_counts = {}
        for issue in self.all_issues:
            sev = issue.severity
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
        
        total_missing_pages = sum(
            len(r.missing_pages) for r in self.archives_report.values()
        )
        total_rotated_pages = sum(
            len(r.rotated_pages) for r in self.archives_report.values()
        )
        total_oob_tokens = sum(
            len(r.out_of_bounds_tokens) for r in self.archives_report.values()
        )
        
        return {
            'total_archives': total_archives,
            'archives_with_issues': archives_with_issues,
            'total_issues': len(self.all_issues),
            'issue_types': issue_type_counts,
            'severity_distribution': severity_counts,
            'missing_pages_total': total_missing_pages,
            'rotated_pages_total': total_rotated_pages,
            'out_of_bounds_tokens_total': total_oob_tokens,
            'archives': {
                aid: {
                    'missing_pages': r.missing_pages,
                    'rotated_pages': r.rotated_pages,
                    'out_of_bounds_tokens_count': len(r.out_of_bounds_tokens),
                    'total_issues': r.total_issues,
                    'critical_issues': r.critical_issues
                }
                for aid, r in self.archives_report.items()
            }
        }
    
    def get_archive_cleaning_report(self, archive_id: str) -> Optional[ArchiveCleaningReport]:
        return self.archives_report.get(archive_id)
