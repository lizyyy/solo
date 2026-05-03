"""
问题规则模块 - 负责检测各种布局问题并生成报告
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

from .parse_validator import PageSize, FieldConfig, TemplateConfig, BusinessData
from .coordinate_transformer import (
    CoordinateTransformer,
    NormalizedField,
    CoordinateSystem,
    PageDimensions
)


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"    # 严重：必须修复
    WARNING = "warning"       # 警告：建议修复
    INFO = "info"             # 信息：仅供参考


class IssueType(Enum):
    """问题类型"""
    OUT_OF_BOUNDS = "out_of_bounds"           # 越界
    OVERLAP_QR = "overlap_qr"                  # 遮挡二维码
    OVERLAP_BARCODE = "overlap_barcode"        # 遮挡条形码
    OVERLAP_FIELD = "overlap_field"            # 字段重叠
    MISSING_REQUIRED = "missing_required"      # 缺少必填字段
    EMPTY_VALUE = "empty_value"                # 空值
    TOO_CLOSE_TO_EDGE = "too_close_to_edge"    # 太靠近边缘
    TEXT_TOO_LONG = "text_too_long"            # 文本过长
    INVALID_COORDINATES = "invalid_coordinates" # 无效坐标


@dataclass
class Issue:
    """单个问题"""
    issue_type: IssueType
    severity: IssueSeverity
    field_name: str
    record_id: Optional[str]
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "field_name": self.field_name,
            "record_id": self.record_id,
            "message": self.message,
            "details": self.details,
            "suggestion": self.suggestion
        }
    
    def to_markdown(self) -> str:
        """转换为Markdown格式"""
        severity_icon = {
            IssueSeverity.CRITICAL: "🔴",
            IssueSeverity.WARNING: "🟡",
            IssueSeverity.INFO: "🔵"
        }.get(self.severity, "⚪")
        
        lines = [
            f"{severity_icon} **{self.issue_type.value.upper()}**",
            f"   - 字段: `{self.field_name}`",
        ]
        
        if self.record_id:
            lines.append(f"   - 记录: `{self.record_id}`")
        
        lines.append(f"   - 描述: {self.message}")
        
        if self.suggestion:
            lines.append(f"   - 建议: {self.suggestion}")
        
        if self.details:
            lines.append(f"   - 详情:")
            for key, value in self.details.items():
                lines.append(f"     - {key}: {value}")
        
        return "\n".join(lines)


@dataclass
class ReviewReport:
    """审核报告"""
    template_name: str
    page_size: str
    total_records: int
    total_fields: int
    
    # 统计
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    
    # 问题列表
    issues: List[Issue] = field(default_factory=list)
    
    # 生成时间
    generated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    def add_issue(self, issue: Issue):
        """添加问题"""
        self.issues.append(issue)
        
        if issue.severity == IssueSeverity.CRITICAL:
            self.critical_count += 1
        elif issue.severity == IssueSeverity.WARNING:
            self.warning_count += 1
        elif issue.severity == IssueSeverity.INFO:
            self.info_count += 1
    
    def get_issues_by_type(self, issue_type: IssueType) -> List[Issue]:
        """按类型获取问题"""
        return [i for i in self.issues if i.issue_type == issue_type]
    
    def get_issues_by_severity(self, severity: IssueSeverity) -> List[Issue]:
        """按严重程度获取问题"""
        return [i for i in self.issues if i.severity == severity]
    
    def has_critical_issues(self) -> bool:
        """是否有严重问题"""
        return self.critical_count > 0
    
    def to_markdown(self) -> str:
        """生成Markdown报告"""
        lines = [
            "# PDF 套打校准审核报告",
            "",
            "## 基本信息",
            "",
            f"| 项目 | 值 |",
            f"|------|-----|",
            f"| 模板名称 | {self.template_name} |",
            f"| 页面尺寸 | {self.page_size} |",
            f"| 总记录数 | {self.total_records} |",
            f"| 总字段数 | {self.total_fields} |",
            f"| 生成时间 | {self.generated_at} |",
            "",
            "## 问题统计",
            "",
            f"| 严重程度 | 数量 |",
            f"|----------|------|",
            f"| 🔴 严重 | {self.critical_count} |",
            f"| 🟡 警告 | {self.warning_count} |",
            f"| 🔵 信息 | {self.info_count} |",
            f"| **总计** | **{len(self.issues)}** |",
            "",
        ]
        
        # 严重问题
        critical_issues = self.get_issues_by_severity(IssueSeverity.CRITICAL)
        if critical_issues:
            lines.extend([
                "## 🔴 严重问题（必须修复）",
                "",
            ])
            for issue in critical_issues:
                lines.append(issue.to_markdown())
                lines.append("")
        
        # 警告问题
        warning_issues = self.get_issues_by_severity(IssueSeverity.WARNING)
        if warning_issues:
            lines.extend([
                "## 🟡 警告问题（建议修复）",
                "",
            ])
            for issue in warning_issues:
                lines.append(issue.to_markdown())
                lines.append("")
        
        # 信息问题
        info_issues = self.get_issues_by_severity(IssueSeverity.INFO)
        if info_issues:
            lines.extend([
                "## 🔵 信息提示",
                "",
            ])
            for issue in info_issues:
                lines.append(issue.to_markdown())
                lines.append("")
        
        # 总结
        lines.extend([
            "## 总结",
            "",
        ])
        
        if self.critical_count > 0:
            lines.append(f"⚠️ **存在 {self.critical_count} 个严重问题，需要立即修复后再进行套打。**")
        elif self.warning_count > 0:
            lines.append(f"ℹ️ 存在 {self.warning_count} 个警告，建议检查后再进行套打。")
        else:
            lines.append("✅ **所有检查通过，可以进行套打。**")
        
        lines.append("")
        
        return "\n".join(lines)
    
    def save_markdown(self, output_path: str) -> bool:
        """保存Markdown报告"""
        try:
            output_dir = Path(output_path).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(self.to_markdown())
            
            return True
        except Exception as e:
            print(f"保存报告失败: {e}")
            return False


class IssueDetector:
    """问题检测器"""
    
    # 配置阈值
    EDGE_MARGIN_THRESHOLD = 20  # 边缘阈值（pt），小于此值认为太靠近边缘
    OVERLAP_WARNING_THRESHOLD = 10  # 重叠警告阈值（%）
    OVERLAP_CRITICAL_THRESHOLD = 50  # 重叠严重阈值（%）
    
    def __init__(self):
        self.transformer = CoordinateTransformer()
    
    def detect_out_of_bounds(
        self,
        field: NormalizedField,
        page_width: float,
        page_height: float,
        margins: Optional[Dict[str, float]] = None,
        record_id: Optional[str] = None
    ) -> List[Issue]:
        """
        检测越界问题
        
        Args:
            field: 标准化字段
            page_width: 页面宽度
            page_height: 页面高度
            margins: 边距
            record_id: 记录ID
        
        Returns:
            问题列表
        """
        issues = []
        
        is_inside, out_of_bounds_issues = self.transformer.is_field_in_page(
            field, page_width, page_height, margins
        )
        
        if not is_inside:
            for issue_msg in out_of_bounds_issues:
                issues.append(Issue(
                    issue_type=IssueType.OUT_OF_BOUNDS,
                    severity=IssueSeverity.CRITICAL,
                    field_name=field.name,
                    record_id=record_id,
                    message=f"字段越界: {issue_msg}",
                    details={
                        "field_x": field.x,
                        "field_y": field.y,
                        "field_width": field.width,
                        "field_height": field.height,
                        "page_width": page_width,
                        "page_height": page_height
                    },
                    suggestion="请调整字段位置，确保完全在页面范围内"
                ))
        
        return issues
    
    def detect_too_close_to_edge(
        self,
        field: NormalizedField,
        page_width: float,
        page_height: float,
        margin_threshold: Optional[float] = None,
        record_id: Optional[str] = None
    ) -> List[Issue]:
        """
        检测太靠近边缘的问题
        
        Args:
            field: 标准化字段
            page_width: 页面宽度
            page_height: 页面高度
            margin_threshold: 边缘阈值
            record_id: 记录ID
        
        Returns:
            问题列表
        """
        issues = []
        threshold = margin_threshold or self.EDGE_MARGIN_THRESHOLD
        
        # 检查各边距离
        distances = {
            "left": field.x1,
            "right": page_width - field.x2,
            "bottom": field.y1,
            "top": page_height - field.y2
        }
        
        for edge, distance in distances.items():
            if distance < threshold and distance >= 0:
                issues.append(Issue(
                    issue_type=IssueType.TOO_CLOSE_TO_EDGE,
                    severity=IssueSeverity.WARNING,
                    field_name=field.name,
                    record_id=record_id,
                    message=f"字段太靠近{edge}边缘，距离={distance:.2f}pt，阈值={threshold}pt",
                    details={
                        "edge": edge,
                        "distance": distance,
                        "threshold": threshold
                    },
                    suggestion="建议将字段向中心移动，避免打印时被裁切"
                ))
        
        return issues
    
    def detect_qr_overlap(
        self,
        fields: List[NormalizedField],
        record_id: Optional[str] = None
    ) -> List[Issue]:
        """
        检测是否有字段遮挡二维码
        
        Args:
            fields: 标准化字段列表
            record_id: 记录ID
        
        Returns:
            问题列表
        """
        issues = []
        
        # 找出所有二维码字段
        qr_fields = [f for f in fields if f.original_config.is_qr_code]
        other_fields = [f for f in fields if not f.original_config.is_qr_code]
        
        for qr_field in qr_fields:
            for other_field in other_fields:
                if qr_field.name == other_field.name:
                    continue
                
                if qr_field.overlaps_with(other_field):
                    overlap_percent = qr_field.get_overlap_percentage(other_field)
                    
                    if overlap_percent >= self.OVERLAP_CRITICAL_THRESHOLD:
                        severity = IssueSeverity.CRITICAL
                    elif overlap_percent >= self.OVERLAP_WARNING_THRESHOLD:
                        severity = IssueSeverity.WARNING
                    else:
                        severity = IssueSeverity.INFO
                    
                    issues.append(Issue(
                        issue_type=IssueType.OVERLAP_QR,
                        severity=severity,
                        field_name=other_field.name,
                        record_id=record_id,
                        message=f"字段 '{other_field.name}' 与二维码 '{qr_field.name}' 重叠 {overlap_percent:.1f}%",
                        details={
                            "qr_field": qr_field.name,
                            "overlapping_field": other_field.name,
                            "overlap_percentage": overlap_percent
                        },
                        suggestion="请移动字段位置，避免遮挡二维码，否则可能无法扫描"
                    ))
        
        return issues
    
    def detect_barcode_overlap(
        self,
        fields: List[NormalizedField],
        record_id: Optional[str] = None
    ) -> List[Issue]:
        """
        检测是否有字段遮挡条形码
        
        Args:
            fields: 标准化字段列表
            record_id: 记录ID
        
        Returns:
            问题列表
        """
        issues = []
        
        # 找出所有条形码字段
        barcode_fields = [f for f in fields if f.original_config.is_barcode]
        other_fields = [f for f in fields if not f.original_config.is_barcode]
        
        for barcode_field in barcode_fields:
            for other_field in other_fields:
                if barcode_field.name == other_field.name:
                    continue
                
                if barcode_field.overlaps_with(other_field):
                    overlap_percent = barcode_field.get_overlap_percentage(other_field)
                    
                    if overlap_percent >= self.OVERLAP_CRITICAL_THRESHOLD:
                        severity = IssueSeverity.CRITICAL
                    elif overlap_percent >= self.OVERLAP_WARNING_THRESHOLD:
                        severity = IssueSeverity.WARNING
                    else:
                        severity = IssueSeverity.INFO
                    
                    issues.append(Issue(
                        issue_type=IssueType.OVERLAP_BARCODE,
                        severity=severity,
                        field_name=other_field.name,
                        record_id=record_id,
                        message=f"字段 '{other_field.name}' 与条形码 '{barcode_field.name}' 重叠 {overlap_percent:.1f}%",
                        details={
                            "barcode_field": barcode_field.name,
                            "overlapping_field": other_field.name,
                            "overlap_percentage": overlap_percent
                        },
                        suggestion="请移动字段位置，避免遮挡条形码，否则可能无法扫描"
                    ))
        
        return issues
    
    def detect_field_overlap(
        self,
        fields: List[NormalizedField],
        record_id: Optional[str] = None
    ) -> List[Issue]:
        """
        检测字段之间的重叠
        
        Args:
            fields: 标准化字段列表
            record_id: 记录ID
        
        Returns:
            问题列表
        """
        issues = []
        checked_pairs = set()
        
        for i, field1 in enumerate(fields):
            for j, field2 in enumerate(fields):
                if i >= j:
                    continue
                
                pair_key = tuple(sorted([field1.name, field2.name]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)
                
                if field1.overlaps_with(field2):
                    overlap_percent1 = field1.get_overlap_percentage(field2)
                    overlap_percent2 = field2.get_overlap_percentage(field1)
                    
                    # 使用较大的重叠百分比
                    max_overlap = max(overlap_percent1, overlap_percent2)
                    
                    if max_overlap >= self.OVERLAP_CRITICAL_THRESHOLD:
                        severity = IssueSeverity.CRITICAL
                    elif max_overlap >= self.OVERLAP_WARNING_THRESHOLD:
                        severity = IssueSeverity.WARNING
                    else:
                        severity = IssueSeverity.INFO
                    
                    issues.append(Issue(
                        issue_type=IssueType.OVERLAP_FIELD,
                        severity=severity,
                        field_name=f"{field1.name} & {field2.name}",
                        record_id=record_id,
                        message=f"字段 '{field1.name}' 与 '{field2.name}' 重叠，最大重叠 {max_overlap:.1f}%",
                        details={
                            "field1": field1.name,
                            "field2": field2.name,
                            "overlap_percent_field1": overlap_percent1,
                            "overlap_percent_field2": overlap_percent2
                        },
                        suggestion="请调整字段位置，避免重叠"
                    ))
        
        return issues
    
    def detect_missing_required(
        self,
        template: TemplateConfig,
        business_data: BusinessData
    ) -> List[Issue]:
        """
        检测缺少必填字段
        
        Args:
            template: 模板配置
            business_data: 业务数据
        
        Returns:
            问题列表
        """
        issues = []
        
        required_fields = [f for f in template.fields if f.required]
        
        for field in required_fields:
            field_name = field.name
            value = business_data.fields.get(field_name)
            
            if value is None or (isinstance(value, str) and value.strip() == ""):
                issues.append(Issue(
                    issue_type=IssueType.MISSING_REQUIRED,
                    severity=IssueSeverity.CRITICAL,
                    field_name=field_name,
                    record_id=business_data.id,
                    message=f"必填字段 '{field_name}' 缺失或为空",
                    details={
                        "field_name": field_name,
                        "field_description": field.description
                    },
                    suggestion="请提供必填字段的值"
                ))
        
        return issues
    
    def detect_empty_values(
        self,
        template: TemplateConfig,
        business_data: BusinessData
    ) -> List[Issue]:
        """
        检测空值（非必填字段）
        
        Args:
            template: 模板配置
            business_data: 业务数据
        
        Returns:
            问题列表
        """
        issues = []
        
        optional_fields = [f for f in template.fields if not f.required]
        
        for field in optional_fields:
            field_name = field.name
            value = business_data.fields.get(field_name)
            
            if value is None or (isinstance(value, str) and value.strip() == ""):
                issues.append(Issue(
                    issue_type=IssueType.EMPTY_VALUE,
                    severity=IssueSeverity.INFO,
                    field_name=field_name,
                    record_id=business_data.id,
                    message=f"可选字段 '{field_name}' 为空",
                    details={
                        "field_name": field_name,
                        "field_description": field.description
                    },
                    suggestion="该字段为可选，如无需数据可忽略此提示"
                ))
        
        return issues
    
    def analyze_all(
        self,
        template: TemplateConfig,
        business_data_list: List[BusinessData],
        coordinate_system: CoordinateSystem = CoordinateSystem.TOP_LEFT,
        margin_threshold: Optional[float] = None
    ) -> ReviewReport:
        """
        执行完整分析
        
        Args:
            template: 模板配置
            business_data_list: 业务数据列表
            coordinate_system: 坐标系
            margin_threshold: 边缘阈值
        
        Returns:
            审核报告
        """
        # 标准化字段
        normalized_fields, (page_width, page_height) = self.transformer.normalize_template(
            template, coordinate_system
        )
        
        # 创建报告
        report = ReviewReport(
            template_name=template.name,
            page_size=f"{template.page_size.value} ({'横向' if template.orientation == 'landscape' else '纵向'})",
            total_records=len(business_data_list),
            total_fields=len(template.fields)
        )
        
        # 1. 静态检查（不依赖业务数据）
        # 检查越界
        for field in normalized_fields:
            issues = self.detect_out_of_bounds(
                field, page_width, page_height, template.margins
            )
            for issue in issues:
                report.add_issue(issue)
        
        # 检查太靠近边缘
        for field in normalized_fields:
            issues = self.detect_too_close_to_edge(
                field, page_width, page_height, margin_threshold
            )
            for issue in issues:
                report.add_issue(issue)
        
        # 检查二维码遮挡
        issues = self.detect_qr_overlap(normalized_fields)
        for issue in issues:
            report.add_issue(issue)
        
        # 检查条形码遮挡
        issues = self.detect_barcode_overlap(normalized_fields)
        for issue in issues:
            report.add_issue(issue)
        
        # 检查字段重叠
        issues = self.detect_field_overlap(normalized_fields)
        for issue in issues:
            report.add_issue(issue)
        
        # 2. 动态检查（依赖业务数据）
        for data in business_data_list:
            # 检查必填字段
            issues = self.detect_missing_required(template, data)
            for issue in issues:
                report.add_issue(issue)
            
            # 检查空值
            issues = self.detect_empty_values(template, data)
            for issue in issues:
                report.add_issue(issue)
        
        return report
