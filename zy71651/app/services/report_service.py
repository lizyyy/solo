import time
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from ..models import (
    EstimationReport,
    EstimationTask,
    SupportEstimation,
    MeshAnalysisResult,
    TaskStatus,
    Student,
    Material,
)
from ..schemas import (
    EstimationReportRequest,
    EstimationReportResponse,
    ReportSummary,
    ReportSection,
    ReportChart,
    ReportDetailItem,
    AnomalyResponse,
)
from ..config import settings
from .status_service import StatusService
from .anomaly_service import AnomalyService
from .params_service import ParamsService
from ..models.enums import AnomalySeverity


class ReportService:
    @staticmethod
    def _get_active_estimation(
        db: Session,
        task: EstimationTask,
        params_version: Optional[int] = None,
    ) -> Optional[SupportEstimation]:
        if params_version:
            return (
                db.query(SupportEstimation)
                .filter(
                    SupportEstimation.task_id == task.id,
                    SupportEstimation.params_version == params_version,
                )
                .order_by(SupportEstimation.created_at.desc())
                .first()
            )
        elif task.active_estimation_id:
            return db.query(SupportEstimation).filter(
                SupportEstimation.id == task.active_estimation_id
            ).first()
        else:
            return (
                db.query(SupportEstimation)
                .filter(SupportEstimation.task_id == task.id)
                .order_by(SupportEstimation.created_at.desc())
                .first()
            )

    @staticmethod
    def _get_latest_analysis(
        db: Session,
        task: EstimationTask,
    ) -> Optional[MeshAnalysisResult]:
        return (
            db.query(MeshAnalysisResult)
            .filter(MeshAnalysisResult.task_id == task.id)
            .order_by(MeshAnalysisResult.created_at.desc())
            .first()
        )

    @staticmethod
    def _generate_summary(
        task: EstimationTask,
        estimation: SupportEstimation,
        analysis: Optional[MeshAnalysisResult],
        params_version: int,
        anomalies: List[Any],
    ) -> ReportSummary:
        student = task.student
        student_name = student.name if student else None

        critical_count = sum(
            1 for a in anomalies
            if not a.is_resolved and a.severity == AnomalySeverity.CRITICAL.value
        )
        error_count = sum(
            1 for a in anomalies
            if not a.is_resolved and a.severity == AnomalySeverity.ERROR.value
        )
        warning_count = sum(
            1 for a in anomalies
            if not a.is_resolved and a.severity == AnomalySeverity.WARNING.value
        )

        can_print = critical_count == 0 and error_count == 0

        warnings = []
        if not can_print:
            warnings.append("存在严重问题，不建议直接打印")
        if warning_count > 0:
            warnings.append(f"存在 {warning_count} 个警告，请检查")
        if estimation.is_time_underestimated:
            warnings.append("打印时间可能被低估，建议预留额外时间")
        if analysis and not analysis.is_watertight:
            warnings.append("模型不封闭，可能影响打印质量")

        return ReportSummary(
            project_name=task.project_name,
            student_name=student_name,
            generated_at=datetime.utcnow(),
            params_version=params_version,
            total_mass_g=estimation.total_mass_g or 0,
            support_mass_g=estimation.support_mass_g or 0,
            support_ratio=estimation.support_material_ratio or 0,
            print_time_hours=estimation.print_time_hours or 0,
            filament_length_m=estimation.filament_length_m or 0,
            quality_score=analysis.quality_score if analysis else 0,
            anomaly_count=len([a for a in anomalies if not a.is_resolved]),
            critical_anomaly_count=critical_count + error_count,
            confidence_score=estimation.confidence_score or 0,
            can_print=can_print,
            warnings=warnings,
        )

    @staticmethod
    def _generate_sections(
        task: EstimationTask,
        estimation: SupportEstimation,
        analysis: Optional[MeshAnalysisResult],
        params: Dict[str, Any],
        material: Optional[Material],
        report_type: str,
    ) -> List[ReportSection]:
        sections: List[ReportSection] = []

        if report_type in ["full", "material_only"]:
            sections.append(ReportSection(
                title="材料用量分析",
                order=1,
                content={
                    "零件重量": f"{estimation.part_mass_g:.2f} g",
                    "支撑重量": f"{estimation.support_mass_g:.2f} g",
                    "总重量": f"{estimation.total_mass_g:.2f} g",
                    "支撑比例": f"{estimation.support_material_ratio:.1f}%",
                    "耗材长度": f"{estimation.filament_length_m:.2f} m",
                    "预估成本": f"¥{estimation.filament_cost_estimate:.2f}",
                    "材料": material.name if material else "未知",
                    "材料类型": material.material_type if material else "未知",
                    "材料密度": f"{material.density:.2f} g/cm³" if material else "未知",
                },
            ))

        if report_type in ["full", "time_only"]:
            time_bd = estimation.time_breakdown or {}
            sections.append(ReportSection(
                title="打印时间分析",
                order=2,
                content={
                    "总打印时间": f"{estimation.print_time_hours:.2f} 小时 ({estimation.print_time_minutes:.0f} 分钟)",
                    "纯打印时间": f"{time_bd.get('print_time_min', 0):.1f} 分钟",
                    "空行移动时间": f"{time_bd.get('travel_time_min', 0):.1f} 分钟",
                    "回抽时间": f"{time_bd.get('retraction_time_min', 0):.1f} 分钟",
                    "冷却时间": f"{time_bd.get('cooling_time_min', 0):.1f} 分钟",
                    "准备时间": f"{time_bd.get('setup_time_min', 0):.1f} 分钟",
                    "总层数": f"{estimation.layer_count} 层",
                    "时间校正系数": f"{estimation.time_correction_factor:.2f}",
                    "时间低估警告": "是" if estimation.is_time_underestimated else "否",
                },
            ))

        if report_type == "full" and analysis:
            sections.append(ReportSection(
                title="网格质量分析",
                order=3,
                content={
                    "质量评分": f"{analysis.quality_score:.1f}/100",
                    "是否封闭": "是" if analysis.is_watertight else "否",
                    "是否流形": "是" if analysis.is_manifold else "否",
                    "破损面数": analysis.broken_face_count,
                    "非流形边数": analysis.non_manifold_edges,
                    "重复面数": analysis.duplicate_faces,
                    "悬垂面数": analysis.overhang_count,
                    "悬垂面积": f"{analysis.overhang_area:.1f} mm²",
                    "模型体积": f"{analysis.part_volume:.4f} cm³",
                    " bounding_box": f"{analysis.bounding_box_volume:.2f} cm³",
                },
            ))

        if report_type == "full":
            sections.append(ReportSection(
                title="切片参数",
                order=4,
                content={
                    "层高": f"{params.get('layer_height', '未知')} mm",
                    "喷嘴直径": f"{params.get('nozzle_diameter', '未知')} mm",
                    "打印速度": f"{params.get('print_speed', '未知')} mm/s",
                    "填充密度": f"{params.get('infill_density', '未知')}%",
                    "支撑启用": "是" if params.get('support_enabled', True) else "否",
                    "支撑密度": f"{params.get('support_density', '未知')}%",
                    "支撑临界角": f"{params.get('support_angle', '未知')}°",
                    "壁厚": f"{params.get('wall_thickness', '未知')} mm",
                    "顶底层数": params.get('top_bottom_layers', '未知'),
                    "热床温度": f"{params.get('bed_temperature', '未知')}°C" if params.get('bed_temperature') else "未设置",
                    "喷嘴温度": f"{params.get('nozzle_temperature', '未知')}°C" if params.get('nozzle_temperature') else "未设置",
                },
            ))

        return sections

    @staticmethod
    def _generate_charts(
        estimation: SupportEstimation,
        analysis: Optional[MeshAnalysisResult],
        report_type: str,
    ) -> List[ReportChart]:
        charts: List[ReportChart] = []

        if report_type in ["full", "material_only"]:
            charts.append(ReportChart(
                chart_type="pie",
                title="材料用量分布",
                data={
                    "labels": ["零件", "支撑"],
                    "values": [
                        estimation.part_mass_g or 0,
                        estimation.support_mass_g or 0,
                    ],
                    "unit": "g",
                },
                explanation="显示零件和支撑各自的材料用量，支撑比例过高会增加成本和打印时间",
            ))

        if report_type in ["full", "time_only"]:
            time_bd = estimation.time_breakdown or {}
            charts.append(ReportChart(
                chart_type="bar",
                title="打印时间构成",
                data={
                    "labels": ["纯打印", "空行移动", "回抽", "冷却", "准备"],
                    "values": [
                        time_bd.get("print_time_min", 0),
                        time_bd.get("travel_time_min", 0),
                        time_bd.get("retraction_time_min", 0),
                        time_bd.get("cooling_time_min", 0),
                        time_bd.get("setup_time_min", 0),
                    ],
                    "unit": "min",
                },
                explanation="打印时间的详细构成，可用于优化打印参数",
            ))

        if report_type == "full" and analysis:
            charts.append(ReportChart(
                chart_type="gauge",
                title="网格质量评分",
                data={
                    "value": analysis.quality_score or 0,
                    "min": 0,
                    "max": 100,
                    "zones": [
                        {"from": 0, "to": 50, "color": "#ff4444", "label": "差"},
                        {"from": 50, "to": 75, "color": "#ffaa00", "label": "中"},
                        {"from": 75, "to": 100, "color": "#44ff44", "label": "良"},
                    ],
                },
                explanation="综合评估模型的打印可行性，低于60分建议修复模型",
            ))

        return charts

    @staticmethod
    def _generate_detail_items(
        estimation: SupportEstimation,
        analysis: Optional[MeshAnalysisResult],
        params: Dict[str, Any],
    ) -> List[ReportDetailItem]:
        items: List[ReportDetailItem] = []

        calc_details = estimation.calculation_details or {}
        time_bd = estimation.time_breakdown or {}

        items.append(ReportDetailItem(
            label="零件重量",
            value=f"{estimation.part_mass_g:.2f}",
            unit="g",
            formula="体积 × 密度 × (填充率×0.8 + 0.2)",
            explanation="考虑外壳和填充的实际重量",
            data_source="estimation_service:step2",
        ))

        items.append(ReportDetailItem(
            label="支撑重量",
            value=f"{estimation.support_mass_g:.2f}",
            unit="g",
            formula="支撑体积 × 支撑密度 × 材料密度",
            explanation="根据支撑密度计算的实际支撑材料重量",
            data_source="estimation_service:step4",
        ))

        items.append(ReportDetailItem(
            label="总打印时间",
            value=f"{estimation.print_time_hours:.2f}",
            unit="小时",
            formula="(挤出量 / (喷嘴截面积 × 速度)) × 复杂度系数 + 辅助时间",
            explanation=f"含{time_bd.get('setup_time_min', 0)}分钟准备时间" + (f"，已应用{estimation.time_correction_factor:.1f}倍校正" if estimation.time_correction_factor > 1 else ""),
            data_source="estimation_service:step" + ("10" if estimation.time_correction_factor > 1 else "9"),
        ))

        items.append(ReportDetailItem(
            label="耗材长度",
            value=f"{estimation.filament_length_m:.2f}",
            unit="m",
            formula="总重量 / (密度 × π × (丝材半径)²) / 10",
            explanation="转换为标准1.75mm丝材的长度",
            data_source="estimation_service:step6",
        ))

        items.append(ReportDetailItem(
            label="支撑材料比例",
            value=f"{estimation.support_material_ratio:.1f}",
            unit="%",
            formula="支撑重量 / (零件重量 + 支撑重量) × 100",
            explanation="支撑材料占总材料的比例，建议控制在30%以内",
            data_source="estimation_service:step5",
        ))

        if analysis:
            items.append(ReportDetailItem(
                label="模型体积",
                value=f"{analysis.part_volume:.4f}",
                unit="cm³",
                formula="从STL文件读取的体积",
                explanation="模型本身的体积，不含支撑",
                data_source="mesh_service:volume_calc",
            ))

            items.append(ReportDetailItem(
                label="悬垂面积",
                value=f"{analysis.overhang_area:.1f}",
                unit="mm²",
                formula=f"法线角度 > {analysis.min_support_angle}° 的面面积之和",
                explanation=f"超过{analysis.min_support_angle}°临界角需要支撑的面积",
                data_source="mesh_service:overhang_analysis",
            ))

        items.append(ReportDetailItem(
            label="置信度",
            value=f"{estimation.confidence_score:.1f}",
            unit="%",
            formula="100 - 模型缺陷扣分 - 复杂度扣分",
            explanation="估算结果的可信度，低于60%建议人工复核",
            data_source="estimation_service:confidence_calc",
        ))

        return items

    @staticmethod
    def generate_report(
        db: Session,
        task: EstimationTask,
        request: EstimationReportRequest,
    ) -> Tuple[EstimationReport, EstimationReportResponse]:
        start_time = time.time()

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.REPORT_GENERATING.value,
            message=f"开始生成{request.report_type}报告",
            triggered_by="report_service",
        )

        params_version = request.params_version or task.current_params_version or 1

        estimation = ReportService._get_active_estimation(db, task, params_version)
        if not estimation:
            raise ValueError("未找到支撑估算结果，请先进行支撑估算")

        analysis = ReportService._get_latest_analysis(db, task)
        params = ParamsService.get_effective_params(db, task.id, params_version)

        material = None
        if estimation.material_id:
            material = db.query(Material).filter(Material.id == estimation.material_id).first()

        anomalies = AnomalyService.get_task_anomalies(db, task.id, include_resolved=False)
        anomaly_responses = [AnomalyService.to_response(a).model_dump() for a in anomalies]

        summary = ReportService._generate_summary(
            task=task,
            estimation=estimation,
            analysis=analysis,
            params_version=params_version,
            anomalies=anomalies,
        )

        sections = ReportService._generate_sections(
            task=task,
            estimation=estimation,
            analysis=analysis,
            params=params,
            material=material,
            report_type=request.report_type,
        )

        charts = ReportService._generate_charts(
            estimation=estimation,
            analysis=analysis,
            report_type=request.report_type,
        )

        detail_items = ReportService._generate_detail_items(
            estimation=estimation,
            analysis=analysis,
            params=params,
        )

        db.query(EstimationReport).filter(
            EstimationReport.task_id == task.id,
            EstimationReport.is_latest == True,
        ).update({"is_latest": False})

        report_content = {
            "summary": summary.model_dump(),
            "sections": [s.model_dump() for s in sections],
            "charts": [c.model_dump() for c in charts],
            "detail_items": [d.model_dump() for d in detail_items],
            "anomalies": anomaly_responses,
        }

        file_path = None
        file_name = None
        if request.format != "json":
            report_dir = settings.report_dir / str(task.id)
            report_dir.mkdir(parents=True, exist_ok=True)
            timestamp = int(time.time())
            file_name = f"report_{task.id}_v{params_version}_{timestamp}.{request.format}"
            file_path = str(report_dir / file_name)

            with open(file_path, "w", encoding="utf-8") as f:
                if request.format == "html":
                    f.write(ReportService._render_html(report_content, task))
                else:
                    json.dump(report_content, f, ensure_ascii=False, indent=2, default=str)

        report = EstimationReport(
            task_id=task.id,
            params_version=params_version,
            estimation_id=estimation.id,
            report_type=request.report_type,
            format=request.format,
            file_path=file_path,
            file_name=file_name,
            summary=summary.model_dump(),
            content=report_content,
            generated_by="report_service",
            generation_time_ms=int((time.time() - start_time) * 1000),
            is_latest=True,
            notes=f"报告类型: {request.report_type}, 格式: {request.format}",
        )
        db.add(report)
        db.flush()

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.REPORT_GENERATED.value,
            message=f"报告生成成功，耗时 {report.generation_time_ms}ms",
            triggered_by="report_service",
            metadata={
                "report_type": request.report_type,
                "format": request.format,
                "generation_time_ms": report.generation_time_ms,
            },
        )

        response = EstimationReportResponse(
            id=report.id,
            task_id=report.task_id,
            params_version=report.params_version,
            estimation_id=report.estimation_id,
            report_type=report.report_type,
            format=report.format,
            file_path=report.file_path,
            file_name=report.file_name,
            summary=summary,
            sections=sections,
            charts=charts,
            detail_items=detail_items,
            anomalies=anomaly_responses,
            generated_by=report.generated_by,
            generation_time_ms=report.generation_time_ms,
            is_latest=report.is_latest,
            notes=report.notes,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

        return report, response

    @staticmethod
    def _render_html(content: Dict[str, Any], task: EstimationTask) -> str:
        summary = content.get("summary", {})
        sections = content.get("sections", [])
        charts = content.get("charts", [])
        anomalies = content.get("anomalies", [])

        status_color = "#4CAF50" if summary.get("can_print") else "#f44336"
        status_text = "可以打印" if summary.get("can_print") else "存在问题"

        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>3D打印估算报告 - {summary.get('project_name', '')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #333; }}
        .header {{ border-bottom: 3px solid {status_color}; padding-bottom: 20px; margin-bottom: 30px; }}
        .status-badge {{ display: inline-block; padding: 8px 16px; border-radius: 20px; background: {status_color}; color: white; font-weight: bold; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
        .summary-card {{ background: #f5f5f5; padding: 20px; border-radius: 8px; }}
        .summary-card .label {{ color: #666; font-size: 14px; }}
        .summary-card .value {{ font-size: 24px; font-weight: bold; margin-top: 8px; }}
        .section {{ margin: 30px 0; padding: 20px; background: #fafafa; border-radius: 8px; }}
        .section h2 {{ margin-top: 0; color: #333; }}
        .section table {{ width: 100%; border-collapse: collapse; }}
        .section td {{ padding: 8px 12px; border-bottom: 1px solid #eee; }}
        .section td:first-child {{ color: #666; width: 40%; }}
        .anomaly {{ padding: 12px; margin: 10px 0; border-radius: 4px; border-left: 4px solid; }}
        .anomaly.critical {{ background: #ffebee; border-color: #f44336; }}
        .anomaly.error {{ background: #fff3e0; border-color: #ff9800; }}
        .anomaly.warning {{ background: #fffde7; border-color: #ffeb3b; }}
        .anomaly .title {{ font-weight: bold; }}
        .anomaly .desc {{ color: #666; margin: 4px 0; }}
        .anomaly .suggestion {{ color: #2e7d32; font-style: italic; }}
        .warnings {{ background: #fff3e0; padding: 15px; border-radius: 4px; margin: 20px 0; }}
        .detail-item {{ padding: 10px; border-bottom: 1px solid #eee; }}
        .detail-item .formula {{ font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }}
        .detail-item .source {{ color: #999; font-size: 12px; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>3D打印支撑量估算报告</h1>
        <h2>{summary.get('project_name', '')}</h2>
        <p>学生: {summary.get('student_name', '未指定')} | 参数版本: v{summary.get('params_version', 1)}</p>
        <p>生成时间: {summary.get('generated_at', '')}</p>
        <span class="status-badge">{status_text}</span>
    </div>
"""

        if summary.get("warnings"):
            html += '<div class="warnings"><h3>⚠️ 注意事项</h3><ul>'
            for w in summary["warnings"]:
                html += f"<li>{w}</li>"
            html += "</ul></div>"

        html += '<div class="summary-grid">'
        summary_items = [
            ("总材料重量", f"{summary.get('total_mass_g', 0):.2f} g"),
            ("支撑重量", f"{summary.get('support_mass_g', 0):.2f} g"),
            ("支撑比例", f"{summary.get('support_ratio', 0):.1f}%"),
            ("打印时间", f"{summary.get('print_time_hours', 0):.2f} 小时"),
            ("耗材长度", f"{summary.get('filament_length_m', 0):.2f} m"),
            ("质量评分", f"{summary.get('quality_score', 0):.1f}/100"),
            ("置信度", f"{summary.get('confidence_score', 0):.1f}%"),
            ("异常数量", str(summary.get('anomaly_count', 0))),
        ]
        for label, value in summary_items:
            html += f'<div class="summary-card"><div class="label">{label}</div><div class="value">{value}</div></div>'
        html += "</div>"

        for section in sections:
            html += f'<div class="section"><h2>{section.get("title", "")}</h2><table>'
            for k, v in section.get("content", {}).items():
                html += f"<tr><td>{k}</td><td>{v}</td></tr>"
            html += "</table></div>"

        if anomalies:
            html += '<div class="section"><h2>🔍 检测到的问题</h2>'
            severity_map = {"critical": "critical", "error": "error", "warning": "warning", "info": "warning"}
            for a in anomalies:
                sev = severity_map.get(a.get("severity", "warning"), "warning")
                html += f'''
                <div class="anomaly {sev}">
                    <div class="title">[{a.get("severity", "").upper()}] {a.get("title", "")}</div>
                    <div class="desc">{a.get("description", "")}</div>
                    <div class="suggestion">💡 建议: {a.get("suggestion", "")}</div>
                    <div class="source">来源: {a.get("data_source", "未知")}</div>
                </div>
                '''
            html += "</div>"

        html += '<div class="section"><h2>📊 计算明细</h2>'
        for item in content.get("detail_items", []):
            html += f'''
            <div class="detail-item">
                <strong>{item.get("label", "")}:</strong> {item.get("value", "")} {item.get("unit", "")}
                <div><span class="formula">{item.get("formula", "")}</span></div>
                <div style="margin-top:4px">{item.get("explanation", "")}</div>
                <div class="source">数据来源: {item.get("data_source", "")}</div>
            </div>
            '''
        html += "</div>"

        html += f'''
    <div class="footer">
        <p>报告生成时间: {summary.get("generated_at", "")} | 任务ID: {task.id}</p>
        <p>本报告由3D打印支撑量估算系统自动生成，供参考使用。实际打印参数请以切片软件为准。</p>
    </div>
</body>
</html>
'''
        return html
