import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import ANOMALY_TYPES, MATERIAL_TYPES, REPORT_EXPORT_DIR
from ..utils import generate_report_no, sanitize_filename
from .material_service import get_batch, get_material


REPORT_TEMPLATE = """# CI缓存污染定位报告

**报告编号**: {report_no}
**批次编号**: {batch_no}
**批次名称**: {batch_name}
**生成时间**: {generated_at}
**报告状态**: {status}

---

## 1. 分析概要

{summary}

### 异常统计

| 异常类型 | 数量 | 严重程度 |
|---------|------|---------|
{anomaly_table_rows}

**总计异常数**: {anomaly_count}

---

## 2. 材料溯源

本次分析使用了以下材料，所有材料均可追溯来源：

{material_section}

---

## 3. 日志解析结果

共解析 {log_total} 条日志条目：

| 分类 | 数量 |
|-----|------|
{log_category_rows}

### 异常日志摘要

{anomaly_logs_section}

---

## 4. 缓存指纹分析

共分析 {fingerprint_total} 个依赖缓存指纹：

| 状态 | 数量 |
|-----|------|
{fingerprint_status_rows}

### 指纹不匹配详情

{fingerprint_mismatch_section}

---

## 5. 失败聚类分析

{cluster_section}

---

## 6. 复现脚本

{script_section}

---

## 7. 异常详情

{anomaly_detail_section}

---

## 8. 修复建议

{recommendation_section}

---

## 9. 复核记录

{review_section}

---

*本报告由CI缓存污染定位系统自动生成，所有数据基于同一批次材料分析，确保结果一致性。*
"""


def generate_report_content(db: Session, batch: models.Batch, report_no: str) -> Dict:
    materials = db.query(models.Material).filter(
        models.Material.batch_id == batch.id,
    ).all()

    parsed_logs = db.query(models.ParsedLogEntry).filter(
        models.ParsedLogEntry.batch_id == batch.id,
    ).all()

    fingerprints = db.query(models.CacheFingerprint).filter(
        models.CacheFingerprint.batch_id == batch.id,
    ).all()

    clusters = db.query(models.FailureCluster).filter(
        models.FailureCluster.batch_id == batch.id,
    ).all()

    scripts = db.query(models.ReproductionScript).filter(
        models.ReproductionScript.batch_id == batch.id,
    ).all()

    anomalies = db.query(models.Anomaly).filter(
        models.Anomaly.batch_id == batch.id,
    ).all()

    material_section = _build_material_section(materials)
    log_category_rows = _build_log_category_table(parsed_logs)
    anomaly_logs_section = _build_anomaly_logs_section(parsed_logs, db)
    fingerprint_status_rows = _build_fingerprint_status_table(fingerprints)
    fingerprint_mismatch_section = _build_fingerprint_mismatch_section(fingerprints, db)
    cluster_section = _build_cluster_section(clusters, db)
    script_section = _build_script_section(scripts, db)
    anomaly_detail_section = _build_anomaly_detail_section(anomalies, db)
    anomaly_table_rows = _build_anomaly_table(anomalies)
    recommendation_section = _build_recommendation_section(anomalies)
    review_section = _build_review_section(None)

    summary = _build_summary(batch, anomalies, parsed_logs, fingerprints)

    content = REPORT_TEMPLATE.format(
        report_no=report_no,
        batch_no=batch.batch_no,
        batch_name=batch.name,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status="待复核",
        summary=summary,
        anomaly_table_rows=anomaly_table_rows,
        anomaly_count=len(anomalies),
        material_section=material_section,
        log_total=len(parsed_logs),
        log_category_rows=log_category_rows,
        anomaly_logs_section=anomaly_logs_section,
        fingerprint_total=len(fingerprints),
        fingerprint_status_rows=fingerprint_status_rows,
        fingerprint_mismatch_section=fingerprint_mismatch_section,
        cluster_section=cluster_section,
        script_section=script_section,
        anomaly_detail_section=anomaly_detail_section,
        recommendation_section=recommendation_section,
        review_section=review_section,
    )

    anomaly_details = {}
    for anomaly in anomalies:
        atype = anomaly.anomaly_type
        if atype not in anomaly_details:
            anomaly_details[atype] = {
                "name": ANOMALY_TYPES.get(atype, atype),
                "count": 0,
                "severity": anomaly.severity,
            }
        anomaly_details[atype]["count"] += 1

    return {
        "content": content,
        "summary": summary,
        "anomaly_count": len(anomalies),
        "anomaly_details": anomaly_details,
        "meta": {
            "materials_count": len(materials),
            "logs_count": len(parsed_logs),
            "fingerprints_count": len(fingerprints),
            "clusters_count": len(clusters),
            "scripts_count": len(scripts),
        },
    }


