from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import csv
import json

from .config import (
    CheckReport,
    ValidationResult,
    ValidationRule,
    ProjectConfig,
)
from .exceptions import ReportGenerationError


class CSVReporter:
    @staticmethod
    def generate(
        check_report: CheckReport,
        output_path: Path,
    ) -> None:
        try:
            rows: List[Dict[str, Any]] = []

            for result in check_report.validation_results:
                row = {
                    "report_id": check_report.report_id,
                    "project_id": check_report.project_id,
                    "file_name": result.material_metadata.file_name,
                    "file_path": result.material_metadata.file_path,
                    "material_type": str(result.material_metadata.material_type),
                    "rule_name": str(result.rule_name),
                    "is_valid": "是" if result.is_valid else "否",
                    "severity": result.severity,
                    "message": result.message,
                    "validated_at": result.validated_at.isoformat() if result.validated_at else "",
                    "latitude": result.material_metadata.latitude or "",
                    "longitude": result.material_metadata.longitude or "",
                    "capture_time": (
                        result.material_metadata.capture_time.isoformat()
                        if result.material_metadata.capture_time
                        else ""
                    ),
                    "device_model": result.material_metadata.device_model or "",
                    "flight_line": result.material_metadata.flight_line or "",
                    "waypoint_number": result.material_metadata.waypoint_number or "",
                    "details": json.dumps(result.details, ensure_ascii=False, default=str),
                }
                rows.append(row)

            if rows:
                fieldnames = list(rows[0].keys())
                with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
            else:
                with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                    f.write("无校验数据\n")

        except Exception as e:
            raise ReportGenerationError(f"生成CSV报告失败: {e}", "csv")


class JSONReporter:
    @staticmethod
    def generate(
        check_report: CheckReport,
        project_config: Optional[ProjectConfig] = None,
    ) -> Dict[str, Any]:
        report_data: Dict[str, Any] = {
            "report_id": check_report.report_id,
            "project_id": check_report.project_id,
            "generated_at": check_report.generated_at.isoformat() if check_report.generated_at else None,
            "summary": {
                "total_materials": check_report.total_materials,
                "valid_materials": check_report.valid_materials,
                "invalid_materials": check_report.invalid_materials,
                "quarantined_materials": check_report.quarantined_materials,
            },
            "stats_by_rule": {
                str(rule): stats
                for rule, stats in check_report.stats_by_rule.items()
            },
            "validation_results": [],
            "notes": check_report.notes,
        }

        for result in check_report.validation_results:
            result_data: Dict[str, Any] = {
                "file_name": result.material_metadata.file_name,
                "file_path": result.material_metadata.file_path,
                "material_type": str(result.material_metadata.material_type),
                "rule_name": str(result.rule_name),
                "is_valid": result.is_valid,
                "severity": result.severity,
                "message": result.message,
                "validated_at": result.validated_at.isoformat() if result.validated_at else None,
                "details": result.details,
                "material_metadata": {
                    "file_size_bytes": result.material_metadata.file_size_bytes,
                    "hash_sha256": result.material_metadata.hash_sha256,
                    "latitude": result.material_metadata.latitude,
                    "longitude": result.material_metadata.longitude,
                    "altitude_meters": result.material_metadata.altitude_meters,
                    "capture_time": (
                        result.material_metadata.capture_time.isoformat()
                        if result.material_metadata.capture_time
                        else None
                    ),
                    "device_model": result.material_metadata.device_model,
                    "gimbal_yaw": result.material_metadata.gimbal_yaw,
                    "gimbal_pitch": result.material_metadata.gimbal_pitch,
                    "gimbal_roll": result.material_metadata.gimbal_roll,
                    "flight_line": result.material_metadata.flight_line,
                    "waypoint_number": result.material_metadata.waypoint_number,
                },
            }
            report_data["validation_results"].append(result_data)

        if project_config:
            report_data["project_config"] = {
                "project_name": project_config.project_name,
                "project_id": project_config.project_id,
                "version": project_config.version,
                "created_at": (
                    project_config.created_at.isoformat()
                    if project_config.created_at
                    else None
                ),
                "time_sync_threshold_seconds": project_config.time_sync_threshold_seconds,
                "coordinate_deviation_threshold_meters": project_config.coordinate_deviation_threshold_meters,
                "enabled_rules": [str(r) for r in project_config.enabled_rules],
                "no_fly_zones": [
                    {
                        "name": nfz.name,
                        "center_lat": nfz.center_lat,
                        "center_lon": nfz.center_lon,
                        "radius_meters": nfz.radius_meters,
                    }
                    for nfz in project_config.no_fly_zones
                ],
            }

        return report_data

    @staticmethod
    def save(
        report_data: Dict[str, Any],
        output_path: Path,
    ) -> None:
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            raise ReportGenerationError(f"保存JSON报告失败: {e}", "json")


