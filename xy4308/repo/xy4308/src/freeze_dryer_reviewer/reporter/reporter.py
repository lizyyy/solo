"""报告生成器 - 支持Markdown、CSV、JSON导出"""
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import json
import csv

from ..models import BatchData
from ..rules import RuleCheckResult, RuleEngine, RuleSeverity


class Reporter(ABC):
    """报告生成器基类"""
    
    def __init__(self, batch: Optional[BatchData] = None):
        self.batch = batch
    
    @abstractmethod
    def generate(self) -> str:
        """生成报告内容"""
        pass
    
    @abstractmethod
    def save(self, file_path: Path) -> None:
        """保存报告到文件"""
        pass


class MarkdownReporter(Reporter):
    """Markdown报告生成器"""
    
    def __init__(self, batch: Optional[BatchData] = None, 
                 check_results: Optional[List[RuleCheckResult]] = None,
                 simulation_results: Optional[Dict[str, Any]] = None):
        super().__init__(batch)
        self.check_results = check_results
        self.simulation_results = simulation_results
    
    def generate(self) -> str:
        """生成Markdown报告"""
        lines = []
        
        lines.append("# 冻干曲线复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if self.batch:
            lines.append("## 批次基本信息")
            lines.append("")
            lines.append(f"- **批次号**: {self.batch.metadata.batch_id}")
            lines.append(f"- **产品名称**: {self.batch.metadata.product_name}")
            lines.append(f"- **设备编号**: {self.batch.metadata.equipment_id}")
            
            if self.batch.metadata.start_time:
                lines.append(f"- **开始时间**: {self.batch.metadata.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
            if self.batch.metadata.end_time:
                lines.append(f"- **结束时间**: {self.batch.metadata.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            if self.batch.total_duration_hours:
                lines.append(f"- **总时长**: {self.batch.total_duration_hours:.2f} 小时")
            
            if self.batch.recipe:
                lines.append("")
                lines.append("### 配方信息")
                lines.append("")
                lines.append(f"- **批次体积**: {self.batch.recipe.batch_size_ml} ml")
                lines.append(f"- **西林瓶数量**: {self.batch.recipe.vial_count}")
                lines.append(f"- **灌装体积**: {self.batch.recipe.fill_volume_ml} ml/瓶")
                if self.batch.recipe.collapse_temp_c is not None:
                    lines.append(f"- **塌陷温度**: {self.batch.recipe.collapse_temp_c} °C")
                if self.batch.recipe.eutectic_temp_c is not None:
                    lines.append(f"- **共晶温度**: {self.batch.recipe.eutectic_temp_c} °C")
            
            lines.append("")
            lines.append("## 传感器数据概览")
            lines.append("")
            
            data_stats = []
            
            if self.batch.shelf_temp:
                stats = self.batch.shelf_temp.get_stats()
                data_stats.append({
                    "传感器": "搁板温度",
                    "数据点": stats["count"],
                    "最小值": f"{stats.get('min', 'N/A'):.2f} °C",
                    "最大值": f"{stats.get('max', 'N/A'):.2f} °C",
                    "平均值": f"{stats.get('mean', 'N/A'):.2f} °C",
                })
            
            if self.batch.product_temp:
                stats = self.batch.product_temp.get_stats()
                data_stats.append({
                    "传感器": "产品温度",
                    "数据点": stats["count"],
                    "最小值": f"{stats.get('min', 'N/A'):.2f} °C",
                    "最大值": f"{stats.get('max', 'N/A'):.2f} °C",
                    "平均值": f"{stats.get('mean', 'N/A'):.2f} °C",
                })
            
            if self.batch.vacuum:
                stats = self.batch.vacuum.get_stats()
                data_stats.append({
                    "传感器": "腔体真空",
                    "数据点": stats["count"],
                    "最小值": f"{stats.get('min', 'N/A'):.2f} mTorr",
                    "最大值": f"{stats.get('max', 'N/A'):.2f} mTorr",
                    "平均值": f"{stats.get('mean', 'N/A'):.2f} mTorr",
                })
            
            if self.batch.moisture and self.batch.moisture.values:
                stats = self.batch.moisture.get_stats()
                data_stats.append({
                    "传感器": "残余水分",
                    "数据点": stats["count"],
                    "最小值": f"{stats.get('min', 'N/A'):.2f} %",
                    "最大值": f"{stats.get('max', 'N/A'):.2f} %",
                    "平均值": f"{stats.get('mean', 'N/A'):.2f} %",
                })
            
            if data_stats:
                lines.append("| 传感器 | 数据点 | 最小值 | 最大值 | 平均值 |")
                lines.append("|--------|--------|--------|--------|--------|")
                for stat in data_stats:
                    lines.append(f"| {stat['传感器']} | {stat['数据点']} | {stat['最小值']} | {stat['最大值']} | {stat['平均值']} |")
            
            lines.append("")
        
        if self.check_results:
            lines.append("## 工艺规则检查结果")
            lines.append("")
            
            critical_issues = [r for r in self.check_results if r.severity == RuleSeverity.CRITICAL and not r.passed]
            warning_issues = [r for r in self.check_results if r.severity == RuleSeverity.WARNING and not r.passed]
            
            if critical_issues:
                lines.append(f"### ⚠️ 严重问题 ({len(critical_issues)}个)")
                lines.append("")
                for issue in critical_issues:
                    lines.append(f"#### {issue.rule_name}")
                    lines.append("")
                    lines.append(f"**状态**: ❌ 未通过")
                    lines.append(f"**描述**: {issue.message}")
                    lines.append("")
                    
                    if issue.occurrences:
                        lines.append("**发生情况**:")
                        lines.append("")
                        for occ in issue.occurrences[:5]:
                            lines.append(f"- {occ.get('message', '检测到异常')}")
                        if len(issue.occurrences) > 5:
                            lines.append(f"- ... 等 {len(issue.occurrences)} 处异常")
                        lines.append("")
                    
                    if issue.recommendations:
                        lines.append("**建议**:")
                        lines.append("")
                        for rec in issue.recommendations:
                            lines.append(f"- {rec}")
                        lines.append("")
            
            if warning_issues:
                lines.append(f"### ⚡ 警告 ({len(warning_issues)}个)")
                lines.append("")
                for issue in warning_issues:
                    lines.append(f"#### {issue.rule_name}")
                    lines.append("")
                    lines.append(f"**状态**: ⚠️ 警告")
                    lines.append(f"**描述**: {issue.message}")
                    lines.append("")
                    
                    if issue.recommendations:
                        lines.append("**建议**:")
                        lines.append("")
                        for rec in issue.recommendations:
                            lines.append(f"- {rec}")
                        lines.append("")
            
            passed_checks = [r for r in self.check_results if r.passed]
            if passed_checks:
                lines.append(f"### ✅ 通过检查 ({len(passed_checks)}个)")
                lines.append("")
                for check in passed_checks:
                    lines.append(f"- **{check.rule_name}**: {check.message}")
                lines.append("")
        
        if self.simulation_results:
            lines.append("## 模拟计算结果")
            lines.append("")
            
            if "sublimation" in self.simulation_results:
                sub_res = self.simulation_results["sublimation"]
                lines.append("### 升华前沿估算")
                lines.append("")
                lines.append(f"- **升华速率**: {sub_res.get('estimated_sublimation_rate_g_h', 0):.2f} g/h")
                lines.append(f"- **剩余冰量**: {sub_res.get('estimated_remaining_ice_mass_g', 0):.2f} g")
                lines.append(f"- **升华界面位置**: {sub_res.get('estimated_subline_position_mm', 0):.2f} mm")
                lines.append(f"- **一次干燥完成度**: {sub_res.get('estimated_primary_drying_completion_pct', 0):.1f} %")
                lines.append("")
            
            if "moisture" in self.simulation_results:
                moist_res = self.simulation_results["moisture"]
                lines.append("### 残余水分估算")
                lines.append("")
                lines.append(f"- **估算残余水分**: {moist_res.get('estimated_residual_moisture_pct', 0):.2f} %")
                lines.append(f"- **结合水比例**: {moist_res.get('estimated_bound_water_pct', 0):.2f} %")
                lines.append(f"- **游离水比例**: {moist_res.get('estimated_free_water_pct', 0):.2f} %")
                lines.append(f"- **干燥速率**: {moist_res.get('estimated_drying_rate_pct_h', 0):.3f} %/h")
                lines.append("")
        
        if self.batch and self.batch.validation_errors:
            lines.append("## 数据导入警告")
            lines.append("")
            for error in self.batch.validation_errors:
                lines.append(f"- {error}")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由冻干曲线复盘器自动生成*")
        
        return "\n".join(lines)
    
    def save(self, file_path: Path) -> None:
        """保存报告到文件"""
        content = self.generate()
        file_path.write_text(content, encoding="utf-8")


class CSVReporter(Reporter):
    """CSV报告生成器"""
    
    def __init__(self, batch: Optional[BatchData] = None,
                 check_results: Optional[List[RuleCheckResult]] = None,
                 simulation_results: Optional[Dict[str, Any]] = None):
        super().__init__(batch)
        self.check_results = check_results
        self.simulation_results = simulation_results
    
    def generate(self) -> List[List[str]]:
        """生成CSV数据（返回行列表）"""
        rows = []
        
        rows.append(["冻干曲线复盘报告 - 导出数据"])
        rows.append(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        rows.append([])
        
        if self.batch:
            rows.append(["=== 批次基本信息 ==="])
            rows.append(["批次号", self.batch.metadata.batch_id])
            rows.append(["产品名称", self.batch.metadata.product_name])
            rows.append(["设备编号", self.batch.metadata.equipment_id])
            if self.batch.metadata.start_time:
                rows.append(["开始时间", self.batch.metadata.start_time.strftime('%Y-%m-%d %H:%M:%S')])
            if self.batch.metadata.end_time:
                rows.append(["结束时间", self.batch.metadata.end_time.strftime('%Y-%m-%d %H:%M:%S')])
            if self.batch.total_duration_hours:
                rows.append(["总时长(小时)", f"{self.batch.total_duration_hours:.2f}"])
            rows.append([])
            
            if self.batch.shelf_temp:
                stats = self.batch.shelf_temp.get_stats()
                rows.append(["=== 搁板温度数据 ==="])
                rows.append(["数据点", stats["count"]])
                rows.append(["最小值(°C)", f"{stats.get('min', ''):.2f}"])
                rows.append(["最大值(°C)", f"{stats.get('max', ''):.2f}"])
                rows.append(["平均值(°C)", f"{stats.get('mean', ''):.2f}"])
                rows.append([])
            
            if self.batch.product_temp:
                stats = self.batch.product_temp.get_stats()
                rows.append(["=== 产品温度数据 ==="])
                rows.append(["数据点", stats["count"]])
                rows.append(["最小值(°C)", f"{stats.get('min', ''):.2f}"])
                rows.append(["最大值(°C)", f"{stats.get('max', ''):.2f}"])
                rows.append(["平均值(°C)", f"{stats.get('mean', ''):.2f}"])
                rows.append([])
            
            if self.batch.vacuum:
                stats = self.batch.vacuum.get_stats()
                rows.append(["=== 腔体真空数据 ==="])
                rows.append(["数据点", stats["count"]])
                rows.append(["最小值(mTorr)", f"{stats.get('min', ''):.2f}"])
                rows.append(["最大值(mTorr)", f"{stats.get('max', ''):.2f}"])
                rows.append(["平均值(mTorr)", f"{stats.get('mean', ''):.2f}"])
                rows.append([])
        
        if self.check_results:
            rows.append(["=== 工艺规则检查结果 ==="])
            rows.append(["规则名称", "状态", "严重程度", "描述", "异常数量"])
            
            for result in self.check_results:
                status = "通过" if result.passed else "未通过"
                severity_map = {
                    RuleSeverity.CRITICAL: "严重",
                    RuleSeverity.WARNING: "警告",
                    RuleSeverity.INFO: "信息"
                }
                severity = severity_map.get(result.severity, "未知")
                occ_count = len(result.occurrences) if result.occurrences else 0
                
                rows.append([
                    result.rule_name,
                    status,
                    severity,
                    result.message,
                    occ_count
                ])
            
            rows.append([])
            
            for result in self.check_results:
                if not result.passed and result.occurrences:
                    rows.append([f"=== {result.rule_name} - 异常详情 ==="])
                    rows.append(["序号", "时间", "描述", "详情"])
                    
                    for i, occ in enumerate(result.occurrences[:10], 1):
                        time_str = occ.get("time", occ.get("start_time", ""))
                        desc = occ.get("message", "检测到异常")
                        detail = ""
                        if "duration_minutes" in occ:
                            detail = f"持续{occ['duration_minutes']:.1f}分钟"
                        if "fluctuation_mtorr" in occ:
                            detail = f"波动{occ['fluctuation_mtorr']:.1f}mTorr"
                        if "max_temp_c" in occ:
                            detail = f"最高{occ['max_temp_c']:.1f}°C"
                        
                        rows.append([str(i), time_str, desc, detail])
                    
                    if len(result.occurrences) > 10:
                        rows.append(["", "", f"... 还有 {len(result.occurrences) - 10} 处异常", ""])
                    
                    rows.append([])
        
        if self.simulation_results:
            rows.append(["=== 模拟计算结果 ==="])
            
            if "sublimation" in self.simulation_results:
                sub_res = self.simulation_results["sublimation"]
                rows.append(["--- 升华前沿估算 ---"])
                rows.append(["升华速率(g/h)", f"{sub_res.get('estimated_sublimation_rate_g_h', 0):.2f}"])
                rows.append(["剩余冰量(g)", f"{sub_res.get('estimated_remaining_ice_mass_g', 0):.2f}"])
                rows.append(["升华界面位置(mm)", f"{sub_res.get('estimated_subline_position_mm', 0):.2f}"])
                rows.append(["一次干燥完成度(%)", f"{sub_res.get('estimated_primary_drying_completion_pct', 0):.1f}"])
            
            if "moisture" in self.simulation_results:
                moist_res = self.simulation_results["moisture"]
                rows.append(["--- 残余水分估算 ---"])
                rows.append(["估算残余水分(%)", f"{moist_res.get('estimated_residual_moisture_pct', 0):.2f}"])
                rows.append(["结合水比例(%)", f"{moist_res.get('estimated_bound_water_pct', 0):.2f}"])
                rows.append(["游离水比例(%)", f"{moist_res.get('estimated_free_water_pct', 0):.2f}"])
                rows.append(["干燥速率(%/h)", f"{moist_res.get('estimated_drying_rate_pct_h', 0):.3f}"])
            
            rows.append([])
        
        return rows
    
    def save(self, file_path: Path) -> None:
        """保存报告到文件"""
        rows = self.generate()
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerows(rows)


class JSONReporter(Reporter):
    """JSON报告生成器"""
    
    def __init__(self, batch: Optional[BatchData] = None,
                 check_results: Optional[List[RuleCheckResult]] = None,
                 simulation_results: Optional[Dict[str, Any]] = None):
        super().__init__(batch)
        self.check_results = check_results
        self.simulation_results = simulation_results
    
    def generate(self) -> Dict[str, Any]:
        """生成JSON数据"""
        report = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "report_type": "freeze_dryer_review"
            }
        }
        
        if self.batch:
            batch_data = {
                "metadata": {
                    "batch_id": self.batch.metadata.batch_id,
                    "product_name": self.batch.metadata.product_name,
                    "equipment_id": self.batch.metadata.equipment_id,
                    "operator": self.batch.metadata.operator,
                    "start_time": self.batch.metadata.start_time.isoformat() if self.batch.metadata.start_time else None,
                    "end_time": self.batch.metadata.end_time.isoformat() if self.batch.metadata.end_time else None,
                    "duration_hours": self.batch.total_duration_hours,
                },
                "sensor_stats": {}
            }
            
            if self.batch.recipe:
                batch_data["recipe"] = {
                    "product_name": self.batch.recipe.product_name,
                    "batch_size_ml": self.batch.recipe.batch_size_ml,
                    "vial_count": self.batch.recipe.vial_count,
                    "fill_volume_ml": self.batch.recipe.fill_volume_ml,
                    "collapse_temp_c": self.batch.recipe.collapse_temp_c,
                    "eutectic_temp_c": self.batch.recipe.eutectic_temp_c,
                    "formulation": self.batch.recipe.formulation,
                    "concentration_mg_ml": self.batch.recipe.concentration_mg_ml,
                }
            
            if self.batch.shelf_temp:
                batch_data["sensor_stats"]["shelf_temp"] = self.batch.shelf_temp.get_stats()
            
            if self.batch.product_temp:
                batch_data["sensor_stats"]["product_temp"] = self.batch.product_temp.get_stats()
            
            if self.batch.vacuum:
                batch_data["sensor_stats"]["vacuum"] = self.batch.vacuum.get_stats()
            
            if self.batch.moisture:
                batch_data["sensor_stats"]["moisture"] = self.batch.moisture.get_stats()
            
            if self.batch.validation_errors:
                batch_data["validation_errors"] = self.batch.validation_errors
            
            report["batch_data"] = batch_data
        
        if self.check_results:
            rule_engine = RuleEngine()
            summary = rule_engine.generate_summary(self.check_results)
            report["rule_checks"] = summary
        
        if self.simulation_results:
            report["simulation_results"] = {}
            
            if "sublimation" in self.simulation_results:
                sub_res = self.simulation_results["sublimation"]
                report["simulation_results"]["sublimation_front"] = sub_res.to_dict() if hasattr(sub_res, 'to_dict') else sub_res
            
            if "moisture" in self.simulation_results:
                moist_res = self.simulation_results["moisture"]
                report["simulation_results"]["residual_moisture"] = moist_res.to_dict() if hasattr(moist_res, 'to_dict') else moist_res
        
        return report
    
    def save(self, file_path: Path) -> None:
        """保存报告到文件"""
        data = self.generate()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)


class ReportGenerator:
    """报告生成器 - 统一接口"""
    
    def __init__(self, batch: Optional[BatchData] = None):
        self.batch = batch
        self.check_results: Optional[List[RuleCheckResult]] = None
        self.simulation_results: Dict[str, Any] = {}
    
    def set_check_results(self, results: List[RuleCheckResult]):
        """设置规则检查结果"""
        self.check_results = results
    
    def set_simulation_results(self, key: str, results: Any):
        """设置模拟计算结果"""
        self.simulation_results[key] = results
    
    def generate_markdown(self) -> str:
        """生成Markdown报告"""
        reporter = MarkdownReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        return reporter.generate()
    
    def generate_csv(self) -> List[List[str]]:
        """生成CSV报告"""
        reporter = CSVReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        return reporter.generate()
    
    def generate_json(self) -> Dict[str, Any]:
        """生成JSON报告"""
        reporter = JSONReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        return reporter.generate()
    
    def save_markdown(self, file_path: Path):
        """保存Markdown报告"""
        reporter = MarkdownReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        reporter.save(file_path)
    
    def save_csv(self, file_path: Path):
        """保存CSV报告"""
        reporter = CSVReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        reporter.save(file_path)
    
    def save_json(self, file_path: Path):
        """保存JSON报告"""
        reporter = JSONReporter(
            batch=self.batch,
            check_results=self.check_results,
            simulation_results=self.simulation_results if self.simulation_results else None
        )
        reporter.save(file_path)
