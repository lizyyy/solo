"""
报告导出功能
支持导出种植报告、失败复盘、错误分析等
"""

import json
import csv
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

from .models import GameState
from .engine import GreenhouseEngine
from .failure_analysis import FailureAnalysis
from .error_tracking import ErrorTracker


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_game_report(
        self,
        game_state: GameState,
        engine: GreenhouseEngine,
        analysis: Optional[FailureAnalysis] = None,
        error_tracker: Optional[ErrorTracker] = None,
        format: str = "txt"
    ) -> str:
        """
        导出游戏报告
        
        Args:
            game_state: 游戏状态
            engine: 游戏引擎
            analysis: 失败分析（可选）
            error_tracker: 错误追踪器（可选）
            format: 导出格式 (txt, json, csv)
        
        Returns:
            导出文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"game_report_{game_state.id}_{timestamp}.{format}"
        filepath = self.output_dir / filename
        
        if format == "txt":
            content = self._generate_txt_report(game_state, engine, analysis, error_tracker)
        elif format == "json":
            content = self._generate_json_report(game_state, engine, analysis, error_tracker)
            content = json.dumps(content, ensure_ascii=False, indent=2)
        elif format == "csv":
            content = self._generate_csv_report(game_state, engine, analysis)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(filepath)
    
    def _generate_txt_report(
        self,
        game_state: GameState,
        engine: GreenhouseEngine,
        analysis: Optional[FailureAnalysis],
        error_tracker: Optional[ErrorTracker]
    ) -> str:
        """生成文本格式报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("火星温室能量局 - 种植报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")
        
        # 游戏基本信息
        lines.append("【游戏基本信息】")
        lines.append(f"关卡名称: {game_state.name}")
        lines.append(f"游戏ID: {game_state.id}")
        lines.append(f"最终状态: {game_state.status.value}")
        lines.append(f"进行回合: {game_state.round} / {game_state.max_rounds}")
        lines.append(f"目标产量: {game_state.target_yield}")
        lines.append(f"实际产量: {game_state.current_yield:.1f}")
        lines.append(f"完成度: {(game_state.current_yield / game_state.target_yield * 100):.1f}%")
        lines.append("")
        
        # 资源统计
        lines.append("【资源统计】")
        lines.append(f"能量总产出: {game_state.total_energy_production:.1f}")
        lines.append(f"能量总消耗: {game_state.total_energy_consumption:.1f}")
        lines.append(f"水平衡: {game_state.total_energy_production - game_state.total_energy_consumption:.1f}")
        lines.append(f"水分总产出: {game_state.total_water_production:.1f}")
        lines.append(f"水分总消耗: {game_state.total_water_consumption:.1f}")
        lines.append(f"水平衡: {game_state.total_water_production - game_state.total_water_consumption:.1f}")
        lines.append("")
        
        # 温室舱状态
        lines.append("【温室舱状态】")
        for module in game_state.greenhouse_modules:
            lines.append(f"  {module.name}:")
            lines.append(f"    温度: {module.temperature:.1f}°C (目标: {module.target_temperature:.1f}°C)")
            lines.append(f"    湿度: {module.humidity:.1f}%")
            lines.append(f"    光照: {'开启' if module.light_on else '关闭'}")
            lines.append(f"    作物数量: {len(module.crops)} / {module.capacity}")
        lines.append("")
        
        # 作物状态
        lines.append("【作物状态】")
        for i, crop in enumerate(game_state.crops, 1):
            lines.append(f"  {i}. {crop.name} ({crop.species})")
            lines.append(f"     状态: {crop.status.value}")
            lines.append(f"     健康度: {crop.health:.1f}%")
            lines.append(f"     生长进度: {crop.growth_progress:.1f}%")
            lines.append(f"     预计产量: {crop.harvest_yield:.1f}")
        lines.append("")
        
        # 失败分析（如果有）
        if analysis:
            lines.append("【失败分析】")
            lines.append(f"失败原因: {analysis.failure_reason.value}")
            lines.append(f"错误分类: {analysis.error_category.value}")
            lines.append(f"根本原因: {analysis.root_cause}")
            lines.append("")
            
            if analysis.conceptual_errors:
                lines.append("概念错误:")
                for err in analysis.conceptual_errors:
                    lines.append(f"  - {err}")
            if analysis.operational_errors:
                lines.append("操作错误:")
                for err in analysis.operational_errors:
                    lines.append(f"  - {err}")
            if analysis.strategic_errors:
                lines.append("策略错误:")
                for err in analysis.strategic_errors:
                    lines.append(f"  - {err}")
            lines.append("")
            
            lines.append("改进建议:")
            for rec in analysis.recommendations:
                lines.append(f"  - {rec}")
            lines.append("")
        
        # 错误追踪（如果有）
        if error_tracker and (error_tracker.errors or error_tracker.warnings):
            lines.append("【错误追踪】")
            lines.append(f"错误总数: {len(error_tracker.errors)}")
            lines.append(f"警告总数: {len(error_tracker.warnings)}")
            lines.append("")
            
            if error_tracker.errors:
                lines.append("最近错误:")
                for err in error_tracker.errors[-5:]:
                    lines.append(f"  [{err.error_id}] {err.error_type}: {err.error_message}")
                    if err.source_file:
                        lines.append(f"      来源: {err.source_file}" + (f":{err.source_line}" if err.source_line else ""))
            lines.append("")
        
        lines.append("=" * 80)
        return "\n".join(lines)
    
    def _generate_json_report(
        self,
        game_state: GameState,
        engine: GreenhouseEngine,
        analysis: Optional[FailureAnalysis],
        error_tracker: Optional[ErrorTracker]
    ) -> Dict[str, Any]:
        """生成JSON格式报告"""
        report = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "game_id": game_state.id,
                "game_name": game_state.name
            },
            "game_summary": {
                "status": game_state.status.value,
                "round": game_state.round,
                "max_rounds": game_state.max_rounds,
                "target_yield": game_state.target_yield,
                "current_yield": game_state.current_yield,
                "completion_rate": game_state.current_yield / game_state.target_yield
            },
            "resource_summary": {
                "energy": {
                    "total_production": game_state.total_energy_production,
                    "total_consumption": game_state.total_energy_consumption,
                    "net": game_state.total_energy_production - game_state.total_energy_consumption
                },
                "water": {
                    "total_production": game_state.total_water_production,
                    "total_consumption": game_state.total_water_consumption,
                    "net": game_state.total_water_production - game_state.total_water_consumption
                }
            },
            "greenhouse_modules": [
                {
                    "id": m.id,
                    "name": m.name,
                    "temperature": m.temperature,
                    "target_temperature": m.target_temperature,
                    "humidity": m.humidity,
                    "light_on": m.light_on,
                    "crop_count": len(m.crops),
                    "capacity": m.capacity
                }
                for m in game_state.greenhouse_modules
            ],
            "crops": [
                {
                    "id": c.id,
                    "name": c.name,
                    "species": c.species,
                    "status": c.status.value,
                    "health": c.health,
                    "growth_progress": c.growth_progress,
                    "harvest_yield": c.harvest_yield
                }
                for c in game_state.crops
            ],
            "round_logs": engine.round_logs
        }
        
        if analysis:
            report["failure_analysis"] = {
                "failure_reason": analysis.failure_reason.value,
                "error_category": analysis.error_category.value,
                "root_cause": analysis.root_cause,
                "conceptual_errors": analysis.conceptual_errors,
                "operational_errors": analysis.operational_errors,
                "strategic_errors": analysis.strategic_errors,
                "recommendations": analysis.recommendations,
                "learning_points": analysis.learning_points,
                "resource_analysis": analysis.resource_analysis
            }
        
        if error_tracker:
            report["error_tracking"] = error_tracker.get_error_summary()
        
        return report
    
    def _generate_csv_report(
        self,
        game_state: GameState,
        engine: GreenhouseEngine,
        analysis: Optional[FailureAnalysis]
    ) -> str:
        """生成CSV格式报告（适合老师统计分析）"""
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 基本信息行
        writer.writerow(["项目", "数值"])
        writer.writerow(["关卡名称", game_state.name])
        writer.writerow(["游戏ID", game_state.id])
        writer.writerow(["最终状态", game_state.status.value])
        writer.writerow(["进行回合", game_state.round])
        writer.writerow(["目标产量", game_state.target_yield])
        writer.writerow(["实际产量", game_state.current_yield])
        writer.writerow(["完成度(%)", f"{(game_state.current_yield / game_state.target_yield * 100):.1f}"])
        writer.writerow([])
        
        # 资源统计
        writer.writerow(["资源统计"])
        writer.writerow(["能量总产出", game_state.total_energy_production])
        writer.writerow(["能量总消耗", game_state.total_energy_consumption])
        writer.writerow(["能量净差", game_state.total_energy_production - game_state.total_energy_consumption])
        writer.writerow(["水分总产出", game_state.total_water_production])
        writer.writerow(["水分总消耗", game_state.total_water_consumption])
        writer.writerow(["水分净差", game_state.total_water_production - game_state.total_water_consumption])
        writer.writerow([])
        
        # 失败分析
        if analysis:
            writer.writerow(["失败分析"])
            writer.writerow(["失败原因", analysis.failure_reason.value])
            writer.writerow(["错误分类", analysis.error_category.value])
            writer.writerow(["根本原因", analysis.root_cause])
            writer.writerow(["概念错误数量", len(analysis.conceptual_errors)])
            writer.writerow(["操作错误数量", len(analysis.operational_errors)])
            writer.writerow(["策略错误数量", len(analysis.strategic_errors)])
        
        return output.getvalue()
    
    def export_error_report(self, error_tracker: ErrorTracker, format: str = "txt") -> str:
        """导出错误报告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"error_report_{timestamp}.{format}"
        filepath = self.output_dir / filename
        
        if format == "txt":
            content = error_tracker.generate_error_report()
        elif format == "json":
            content = json.dumps({
                "errors": [
                    {
                        "error_id": e.error_id,
                        "error_type": e.error_type,
                        "error_message": e.error_message,
                        "severity": e.severity,
                        "source_file": e.source_file,
                        "source_line": e.source_line,
                        "object_id": e.object_id,
                        "timestamp": e.timestamp.isoformat()
                    }
                    for e in error_tracker.errors
                ],
                "warnings": [
                    {
                        "error_id": w.error_id,
                        "error_type": w.error_type,
                        "error_message": w.error_message,
                        "source_file": w.source_file,
                        "timestamp": w.timestamp.isoformat()
                    }
                    for w in error_tracker.warnings
                ]
            }, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(filepath)
