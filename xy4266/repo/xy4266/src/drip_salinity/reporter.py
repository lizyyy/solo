"""报告生成模块 - 生成Markdown、CSV、JSON格式的报告"""

from dataclasses import asdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

from .config import ProjectConfig
from .calculator import (
    SaltTrend, FlushingRequirement, RiskLevel,
    DailySaltBalance, MultiBedCalculator
)
from .storage import StorageManager


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, storage: StorageManager, config: ProjectConfig):
        """
        初始化报告生成器
        
        Args:
            storage: 存储管理器
            config: 项目配置
        """
        self.storage = storage
        self.config = config
    
    def generate_markdown_report(self,
                                  trends: Dict[str, SaltTrend],
                                  flushing_forecasts: Dict[str, FlushingRequirement],
                                  calculations: List[DailySaltBalance]) -> str:
        """
        生成Markdown格式的报告
        
        Args:
            trends: 各畦的趋势分析
            flushing_forecasts: 各畦的冲洗预测
            calculations: 盐平衡计算结果
            
        Returns:
            Markdown格式字符串
        """
        now = datetime.now()
        
        # 统计数据
        total_beds = len(trends)
        danger_beds = [t for t in trends.values() if t.risk_level == RiskLevel.DANGER]
        warning_beds = [t for t in trends.values() if t.risk_level == RiskLevel.WARNING]
        safe_beds = [t for t in trends.values() if t.risk_level == RiskLevel.SAFE]
        
        # 需要立即冲洗的畦
        urgent_flush = [f for f in flushing_forecasts.values() 
                        if f.urgency in ["立即", "1天内", "2天内", "3天内"]]
        
        # 构建Markdown
        md_lines = []
        
        # 标题
        md_lines.append(f"# 滴灌盐分回算报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**项目名称**: {self.config.project_name}")
        md_lines.append(f"**作物类型**: {self.config.crop.crop_type.value}")
        md_lines.append("")
        
        # 概要
        md_lines.append("## 📊 概要")
        md_lines.append("")
        md_lines.append(f"- **总畦数**: {total_beds}")
        md_lines.append(f"- **🔴 危险状态**: {len(danger_beds)} 畦")
        md_lines.append(f"- **🟡 预警状态**: {len(warning_beds)} 畦")
        md_lines.append(f"- **🟢 安全状态**: {len(safe_beds)} 畦")
        md_lines.append(f"- **💧 需要冲洗**: {len(urgent_flush)} 畦")
        md_lines.append("")
        
        # 风险分布
        if danger_beds or warning_beds:
            md_lines.append("## ⚠️ 风险畦清单")
            md_lines.append("")
            
            if danger_beds:
                md_lines.append("### 🔴 危险状态畦")
                md_lines.append("")
                md_lines.append("| 畦号 | 当前EC | 趋势 | 距危险天数 |")
                md_lines.append("|------|--------|------|-----------|")
                for t in danger_beds:
                    md_lines.append(f"| {t.bed_id} | {t.current_ec:.2f} mS/cm | {t.ec_trend} | - |")
                md_lines.append("")
            
            if warning_beds:
                md_lines.append("### 🟡 预警状态畦")
                md_lines.append("")
                md_lines.append("| 畦号 | 当前EC | 趋势 | 距危险天数 |")
                md_lines.append("|------|--------|------|-----------|")
                for t in warning_beds:
                    md_lines.append(f"| {t.bed_id} | {t.current_ec:.2f} mS/cm | {t.ec_trend} | {t.danger_days} 天 |")
                md_lines.append("")
        
        # 冲洗建议
        md_lines.append("## 💧 冲洗建议")
        md_lines.append("")
        
        if urgent_flush:
            md_lines.append("### 需要立即处理的畦")
            md_lines.append("")
            md_lines.append("| 畦号 | 当前EC | 目标EC | 紧急程度 | 建议冲洗量 | 冲洗液EC |")
            md_lines.append("|------|--------|--------|----------|-----------|----------|")
            for f in urgent_flush:
                md_lines.append(
                    f"| {f.bed_id} | {f.current_ec:.2f} | {f.target_ec:.2f} | {f.urgency} | "
                    f"{f.recommended_flush_volume:.1f} L | {f.recommended_flush_ec:.2f} mS/cm |"
                )
            md_lines.append("")
        
        # 未来3天预测
        md_lines.append("## 🔮 未来3天预测")
        md_lines.append("")
        md_lines.append("| 畦号 | 当前EC | 第1天预测 | 第2天预测 | 第3天预测 |")
        md_lines.append("|------|--------|-----------|-----------|-----------|")
        for bed_id, forecast in flushing_forecasts.items():
            md_lines.append(
                f"| {bed_id} | {forecast.current_ec:.2f} | "
                f"{forecast.day_1_forecast:.2f} | {forecast.day_2_forecast:.2f} | "
                f"{forecast.day_3_forecast:.2f} |"
            )
        md_lines.append("")
        
        # 阈值参考
        md_lines.append("## 📋 阈值参考")
        md_lines.append("")
        thresholds = self.config.thresholds
        md_lines.append(f"- **适宜EC范围**: {self.config.crop.expected_ec_range[0]:.1f} - {self.config.crop.expected_ec_range[1]:.1f} mS/cm")
        md_lines.append(f"- **预警EC阈值**: {thresholds.ec_warning_threshold:.1f} mS/cm")
        md_lines.append(f"- **危险EC阈值**: {thresholds.ec_danger_threshold:.1f} mS/cm")
        md_lines.append(f"- **正常排液率范围**: {thresholds.min_drainage_ratio:.0%} - {thresholds.max_drainage_ratio:.0%}")
        md_lines.append("")
        
        # 操作建议
        md_lines.append("## 💡 操作建议")
        md_lines.append("")
        
        if danger_beds:
            md_lines.append("### 🔴 紧急操作")
            md_lines.append("")
            md_lines.append("以下畦需要**立即冲洗**以降低盐分：")
            for t in danger_beds:
                forecast = flushing_forecasts.get(t.bed_id)
                if forecast:
                    md_lines.append(f"- **{t.bed_id}**: 当前EC {t.current_ec:.2f} mS/cm，建议冲洗量 {forecast.recommended_flush_volume:.1f} L/畦")
            md_lines.append("")
            md_lines.append("**冲洗操作要点**：")
            md_lines.append("1. 使用低EC水（建议 < 1.0 mS/cm）进行冲洗")
            md_lines.append("2. 采用大流量、短间隔的方式")
            md_lines.append("3. 监测排液EC，直到降至目标范围")
            md_lines.append("")
        
        if warning_beds:
            md_lines.append("### 🟡 预警操作")
            md_lines.append("")
            md_lines.append("以下畦盐分呈上升趋势，建议**加强监测**并考虑预防性冲洗：")
            for t in warning_beds:
                md_lines.append(f"- **{t.bed_id}**: 当前EC {t.current_ec:.2f} mS/cm，预计 {t.danger_days} 天后达到危险值")
            md_lines.append("")
            md_lines.append("**建议措施**：")
            md_lines.append("1. 适当增加灌溉量，提高排液率至30%以上")
            md_lines.append("2. 考虑降低灌溉EC 0.2-0.3 mS/cm")
            md_lines.append("3. 增加EC监测频率")
            md_lines.append("")
        
        if not danger_beds and not warning_beds:
            md_lines.append("### 🟢 日常管理")
            md_lines.append("")
            md_lines.append("所有畦盐分状态良好，继续保持现有管理方案：")
            md_lines.append("1. 维持当前灌溉策略")
            md_lines.append("2. 定期（每周1-2次）监测EC和排液率")
            md_lines.append("3. 记录异常情况并及时调整")
            md_lines.append("")
        
        # 附录
        md_lines.append("## 📎 附录")
        md_lines.append("")
        md_lines.append("### 术语说明")
        md_lines.append("")
        md_lines.append("- **EC值**: 电导率，反映溶液中盐分浓度")
        md_lines.append("- **排液率**: 排液量 / 灌溉量，正常值为10%-40%")
        md_lines.append("- **盐平衡**: 输入盐分 - 输出盐分，正值表示盐分累积")
        md_lines.append("")
        
        md_lines.append("---")
        md_lines.append(f"*报告由滴灌盐分回算器生成 | v0.1.0*")
        
        return "\n".join(md_lines)
    
    def generate_risk_csv(self,
                          trends: Dict[str, SaltTrend],
                          flushing_forecasts: Dict[str, FlushingRequirement]) -> Tuple[List[List[Any]], List[str]]:
        """
        生成风险畦CSV数据
        
        Args:
            trends: 趋势分析
            flushing_forecasts: 冲洗预测
            
        Returns:
            (数据行列表, 表头列表)
        """
        headers = [
            "畦号", "风险等级", "当前EC (mS/cm)", "EC趋势",
            "距预警天数", "距危险天数", "是否需要冲洗", "紧急程度",
            "建议冲洗量 (L)", "冲洗液EC (mS/cm)", "第1天预测", "第2天预测", "第3天预测"
        ]
        
        rows = []
        for bed_id in sorted(trends.keys()):
            trend = trends[bed_id]
            forecast = flushing_forecasts.get(bed_id)
            
            if forecast:
                row = [
                    bed_id,
                    trend.risk_level.value,
                    round(trend.current_ec, 2),
                    trend.ec_trend,
                    trend.warning_days if trend.warning_days < 999 else ">999",
                    trend.danger_days if trend.danger_days < 999 else ">999",
                    "是" if forecast.flushing_needed else "否",
                    forecast.urgency,
                    round(forecast.recommended_flush_volume, 1),
                    round(forecast.recommended_flush_ec, 2),
                    round(forecast.day_1_forecast, 2),
                    round(forecast.day_2_forecast, 2),
                    round(forecast.day_3_forecast, 2)
                ]
            else:
                row = [
                    bed_id,
                    trend.risk_level.value,
                    round(trend.current_ec, 2),
                    trend.ec_trend,
                    trend.warning_days if trend.warning_days < 999 else ">999",
                    trend.danger_days if trend.danger_days < 999 else ">999",
                    "否", "-", 0, 0, 0, 0, 0
                ]
            rows.append(row)
        
        return rows, headers
    
    def generate_history_csv(self, calculations: List[DailySaltBalance]) -> Tuple[List[List[Any]], List[str]]:
        """
        生成历史数据CSV
        
        Args:
            calculations: 盐平衡计算结果
            
        Returns:
            (数据行列表, 表头列表)
        """
        headers = [
            "日期", "畦号", "灌溉量 (L)", "灌溉EC (mS/cm)",
            "排液量 (L)", "排液EC (mS/cm)", "排液率",
            "基质含水率 (%)", "估算根区EC (mS/cm)",
            "净盐分变化 (meq)", "累积盐分变化 (meq)",
            "距上次冲洗天数"
        ]
        
        rows = []
        for calc in sorted(calculations, key=lambda x: (x.record_date, x.bed_id)):
            row = [
                calc.record_date.isoformat(),
                calc.bed_id,
                round(calc.input_irrigation_volume, 1),
                round(calc.input_irrigation_ec, 2),
                round(calc.output_drainage_volume, 1),
                round(calc.output_drainage_ec, 2),
                f"{calc.drainage_ratio:.1%}",
                round(calc.substrate_water_content, 1),
                round(calc.estimated_root_ec, 2),
                round(calc.net_salt_change, 1),
                round(calc.cumulative_salt_change, 1),
                calc.days_since_last_flush
            ]
            rows.append(row)
        
        return rows, headers
    
    def generate_audit_data(self,
                            trends: Dict[str, SaltTrend],
                            flushing_forecasts: Dict[str, FlushingRequirement],
                            calculations: List[DailySaltBalance]) -> Dict[str, Any]:
        """
        生成审计包数据
        
        Args:
            trends: 趋势分析
            flushing_forecasts: 冲洗预测
            calculations: 计算结果
            
        Returns:
            审计数据字典
        """
        now = datetime.now()
        
        # 转换趋势数据
        trends_data = {}
        for bed_id, trend in trends.items():
            trends_data[bed_id] = {
                'current_ec': trend.current_ec,
                'ec_trend': trend.ec_trend,
                'ec_change_rate': trend.ec_change_rate,
                'risk_level': trend.risk_level.value,
                'warning_days': trend.warning_days,
                'danger_days': trend.danger_days,
                'last_7_days_avg_change': trend.last_7_days_avg_change,
                'historical_ecs': [
                    {'date': d.isoformat(), 'ec': ec}
                    for d, ec in trend.historical_ecs
                ]
            }
        
        # 转换冲洗预测数据
        forecasts_data = {}
        for bed_id, forecast in flushing_forecasts.items():
            forecasts_data[bed_id] = {
                'current_ec': forecast.current_ec,
                'target_ec': forecast.target_ec,
                'ec_reduction_needed': forecast.ec_reduction_needed,
                'day_1_forecast': forecast.day_1_forecast,
                'day_2_forecast': forecast.day_2_forecast,
                'day_3_forecast': forecast.day_3_forecast,
                'flushing_needed': forecast.flushing_needed,
                'recommended_flush_volume': forecast.recommended_flush_volume,
                'recommended_flush_ec': forecast.recommended_flush_ec,
                'urgency': forecast.urgency,
                'risk_if_no_action': forecast.risk_if_no_action.value
            }
        
        # 转换计算结果
        calculations_data = [
            {
                'record_date': c.record_date.isoformat(),
                'bed_id': c.bed_id,
                'input_salt_mass': c.input_salt_mass,
                'input_irrigation_volume': c.input_irrigation_volume,
                'input_irrigation_ec': c.input_irrigation_ec,
                'output_salt_mass': c.output_salt_mass,
                'output_drainage_volume': c.output_drainage_volume,
                'output_drainage_ec': c.output_drainage_ec,
                'net_salt_change': c.net_salt_change,
                'drainage_ratio': c.drainage_ratio,
                'substrate_water_content': c.substrate_water_content,
                'estimated_root_ec': c.estimated_root_ec,
                'cumulative_salt_change': c.cumulative_salt_change,
                'days_since_last_flush': c.days_since_last_flush
            }
            for c in calculations
        ]
        
        # 统计数据
        total_beds = len(trends)
        danger_count = sum(1 for t in trends.values() if t.risk_level == RiskLevel.DANGER)
        warning_count = sum(1 for t in trends.values() if t.risk_level == RiskLevel.WARNING)
        safe_count = sum(1 for t in trends.values() if t.risk_level == RiskLevel.SAFE)
        flush_needed_count = sum(1 for f in flushing_forecasts.values() if f.flushing_needed)
        
        return {
            'audit_metadata': {
                'generated_at': now.isoformat(),
                'version': '0.1.0',
                'project_name': self.config.project_name
            },
            'summary': {
                'total_beds': total_beds,
                'danger_count': danger_count,
                'warning_count': warning_count,
                'safe_count': safe_count,
                'flush_needed_count': flush_needed_count
            },
            'thresholds': {
                'expected_ec_min': self.config.crop.expected_ec_range[0],
                'expected_ec_max': self.config.crop.expected_ec_range[1],
                'warning_threshold': self.config.thresholds.ec_warning_threshold,
                'danger_threshold': self.config.thresholds.ec_danger_threshold
            },
            'trends': trends_data,
            'flushing_forecasts': forecasts_data,
            'calculations': calculations_data
        }
    
    def save_all_reports(self,
                         trends: Dict[str, SaltTrend],
                         flushing_forecasts: Dict[str, FlushingRequirement],
                         calculations: List[DailySaltBalance]) -> Dict[str, str]:
        """
        保存所有报告文件
        
        Args:
            trends: 趋势分析
            flushing_forecasts: 冲洗预测
            calculations: 计算结果
            
        Returns:
            保存的文件路径字典
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved_paths = {}
        
        # 1. Markdown报告
        md_content = self.generate_markdown_report(trends, flushing_forecasts, calculations)
        md_filename = f"salt_report_{timestamp}.md"
        md_path = self.storage.save_report_file(md_content, md_filename)
        saved_paths['markdown'] = str(md_path)
        
        # 2. 风险畦CSV
        risk_rows, risk_headers = self.generate_risk_csv(trends, flushing_forecasts)
        risk_filename = f"risk_beds_{timestamp}.csv"
        risk_path = self.storage.save_csv_report(risk_rows, risk_filename, risk_headers)
        saved_paths['risk_csv'] = str(risk_path)
        
        # 3. 历史数据CSV
        hist_rows, hist_headers = self.generate_history_csv(calculations)
        hist_filename = f"history_data_{timestamp}.csv"
        hist_path = self.storage.save_csv_report(hist_rows, hist_filename, hist_headers)
        saved_paths['history_csv'] = str(hist_path)
        
        # 4. JSON审计包
        audit_data = self.generate_audit_data(trends, flushing_forecasts, calculations)
        audit_path = self.storage.create_audit_package(extra_data={'report_summary': audit_data})
        saved_paths['audit_json'] = str(audit_path)
        
        return saved_paths
