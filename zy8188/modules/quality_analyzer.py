from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
import re
from .data_loader import DataLoader, OCRToken, PageInfo, TemplateRule


@dataclass
class FieldQuality:
    field_name: str
    archive_id: str
    page_num: int
    detected: bool = False
    detected_text: str = ""
    confidence: float = 0.0
    avg_token_confidence: float = 0.0
    layout_drift_x: float = 0.0
    layout_drift_y: float = 0.0
    layout_drift_distance: float = 0.0
    is_within_tolerance: bool = True
    validation_passed: bool = False
    validation_errors: List[str] = field(default_factory=list)
    tokens_used: List[Dict[str, Any]] = field(default_factory=list)
    needs_review: bool = False
    review_reason: str = ""


@dataclass
class PageQuality:
    archive_id: str
    page_num: int
    total_tokens: int = 0
    low_confidence_tokens: int = 0
    critical_confidence_tokens: int = 0
    avg_confidence: float = 0.0
    fields_quality: Dict[str, FieldQuality] = field(default_factory=dict)
    has_rotation: bool = False
    rotation_angle: int = 0
    has_missing_tokens: bool = False
    has_out_of_bounds_tokens: bool = False
    needs_review: bool = False
    review_reasons: List[str] = field(default_factory=list)


@dataclass
class ArchiveQuality:
    archive_id: str
    total_pages: int = 0
    pages_with_issues: int = 0
    missing_pages: List[int] = field(default_factory=list)
    pages_quality: Dict[int, PageQuality] = field(default_factory=dict)
    needs_review: bool = False
    review_reasons: List[str] = field(default_factory=list)


