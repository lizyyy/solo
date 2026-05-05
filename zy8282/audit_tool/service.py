"""核心审计服务"""

from pathlib import Path
from typing import Optional

from .calculator import MetricCalculator
from .exporter import ReportExporter
from .models import (
    AuditContext,
    MetricRule,
    ValidationResult,
)
from .parsers import CSVParser, ReportParser, YAMLParser
from .validator import MetricValidator


class AuditService:
    """审计服务核心类"""
    
    def __init__(self):
        self.context: Optional[AuditContext] = None
        self._last_result: Optional[ValidationResult] = None
    
    def load_data(
        self,
        orders_path: Path,
        refunds_path: Path,
        labor_costs_path: Path,
        metric_rules_path: Path,
    ) -> None:
        """加载业务数据和规则"""
        orders = CSVParser.parse_orders(orders_path)
        refunds = CSVParser.parse_refunds(refunds_path)
        labor_costs = CSVParser.parse_labor_costs(labor_costs_path)
        metric_rules = YAMLParser.parse_metric_rules(metric_rules_path)
        
        if 'default' not in metric_rules:
            metric_rules['default'] = MetricRule(
                metric_name='default',
                display_name='默认规则',
                formula='',
                description='默认四舍五入规则',
                tolerance=0.01,
                rounding_method='ROUND_HALF_UP',
                decimal_places=2,
            )
        
        store_ids = list(set(o.store_id for o in orders))
        
        self.context = AuditContext(
            orders=orders,
            refunds=refunds,
            labor_costs=labor_costs,
            metric_rules=metric_rules,
            report_content=None,
            report_type='',
            store_ids=store_ids,
        )
    
    def load_report(self, report_path: Path) -> None:
        """加载待验证的报告"""
        if not self.context:
            raise RuntimeError("请先调用 load_data 加载业务数据")
        
        file_ext = report_path.suffix.lower()
        
        if file_ext == '.md':
            report_content = ReportParser.parse_markdown(report_path)
            report_type = 'markdown'
        elif file_ext == '.json':
            report_content = ReportParser.parse_json(report_path)
            report_type = 'json'
        else:
            raise ValueError(f"不支持的报告格式: {file_ext}，仅支持 .md 和 .json")
        
        self.context.report_content = report_content
        self.context.report_type = report_type
    
    def validate(self) -> ValidationResult:
        """执行验证"""
        if not self.context:
            raise RuntimeError("请先调用 load_data 加载业务数据")
        
        if not self.context.report_content:
            raise RuntimeError("请先调用 load_report 加载待验证的报告")
        
        calculator = MetricCalculator(self.context)
        calculated_metrics = calculator.calculate_all()
        
        report_metrics = self.context.report_content.get('metrics', [])
        report_store_metrics = self.context.report_content.get('store_metrics', {})
        
        validator = MetricValidator(self.context)
        result = validator.validate(
            calculated_metrics, 
            report_metrics,
            report_store_metrics
        )
        
        self._last_result = result
        return result
    
    def audit(
        self,
        orders_path: Path,
        refunds_path: Path,
        labor_costs_path: Path,
        metric_rules_path: Path,
        report_path: Path,
    ) -> ValidationResult:
        """执行完整的审计流程"""
        self.load_data(orders_path, refunds_path, labor_costs_path, metric_rules_path)
        self.load_report(report_path)
        return self.validate()
    
    def export_markdown_report(
        self,
        output_path: Path,
        result: Optional[ValidationResult] = None,
    ) -> Path:
        """导出 Markdown 格式的差异报告"""
        if result is None:
            result = self._last_result
        
        if result is None:
            raise RuntimeError("请先执行验证，或提供验证结果")
        
        context_info = {}
        if self.context:
            context_info = {
                'store_count': len(self.context.store_ids),
                'order_count': len(self.context.orders),
                'refund_count': len(self.context.refunds),
                'report_type': self.context.report_type,
            }
        
        return ReportExporter.export_markdown(result, output_path, context_info)
    
    def export_csv_report(
        self,
        output_path: Path,
        result: Optional[ValidationResult] = None,
    ) -> Path:
        """导出 CSV 格式的问题明细报告"""
        if result is None:
            result = self._last_result
        
        if result is None:
            raise RuntimeError("请先执行验证，或提供验证结果")
        
        return ReportExporter.export_csv(result, output_path)
    
    def export_metrics_comparison(
        self,
        output_path: Path,
        result: Optional[ValidationResult] = None,
    ) -> Path:
        """导出指标对比 CSV"""
        if result is None:
            result = self._last_result
        
        if result is None:
            raise RuntimeError("请先执行验证，或提供验证结果")
        
        return ReportExporter.export_metrics_csv(
            result.calculated_metrics,
            result.report_metrics,
            output_path
        )
    
    def get_statistics(self) -> dict:
        """获取统计信息"""
        if not self.context:
            return {}
        
        stats = {
            'store_count': len(self.context.store_ids),
            'store_ids': self.context.store_ids,
            'order_count': len(self.context.orders),
            'refund_count': len(self.context.refunds),
            'labor_record_count': len(self.context.labor_costs),
            'metric_rule_count': len(self.context.metric_rules),
            'report_type': self.context.report_type,
        }
        
        if self._last_result:
            stats['validation'] = {
                'is_valid': self._last_result.is_valid,
                'total_issues': self._last_result.total_issues,
                'critical_issues': self._last_result.critical_issues,
                'warning_issues': self._last_result.warning_issues,
            }
        
        return stats
