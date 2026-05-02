"""镜头瑕疵分拣台 - 报告生成模块"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, TextIO

from .models import (
    SessionState,
    LensInspection,
    DefectDetection,
    ImageFeatures,
    InspectionStatus,
)


class ReportGenerator:
    def __init__(self):
        pass

    def generate_markdown_report(
        self,
        state: SessionState,
        output_path: str,
        include_all: bool = True,
        include_normal: bool = False,
    ) -> Path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        inspections = state.inspections
        if not include_normal:
            inspections = {
                k: v
                for k, v in inspections.items()
                if v.anomaly_score > 0.1 or v.defects or v.human_verified
            }

        report_content = self._build_markdown_content(state, inspections, include_all)

        with open(output, "w", encoding="utf-8") as f:
            f.write(report_content)

        return output

    def _build_markdown_content(
        self,
        state: SessionState,
        inspections: Dict[str, LensInspection],
        include_all: bool,
    ) -> str:
        lines = []

        lines.append("# 镜头瑕疵检测报告")
        lines.append("")
        lines.append(f"- **报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **会话ID**: {state.session_id}")
        lines.append(f"- **检测目录**: {state.inspection_dir}")
        if state.notes_csv:
            lines.append(f"- **备注CSV**: {state.notes_csv}")
        lines.append(f"- **总检测数量**: {len(state.inspections)}")
        lines.append(f"- **本报告涵盖数量**: {len(inspections)}")
        lines.append("")

        lines.append("## 检测概览")
        lines.append("")

        if inspections:
            status_counts: Dict[str, int] = {}
            cluster_counts: Dict[str, int] = {}
            defect_type_counts: Dict[str, int] = {}
            total_anomaly = 0.0

            for insp in inspections.values():
                status = insp.status.value
                status_counts[status] = status_counts.get(status, 0) + 1

                cluster = insp.cluster_label or "未聚类"
                cluster_counts[cluster] = cluster_counts.get(cluster, 0) + 1

                for defect in insp.defects:
                    dtype = defect.defect_type.value
                    defect_type_counts[dtype] = defect_type_counts.get(dtype, 0) + 1

                total_anomaly += insp.anomaly_score

            avg_anomaly = total_anomaly / len(inspections) if inspections else 0.0

            lines.append(f"- **平均异常评分**: {avg_anomaly:.3f}")
            lines.append(f"- **最高异常评分**: {max(insp.anomaly_score for insp in inspections.values()):.3f}")
            lines.append("")

            lines.append("### 状态分布")
            lines.append("")
            lines.append("| 状态 | 数量 |")
            lines.append("|------|------|")
            for status, count in sorted(status_counts.items()):
                lines.append(f"| {status} | {count} |")
            lines.append("")

            if cluster_counts:
                lines.append("### 聚类分布")
                lines.append("")
                lines.append("| 聚类类型 | 数量 |")
                lines.append("|----------|------|")
                for cluster, count in sorted(cluster_counts.items()):
                    lines.append(f"| {cluster} | {count} |")
                lines.append("")

            if defect_type_counts:
                lines.append("### 缺陷类型分布")
                lines.append("")
                lines.append("| 缺陷类型 | 数量 |")
                lines.append("|----------|------|")
                for dtype, count in sorted(defect_type_counts.items()):
                    lines.append(f"| {dtype} | {count} |")
                lines.append("")
        else:
            lines.append("*本报告未包含任何检测结果。*")
            lines.append("")

        lines.append("## 详细检测结果")
        lines.append("")

        sorted_inspections = sorted(
            inspections.items(),
            key=lambda x: x[1].anomaly_score,
            reverse=True,
        )

        for lens_id, inspection in sorted_inspections:
            lines.append(f"### 镜头 {lens_id}")
            lines.append("")

            severity = "🟢 正常"
            if inspection.anomaly_score > 0.7:
                severity = "🔴 严重"
            elif inspection.anomaly_score > 0.4:
                severity = "🟡 中等"
            elif inspection.anomaly_score > 0.1:
                severity = "🟡 轻微"

            lines.append(f"- **异常评分**: {inspection.anomaly_score:.3f} ({severity})")
            lines.append(f"- **检测状态**: {inspection.status.value}")
            if inspection.cluster_label:
                lines.append(f"- **聚类类型**: {inspection.cluster_label}")

            if inspection.human_verified:
                lines.append(f"- **人工确认**: ✅ 已确认")
                if inspection.human_notes:
                    lines.append(f"- **人工备注**: {inspection.human_notes}")

            lines.append("")

            if inspection.anomaly_score_breakdown:
                lines.append("#### 评分详情")
                lines.append("")
                lines.append("| 维度 | 评分 |")
                lines.append("|------|------|")
                breakdown = inspection.anomaly_score_breakdown
                for key in ["sharpness", "dark_corner", "color_shift", "dead_pixel", "hot_pixel", "noise"]:
                    label = {
                        "sharpness": "清晰度",
                        "dark_corner": "暗角",
                        "color_shift": "色偏",
                        "dead_pixel": "坏点",
                        "hot_pixel": "热点",
                        "noise": "噪点",
                    }.get(key, key)
                    score = breakdown.get(key, 0.0)
                    lines.append(f"| {label} | {score:.3f} |")
                lines.append("")

            if inspection.defects:
                lines.append("#### 检测到的缺陷")
                lines.append("")
                lines.append("| 缺陷ID | 类型 | 置信度 | 严重程度 | 位置 | 描述 |")
                lines.append("|--------|------|--------|----------|------|------|")
                for defect in inspection.defects:
                    lines.append(
                        f"| {defect.defect_id} | {defect.defect_type.value} | "
                        f"{defect.confidence:.2f} | {defect.severity} | "
                        f"({defect.location[0]}, {defect.location[1]}) | {defect.description} |"
                    )
                lines.append("")

            if inspection.similar_defects:
                lines.append("#### 相似缺陷镜头")
                lines.append("")
                lines.append(f"- 相似镜头: {', '.join(inspection.similar_defects)}")
                lines.append("")

            if inspection.note:
                lines.append("#### 原始备注")
                lines.append("")
                if inspection.note.notes:
                    lines.append(f"- 备注: {inspection.note.notes}")
                if inspection.note.body_id:
                    lines.append(f"- 机身编号: {inspection.note.body_id}")
                if inspection.note.inspector:
                    lines.append(f"- 检测员: {inspection.note.inspector}")
                if inspection.note.received_date:
                    lines.append(f"- 接收日期: {inspection.note.received_date.strftime('%Y-%m-%d')}")
                lines.append("")

            lines.append("---")
            lines.append("")

        lines.append("## 报告说明")
        lines.append("")
        lines.append("### 异常评分说明")
        lines.append("")
        lines.append("- **0.0 - 0.1**: 正常，无明显缺陷")
        lines.append("- **0.1 - 0.4**: 轻微异常，可能需要关注")
        lines.append("- **0.4 - 0.7**: 中等异常，建议人工检查")
        lines.append("- **0.7 - 1.0**: 严重异常，必须人工确认")
        lines.append("")

        lines.append("### 缺陷类型说明")
        lines.append("")
        lines.append("- **霉斑**: 镜头内部霉菌生长")
        lines.append("- **暗角**: 边角亮度低于中心")
        lines.append("- **色偏**: RGB通道不均衡")
        lines.append("- **坏点**: 持续暗的像素点")
        lines.append("- **热点**: 持续亮的像素点")
        lines.append("- **偏心**: 光学中心偏移导致清晰度不均")
        lines.append("")

        return "\n".join(lines)

    def generate_csv_report(
        self,
        state: SessionState,
        output_path: str,
        include_all: bool = True,
    ) -> Path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        inspections = state.inspections

        rows = []
        for lens_id, inspection in inspections.items():
            base_row = {
                "lens_id": lens_id,
                "anomaly_score": f"{inspection.anomaly_score:.4f}",
                "status": inspection.status.value,
                "cluster_label": inspection.cluster_label or "",
                "human_verified": "是" if inspection.human_verified else "否",
                "human_notes": inspection.human_notes,
                "body_id": inspection.note.body_id if inspection.note else "",
                "inspector": inspection.note.inspector if inspection.note else "",
                "original_notes": inspection.note.notes if inspection.note else "",
                "received_date": (
                    inspection.note.received_date.strftime("%Y-%m-%d")
                    if inspection.note and inspection.note.received_date
                    else ""
                ),
            }

            if inspection.anomaly_score_breakdown:
                breakdown = inspection.anomaly_score_breakdown
                base_row["sharpness_score"] = f"{breakdown.get('sharpness', 0.0):.4f}"
                base_row["dark_corner_score"] = f"{breakdown.get('dark_corner', 0.0):.4f}"
                base_row["color_shift_score"] = f"{breakdown.get('color_shift', 0.0):.4f}"
                base_row["dead_pixel_score"] = f"{breakdown.get('dead_pixel', 0.0):.4f}"
                base_row["hot_pixel_score"] = f"{breakdown.get('hot_pixel', 0.0):.4f}"
                base_row["noise_score"] = f"{breakdown.get('noise', 0.0):.4f}"

            if inspection.defects:
                defect_types = [d.defect_type.value for d in inspection.defects]
                base_row["defect_types"] = ";".join(defect_types)
                base_row["defect_count"] = len(inspection.defects)

                high_defects = [d for d in inspection.defects if d.severity == "高"]
                base_row["high_severity_count"] = len(high_defects)
            else:
                base_row["defect_types"] = ""
                base_row["defect_count"] = 0
                base_row["high_severity_count"] = 0

            if inspection.similar_defects:
                base_row["similar_lenses"] = ";".join(inspection.similar_defects)
            else:
                base_row["similar_lenses"] = ""

            rows.append(base_row)

        if rows:
            fieldnames = list(rows[0].keys())
            with open(output, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        else:
            with open(output, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["备注"])
                writer.writerow(["没有检测数据"])

        return output

    def generate_defect_details_csv(
        self,
        state: SessionState,
        output_path: str,
    ) -> Path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        rows = []
        for lens_id, inspection in state.inspections.items():
            for defect in inspection.defects:
                row = {
                    "lens_id": lens_id,
                    "defect_id": defect.defect_id,
                    "defect_type": defect.defect_type.value,
                    "confidence": f"{defect.confidence:.4f}",
                    "severity": defect.severity,
                    "location_x": defect.location[0],
                    "location_y": defect.location[1],
                    "area": f"{defect.area:.6f}",
                    "description": defect.description,
                    "image_id": defect.image_id,
                }
                rows.append(row)

        if rows:
            fieldnames = list(rows[0].keys())
            with open(output, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        else:
            with open(output, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["备注"])
                writer.writerow(["没有检测到缺陷"])

        return output

    def generate_json_audit(
        self,
        state: SessionState,
        output_path: str,
        include_image_features: bool = True,
    ) -> Path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        audit_data = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "session": {
                "session_id": state.session_id,
                "inspection_dir": state.inspection_dir,
                "notes_csv": state.notes_csv,
                "created_at": state.created_at.isoformat(),
                "updated_at": state.updated_at.isoformat(),
            },
            "inspections": [],
        }

        for lens_id, inspection in state.inspections.items():
            insp_data = {
                "lens_id": lens_id,
                "images": inspection.images,
                "anomaly_score": inspection.anomaly_score,
                "anomaly_score_breakdown": inspection.anomaly_score_breakdown,
                "cluster_id": inspection.cluster_id,
                "cluster_label": inspection.cluster_label,
                "similar_defects": inspection.similar_defects,
                "status": inspection.status.value,
                "human_verified": inspection.human_verified,
                "human_notes": inspection.human_notes,
                "created_at": inspection.created_at.isoformat(),
                "updated_at": inspection.updated_at.isoformat(),
            }

            if include_image_features:
                insp_data["image_features"] = {
                    k: v.to_dict() for k, v in inspection.image_features.items()
                }

            insp_data["defects"] = [d.to_dict() for d in inspection.defects]

            if inspection.note:
                insp_data["note"] = inspection.note.to_dict()

            audit_data["inspections"].append(insp_data)

        audit_data["summary"] = self._generate_audit_summary(state)

        with open(output, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

        return output

    def _generate_audit_summary(self, state: SessionState) -> Dict[str, Any]:
        inspections = state.inspections.values()

        status_counts: Dict[str, int] = {}
        cluster_counts: Dict[str, int] = {}
        defect_type_counts: Dict[str, int] = {}

        scores = []
        high_anomaly = 0

        for insp in inspections:
            status = insp.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

            cluster = insp.cluster_label or "未聚类"
            cluster_counts[cluster] = cluster_counts.get(cluster, 0) + 1

            for defect in insp.defects:
                dtype = defect.defect_type.value
                defect_type_counts[dtype] = defect_type_counts.get(dtype, 0) + 1

            scores.append(insp.anomaly_score)
            if insp.anomaly_score > 0.5:
                high_anomaly += 1

        return {
            "total_count": len(state.inspections),
            "status_distribution": status_counts,
            "cluster_distribution": cluster_counts,
            "defect_type_distribution": defect_type_counts,
            "anomaly_statistics": {
                "min": min(scores) if scores else 0.0,
                "max": max(scores) if scores else 0.0,
                "mean": sum(scores) / len(scores) if scores else 0.0,
                "high_anomaly_count": high_anomaly,
            },
        }
