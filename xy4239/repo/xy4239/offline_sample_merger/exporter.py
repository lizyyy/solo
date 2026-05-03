"""
导出模块 - 负责导出合并报告、冲突清单和审计包
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from .models import (
    GeoSample,
    ConflictRecord,
    ConflictType,
    MergeResult,
    PackageInfo,
)


class ReportExporter:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_markdown_report(
        self,
        packages: List[PackageInfo],
        merged_samples: List[GeoSample],
        conflicts: List[ConflictRecord],
        merge_result: MergeResult,
        filename: str = "merge_report.md",
    ) -> str:
        report_path = self.output_dir / filename

        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# 离线样本包合并报告\n\n")
            
            f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 一、合并统计摘要\n\n")
            f.write("| 指标 | 数值 |\n")
            f.write("|------|------|\n")
            f.write(f"| 扫描包数量 | {merge_result.total_packages} |\n")
            f.write(f"| 总样本数 | {merge_result.total_samples} |\n")
            f.write(f"| 合并样本数 | {merge_result.merged_samples} |\n")
            f.write(f"| 最终样本数 | {merge_result.final_sample_count} |\n")
            f.write(f"| 发现冲突数 | {merge_result.conflicts_found} |\n")
            f.write(f"| 已解决冲突 | {merge_result.conflicts_resolved} |\n")
            f.write(f"| 待复核冲突 | {merge_result.conflicts_pending} |\n")
            f.write(f"| 警告数 | {merge_result.warnings} |\n")
            f.write(f"| 错误数 | {merge_result.errors} |\n\n")

            f.write("## 二、包扫描详情\n\n")
            if packages:
                f.write("| 包名 | 格式 | 样本数 | 文件数 | 设备 | 采集者 | 校验和 |\n")
                f.write("|------|------|--------|--------|------|--------|--------|\n")
                for pkg in packages:
                    checksum = pkg.checksum[:16] + "..." if len(pkg.checksum) > 16 else pkg.checksum
                    f.write(f"| {pkg.name} | {pkg.format} | {pkg.sample_count} | {pkg.file_count} | {pkg.source_device or '-'} | {pkg.collector or '-'} | {checksum} |\n")
            else:
                f.write("无包数据\n")
            f.write("\n")

            f.write("## 三、冲突统计\n\n")
            conflicts_by_type: Dict[ConflictType, int] = {}
            for conflict in conflicts:
                conflicts_by_type[conflict.conflict_type] = conflicts_by_type.get(conflict.conflict_type, 0) + 1

            if conflicts_by_type:
                f.write("| 冲突类型 | 数量 |\n")
                f.write("|----------|------|\n")
                for conflict_type, count in conflicts_by_type.items():
                    f.write(f"| {conflict_type.value} | {count} |\n")
            else:
                f.write("无冲突\n")
            f.write("\n")

            f.write("## 四、冲突详情\n\n")
            pending_conflicts = [c for c in conflicts if not c.is_resolved]
            resolved_conflicts = [c for c in conflicts if c.is_resolved]

            if pending_conflicts:
                f.write("### 4.1 待复核冲突\n\n")
                for i, conflict in enumerate(pending_conflicts, 1):
                    f.write(f"#### 冲突 {i}: {conflict.conflict_type.value}\n\n")
                    f.write(f"- **冲突ID**: {conflict.conflict_id}\n")
                    f.write(f"- **描述**: {conflict.description}\n")
                    f.write(f"- **涉及样本**: {', '.join([s.sample_id for s in conflict.samples])}\n\n")
                    if conflict.samples:
                        f.write("**样本对比**:\n\n")
                        for j, sample in enumerate(conflict.samples, 1):
                            f.write(f"**样本 {j}**\n")
                            f.write(f"- 样本ID: {sample.sample_id}\n")
                            f.write(f"- 坐标: ({sample.latitude}, {sample.longitude})\n")
                            f.write(f"- 采集者: {sample.collector}\n")
                            f.write(f"- 采样时间: {sample.sample_time.isoformat() if sample.sample_time else '未知'}\n")
                            f.write(f"- 来源包: {sample.package_name}\n")
                            f.write(f"- 哈希值: {sample.hash_value[:20]}...\n\n")

            if resolved_conflicts:
                f.write("### 4.2 已解决冲突\n\n")
                for i, conflict in enumerate(resolved_conflicts, 1):
                    f.write(f"#### 已解决冲突 {i}: {conflict.conflict_type.value}\n\n")
                    f.write(f"- **冲突ID**: {conflict.conflict_id}\n")
                    f.write(f"- **描述**: {conflict.description}\n")
                    f.write(f"- **决策**: {conflict.decision.value if conflict.decision else '未知'}\n")
                    f.write(f"- **解决时间**: {conflict.resolved_at.isoformat() if conflict.resolved_at else '未知'}\n")
                    f.write(f"- **解决人**: {conflict.resolved_by}\n")
                    f.write(f"- **备注**: {conflict.notes or '-'}\n\n")

            f.write("## 五、样本统计\n\n")
            f.write(f"最终合并样本数量: {len(merged_samples)}\n\n")

            if merged_samples:
                f.write("### 5.1 样本列表\n\n")
                f.write("| 样本ID | 坐标 | 采集者 | 采样时间 | 岩性 | 照片数 | 来源包 |\n")
                f.write("|--------|------|--------|----------|------|--------|--------|\n")
                for sample in merged_samples:
                    coord = f"({sample.latitude:.6f}, {sample.longitude:.6f})"
                    time_str = sample.sample_time.strftime("%Y-%m-%d %H:%M") if sample.sample_time else "-"
                    photo_count = len(sample.photo_paths)
                    rock_type = sample.rock_type or "-"
                    f.write(f"| {sample.sample_id} | {coord} | {sample.collector} | {time_str} | {rock_type} | {photo_count} | {sample.package_name} |\n")

            f.write("\n---\n\n")
            f.write("*本报告由离线样本包合并器自动生成*\n")

        return str(report_path)

    def export_conflict_csv(
        self,
        conflicts: List[ConflictRecord],
        filename: str = "conflicts.csv",
    ) -> str:
        csv_path = self.output_dir / filename

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "冲突ID", "冲突类型", "状态", "描述", "涉及样本",
                "决策", "解决时间", "解决人", "备注"
            ])

            for conflict in conflicts:
                status = "已解决" if conflict.is_resolved else "待复核"
                sample_ids = "; ".join([s.sample_id for s in conflict.samples])
                decision = conflict.decision.value if conflict.decision else ""
                resolved_at = conflict.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if conflict.resolved_at else ""
                
                writer.writerow([
                    conflict.conflict_id,
                    conflict.conflict_type.value,
                    status,
                    conflict.description,
                    sample_ids,
                    decision,
                    resolved_at,
                    conflict.resolved_by,
                    conflict.notes,
                ])

        return str(csv_path)

    def export_audit_json(
        self,
        packages: List[PackageInfo],
        merged_samples: List[GeoSample],
        conflicts: List[ConflictRecord],
        merge_result: MergeResult,
        filename: str = "audit_package.json",
    ) -> str:
        json_path = self.output_dir / filename

        audit_package = {
            "metadata": {
                "export_time": datetime.now().isoformat(),
                "version": "1.0.0",
            },
            "packages": [],
            "samples": [],
            "conflicts": [],
            "merge_stats": {
                "total_packages": merge_result.total_packages,
                "total_samples": merge_result.total_samples,
                "merged_samples": merge_result.merged_samples,
                "final_sample_count": merge_result.final_sample_count,
                "conflicts_found": merge_result.conflicts_found,
                "conflicts_resolved": merge_result.conflicts_resolved,
                "conflicts_pending": merge_result.conflicts_pending,
                "photos_linked": merge_result.photos_linked,
                "photos_missing": merge_result.photos_missing,
                "warnings": merge_result.warnings,
                "errors": merge_result.errors,
            },
        }

        for pkg in packages:
            audit_package["packages"].append({
                "name": pkg.name,
                "path": pkg.path,
                "format": pkg.format,
                "checksum": pkg.checksum,
                "file_count": pkg.file_count,
                "sample_count": pkg.sample_count,
                "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
                "source_device": pkg.source_device,
                "collector": pkg.collector,
            })

        for sample in merged_samples:
            audit_package["samples"].append(sample.to_dict())

        for conflict in conflicts:
            audit_package["conflicts"].append(conflict.to_dict())

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)

        return str(json_path)

    def export_samples_csv(
        self,
        samples: List[GeoSample],
        filename: str = "merged_samples.csv",
    ) -> str:
        csv_path = self.output_dir / filename

        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            fieldnames = [
                "sample_id", "latitude", "longitude", "sample_time",
                "collector", "rock_type", "description", "depth",
                "photo_paths", "hash_value", "package_name",
                "create_time", "modify_time"
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for sample in samples:
                writer.writerow({
                    "sample_id": sample.sample_id,
                    "latitude": sample.latitude,
                    "longitude": sample.longitude,
                    "sample_time": sample.sample_time.isoformat() if sample.sample_time else "",
                    "collector": sample.collector,
                    "rock_type": sample.rock_type or "",
                    "description": sample.description or "",
                    "depth": sample.depth if sample.depth is not None else "",
                    "photo_paths": "; ".join(sample.photo_paths),
                    "hash_value": sample.hash_value,
                    "package_name": sample.package_name,
                    "create_time": sample.create_time.isoformat() if sample.create_time else "",
                    "modify_time": sample.modify_time.isoformat() if sample.modify_time else "",
                })

        return str(csv_path)

    def export_all(
        self,
        packages: List[PackageInfo],
        merged_samples: List[GeoSample],
        conflicts: List[ConflictRecord],
        merge_result: MergeResult,
        prefix: str = "",
    ) -> Dict[str, str]:
        prefix = prefix.rstrip("_") + "_" if prefix else ""

        results = {
            "markdown_report": self.export_markdown_report(
                packages, merged_samples, conflicts, merge_result,
                filename=f"{prefix}merge_report.md"
            ),
            "conflict_csv": self.export_conflict_csv(
                conflicts,
                filename=f"{prefix}conflicts.csv"
            ),
            "audit_json": self.export_audit_json(
                packages, merged_samples, conflicts, merge_result,
                filename=f"{prefix}audit_package.json"
            ),
            "samples_csv": self.export_samples_csv(
                merged_samples,
                filename=f"{prefix}merged_samples.csv"
            ),
        }

        return results
