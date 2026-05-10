from datetime import datetime
from pathlib import Path
from typing import List, Dict
import json

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib

matplotlib.use('Agg')

from config import config
from data_manager import DataManager, ChangeRecord
from order_matcher import MatchResult
from detour_detector import DetourAnalysis


class ReportGenerator:
    def __init__(self, data_manager: DataManager):
        self.data_manager = data_manager
    
    def _generate_summary_table(self, analyses: List[DetourAnalysis],
                                matches: Dict[str, MatchResult]) -> pd.DataFrame:
        data = []
        for analysis in analyses:
            match = matches.get(analysis.order_id)
            risk_level = "高" if analysis.overall_risk_score >= 60 else "中" if analysis.overall_risk_score >= 30 else "低"
            
            data.append({
                "订单ID": analysis.order_id,
                "司机ID": analysis.driver_id,
                "匹配分数": f"{match.match_score:.2%}" if match else "未匹配",
                "计划距离(km)": round(analysis.planned_distance / 1000, 2),
                "实际距离(km)": round(analysis.actual_distance / 1000, 2),
                "距离比例": f"{analysis.distance_ratio:.2%}",
                "预期时间(分)": round(analysis.expected_duration / 60, 1),
                "实际时间(分)": round(analysis.actual_duration / 60, 1),
                "时间比例": f"{analysis.time_ratio:.2%}",
                "绕行距离(m)": round(analysis.detour_distance, 0),
                "绕行路段数": len(analysis.detour_segments),
                "停留次数": len(analysis.stationary_segments),
                "风险评分": analysis.overall_risk_score,
                "风险等级": risk_level,
                "主要结论": analysis.conclusions[0] if analysis.conclusions else "无"
            })
        
        return pd.DataFrame(data)
    
    def _generate_history_table(self, history: List[ChangeRecord]) -> pd.DataFrame:
        data = []
        for record in history:
            data.append({
                "变更ID": record.change_id,
                "变更时间": record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "操作类型": record.action,
                "记录类型": record.record_type,
                "记录ID": record.record_id,
                "变更原因": record.reason
            })
        return pd.DataFrame(data)
    
    def _generate_detailed_table(self, analysis: DetourAnalysis,
                                 match: MatchResult) -> pd.DataFrame:
        data = []
        
        for i, seg in enumerate(analysis.detour_segments):
            data.append({
                "类型": "绕行",
                "序号": i + 1,
                "起点索引": seg.start_index,
                "终点索引": seg.end_index,
                "距离(m)": round(seg.segment_distance, 1),
                "时间(秒)": seg.segment_time,
                "异常类型": seg.anomaly_type.value,
                "描述": seg.description
            })
        
        for i, seg in enumerate(analysis.stationary_segments):
            data.append({
                "类型": "停留",
                "序号": i + 1,
                "起点索引": seg["start_index"],
                "终点索引": seg["end_index"],
                "距离(m)": 0,
                "时间(秒)": seg["duration_seconds"],
                "异常类型": "长时间停留",
                "描述": f"在({seg['location']['latitude']:.4f}, {seg['location']['longitude']:.4f})停留{seg['duration_seconds']/60:.1f}分钟"
            })
        
        return pd.DataFrame(data)
    
    def _generate_distance_chart(self, analysis: DetourAnalysis, match: MatchResult, 
                                output_path: Path) -> Path:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle(f"订单 {analysis.order_id} 绕路分析报告", fontsize=16, fontweight='bold')
        
        ax1 = axes[0, 0]
        categories = ['计划距离', '实际距离', '绕行距离']
        values = [
            analysis.planned_distance / 1000,
            analysis.actual_distance / 1000,
            analysis.detour_distance / 1000
        ]
        colors = ['#2ecc71', '#e74c3c', '#f39c12']
        bars = ax1.bar(categories, values, color=colors, width=0.5)
        ax1.set_ylabel('公里(km)')
        ax1.set_title('距离对比')
        for bar, val in zip(bars, values):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1, 
                    f'{val:.2f}', ha='center', va='bottom')
        
        ax2 = axes[0, 1]
        categories2 = ['预期时间', '实际时间']
        values2 = [analysis.expected_duration / 60, analysis.actual_duration / 60]
        colors2 = ['#3498db', '#e74c3c']
        bars2 = ax2.bar(categories2, values2, color=colors2, width=0.4)
        ax2.set_ylabel('分钟')
        ax2.set_title('时间对比')
        for bar, val in zip(bars2, values2):
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
                    f'{val:.1f}', ha='center', va='bottom')
        
        ax3 = axes[1, 0]
        risk = analysis.overall_risk_score
        colors3 = ['#2ecc71', '#f39c12', '#e74c3c']
        color_idx = 0 if risk < 30 else 1 if risk < 60 else 2
        ax3.pie([risk, 100-risk], labels=['风险', '正常'], colors=[colors3[color_idx], '#ecf0f1'],
                autopct='%1.1f%%', startangle=90)
        ax3.set_title(f'整体风险评分: {risk:.1f}/100')
        
        ax4 = axes[1, 1]
        ax4.axis('off')
        calc_text = (
            "【计算口径说明】\n\n"
            "• 距离比例 = 实际行驶距离 / 计划距离\n"
            "• 时间比例 = 实际用时 / 预期用时\n"
            "• 绕行距离 = max(0, 实际距离 - 计划距离)\n"
            f"• 距离阈值: {config.DETOUR_DISTANCE_THRESHOLD}倍\n"
            f"• 时间阈值: {config.DETOUR_TIME_RATIO}倍\n"
            f"• 停留阈值: {config.STATIONARY_TIME_THRESHOLD}秒\n\n"
            f"【风险来源分解】\n\n"
        )
        
        risk_components = []
        if analysis.distance_ratio >= config.DETOUR_DISTANCE_THRESHOLD:
            risk_components.append(f"• 距离超限: 超出{(analysis.distance_ratio-1)*100:.1f}%")
        if analysis.time_ratio >= config.DETOUR_TIME_RATIO:
            risk_components.append(f"• 时间超限: 超出{(analysis.time_ratio-1)*100:.1f}%")
        if analysis.detour_segments:
            risk_components.append(f"• 路径偏离: {len(analysis.detour_segments)}处")
        if analysis.stationary_segments:
            total = sum(s['duration_seconds'] for s in analysis.stationary_segments) / 60
            risk_components.append(f"• 停留异常: {total:.1f}分钟")
        
        if not risk_components:
            risk_components.append("• 无明显异常")
        
        calc_text += "\n".join(risk_components)
        ax4.text(0.05, 0.95, calc_text, transform=ax4.transAxes,
                fontsize=11, verticalalignment='top', family='monospace')
        
        plt.tight_layout(rect=[0, 0, 1, 0.95])
        chart_path = output_path / f"{analysis.order_id}_analysis.png"
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        return chart_path
    
    def generate_report(self, analyses: List[DetourAnalysis], 
                       matches: Dict[str, MatchResult],
                       report_name: str = None) -> Dict:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_name = report_name or f"report_{timestamp}"
        
        output_dir = config.REPORTS_DIR / report_name
        output_dir.mkdir(parents=True, exist_ok=True)
        
        summary_df = self._generate_summary_table(analyses, matches)
        summary_path = output_dir / "summary.csv"
        summary_df.to_csv(summary_path, index=False, encoding='utf-8-sig')
        
        history = self.data_manager.get_history()
        if history:
            history_df = self._generate_history_table(history)
            history_path = output_dir / "history.csv"
            history_df.to_csv(history_path, index=False, encoding='utf-8-sig')
        
        chart_paths = {}
        detail_paths = {}
        
        for analysis in analyses:
            match = matches.get(analysis.order_id)
            if match:
                chart_path = self._generate_distance_chart(analysis, match, output_dir)
                chart_paths[analysis.order_id] = str(chart_path)
                
                detail_df = self._generate_detailed_table(analysis, match)
                if not detail_df.empty:
                    detail_path = output_dir / f"{analysis.order_id}_details.csv"
                    detail_df.to_csv(detail_path, index=False, encoding='utf-8-sig')
                    detail_paths[analysis.order_id] = str(detail_path)
        
        report_data = {
            "report_name": report_name,
            "generated_at": datetime.now().isoformat(),
            "analysis_count": len(analyses),
            "summary_table": str(summary_path),
            "history_table": str(output_dir / "history.csv") if history else None,
            "charts": chart_paths,
            "details": detail_paths,
            "calculation_rules": {
                "detour_distance_threshold": config.DETOUR_DISTANCE_THRESHOLD,
                "detour_time_ratio": config.DETOUR_TIME_RATIO,
                "stationary_time_threshold": config.STATIONARY_TIME_THRESHOLD,
                "match_time_window": config.MATCH_TIME_WINDOW
            },
            "analyses": [a.to_dict() for a in analyses]
        }
        
        json_path = output_dir / "report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return report_data