class QualityAnalyzer:
    def __init__(self, data_loader: DataLoader):
        self.data_loader = data_loader
        self.archives_quality: Dict[str, ArchiveQuality] = {}
        self.review_pages: List[Tuple[str, int]] = []
        
    def analyze_all(self) -> Dict[str, ArchiveQuality]:
        if not self.data_loader.is_data_loaded():
            raise ValueError("Data not loaded. Please load data first.")
        
        archive_ids = self.data_loader.get_all_archive_ids()
        
        for archive_id in archive_ids:
            archive_quality = self._analyze_archive(archive_id)
            self.archives_quality[archive_id] = archive_quality
            
            if archive_quality.needs_review:
                for page_num, page_quality in archive_quality.pages_quality.items():
                    if page_quality.needs_review:
                        self.review_pages.append((archive_id, page_num))
        
        return self.archives_quality
    
    def _analyze_archive(self, archive_id: str) -> ArchiveQuality:
        archive_quality = ArchiveQuality(archive_id=archive_id)
        
        pages = self.data_loader.get_archive_pages(archive_id)
        page_numbers = self.data_loader.get_archive_page_numbers(archive_id)
        
        archive_quality.total_pages = len(pages)
        
        expected_page_numbers = list(range(1, max(page_numbers) + 1)) if page_numbers else []
        missing_pages = [p for p in expected_page_numbers if p not in page_numbers]
        archive_quality.missing_pages = missing_pages
        
        if missing_pages:
            archive_quality.needs_review = True
            archive_quality.review_reasons.append(f"缺页: {missing_pages}")
        
        for page in pages:
            page_quality = self._analyze_page(page)
            archive_quality.pages_quality[page.page_num] = page_quality
            
            if page_quality.needs_review:
                archive_quality.pages_with_issues += 1
                archive_quality.needs_review = True
        
        return archive_quality
    
    def _analyze_page(self, page: PageInfo) -> PageQuality:
        page_quality = PageQuality(
            archive_id=page.archive_id,
            page_num=page.page_num
        )
        
        tokens = self.data_loader.get_page_tokens(page.archive_id, page.page_num)
        page_quality.total_tokens = len(tokens)
        
        if page.rotation != 0:
            page_quality.has_rotation = True
            page_quality.rotation_angle = page.rotation
            page_quality.needs_review = True
            page_quality.review_reasons.append(f"页面旋转: {page.rotation}度")
        
        if tokens:
            confidences = [t.confidence for t in tokens]
            page_quality.avg_confidence = sum(confidences) / len(confidences)
            
            settings = self.data_loader.template_rule.quality_settings if self.data_loader.template_rule else {}
            low_threshold = settings.get('low_confidence_threshold', 0.70)
            critical_threshold = settings.get('critical_confidence_threshold', 0.50)
            
            page_quality.low_confidence_tokens = sum(1 for c in confidences if c < low_threshold)
            page_quality.critical_confidence_tokens = sum(1 for c in confidences if c < critical_threshold)
            
            if page_quality.critical_confidence_tokens > 0:
                page_quality.needs_review = True
                page_quality.review_reasons.append(
                    f"存在{page_quality.critical_confidence_tokens}个低置信度Token(<{critical_threshold})"
                )
        
        if self.data_loader.template_rule:
            for field_rule in self.data_loader.template_rule.key_fields:
                field_quality = self._analyze_field(page, tokens, field_rule)
                page_quality.fields_quality[field_rule['field_name']] = field_quality
                
                if field_quality.needs_review:
                    page_quality.needs_review = True
                    if field_quality.review_reason:
                        page_quality.review_reasons.append(
                            f"字段[{field_rule['field_name']}]: {field_quality.review_reason}"
                        )
        
        return page_quality
    
    def _analyze_field(
        self, 
        page: PageInfo, 
        tokens: List[OCRToken], 
        field_rule: Dict[str, Any]
    ) -> FieldQuality:
        field_name = field_rule['field_name']
        field_quality = FieldQuality(
            field_name=field_name,
            archive_id=page.archive_id,
            page_num=page.page_num
        )
        
        expected_region = field_rule.get('expected_region', {})
        keywords = field_rule.get('keywords', [])
        confidence_threshold = field_rule.get('confidence_threshold', 0.80)
        layout_tolerance = field_rule.get('layout_tolerance', 50)
        
        matching_tokens = []
        keyword_tokens = []
        
        for token in tokens:
            token_center_x = (token.x1 + token.x2) / 2
            token_center_y = (token.y1 + token.y2) / 2
            
            in_expected_region = (
                expected_region.get('x1', 0) - layout_tolerance <= token_center_x <= expected_region.get('x2', 9999) + layout_tolerance and
                expected_region.get('y1', 0) - layout_tolerance <= token_center_y <= expected_region.get('y2', 9999) + layout_tolerance
            )
            
            has_keyword = any(kw in token.text for kw in keywords)
            
            if has_keyword:
                keyword_tokens.append(token)
            
            if in_expected_region or has_keyword:
                matching_tokens.append(token)
        
        if keyword_tokens:
            field_quality.detected = True
            field_quality.detected_text = ' '.join([t.text for t in keyword_tokens])
            field_quality.tokens_used = [
                {'text': t.text, 'confidence': t.confidence, 'x1': t.x1, 'y1': t.y1, 'x2': t.x2, 'y2': t.y2}
                for t in keyword_tokens
            ]
            
            confidences = [t.confidence for t in keyword_tokens]
            field_quality.avg_token_confidence = sum(confidences) / len(confidences)
            field_quality.confidence = min(confidences) if confidences else 0.0
            
            if keyword_tokens:
                first_token = keyword_tokens[0]
                token_center_x = (first_token.x1 + first_token.x2) / 2
                token_center_y = (first_token.y1 + first_token.y2) / 2
                
                expected_center_x = (expected_region.get('x1', 0) + expected_region.get('x2', 0)) / 2
                expected_center_y = (expected_region.get('y1', 0) + expected_region.get('y2', 0)) / 2
                
                field_quality.layout_drift_x = token_center_x - expected_center_x
                field_quality.layout_drift_y = token_center_y - expected_center_y
                field_quality.layout_drift_distance = (
                    field_quality.layout_drift_x ** 2 + field_quality.layout_drift_y ** 2
                ) ** 0.5
                
                field_quality.is_within_tolerance = field_quality.layout_drift_distance <= layout_tolerance
            
            validation_errors = self._validate_field(field_quality.detected_text, field_rule)
            field_quality.validation_errors = validation_errors
            field_quality.validation_passed = len(validation_errors) == 0
            
            if field_quality.confidence < confidence_threshold:
                field_quality.needs_review = True
                field_quality.review_reason = f"置信度过低 ({field_quality.confidence:.2f} < {confidence_threshold})"
            elif not field_quality.is_within_tolerance:
                field_quality.needs_review = True
                field_quality.review_reason = f"版式漂移 ({field_quality.layout_drift_distance:.1f}px > {layout_tolerance}px)"
            elif not field_quality.validation_passed:
                field_quality.needs_review = True
                field_quality.review_reason = f"验证失败: {validation_errors}"
        
        else:
            field_quality.detected = False
            field_quality.needs_review = True
            field_quality.review_reason = "未检测到关键字段"
        
        return field_quality
    
    def _validate_field(self, text: str, field_rule: Dict[str, Any]) -> List[str]:
        errors = []
        validation = field_rule.get('validation_rules', {})
        field_type = field_rule.get('field_type', 'text')
        
        if not text:
            return ["字段值为空"]
        
        min_length = validation.get('min_length')
        if min_length is not None and len(text) < min_length:
            errors.append(f"长度不足(最小{min_length}字符)")
        
        max_length = validation.get('max_length')
        if max_length is not None and len(text) > max_length:
            errors.append(f"长度超出(最大{max_length}字符)")
        
        pattern = validation.get('pattern')
        if pattern:
            try:
                if not re.match(pattern, text):
                    errors.append(f"格式不匹配")
            except re.error:
                errors.append("正则表达式验证失败")
        
        if field_type == 'date':
            if not self._looks_like_date(text):
                errors.append("不符合日期格式")
        
        return errors
    
    def _looks_like_date(self, text: str) -> bool:
        date_patterns = [
            r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?',
            r'\d{4}\d{2}\d{2}',
            r'\d{2}[-/]\d{2}[-/]\d{4}',
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def get_review_pages(self) -> List[Tuple[str, int]]:
        return self.review_pages
    
    def get_quality_summary(self) -> Dict[str, Any]:
        total_archives = len(self.archives_quality)
        archives_with_issues = sum(1 for aq in self.archives_quality.values() if aq.needs_review)
        
        total_pages = sum(aq.total_pages for aq in self.archives_quality.values())
        pages_with_issues = sum(aq.pages_with_issues for aq in self.archives_quality.values())
        
        all_low_conf_tokens = sum(
            pq.low_confidence_tokens 
            for aq in self.archives_quality.values() 
            for pq in aq.pages_quality.values()
        )
        
        all_critical_tokens = sum(
            pq.critical_confidence_tokens 
            for aq in self.archives_quality.values() 
            for pq in aq.pages_quality.values()
        )
        
        all_missing_pages = sum(
            len(aq.missing_pages) 
            for aq in self.archives_quality.values()
        )
        
        return {
            'total_archives': total_archives,
            'archives_with_issues': archives_with_issues,
            'total_pages': total_pages,
            'pages_with_issues': pages_with_issues,
            'review_pages_count': len(self.review_pages),
            'low_confidence_tokens': all_low_conf_tokens,
            'critical_confidence_tokens': all_critical_tokens,
            'missing_pages_total': all_missing_pages,
            'archives': {
                aid: {
                    'total_pages': aq.total_pages,
                    'pages_with_issues': aq.pages_with_issues,
                    'missing_pages': aq.missing_pages,
                    'needs_review': aq.needs_review
                }
                for aid, aq in self.archives_quality.items()
            }
        }
    
    def get_page_quality(self, archive_id: str, page_num: int) -> Optional[PageQuality]:
        archive_quality = self.archives_quality.get(archive_id)
        if archive_quality:
            return archive_quality.pages_quality.get(page_num)
        return None