def _build_summary(batch: models.Batch, anomalies: List[models.Anomaly],
                   logs: List[models.ParsedLogEntry], fingerprints: List[models.CacheFingerprint]) -> str:
    anomaly_count = len(anomalies)
    log_anomalies = sum(1 for l in logs if l.is_anomaly)
    fp_mismatches = sum(1 for fp in fingerprints if fp.status in ["mismatch", "unexpected_miss"])

    if anomaly_count == 0:
        return f"本次分析未发现明显的CI缓存污染问题。共分析{len(logs)}条日志、{len(fingerprints)}个依赖指纹，所有指标正常。"

    severity = "高" if any(a.severity == "high" for a in anomalies) else "中"
    unique_types = list({a.anomaly_type: a for a in anomalies}.values())
    types = ", ".join([ANOMALY_TYPES.get(a.anomaly_type, a.anomaly_type) for a in unique_types])

    return (
        f"本次分析检测到 **{anomaly_count}** 个潜在CI缓存污染问题，风险等级：**{severity}**。\n\n"
        f"- 异常类型包括：{types}\n"
        f"- 检测到 {log_anomalies} 条异常日志条目\n"
        f"- 发现 {fp_mismatches} 个缓存指纹不匹配\n\n"
        f"建议立即排查以下异常并采取相应修复措施。"
    )


def _build_anomaly_table(anomalies: List[models.Anomaly]) -> str:
    type_counts: Dict[str, Dict] = {}
    for a in anomalies:
        atype = a.anomaly_type
        if atype not in type_counts:
            type_counts[atype] = {"count": 0, "severity": a.severity}
        type_counts[atype]["count"] += 1
        if a.severity == "high":
            type_counts[atype]["severity"] = "high"

    rows = []
    for atype, info in type_counts.items():
        sev_map = {"high": "🔴 高", "medium": "🟡 中", "low": "🟢 低", "info": "ℹ️ 信息"}
        rows.append(f"| {ANOMALY_TYPES.get(atype, atype)} | {info['count']} | {sev_map.get(info['severity'], info['severity'])} |")
    return "\n".join(rows) if rows else "| 无异常 | 0 | - |"


def _build_material_section(materials: List[models.Material]) -> str:
    if not materials:
        return "无材料记录"

    lines = []
    for mat in materials:
        mtype = MATERIAL_TYPES.get(mat.material_type, mat.material_type)
        lines.append(f"### {mtype}: {mat.name}")
        lines.append(f"- **材料ID**: {mat.id}")
        lines.append(f"- **来源**: {mat.source}")
        lines.append(f"- **内容哈希**: {mat.content_hash or 'N/A'}")
        lines.append(f"- **存储路径**: `{mat.file_path or 'N/A'}`")
        if mat.meta:
            meta_str = ", ".join([f"{k}={v}" for k, v in mat.meta.items()])
            lines.append(f"- **元数据**: {meta_str}")
        lines.append("")
    return "\n".join(lines)


def _build_log_category_table(logs: List[models.ParsedLogEntry]) -> str:
    counts: Dict[str, int] = {}
    for log in logs:
        cat = log.category or "other"
        counts[cat] = counts.get(cat, 0) + 1

    cat_map = {
        "cache": "缓存操作",
        "test_artifact": "测试产物",
        "env_var": "环境变量",
        "dependency": "依赖管理",
        "error": "错误日志",
        "other": "其他",
    }

    rows = []
    for cat, count in sorted(counts.items(), key=lambda x: -x[1]):
        rows.append(f"| {cat_map.get(cat, cat)} | {count} |")
    return "\n".join(rows)


def _build_anomaly_logs_section(logs: List[models.ParsedLogEntry], db: Session) -> str:
    anomaly_logs = [l for l in logs if l.is_anomaly][:10]
    if not anomaly_logs:
        return "未检测到异常日志条目。"

    lines = ["检测到以下异常日志条目（最多显示10条）：", ""]
    for log in anomaly_logs:
        material = db.query(models.Material).filter(models.Material.id == log.material_id).first()
        mat_name = material.name if material else "未知材料"
        lines.append(f"- **[日志ID: {log.id}]** {mat_name} (行 {log.line_number}):")
        lines.append(f"  `{log.message[:150]}...`" if len(log.message) > 150 else f"  `{log.message}`")
    return "\n".join(lines)


