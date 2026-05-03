"""报告生成模块 - 导出 Markdown、CSV、JSON 审计包"""

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from .models import (
    RaceData,
    Violation,
    ViolationType,
    ViolationLevel,
    SplitRecord,
    CheckpointType,
)
from .review_store import ReviewStore, ReviewRecord, ResolutionType


def _format_timedelta(td: Optional[timedelta]) -> str:
    """格式化时间差"""
    if td is None:
        return "-"
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def _format_datetime(dt: Optional[datetime]) -> str:
    """格式化时间"""
    if dt is None:
        return "-"
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def generate_markdown_report(
    race_data: RaceData,
    violations: List[Violation],
    participant_splits: Dict[str, List[SplitRecord]],
    review_store: Optional[ReviewStore] = None,
    report_time: Optional[datetime] = None,
) -> str:
    """生成 Markdown 格式报告"""
    report_time = report_time or datetime.now()
    
    critical_violations = [v for v in violations if v.level == ViolationLevel.CRITICAL]
    warning_violations = [v for v in violations if v.level == ViolationLevel.WARNING]
    info_violations = [v for v in violations if v.level == ViolationLevel.INFO]
    
    reviewed_violations = {}
    if review_store:
        for v in violations:
            review = review_store.get_review(v.violation_id)
            if review:
                reviewed_violations[v.violation_id] = review
    
    stats = {
        "total_participants": len(race_data.participants),
        "total_chips": len(race_data.chip_bindings),
        "total_checkpoints": len(race_data.checkpoints),
        "total_waves": len(race_data.waves),
        "total_logs": len(race_data.checkpoint_logs),
        "total_dnf": len(race_data.dnf_records),
        "total_violations": len(violations),
        "critical": len(critical_violations),
        "warning": len(warning_violations),
        "info": len(info_violations),
        "reviewed": len(reviewed_violations),
    }
    
    md = f"""# {race_data.race_name} - 计时芯片核验报告

> 报告生成时间: {_format_datetime(report_time)}

---

## 一、赛事概览

| 指标 | 数值 |
|------|------|
| 参赛选手数 | {stats['total_participants']} |
| 绑定芯片数 | {stats['total_chips']} |
| 检查点数 | {stats['total_checkpoints']} |
| 起跑波次数 | {stats['total_waves']} |
| 设备日志数 | {stats['total_logs']} |
| 退赛记录数 | {stats['total_dnf']} |

---

## 二、违规统计

| 级别 | 数量 |
|------|------|
| 🔴 严重 (CRITICAL) | {stats['critical']} |
| 🟡 警告 (WARNING) | {stats['warning']} |
| 🔵 信息 (INFO) | {stats['info']} |
| **合计** | **{stats['total_violations']}** |
| 已复核 | {stats['reviewed']} |

---

## 三、详细违规记录
"""
    
    if violations:
        for v in violations:
            level_icon = "🔴" if v.level == ViolationLevel.CRITICAL else "🟡" if v.level == ViolationLevel.WARNING else "🔵"
            reviewed = reviewed_violations.get(v.violation_id)
            
            md += f"\n### {level_icon} [{v.violation_id}] {v.violation_type.value}\n\n"
            md += f"- **严重程度**: {v.level.value}\n"
            md += f"- **发现时间**: {_format_datetime(v.discovered_at)}\n"
            if v.bib_number:
                md += f"- **涉及选手**: {v.bib_number}\n"
            if v.chip_id:
                md += f"- **涉及芯片**: {v.chip_id}\n"
            if v.wave_id:
                md += f"- **涉及波次**: {v.wave_id}\n"
            if v.checkpoint_id:
                md += f"- **涉及检查点**: {v.checkpoint_id}\n"
            md += f"- **描述**: {v.message}\n"
            
            if reviewed:
                md += f"\n**复核状态**: 已复核\n"
                md += f"- **复核结论**: {reviewed.resolution.value}\n"
                md += f"- **复核人**: {reviewed.reviewer or '未知'}\n"
                md += f"- **复核时间**: {_format_datetime(reviewed.review_time)}\n"
                if reviewed.notes:
                    md += f"- **复核备注**: {reviewed.notes}\n"
            else:
                md += f"\n**复核状态**: 待复核\n"
            
            md += "\n---\n"
    else:
        md += "\n✅ 未发现任何违规记录\n\n"
    
    md += """\n---

## 四、检查点配置

"""
    sorted_checkpoints = race_data.get_sorted_checkpoints()
    if sorted_checkpoints:
        md += "| 顺序 | ID | 名称 | 类型 | 距起点(km) |\n"
        md += "|------|-----|------|------|-----------|\n"
        for cp in sorted_checkpoints:
            type_icon = "🏁" if cp.cp_type == CheckpointType.START else "🔚" if cp.cp_type == CheckpointType.FINISH else "📍"
            md += f"| {cp.order} | {cp.checkpoint_id} | {type_icon} {cp.name} | {cp.cp_type.value} | {cp.distance_from_start} |\n"
    else:
        md += "无检查点配置\n"
    
    md += """\n---

## 五、波次配置

"""
    if race_data.waves:
        md += "| 波次ID | 名称 | 发枪时间 | 人数限制 |\n"
        md += "|--------|------|----------|----------|\n"
        for wave_id, wave in race_data.waves.items():
            max_p = wave.max_participants or "无限制"
            md += f"| {wave.wave_id} | {wave.wave_name.value} | {_format_datetime(wave.start_time)} | {max_p} |\n"
    else:
        md += "无波次配置\n"
    
    return md