class MarkdownReporter:
    @staticmethod
    def _get_rule_display_name(rule: ValidationRule) -> str:
        names: Dict[ValidationRule, str] = {
            ValidationRule.DELIVERY_MISSING: "交付清单缺失检查",
            ValidationRule.TIME_MISALIGNMENT: "时间同步检查",
            ValidationRule.COORDINATE_DEVIATION: "坐标偏离检查",
            ValidationRule.DUPLICATE_ARCHIVE: "重复归档检查",
            ValidationRule.MISSING_METADATA: "元数据缺失检查",
            ValidationRule.NO_FLY_ZONE: "禁飞区检查",
        }
        return names.get(rule, str(rule))

    @staticmethod
    def _get_severity_emoji(severity: str) -> str:
        emojis = {
            "error": "🔴",
            "warning": "🟡",
            "info": "🔵",
        }
        return emojis.get(severity, "⚪")

    @staticmethod
    def generate(
        check_report: CheckReport,
        project_config: Optional[ProjectConfig] = None,
        title: Optional[str] = None,
    ) -> str:
        lines: List[str] = []

        report_title = title or "航拍素材归档校验报告"
        lines.append(f"# {report_title}")
        lines.append("")
        lines.append("> 本报告由航拍素材归档校验员自动生成")
        lines.append("")

        lines.append("## 报告概览")
        lines.append("")

        if check_report.generated_at:
            lines.append(f"- **生成时间**: {check_report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **报告ID**: {check_report.report_id}")
        lines.append(f"- **项目ID**: {check_report.project_id}")
        lines.append("")

        lines.append("## 校验统计")
        lines.append("")

        total = check_report.total_materials
        valid = check_report.valid_materials
        invalid = check_report.invalid_materials
        quarantined = check_report.quarantined_materials

        lines.append("| 统计项 | 数量 | 占比 |")
        lines.append("|--------|------|------|")
        if total > 0:
            lines.append(f"| 总素材数 | {total} | 100% |")
            lines.append(f"| 校验通过 | {valid} | {valid/total*100:.1f}% |")
            lines.append(f"| 校验失败 | {invalid} | {invalid/total*100:.1f}% |")
        else:
            lines.append(f"| 总素材数 | {total} | - |")
            lines.append(f"| 校验通过 | {valid} | - |")
            lines.append(f"| 校验失败 | {invalid} | - |")
        if quarantined > 0:
            lines.append(f"| 已隔离 | {quarantined} | {quarantined/total*100:.1f}% |")
        lines.append("")

        lines.append("## 按规则统计")
        lines.append("")

        lines.append("| 规则名称 | 总检查数 | 通过数 | 失败数 |")
        lines.append("|----------|----------|--------|--------|")

        for rule, stats in check_report.stats_by_rule.items():
            rule_name = MarkdownReporter._get_rule_display_name(rule)
            total_rule = stats.get("total", 0)
            valid_rule = stats.get("valid", 0)
            invalid_rule = stats.get("invalid", 0)

            lines.append(f"| {rule_name} | {total_rule} | {valid_rule} | {invalid_rule} |")
        lines.append("")

        lines.append("## 异常详情")
        lines.append("")

        invalid_results = [
            r for r in check_report.validation_results
            if not r.is_valid
        ]

        if not invalid_results:
            lines.append("✅ **所有校验规则均已通过**")
            lines.append("")
        else:
            error_results = [r for r in invalid_results if r.severity == "error"]
            warning_results = [r for r in invalid_results if r.severity == "warning"]

            if error_results:
                lines.append("### 🔴 错误级异常")
                lines.append("")

                for result in error_results:
                    lines.append(f"#### 文件: `{result.material_metadata.file_name}`")
                    lines.append("")
                    lines.append(f"- **规则**: {MarkdownReporter._get_rule_display_name(result.rule_name)}")
                    lines.append(f"- **问题**: {result.message}")
                    if result.material_metadata.capture_time:
                        lines.append(f"- **拍摄时间**: {result.material_metadata.capture_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    if result.material_metadata.is_valid_geolocation():
                        lines.append(f"- **坐标**: ({result.material_metadata.latitude:.6f}, {result.material_metadata.longitude:.6f})")
                    lines.append("")

            if warning_results:
                lines.append("### 🟡 警告级异常")
                lines.append("")

                for result in warning_results:
                    lines.append(f"#### 文件: `{result.material_metadata.file_name}`")
                    lines.append("")
                    lines.append(f"- **规则**: {MarkdownReporter._get_rule_display_name(result.rule_name)}")
                    lines.append(f"- **问题**: {result.message}")
                    lines.append("")

        lines.append("## 配置信息")
        lines.append("")

        if project_config:
            lines.append(f"- **项目名称**: {project_config.project_name}")
            lines.append(f"- **项目版本**: {project_config.version}")
            lines.append(f"- **时间同步阈值**: {project_config.time_sync_threshold_seconds} 秒")
            lines.append(f"- **坐标偏离阈值**: {project_config.coordinate_deviation_threshold_meters} 米")
            lines.append("")

            lines.append("### 启用的校验规则")
            lines.append("")

            for rule in project_config.enabled_rules:
                lines.append(f"- ✅ {MarkdownReporter._get_rule_display_name(rule)}")
            lines.append("")

            if project_config.no_fly_zones:
                lines.append("### 禁飞区配置")
                lines.append("")

                for nfz in project_config.no_fly_zones:
                    lines.append(f"- **{nfz.name}**")
                    lines.append(f"  - 中心坐标: ({nfz.center_lat:.6f}, {nfz.center_lon:.6f})")
                    lines.append(f"  - 半径: {nfz.radius_meters} 米")
                lines.append("")
        else:
            lines.append("*无项目配置信息*")
            lines.append("")

        if check_report.notes:
            lines.append("## 备注")
            lines.append("")

            for note in check_report.notes:
                lines.append(f"- {note}")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*报告生成时间: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "*")

        return "\n".join(lines)

    @staticmethod
    def save(
        markdown_content: str,
        output_path: Path,
    ) -> None:
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
        except Exception as e:
            raise ReportGenerationError(f"保存Markdown报告失败: {e}", "markdown")