def _build_fingerprint_status_table(fingerprints: List[models.CacheFingerprint]) -> str:
    counts: Dict[str, int] = {}
    for fp in fingerprints:
        counts[fp.status] = counts.get(fp.status, 0) + 1

    status_map = {
        "matched": "✅ 匹配",
        "mismatch": "❌ 不匹配",
        "unexpected_miss": "⚠️ 意外未命中",
        "unknown": "❓ 未知",
    }

    rows = []
    for status, count in sorted(counts.items(), key=lambda x: -x[1]):
        rows.append(f"| {status_map.get(status, status)} | {count} |")
    return "\n".join(rows) if rows else "| 无数据 | 0 |"


def _build_fingerprint_mismatch_section(fingerprints: List[models.CacheFingerprint], db: Session) -> str:
    mismatches = [fp for fp in fingerprints if fp.status in ["mismatch", "unexpected_miss"]]
    if not mismatches:
        return "所有缓存指纹均匹配，未检测到异常。"

    lines = ["检测到以下缓存指纹不匹配：", ""]
    for fp in mismatches[:10]:
        material = db.query(models.Material).filter(models.Material.id == fp.material_id).first()
        mat_name = material.name if material else "未知材料"
        status_text = "指纹不匹配" if fp.status == "mismatch" else "意外缓存未命中"
        lines.append(f"### {fp.dependency_name or fp.cache_key}")
        lines.append(f"- **状态**: {status_text}")
        lines.append(f"- **缓存键**: {fp.cache_key}")
        lines.append(f"- **实际指纹**: `{fp.fingerprint}`")
        lines.append(f"- **期望指纹**: `{fp.expected_fingerprint or 'N/A'}`")
        lines.append(f"- **来源材料**: {mat_name}")
        lines.append("")
    return "\n".join(lines)


def _build_cluster_section(clusters: List[models.FailureCluster], db: Session) -> str:
    anomaly_clusters = [c for c in clusters if not c.is_normal_result]
    normal_clusters = [c for c in clusters if c.is_normal_result]

    if not clusters:
        return "未进行聚类分析。"

    lines = []
    if anomaly_clusters:
        lines.append(f"### 异常聚类 ({len(anomaly_clusters)} 个)")
        lines.append("")
        for cluster in anomaly_clusters:
            sev_map = {"high": "🔴 高", "medium": "🟡 中", "low": "🟢 低"}
            lines.append(f"#### {sev_map.get(cluster.severity, '')} {cluster.title}")
            lines.append(f"- **聚类ID**: {cluster.id}")
            lines.append(f"- **类型**: {ANOMALY_TYPES.get(cluster.cluster_type, cluster.cluster_type)}")
            lines.append(f"- **影响条目数**: {cluster.affected_count}")
            lines.append(f"- **描述**: {cluster.description}")
            if cluster.pattern_signature:
                lines.append(f"- **特征签名**: `{cluster.pattern_signature[:20]}...`")
            lines.append("")

    if normal_clusters:
        lines.append(f"### 正常结果聚类 (已排除，{len(normal_clusters)} 个)")
        lines.append("")
        lines.append("以下聚类被识别为正常执行结果，已排除在异常分析之外：")
        for cluster in normal_clusters:
            lines.append(f"- **{cluster.title}**: {cluster.affected_count} 条记录")
        lines.append("")

    return "\n".join(lines)


def _build_script_section(scripts: List[models.ReproductionScript], db: Session) -> str:
    if not scripts:
        return "未生成复现脚本。"

    lines = [f"已生成 {len(scripts)} 个复现脚本：", ""]
    for script in scripts:
        cluster = db.query(models.FailureCluster).filter(models.FailureCluster.id == script.cluster_id).first()
        cluster_title = cluster.title if cluster else "未知聚类"
        lines.append(f"### {script.name}")
        lines.append(f"- **脚本ID**: {script.id}")
        lines.append(f"- **类型**: {script.script_type}")
        lines.append(f"- **对应聚类**: {cluster_title} (ID: {script.cluster_id})")
        lines.append(f"- **描述**: {script.description}")
        lines.append("")
    return "\n".join(lines)


