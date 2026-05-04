"""数据导出模块"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from collections import defaultdict

from ..analysis.grouping import AnalysisResult, DefectGroup, AnomalyDetection
from ..io.importer import ImportResult
from ..storage.repository import DataRepository
from ..storage.models import Sample, DefectGroupModel, AnomalyModel


def export_markdown(
    result: AnalysisResult,
    output_path: str,
    import_result: Optional[ImportResult] = None
) -> str:
    """导出 Markdown 复盘单"""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    lines = []

    gen_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    lines.append(f"# 玻璃吹制试样质检复盘单")
    lines.append("")
    lines.append(f"**批次ID**: {result.batch_id}")
    lines.append(f"**生成时间**: {gen_time}")
    lines.append(f"**总试样数**: {result.total_samples}")
    lines.append(f"**缺陷分组数**: {len(result.groups)}")
    lines.append(f"**异常检测数**: {len(result.anomalies)}")
    lines.append("")

    lines.append("## 一、统计摘要")
    lines.append("")

    summary = result.summary

    lines.append("### 1.1 整体情况")
    lines.append("")
    lines.append("- **总试样数**: {} 个".format(summary.get('total_samples', 0)))
    lines.append("- **缺陷分组数**: {} 组".format(summary.get('total_groups', 0)))
    lines.append("- **异常检测数**: {} 个".format(summary.get('total_anomalies', 0)))
    lines.append("- **气泡异常**: {} 个".format(summary.get('bubble_abnormal_count', 0)))
    lines.append("- **气泡正常**: {} 个".format(summary.get('bubble_normal_count', 0)))
    lines.append("")

    defect_dist = summary.get('defect_distribution', {})
    if defect_dist:
        lines.append("### 1.2 缺陷分布")
        lines.append("")
        lines.append("| 缺陷类型 | 试样数量 |")
        lines.append("|---------|---------|")
        for defect_type, count in defect_dist.items():
            lines.append(f"| {defect_type} | {count} |")
        lines.append("")

    anomaly_dist = summary.get('anomaly_distribution', {})
    if anomaly_dist:
        lines.append("### 1.3 异常分布")
        lines.append("")
        lines.append("| 异常类型 | 数量 |")
        lines.append("|---------|------|")
        for anomaly_type, count in anomaly_dist.items():
            lines.append(f"| {anomaly_type} | {count} |")
        lines.append("")

    lines.append("## 二、缺陷分组详情")
    lines.append("")

    for idx, group in enumerate(result.groups, 1):
        lines.append(f"### 2.{idx} {group.name}")
        lines.append("")
        lines.append(f"- **分组ID**: {group.group_id}")
        lines.append(f"- **主要缺陷类型**: {group.dominant_defect_type}")
        lines.append(f"- **试样数量**: {len(group.sample_ids)}")
        lines.append(f"- **组内相似度**: {group.similarity_score:.2%}")
        lines.append(f"- **分组方式**: {'手动' if group.is_manual else '自动'}")
        lines.append("")

        if group.features_summary:
            lines.append("**特征摘要**:")
            lines.append("")
            fs = group.features_summary
            lines.append(f"- 平均气泡数: {fs.get('avg_bubble_count', 0):.1f} 个")
            lines.append(f"- 最大气泡数: {fs.get('max_bubble_count', 0)} 个")
            lines.append(f"- 平均气泡占比: {fs.get('avg_bubble_ratio', 0):.2%}")
            lines.append(f"- 平均颜色对比度: {fs.get('avg_color_contrast', 0):.1f}")
            lines.append("")

        lines.append("**包含试样:**")
        lines.append("")
        sample_ids_str = ", ".join(group.sample_ids[:10])
        if len(group.sample_ids) > 10:
            sample_ids_str += f" ... 等共 {len(group.sample_ids)} 个"
        lines.append(f"- {sample_ids_str}")
        lines.append("")

    lines.append("## 三、异常检测详情")
    lines.append("")

    if result.anomalies:
        for idx, anomaly in enumerate(result.anomalies, 1):
            severity_label = "高" if anomaly.severity > 0.7 else "中" if anomaly.severity > 0.4 else "低"

            lines.append(f"### 3.{idx} 试样 {anomaly.sample_id}")
            lines.append("")
            lines.append(f"- **异常类型**: {anomaly.anomaly_type}")
            lines.append(f"- **严重程度**: {severity_label} ({anomaly.severity:.2%})")
            lines.append(f"- **描述**: {anomaly.description}")
            lines.append("")

            if anomaly.comparison_samples:
                lines.append(f"**对比试样**: {', '.join(anomaly.comparison_samples)}")
                lines.append("")

            if anomaly.details:
                lines.append("**详细信息**:")
                lines.append("")
                for key, value in anomaly.details.items():
                    if isinstance(value, float):
                        lines.append(f"- {key}: {value:.4f}")
                    else:
                        lines.append(f"- {key}: {value}")
                lines.append("")
    else:
        lines.append("*未检测到异常*")
        lines.append("")

    lines.append("## 四、配方分析")
    lines.append("")

    if import_result and import_result.samples:
        formula_groups = defaultdict(list)
        for sample in import_result.samples:
            formula_groups[sample.formula].append(sample)

        if len(formula_groups) > 1 or (len(formula_groups) == 1 and list(formula_groups.keys())[0] != "default"):
            lines.append("### 4.1 配方分布")
            lines.append("")
            lines.append("| 配方 | 试样数量 |")
            lines.append("|------|---------|")
            for formula, samples in formula_groups.items():
                lines.append(f"| {formula} | {len(samples)} |")
            lines.append("")

            lines.append("### 4.2 配方间对比")
            lines.append("")

            for formula, samples in formula_groups.items():
                bubble_counts = [s.image_features.bubble.bubble_count for s in samples]
                bubble_ratios = [s.image_features.bubble.bubble_area_ratio for s in samples]

                lines.append(f"**配方 {formula}**:")
                lines.append("")
                lines.append(f"- 试样数: {len(samples)}")
                lines.append(f"- 平均气泡数: {sum(bubble_counts)/len(bubble_counts):.1f} 个")
                lines.append(f"- 平均气泡占比: {sum(bubble_ratios)/len(bubble_ratios):.2%}")
                lines.append("")

    lines.append("## 五、建议")
    lines.append("")

    suggestions = []

    bubble_abnormal = summary.get('bubble_abnormal_count', 0)
    if bubble_abnormal > 0:
        suggestions.append(f"- **气泡问题**: 检测到 {bubble_abnormal} 个试样存在气泡异常，建议检查：")
        suggestions.append("  - 窑炉温度曲线是否平稳")
        suggestions.append("  - 玻璃料熔化是否充分")
        suggestions.append("  - 操作过程中是否引入空气")

    color_anomalies = [a for a in result.anomalies if a.anomaly_type == "色差"]
    if color_anomalies:
        suggestions.append(f"- **色差问题**: 检测到 {len(color_anomalies)} 个试样存在色差异常")
        suggestions.append("  - 检查同配方试样颜色一致性")
        suggestions.append("  - 确认窑炉温度分布是否均匀")

    temp_anomalies = [a for a in result.anomalies if a.anomaly_type == "温度"]
    if temp_anomalies:
        suggestions.append(f"- **温度问题**: 检测到 {len(temp_anomalies)} 个试样关联温度异常")
        suggestions.append("  - 检查窑炉温度记录设备")
        suggestions.append("  - 确认温度控制程序是否正确")

    if suggestions:
        for s in suggestions:
            lines.append(s)
            if not s.startswith("  "):
                lines.append("")
    else:
        lines.append("*本次检测未发现明显问题，建议定期检查试样质量良好。*")
        lines.append("")

    lines.append("---")
    lines.append("")
    gen_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    lines.append(f"*报告生成时间: {gen_time}*")
    lines.append("")

    content = "\n".join(lines)

    with open(output, 'w', encoding='utf-8') as f:
        f.write(content)

    return str(output)


def export_json(
    result: AnalysisResult,
    output_path: str,
    import_result: Optional[ImportResult] = None
) -> str:
    """导出 JSON 明细"""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "batch_id": result.batch_id,
        "generated_at": datetime.now().isoformat(),
        "total_samples": result.total_samples,
        "summary": result.summary,
    }

    data["groups"] = []
    for group in result.groups:
        group_dict = group.to_dict()
        data["groups"].append(group_dict)

    data["anomalies"] = []
    for anomaly in result.anomalies:
        anomaly_dict = anomaly.to_dict()
        data["anomalies"].append(anomaly_dict)

    if import_result:
        data["import_info"] = {
            "total_imported": len(import_result.samples),
            "errors": import_result.errors,
            "warnings": import_result.warnings,
        }

        data["samples"] = []
        for sample in import_result.samples:
            sample_dict = {
                "sample_id": sample.sample_id,
                "image_path": sample.image_path,
                "batch_id": sample.batch_id,
                "formula": sample.formula,
                "notes": sample.notes,
                "metadata": sample.metadata,
            }

            if sample.image_features:
                sample_dict["image_features"] = sample.image_features.to_dict()

            if sample.text_features:
                sample_dict["text_features"] = sample.text_features.to_dict()

            if sample.kiln_temperature_data:
                sample_dict["temperature_data"] = sample.kiln_temperature_data

            data["samples"].append(sample_dict)

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    return str(output)


def export_batch_markdown(
    batch_id: str,
    output_path: str,
    repo: DataRepository
) -> str:
    """从数据库导出批次的 Markdown 复盘单"""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    batch = repo.get_batch(batch_id)
    if not batch:
        raise ValueError(f"Batch not found: {batch_id}")

    samples = repo.get_samples_by_batch(batch_id)
    groups = repo.get_groups_by_batch(batch_id)
    anomalies = repo.get_anomalies_by_batch(batch_id)

    lines = []
    gen_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    lines.append(f"# 玻璃吹制试样质检复盘单")
    lines.append("")
    lines.append(f"**批次ID**: {batch_id}")
    lines.append(f"**批次名称**: {batch.name or '-'}")
    lines.append(f"**生成时间**: {gen_time}")
    lines.append(f"**总试样数**: {len(samples)}")
    lines.append(f"**缺陷分组数**: {len(groups)}")
    lines.append(f"**异常检测数**: {len(anomalies)}")
    lines.append("")

    lines.append("## 一、统计摘要")
    lines.append("")

    verified_count = sum(1 for s in samples if s.is_verified)

    lines.append("### 1.1 整体情况")
    lines.append("")
    lines.append(f"- **总试样数**: {len(samples)} 个")
    lines.append(f"- **已确认试样**: {verified_count} 个")
    lines.append(f"- **缺陷分组数**: {len(groups)} 组")
    lines.append(f"- **异常检测数**: {len(anomalies)} 个")
    lines.append("")

    lines.append("## 二、缺陷分组详情")
    lines.append("")

    for idx, group in enumerate(groups, 1):
        group_samples = [s for s in samples if s.group_id == group.id]

        lines.append(f"### 2.{idx} {group.name}")
        lines.append("")
        lines.append(f"- **分组ID**: {group.group_id}")
        lines.append(f"- **主要缺陷类型**: {group.dominant_defect_type}")
        lines.append(f"- **试样数量**: {len(group_samples)}")
        lines.append(f"- **组内相似度**: {group.similarity_score:.2%}")
        lines.append(f"- **分组方式**: {'手动' if group.is_manual else '自动'}")
        lines.append("")

        sample_ids = [s.sample_id for s in group_samples]
        if sample_ids:
            lines.append("**包含试样**:")
            lines.append("")
            sample_ids_str = ", ".join(sample_ids[:10])
            if len(sample_ids) > 10:
                sample_ids_str += f" ... 等共 {len(sample_ids)} 个"
            lines.append(f"- {sample_ids_str}")
            lines.append("")

    lines.append("## 三、异常检测详情")
    lines.append("")

    if anomalies:
        for idx, anomaly in enumerate(anomalies, 1):
            severity_label = "高" if anomaly.severity > 0.7 else "中" if anomaly.severity > 0.4 else "低"
            reviewed_label = "已复核" if anomaly.is_reviewed else "待复核"

            lines.append(f"### 3.{idx} 试样 {anomaly.sample_id}")
            lines.append("")
            lines.append(f"- **异常类型**: {anomaly.anomaly_type}")
            lines.append(f"- **严重程度**: {severity_label} ({anomaly.severity:.2%})")
            lines.append(f"- **状态**: {reviewed_label}")
            lines.append(f"- **描述**: {anomaly.description}")
            lines.append("")

            if anomaly.review_notes:
                lines.append(f"**复核备注**: {anomaly.review_notes}")
                lines.append("")
    else:
        lines.append("*未检测到异常*")
        lines.append("")

    lines.append("## 四、试样列表")
    lines.append("")

    lines.append("| 试样ID | 配方 | 气泡数 | 状态 |")
    lines.append("|--------|------|--------|------|")

    for sample in samples[:50]:
        bubble_count = sample.image_features.bubble_count if sample.image_features else 0
        status = "已确认" if sample.is_verified else "待确认"
        lines.append(f"| {sample.sample_id} | {sample.formula or '-'} | {bubble_count} | {status} |")

    if len(samples) > 50:
        lines.append("")
        lines.append(f"... 还有 {len(samples) - 50} 个试样未显示")

    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {gen_time}*")
    lines.append("")

    content = "\n".join(lines)

    with open(output, 'w', encoding='utf-8') as f:
        f.write(content)

    return str(output)


def export_batch_json(
    batch_id: str,
    output_path: str,
    repo: DataRepository
) -> str:
    """从数据库导出批次的 JSON 明细"""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    batch = repo.get_batch(batch_id)
    if not batch:
        raise ValueError(f"Batch not found: {batch_id}")

    samples = repo.get_samples_by_batch(batch_id)
    groups = repo.get_groups_by_batch(batch_id)
    anomalies = repo.get_anomalies_by_batch(batch_id)

    data = {
        "batch_id": batch_id,
        "batch_name": batch.name,
        "generated_at": datetime.now().isoformat(),
        "total_samples": len(samples),
    }

    data["groups"] = []
    for group in groups:
        group_samples = [s for s in samples if s.group_id == group.id]
        group_dict = {
            "group_id": group.group_id,
            "name": group.name,
            "description": group.description,
            "dominant_defect_type": group.dominant_defect_type,
            "similarity_score": group.similarity_score,
            "is_manual": group.is_manual,
            "sample_count": len(group_samples),
            "sample_ids": [s.sample_id for s in group_samples],
        }
        data["groups"].append(group_dict)

    data["anomalies"] = []
    for anomaly in anomalies:
        anomaly_dict = {
            "anomaly_id": anomaly.anomaly_id,
            "sample_id": anomaly.sample_id,
            "anomaly_type": anomaly.anomaly_type,
            "severity": anomaly.severity,
            "description": anomaly.description,
            "is_reviewed": anomaly.is_reviewed,
            "reviewed_at": anomaly.reviewed_at.isoformat() if anomaly.reviewed_at else None,
            "reviewed_by": anomaly.reviewed_by,
            "review_notes": anomaly.review_notes,
        }
        data["anomalies"].append(anomaly_dict)

    data["samples"] = []
    for sample in samples:
        sample_dict = {
            "sample_id": sample.sample_id,
            "image_path": sample.image_path,
            "formula": sample.formula,
            "notes": sample.notes,
            "is_verified": sample.is_verified,
            "verified_at": sample.verified_at.isoformat() if sample.verified_at else None,
            "verified_by": sample.verified_by,
            "verification_notes": sample.verification_notes,
        }

        if sample.image_features:
            img = sample.image_features
            sample_dict["image_features"] = {
                "width": img.width,
                "height": img.height,
                "avg_lab": [img.avg_lab_l, img.avg_lab_a, img.avg_lab_b],
                "color_contrast": img.color_contrast,
                "brightness": img.brightness,
                "bubble_count": img.bubble_count,
                "bubble_area_ratio": img.bubble_area_ratio,
            }

        if sample.text_features:
            txt = sample.text_features
            sample_dict["text_features"] = {
                "has_defect": txt.has_defect,
                "defect_categories": txt.defect_categories,
                "defect_keywords": txt.defect_keywords,
            }

        data["samples"].append(sample_dict)

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    return str(output)
