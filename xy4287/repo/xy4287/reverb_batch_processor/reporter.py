"""报告导出模块"""

import csv
import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from .models import (
    BatchResult, Room, MeasurementPoint, AcousticMetrics,
    FitResult, ValidationStatus, AnomalyType
)


class NumpyEncoder(json.JSONEncoder):
    """支持NumPy类型的JSON编码器"""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if is_dataclass(obj):
            return asdict(obj)
        return super().default(obj)


from enum import Enum


class ReportExporter:
    """报告导出器"""

    def export_markdown(self, result: BatchResult, output_dir: Path) -> Path:
        """
        导出Markdown报告

        Args:
            result: 批处理结果
            output_dir: 输出目录

        Returns:
            输出文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = output_dir / f"reverb_report_{timestamp}.md"

        content = self._generate_markdown_content(result)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return file_path

    def _generate_markdown_content(self, result: BatchResult) -> str:
        """生成Markdown内容"""
        lines = []

        lines.append("# 混响测量批处理报告")
        lines.append("")
        lines.append(f"**生成时间**: {result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 处理摘要")
        lines.append("")
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总测量数 | {result.total_measurements} |")
        lines.append(f"| 成功处理 | {result.passed_measurements} |")
        lines.append(f"| 处理失败 | {result.failed_measurements} |")
        lines.append(f"| 房间数 | {len(result.rooms)} |")
        lines.append("")

        for room_id, room in result.rooms.items():
            lines.append(f"## 房间: {room.name}")
            lines.append("")

            if room.volume:
                lines.append(f"- **容积**: {room.volume} m³")
            if room.area:
                lines.append(f"- **面积**: {room.area} m²")
            if room.description:
                lines.append(f"- **描述**: {room.description}")
            lines.append("")

            lines.append("### 测点详情")
            lines.append("")

            for point_id, point in room.points.items():
                lines.append(f"#### {point.name}")
                lines.append("")

                if point.metrics:
                    lines.append("| 频段 | RT20 (s) | RT30 (s) | EDT (s) | C80 (dB) | D50 | 置信度 | 状态 |")
                    lines.append("|------|----------|----------|---------|----------|-----|--------|------|")

                    for band, metrics in point.metrics.items():
                        rt20 = f"{metrics.rt20.rt_value:.3f}" if metrics.rt20 else "-"
                        rt30 = f"{metrics.rt30.rt_value:.3f}" if metrics.rt30 else "-"
                        edt = f"{metrics.edt.rt_value:.3f}" if metrics.edt else "-"
                        c80 = f"{metrics.c80:.1f}" if metrics.c80 is not None else "-"
                        d50 = f"{metrics.d50:.2%}" if metrics.d50 is not None else "-"

                        conf = "-"
                        if metrics.rt30:
                            conf = f"{metrics.rt30.confidence:.1%}"

                        status = "正常"
                        if metrics.rt30 and metrics.rt30.anomalies:
                            status = "异常 ⚠️"

                        lines.append(f"| {band} | {rt20} | {rt30} | {edt} | {c80} | {d50} | {conf} | {status} |")

                    lines.append("")

                    for band, metrics in point.metrics.items():
                        if metrics.rt30 and metrics.rt30.anomalies:
                            lines.append(f"**{band} 异常详情**:")
                            lines.append("")
                            for reason in metrics.rt30.anomaly_reasons:
                                lines.append(f"- {reason}")
                            lines.append("")

                        if metrics.rt30:
                            lines.append(f"**{band} 拟合详情**:")
                            lines.append("")
                            lines.append(f"- 拟合范围: {metrics.rt30.fit_start_db:.1f} dB → {metrics.rt30.fit_end_db:.1f} dB")
                            lines.append(f"- 时间范围: {metrics.rt30.fit_start_time:.3f} s → {metrics.rt30.fit_end_time:.3f} s")
                            lines.append(f"- 斜率: {metrics.rt30.slope:.2f} dB/s")
                            lines.append(f"- 决定系数 (R²): {metrics.rt30.r_squared:.4f}")
                            lines.append("")

                if point.validation.status != ValidationStatus.PASS:
                    lines.append("**校验消息**:")
                    lines.append("")
                    for msg in point.validation.messages:
                        lines.append(f"- {msg}")
                    lines.append("")

            lines.append("")

        lines.append("## 附录")
        lines.append("")
        lines.append("### 指标说明")
        lines.append("")
        lines.append("- **RT20**: 声压级衰减20dB所需时间，外推至60dB")
        lines.append("- **RT30**: 声压级衰减30dB所需时间，外推至60dB")
        lines.append("- **EDT**: 早期衰减时间，衰减10dB外推至60dB")
        lines.append("- **C80**: 清晰度指标，80ms前后能量比")
        lines.append("- **D50**: 语言清晰度指标，50ms内能量占比")
        lines.append("")

        lines.append("### 异常类型")
        lines.append("")
        lines.append("- **削波**: 信号达到测量设备上限")
        lines.append("- **噪声底过高**: 环境噪声过大")
        lines.append("- **数据缺失**: 采样数据不完整")
        lines.append("- **多次反射干扰**: 存在耦合振动或多重反射")
        lines.append("- **非线性衰减**: 衰减曲线非线性")
        lines.append("- **信噪比过低**: 信号与噪声比不足")
        lines.append("")

        return "\n".join(lines)

    def export_csv(self, result: BatchResult, output_dir: Path) -> Path:
        """
        导出CSV报告

        Args:
            result: 批处理结果
            output_dir: 输出目录

        Returns:
            输出文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = output_dir / f"reverb_report_{timestamp}.csv"

        rows = []

        headers = [
            '房间名称', '测点名称', '频段',
            'RT20 (s)', 'RT20_置信度', 'RT20_R²',
            'RT30 (s)', 'RT30_置信度', 'RT30_R²',
            'EDT (s)', 'EDT_置信度', 'EDT_R²',
            'C80 (dB)', 'D50', 'CenterTime (s)',
            '异常类型', '异常原因', '校验状态'
        ]
        rows.append(headers)

        for room_id, room in result.rooms.items():
            for point_id, point in room.points.items():
                for band, metrics in point.metrics.items():
                    row = [
                        room.name,
                        point.name,
                        band,
                        self._format_value(metrics.rt20, 'rt_value'),
                        self._format_value(metrics.rt20, 'confidence'),
                        self._format_value(metrics.rt20, 'r_squared'),
                        self._format_value(metrics.rt30, 'rt_value'),
                        self._format_value(metrics.rt30, 'confidence'),
                        self._format_value(metrics.rt30, 'r_squared'),
                        self._format_value(metrics.edt, 'rt_value'),
                        self._format_value(metrics.edt, 'confidence'),
                        self._format_value(metrics.edt, 'r_squared'),
                        f"{metrics.c80:.2f}" if metrics.c80 is not None else '',
                        f"{metrics.d50:.4f}" if metrics.d50 is not None else '',
                        f"{metrics.center_time:.4f}" if metrics.center_time is not None else '',
                        ';'.join(a.value for a in (metrics.rt30.anomalies if metrics.rt30 else [])),
                        ';'.join(metrics.rt30.anomaly_reasons if metrics.rt30 else []),
                        point.validation.status.value
                    ]
                    rows.append(row)

        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        return file_path

    def _format_value(self, fit_result: Optional[FitResult], attr: str) -> str:
        """格式化拟合结果值"""
        if fit_result is None:
            return ''
        value = getattr(fit_result, attr, None)
        if value is None:
            return ''
        if attr in ['confidence', 'r_squared']:
            return f"{value:.4f}"
        return f"{value:.4f}"

    def export_json(self, result: BatchResult, output_dir: Path) -> Path:
        """
        导出JSON审计包

        Args:
            result: 批处理结果
            output_dir: 输出目录

        Returns:
            输出文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = output_dir / f"reverb_audit_{timestamp}.json"

        audit_data = self._build_audit_data(result)

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, cls=NumpyEncoder, ensure_ascii=False, indent=2)

        return file_path

    def _build_audit_data(self, result: BatchResult) -> Dict[str, Any]:
        """构建审计数据结构"""
        return {
            'audit_info': {
                'generated_at': result.processed_at.isoformat(),
                'software_version': '0.1.0',
                'software_name': '混响测量批处理员'
            },
            'summary': {
                'total_measurements': result.total_measurements,
                'passed_measurements': result.passed_measurements,
                'failed_measurements': result.failed_measurements,
                'room_count': len(result.rooms)
            },
            'rooms': [
                self._room_to_dict(room_id, room)
                for room_id, room in result.rooms.items()
            ]
        }

    def _room_to_dict(self, room_id: str, room: Room) -> Dict[str, Any]:
        """转换房间数据为字典"""
        return {
            'id': room_id,
            'name': room.name,
            'volume': room.volume,
            'area': room.area,
            'description': room.description,
            'validation': {
                'status': room.validation.status.value,
                'messages': room.validation.messages,
                'details': room.validation.details
            },
            'points': [
                self._point_to_dict(point_id, point)
                for point_id, point in room.points.items()
            ]
        }

    def _point_to_dict(self, point_id: str, point: MeasurementPoint) -> Dict[str, Any]:
        """转换测点数据为字典"""
        return {
            'id': point_id,
            'name': point.name,
            'position': point.position,
            'validation': {
                'status': point.validation.status.value,
                'messages': point.validation.messages,
                'details': point.validation.details
            },
            'metrics': [
                self._metrics_to_dict(band, metrics)
                for band, metrics in point.metrics.items()
            ]
        }

    def _metrics_to_dict(self, band: str, metrics: AcousticMetrics) -> Dict[str, Any]:
        """转换声学指标为字典"""
        return {
            'band': band,
            'rt20': self._fit_result_to_dict(metrics.rt20),
            'rt30': self._fit_result_to_dict(metrics.rt30),
            'edt': self._fit_result_to_dict(metrics.edt),
            'c80': metrics.c80,
            'd50': metrics.d50,
            'center_time': metrics.center_time,
            'validation': {
                'status': metrics.validation.status.value,
                'messages': metrics.validation.messages,
                'details': metrics.validation.details
            }
        }

    def _fit_result_to_dict(self, fit: Optional[FitResult]) -> Optional[Dict[str, Any]]:
        """转换拟合结果为字典"""
        if fit is None:
            return None

        return {
            'rt_value': fit.rt_value,
            'confidence': fit.confidence,
            'fit_start_db': fit.fit_start_db,
            'fit_end_db': fit.fit_end_db,
            'fit_start_time': fit.fit_start_time,
            'fit_end_time': fit.fit_end_time,
            'slope': fit.slope,
            'intercept': fit.intercept,
            'r_squared': fit.r_squared,
            'anomalies': [a.value for a in fit.anomalies],
            'anomaly_reasons': fit.anomaly_reasons
        }


def export_report(
    result: BatchResult,
    output_dir: Path,
    format: str = 'all'
) -> List[Path]:
    """
    导出报告的便捷函数

    Args:
        result: 批处理结果
        output_dir: 输出目录
        format: 输出格式 ('markdown', 'csv', 'json', 'all')

    Returns:
        导出的文件路径列表
    """
    exporter = ReportExporter()
    exported_files = []

    output_dir.mkdir(parents=True, exist_ok=True)

    formats_to_export = []
    if format == 'all':
        formats_to_export = ['markdown', 'csv', 'json']
    else:
        formats_to_export = [format]

    for fmt in formats_to_export:
        if fmt == 'markdown':
            exported_files.append(exporter.export_markdown(result, output_dir))
        elif fmt == 'csv':
            exported_files.append(exporter.export_csv(result, output_dir))
        elif fmt == 'json':
            exported_files.append(exporter.export_json(result, output_dir))

    return exported_files
