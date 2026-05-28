import json
from datetime import datetime
from typing import List
import os

from .models import TrialRunReport, SKUResult, DataQualityStatus


class Reporter:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_all(self, report: TrialRunReport) -> dict:
        terminal_summary = self._print_terminal_summary(report)
        json_path = self._save_machine_readable(report)
        text_path = self._save_human_report(report)
        review_path = self._save_manual_review_template(report)
        
        return {
            "terminal_summary": terminal_summary,
            "json_file": json_path,
            "text_report": text_path,
            "review_template": review_path
        }
    
    def _print_terminal_summary(self, report: TrialRunReport) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("  库存安全量试算报告 - 终端摘要")
        lines.append("=" * 70)
        lines.append(f"  运行ID: {report.run_id}")
        lines.append(f"  运行时间: {report.run_date.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  整体状态: {self._format_status(report.overall_status)}")
        lines.append("-" * 70)
        lines.append(f"  处理SKU数: {len(report.sku_results)}")
        lines.append(f"  异常总数: {report.total_anomalies}")
        lines.append(f"  严重异常: {report.critical_anomalies}")
        lines.append(f"  需人工核对: {len(report.manual_review_required)} 个SKU")
        lines.append("-" * 70)
        lines.append("")
        lines.append("  SKU明细:")
        lines.append("")
        
        for result in report.sku_results:
            lines.append(f"  SKU: {result.sku}")
            lines.append(f"    供应商: {result.supplier}")
            lines.append(f"    数据质量: {self._format_status(result.data_quality)}")
            lines.append(f"    日均需求: {result.demand_stats.mean_daily_demand:.1f} ± {result.demand_stats.std_daily_demand:.1f}")
            lines.append(f"    到货周期: {result.lead_time_stats.mean_lead_time_days:.1f} 天")
            lines.append(f"    服务水平: {result.safety_stock.service_level:.1%}")
            lines.append(f"    安全库存: {result.safety_stock.safety_stock_units} 件")
            lines.append(f"    再订货点: {result.safety_stock.reorder_point} 件")
            lines.append(f"    当前库存: {result.current_inventory} 件")
            lines.append(f"    缺货风险: {result.safety_stock.stockout_risk_percentage:.1f}%")
            lines.append(f"    行动建议: {self._format_action(result.recommended_action)}")
            if result.anomalies:
                lines.append(f"    异常数: {len(result.anomalies)}")
                for a in result.anomalies[:2]:
                    lines.append(f"      - [{a.severity.upper()}] {a.description}")
            lines.append("")
        
        if report.manual_review_required:
            lines.append("-" * 70)
            lines.append("  需人工核对的SKU:")
            for sku in report.manual_review_required:
                lines.append(f"    - {sku}")
            lines.append("")
        
        lines.append("=" * 70)
        
        summary = "\n".join(lines)
        print(summary)
        return summary
    
    def _format_status(self, status: DataQualityStatus) -> str:
        status_map = {
            DataQualityStatus.CLEAN: "✓ 数据良好",
            DataQualityStatus.WARNING: "⚠ 有警告",
            DataQualityStatus.ERROR: "✗ 有错误",
        }
        return status_map.get(status, str(status))
    
    def _format_action(self, action: str) -> str:
        action_map = {
            "URGENT_REORDER": "紧急补货",
            "PLACE_ORDER_SOON": "尽快下单",
            "MONITOR_CLOSELY": "密切关注",
            "MAINTAIN_CURRENT": "维持现状",
            "REDUCE_INVENTORY": "减少库存",
            "REQUIRES_MANUAL_REVIEW": "需人工复核",
        }
        return action_map.get(action, action)
    
    def _save_machine_readable(self, report: TrialRunReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"safety_stock_report_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        
        print(f"  机器可读结果已保存: {filepath}")
        return filepath
    
    def _save_human_report(self, report: TrialRunReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"safety_stock_report_{timestamp}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        lines = []
        lines.append("=" * 80)
        lines.append("                   库存安全量试算报告")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"报告编号: {report.run_id}")
        lines.append(f"生成时间: {report.run_date.strftime('%Y年%m月%d日 %H:%M:%S')}")
        lines.append("")
        lines.append("=" * 80)
        lines.append("一、整体概览")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"  1. 处理SKU总数: {len(report.sku_results)}")
        lines.append(f"  2. 数据质量状态: {self._format_status(report.overall_status)}")
        lines.append(f"  3. 检测到异常: {report.total_anomalies} 个")
        lines.append(f"     - 严重异常: {report.critical_anomalies} 个")
        lines.append(f"     - 警告: {report.total_anomalies - report.critical_anomalies} 个")
        lines.append(f"  4. 需人工复核: {len(report.manual_review_required)} 个SKU")
        lines.append("")
        
        lines.append("=" * 80)
        lines.append("二、各SKU详细分析")
        lines.append("=" * 80)
        
        for idx, result in enumerate(report.sku_results, 1):
            lines.append("")
            lines.append(f"  {idx}. SKU: {result.sku}")
            lines.append("-" * 50)
            lines.append(f"     供应商: {result.supplier}")
            lines.append(f"     数据质量: {self._format_status(result.data_quality)}")
            lines.append("")
            lines.append("     【需求统计】")
            ds = result.demand_stats
            lines.append(f"       - 日均需求: {ds.mean_daily_demand:.2f} 件")
            lines.append(f"       - 需求波动(标准差): ±{ds.std_daily_demand:.2f} 件")
            lines.append(f"       - 变异系数(CV): {ds.cv:.4f}")
            lines.append(f"       - 数据样本量: {ds.data_points} 天")
            lines.append(f"       - 销量范围: {ds.min_demand} ~ {ds.max_demand} 件/天")
            lines.append("")
            lines.append("     【到货周期统计】")
            lts = result.lead_time_stats
            lines.append(f"       - 平均周期: {lts.mean_lead_time_days:.1f} 天")
            lines.append(f"       - 周期波动: ±{lts.std_lead_time_days:.2f} 天")
            lines.append(f"       - 周期范围: {lts.min_lead_time_days} ~ {lts.max_lead_time_days} 天")
            lines.append(f"       - 数据样本量: {lts.data_points} 次")
            lines.append("")
            lines.append("     【安全库存计算】")
            ss = result.safety_stock
            lines.append(f"       - 目标服务水平: {ss.service_level:.1%}")
            lines.append(f"       - Z值: {ss.z_score}")
            lines.append(f"       - 备货周期需求: {ss.average_demand_during_lead_time:.1f} 件")
            lines.append(f"       - 安全库存量: {ss.safety_stock_units} 件")
            lines.append(f"       - 再订货点(ROP): {ss.reorder_point} 件")
            lines.append(f"       - 缺货风险: {ss.stockout_risk_percentage:.1f}%")
            lines.append(f"       - 订单满足率: {ss.fill_rate_percentage:.1f}%")
            lines.append("")
            lines.append("     【敏感性分析 (服务水平 vs 安全库存)】")
            for p in result.sensitivity.points:
                bar = "█" * int(p.safety_stock_units / max(1, result.sensitivity.points[-1].safety_stock_units) * 30)
                lines.append(f"       {p.service_level:6.1%} | {bar} {p.safety_stock_units:4d} 件 (+{p.marginal_increase})")
            lines.append("")
            lines.append("     【库存状态】")
            lines.append(f"       - 当前库存: {result.current_inventory} 件")
            lines.append(f"       - 建议行动: {self._format_action(result.recommended_action)}")
            lines.append("")
            
            if result.anomalies:
                lines.append("     【数据异常】")
                for a in result.anomalies:
                    icon = "✗" if a.severity == "critical" else "!"
                    lines.append(f"       {icon} [{a.severity.upper()}] {a.description}")
                    lines.append(f"          详情: {json.dumps(a.affected_data, ensure_ascii=False)}")
                lines.append("")
        
        if report.manual_review_required:
            lines.append("=" * 80)
            lines.append("三、需人工核对清单")
            lines.append("=" * 80)
            lines.append("")
            for sku in report.manual_review_required:
                lines.append(f"  - {sku}")
            lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        print(f"  人工阅读报告已保存: {filepath}")
        return filepath
    
    def _save_manual_review_template(self, report: TrialRunReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"manual_review_{timestamp}.md"
        filepath = os.path.join(self.output_dir, filename)
        
        lines = []
        lines.append("# 库存安全量试算 - 人工核对表")
        lines.append("")
        lines.append(f"**运行ID**: {report.run_id}  ")
        lines.append(f"**生成时间**: {report.run_date.strftime('%Y-%m-%d %H:%M:%S')}  ")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 核对说明")
        lines.append("")
        lines.append("请采购经理对以下SKU进行人工复核，在「核对结果」栏填写：")
        lines.append("- `确认` - 数据无误，可采纳建议")
        lines.append("- `修正数据` - 需要修正原始数据后重新计算")
        lines.append("- `特殊调整` - 根据业务经验调整参数")
        lines.append("- `暂缓处理` - 需要进一步调研")
        lines.append("")
        
        lines.append("## 需核对SKU清单")
        lines.append("")
        lines.append("| SKU | 供应商 | 异常类型 | 问题简述 | 当前库存 | 建议安全库存 | 核对结果 | 备注 |")
        lines.append("|-----|--------|----------|----------|----------|--------------|----------|------|")
        
        for result in report.sku_results:
            if result.anomalies:
                anomaly_types = ", ".join([a.anomaly_type.value for a in result.anomalies[:2]])
                issue_desc = result.anomalies[0].description[:30] + "..." if len(result.anomalies[0].description) > 30 else result.anomalies[0].description
                lines.append(f"| {result.sku} | {result.supplier} | {anomaly_types} | {issue_desc} | {result.current_inventory} | {result.safety_stock.safety_stock_units} | □ | |")
        
        lines.append("")
        lines.append("## 详细核对记录")
        lines.append("")
        
        for result in report.sku_results:
            if result.anomalies:
                lines.append(f"### SKU: {result.sku}")
                lines.append("")
                lines.append(f"- **供应商**: {result.supplier}")
                lines.append(f"- **当前库存**: {result.current_inventory}")
                lines.append(f"- **建议安全库存**: {result.safety_stock.safety_stock_units}")
                lines.append(f"- **建议再订货点**: {result.safety_stock.reorder_point}")
                lines.append("")
                lines.append("#### 检测到的异常")
                lines.append("")
                for a in result.anomalies:
                    lines.append(f"1. **{a.anomaly_type.value}** ({a.severity})")
                    lines.append(f"   - {a.description}")
                    lines.append(f"   - 详情: `{json.dumps(a.affected_data, ensure_ascii=False)}`")
                    lines.append("")
                lines.append("#### 核对记录")
                lines.append("- [ ] 确认/修正数据")
                lines.append("- [ ] 调整服务水平: _____% (当前 {:.1%})".format(result.safety_stock.service_level))
                lines.append("- [ ] 人工调整安全库存: _____ 件 (建议 {})".format(result.safety_stock.safety_stock_units))
                lines.append("- 最终决策: _________________")
                lines.append("- 备注: _____________________")
                lines.append("")
                lines.append("---")
                lines.append("")
        
        lines.append("## 复核人签字")
        lines.append("")
        lines.append("- 复核人: _______________")
        lines.append("- 日期: _________________")
        lines.append("- 签名: _________________")
        lines.append("")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        print(f"  人工核对模板已保存: {filepath}")
        return filepath