def generate_csv_audit(
    race_data: RaceData,
    violations: List[Violation],
    participant_splits: Dict[str, List[SplitRecord]],
    output_dir: Path,
    review_store: Optional[ReviewStore] = None,
) -> List[Path]:
    """生成 CSV 格式审计包，包含多个文件
    
    生成的文件：
    - violations.csv - 违规记录
    - splits.csv - 分段成绩
    - participants.csv - 选手信息
    - reviews.csv - 复核记录（如有）
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_files: List[Path] = []
    
    violations_file = output_dir / "violations.csv"
    with open(violations_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "违规ID", "违规类型", "严重程度", "号码布", "芯片ID",
            "波次", "检查点", "描述", "发现时间", "是否复核",
            "复核结论", "复核人", "复核时间", "复核备注"
        ])
        for v in violations:
            review = review_store.get_review(v.violation_id) if review_store else None
            writer.writerow([
                v.violation_id,
                v.violation_type.value,
                v.level.value,
                v.bib_number or "",
                v.chip_id or "",
                v.wave_id or "",
                v.checkpoint_id or "",
                v.message,
                _format_datetime(v.discovered_at),
                "是" if review else "否",
                review.resolution.value if review else "",
                review.reviewer or "" if review else "",
                _format_datetime(review.review_time) if review else "",
                review.notes or "" if review else "",
            ])
    generated_files.append(violations_file)
    
    splits_file = output_dir / "splits.csv"
    with open(splits_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "号码布", "姓名", "芯片ID", "波次", "检查点顺序", "检查点名称",
            "检查点类型", "读取时间", "分段时间", "区间时间"
        ])
        for bib_number, splits in participant_splits.items():
            for split in splits:
                writer.writerow([
                    split.participant.bib_number,
                    split.participant.name,
                    split.chip_id,
                    split.wave.wave_id if split.wave else "",
                    split.checkpoint.order,
                    split.checkpoint.name,
                    split.checkpoint.cp_type.value,
                    _format_datetime(split.log_time),
                    _format_timedelta(split.split_time),
                    _format_timedelta(split.segment_time),
                ])
    generated_files.append(splits_file)
    
    participants_file = output_dir / "participants.csv"
    with open(participants_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "号码布", "姓名", "性别", "年龄", "组别", "波次",
            "芯片数", "绑定芯片", "是否退赛"
        ])
        for bib_number, p in race_data.participants.items():
            chips = race_data.get_chip_by_bib(bib_number)
            is_dnf = race_data.is_dnf(bib_number)
            writer.writerow([
                p.bib_number,
                p.name,
                p.gender.value if p.gender else "",
                p.age or "",
                p.category or "",
                p.wave_id or "",
                len(chips),
                ",".join(chips),
                "是" if is_dnf else "否",
            ])
    generated_files.append(participants_file)
    
    if review_store:
        reviews_file = output_dir / "reviews.csv"
        with open(reviews_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "复核ID", "违规ID", "违规类型", "原描述", "裁决",
                "复核人", "复核时间", "备注"
            ])
            for review in review_store.get_all_reviews():
                writer.writerow([
                    review.review_id,
                    review.violation_id,
                    review.violation_type,
                    review.original_message,
                    review.resolution.value,
                    review.reviewer or "",
                    _format_datetime(review.review_time),
                    review.notes or "",
                ])
        generated_files.append(reviews_file)
    
    return generated_files


def generate_json_audit(
    race_data: RaceData,
    violations: List[Violation],
    participant_splits: Dict[str, List[SplitRecord]],
    output_path: Path,
    review_store: Optional[ReviewStore] = None,
    report_time: Optional[datetime] = None,
) -> Path:
    """生成 JSON 格式审计包"""
    report_time = report_time or datetime.now()
    
    def violation_to_dict(v: Violation) -> Dict[str, Any]:
        review = review_store.get_review(v.violation_id) if review_store else None
        return {
            "violation_id": v.violation_id,
            "violation_type": v.violation_type.value,
            "level": v.level.value,
            "bib_number": v.bib_number,
            "chip_id": v.chip_id,
            "wave_id": v.wave_id,
            "checkpoint_id": v.checkpoint_id,
            "message": v.message,
            "evidence": v.evidence,
            "discovered_at": v.discovered_at.isoformat() if v.discovered_at else None,
            "review": {
                "review_id": review.review_id,
                "resolution": review.resolution.value,
                "reviewer": review.reviewer,
                "review_time": review.review_time.isoformat(),
                "notes": review.notes,
            } if review else None
        }
    
    def split_to_dict(s: SplitRecord) -> Dict[str, Any]:
        return {
            "bib_number": s.participant.bib_number,
            "name": s.participant.name,
            "chip_id": s.chip_id,
            "wave_id": s.wave.wave_id if s.wave else None,
            "checkpoint": {
                "id": s.checkpoint.checkpoint_id,
                "name": s.checkpoint.name,
                "type": s.checkpoint.cp_type.value,
                "order": s.checkpoint.order,
                "distance_km": s.checkpoint.distance_from_start,
            },
            "log_time": s.log_time.isoformat(),
            "split_time_seconds": s.split_time.total_seconds() if s.split_time else None,
            "segment_time_seconds": s.segment_time.total_seconds() if s.segment_time else None,
        }
    
    audit_data = {
        "version": "1.0",
        "report_time": report_time.isoformat(),
        "race": {
            "name": race_data.race_name,
            "date": race_data.race_date.isoformat() if race_data.race_date else None,
            "statistics": {
                "participants": len(race_data.participants),
                "chips": len(race_data.chip_bindings),
                "checkpoints": len(race_data.checkpoints),
                "waves": len(race_data.waves),
                "logs": len(race_data.checkpoint_logs),
                "dnf": len(race_data.dnf_records),
            }
        },
        "violations": {
            "summary": {
                "total": len(violations),
                "critical": len([v for v in violations if v.level == ViolationLevel.CRITICAL]),
                "warning": len([v for v in violations if v.level == ViolationLevel.WARNING]),
                "info": len([v for v in violations if v.level == ViolationLevel.INFO]),
            },
            "records": [violation_to_dict(v) for v in violations],
        },
        "splits": [split_to_dict(s) for splits in participant_splits.values() for s in splits],
        "review_statistics": review_store.get_statistics() if review_store else None,
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)
    
    return output_path


def generate_all_reports(
    race_data: RaceData,
    violations: List[Violation],
    participant_splits: Dict[str, List[SplitRecord]],
    output_dir: Path,
    review_store: Optional[ReviewStore] = None,
    prefix: str = "race-audit",
) -> Dict[str, Path]:
    """生成所有格式的审计报告
    
    Returns:
        字典，键为格式名称，值为生成的文件路径
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    report_time = datetime.now()
    
    result: Dict[str, Path] = {}
    
    md_path = output_dir / f"{prefix}-{report_time.strftime('%Y%m%d-%H%M%S')}.md"
    md_content = generate_markdown_report(
        race_data, violations, participant_splits, review_store, report_time
    )
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    result["markdown"] = md_path
    
    csv_dir = output_dir / f"{prefix}-csv-{report_time.strftime('%Y%m%d-%H%M%S')}"
    csv_files = generate_csv_audit(
        race_data, violations, participant_splits, csv_dir, review_store
    )
    result["csv_dir"] = csv_dir
    result["csv_files"] = csv_files
    
    json_path = output_dir / f"{prefix}-{report_time.strftime('%Y%m%d-%H%M%S')}.json"
    generate_json_audit(
        race_data, violations, participant_splits, json_path, review_store, report_time
    )
    result["json"] = json_path
    
    return result