class ReportExporter:
    def __init__(
        self,
        check_report: CheckReport,
        project_config: Optional[ProjectConfig] = None,
    ) -> None:
        self.check_report = check_report
        self.project_config = project_config

    def export_markdown(
        self,
        output_path: Path,
        title: Optional[str] = None,
    ) -> Path:
        content = MarkdownReporter.generate(
            self.check_report,
            self.project_config,
            title,
        )
        MarkdownReporter.save(content, output_path)
        return output_path

    def export_csv(
        self,
        output_path: Path,
    ) -> Path:
        CSVReporter.generate(self.check_report, output_path)
        return output_path

    def export_json(
        self,
        output_path: Path,
    ) -> Path:
        data = JSONReporter.generate(self.check_report, self.project_config)
        JSONReporter.save(data, output_path)
        return output_path

    def export_all(
        self,
        output_directory: Path,
        base_filename: str = "validation_report",
    ) -> Dict[str, Path]:
        output_directory.mkdir(parents=True, exist_ok=True)

        paths: Dict[str, Path] = {}

        md_path = output_directory / f"{base_filename}.md"
        paths["markdown"] = self.export_markdown(md_path)

        csv_path = output_directory / f"{base_filename}.csv"
        paths["csv"] = self.export_csv(csv_path)

        json_path = output_directory / f"{base_filename}.json"
        paths["json"] = self.export_json(json_path)

        return paths