def _build_anomaly_detail_section(anomalies: List[models.Anomaly], db: Session) -> str:
    if not anomalies:
        return "未检测到异常。"

    lines = []
    for anomaly in anomalies:
        sev_map = {"high": "🔴", "medium": "🟡", "low": "🟢"}
        lines.append(f"### {sev_map.get(anomaly.severity, '')} {anomaly.title}")
        lines.append(f"- **异常ID**: {anomaly.id}")
        lines.append(f"- **类型**: {ANOMALY_TYPES.get(anomaly.anomaly_type, anomaly.anomaly_type)}")
        lines.append(f"- **描述**: {anomaly.description}")
        lines.append(f"- **状态**: {anomaly.status}")

        if anomaly.evidence_material_ids:
            mats = db.query(models.Material).filter(models.Material.id.in_(anomaly.evidence_material_ids)).all()
            mat_names = ", ".join([f"{m.name}(ID:{m.id})" for m in mats])
            lines.append(f"- **证据材料**: {mat_names}")
        if anomaly.evidence_log_ids:
            lines.append(f"- **关联日志ID**: {', '.join(map(str, anomaly.evidence_log_ids))}")
        if anomaly.evidence_fingerprint_ids:
            lines.append(f"- **关联指纹ID**: {', '.join(map(str, anomaly.evidence_fingerprint_ids))}")
        lines.append("")
    return "\n".join(lines)


def _build_recommendation_section(anomalies: List[models.Anomaly]) -> str:
    recommendations = {
        "cache_miss_error": [
            "1. **检查CI缓存键配置**: 确保缓存键包含所有影响依赖的文件哈希",
            "2. **验证缓存恢复逻辑**: 检查缓存恢复步骤是否在依赖安装之前执行",
            "3. **增加缓存失效条件**: 当 `requirements.txt` 或 `package.json` 变更时强制失效",
            "4. **使用 `restore-keys`**: 配置回退缓存键，避免完全未命中",
        ],
        "test_artifact_leftover": [
            "1. **添加强制清理步骤**: 在CI流程最开始执行 `git clean -fdx`",
            "2. **检查工作区复用配置**: 确认CI工作区不会在不同任务间复用",
            "3. **使用独立构建目录**: 将构建产物输出到独立目录并在每次构建前清理",
            "4. **添加产物存在性检查**: 在测试前检查是否存在遗留的 `.pyc` 或 `__pycache__`",
        ],
        "env_var_drift": [
            "1. **显式声明所有环境变量**: 在CI配置中列出所有必需的环境变量",
            "2. **使用环境变量白名单**: 只传递必要的环境变量到构建环境",
            "3. **添加环境变量校验**: 在CI开始时打印并校验关键环境变量",
            "4. **使用版本化的CI配置**: 将环境变量配置纳入版本控制",
        ],
        "dependency_conflict": [
            "1. **锁定所有依赖版本**: 使用 `pip freeze` 或 `package-lock.json` 锁定版本",
            "2. **使用哈希校验**: 验证依赖包的完整性哈希",
            "3. **定期更新依赖**: 建立定期更新依赖的流程",
            "4. **添加依赖版本检查**: 在CI中添加依赖一致性检查步骤",
        ],
        "unknown": [
            "1. **增加CI日志详细程度**: 启用更详细的日志输出以便后续分析",
            "2. **添加自定义检查步骤**: 在关键节点添加状态检查",
            "3. **对比成功/失败流水线**: 对比成功和失败运行的差异",
            "4. **考虑增加重试机制**: 对于偶发问题考虑添加自动重试",
        ],
    }

    lines = []
    seen_types = set()
    for anomaly in anomalies:
        atype = anomaly.anomaly_type
        if atype in seen_types:
            continue
        seen_types.add(atype)
        lines.append(f"#### 针对 {ANOMALY_TYPES.get(atype, atype)} 的建议")
        lines.append("")
        for rec in recommendations.get(atype, recommendations["unknown"]):
            lines.append(rec)
        lines.append("")

    if not lines:
        return "本次分析未检测到异常，无需特殊修复措施。"

    return "\n".join(lines)


def _build_review_section(review_data: Optional[Dict]) -> str:
    if not review_data:
        return "**本报告尚未复核**\n\n请使用复核接口添加复核意见。"

    return (
        f"**复核人**: {review_data.get('reviewed_by', 'N/A')}\n\n"
        f"**复核时间**: {review_data.get('reviewed_at', 'N/A')}\n\n"
        f"**复核意见**: {review_data.get('review_comment', '无')}"
    )


def generate_analysis_report(db: Session, batch_id: int) -> Dict:
    batch = get_batch(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    report_no = generate_report_no(batch.batch_no)

    report_data = generate_report_content(db, batch, report_no)

    report_create = schemas.AnalysisReportCreate(
        batch_id=batch_id,
        title=f"CI缓存污染定位报告 - {batch.name}",
        summary=report_data["summary"],
        content=report_data["content"],
        anomaly_count=report_data["anomaly_count"],
        anomaly_details=report_data["anomaly_details"],
        meta=report_data["meta"],
    )

    db_report = models.AnalysisReport(
        batch_id=report_create.batch_id,
        report_no=report_no,
        title=report_create.title,
        summary=report_create.summary,
        content=report_create.content,
        anomaly_count=report_create.anomaly_count,
        anomaly_details=report_create.anomaly_details,
        status="draft",
        meta=report_create.meta,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    batch.status = "report_generated"
    db.commit()

    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "report_id": db_report.id,
        "report_no": report_no,
        "title": db_report.title,
        "anomaly_count": db_report.anomaly_count,
        "status": db_report.status,
    }


def review_report(db: Session, report_id: int, review_in: schemas.AnalysisReportReview) -> models.AnalysisReport:
    report = db.query(models.AnalysisReport).filter(models.AnalysisReport.id == report_id).first()
    if not report:
        raise ValueError(f"Report {report_id} not found")

    report.reviewed_by = review_in.reviewed_by
    report.reviewed_at = datetime.utcnow()
    report.review_comment = review_in.review_comment
    report.status = "reviewed"

    report.content = report.content.replace(
        "**本报告尚未复核**\n\n请使用复核接口添加复核意见。",
        _build_review_section({
            "reviewed_by": report.reviewed_by,
            "reviewed_at": report.reviewed_at.strftime("%Y-%m-%d %H:%M:%S"),
            "review_comment": report.review_comment or "无",
        }),
    )
    report.content = report.content.replace("**报告状态**: 待复核", "**报告状态**: 已复核")

    db.commit()
    db.refresh(report)

    batch = get_batch(db, report.batch_id)
    if batch:
        batch.status = "report_reviewed"
        db.commit()

    return report


def export_report(db: Session, report_id: int, format: str = "md") -> Dict:
    report = db.query(models.AnalysisReport).filter(models.AnalysisReport.id == report_id).first()
    if not report:
        raise ValueError(f"Report {report_id} not found")

    batch = get_batch(db, report.batch_id)
    if not batch:
        raise ValueError(f"Batch {report.batch_id} not found")

    safe_name = sanitize_filename(batch.name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{report.report_no}_{safe_name}_{timestamp}.{format}"
    export_path = REPORT_EXPORT_DIR / filename

    if format == "md":
        with open(export_path, "w", encoding="utf-8") as f:
            f.write(report.content)
    elif format == "json":
        json_data = {
            "report_no": report.report_no,
            "batch_no": batch.batch_no,
            "batch_name": batch.name,
            "title": report.title,
            "summary": report.summary,
            "anomaly_count": report.anomaly_count,
            "anomaly_details": report.anomaly_details,
            "status": report.status,
            "reviewed_by": report.reviewed_by,
            "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
            "review_comment": report.review_comment,
            "created_at": report.created_at.isoformat(),
            "meta": report.meta,
        }
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
    else:
        raise ValueError(f"Unsupported export format: {format}")

    report.export_path = str(export_path)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report_id,
        "report_no": report.report_no,
        "export_path": str(export_path),
        "format": format,
        "file_size": export_path.stat().st_size,
    }


def list_reports(db: Session, batch_id: Optional[int] = None,
                 status: Optional[str] = None,
                 skip: int = 0, limit: int = 100) -> List[models.AnalysisReport]:
    query = db.query(models.AnalysisReport)
    if batch_id:
        query = query.filter(models.AnalysisReport.batch_id == batch_id)
    if status:
        query = query.filter(models.AnalysisReport.status == status)
    return query.order_by(models.AnalysisReport.created_at.desc()).offset(skip).limit(limit).all()


def get_report(db: Session, report_id: int) -> Optional[models.AnalysisReport]:
    return db.query(models.AnalysisReport).filter(models.AnalysisReport.id == report_id).first()
