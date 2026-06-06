import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import (
    Song, SignInPhoto, TicketExport, TranspositionAnnotation,
    TranspositionCalc, ArchiveRecord, ChangeHistory, WeeklyReport
)


def get_file_hash(file_content: bytes) -> str:
    return hashlib.md5(file_content).hexdigest()


def get_or_create_song(db: Session, live_name: str = None, copyright_name: str = None) -> Song:
    song = None
    if live_name:
        song = db.query(Song).filter(Song.live_name == live_name).first()
    if not song and copyright_name:
        song = db.query(Song).filter(Song.copyright_name == copyright_name).first()
    
    if not song:
        song = Song(
            live_name=live_name or copyright_name,
            copyright_name=copyright_name or live_name,
            needs_teacher_review=True,
            review_status="pending"
        )
        db.add(song)
        db.flush()
    else:
        if live_name and (not song.live_name or song.live_name == song.copyright_name):
            song.live_name = live_name
        if copyright_name and (not song.copyright_name or song.copyright_name == song.live_name):
            song.copyright_name = copyright_name
        if song.live_name != song.copyright_name:
            song.needs_teacher_review = True
            song.review_status = "pending"
    
    return song


def import_sign_in_photos_batch(
    db: Session,
    photos_data: List[Dict],
    operator: str = "老周"
) -> Dict:
    batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{operator}"
    imported_count = 0
    skipped_count = 0
    
    for photo_data in photos_data:
        file_hash = photo_data.get("file_hash") or get_file_hash(
            photo_data.get("file_content", b"")
        )
        
        existing = db.query(SignInPhoto).filter(
            SignInPhoto.file_hash == file_hash
        ).first()
        
        if existing:
            skipped_count += 1
            continue
        
        song = get_or_create_song(db, live_name=photo_data.get("song_live_name"))
        
        photo = SignInPhoto(
            batch_id=batch_id,
            file_hash=file_hash,
            file_name=photo_data.get("file_name", ""),
            file_path=photo_data.get("file_path", ""),
            course_name=photo_data.get("course_name", ""),
            teacher_name=photo_data.get("teacher_name", ""),
            sign_date=photo_data.get("sign_date"),
            song_live_name=photo_data.get("song_live_name", ""),
            extracted_text=photo_data.get("extracted_text", ""),
            song_id=song.id,
            created_by=operator
        )
        db.add(photo)
        db.flush()
        imported_count += 1
        
        annotation = TranspositionAnnotation(
            song_id=song.id,
            sign_in_photo_id=photo.id,
            annotated_by=operator,
            workflow_stage="photo_imported",
            remark=photo_data.get("remark", "")
        )
        db.add(annotation)
        db.flush()
        
        archive_no = f"ARC-{datetime.utcnow().strftime('%Y%m%d')}-{annotation.id:04d}"
        archive = ArchiveRecord(
            archive_no=archive_no,
            annotation_id=annotation.id,
            keep_reason="首次导入课时签到照片，待补充票务信息并复核",
            missing_materials=["票务导出表", "音乐老师转调复核"],
            next_action="待老周补看票务导出表",
            next_action_owner="老周"
        )
        db.add(archive)
    
    db.commit()
    
    return {
        "batch_id": batch_id,
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "note": f"成功导入{imported_count}张，跳过{skipped_count}张重复照片"
    }


def add_ticket_export_to_annotation(
    db: Session,
    annotation_id: int,
    ticket_data: Dict,
    operator: str = "老周"
) -> Dict:
    annotation = db.query(TranspositionAnnotation).filter(
        TranspositionAnnotation.id == annotation_id
    ).first()
    
    if not annotation:
        return {"error": "批注记录不存在"}
    
    song = get_or_create_song(
        db,
        live_name=annotation.song.live_name if annotation.song else None,
        copyright_name=ticket_data.get("song_copyright_name")
    )
    
    ticket = TicketExport(
        batch_id=f"ticket_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        file_name=ticket_data.get("file_name", ""),
        file_path=ticket_data.get("file_path", ""),
        song_copyright_name=ticket_data.get("song_copyright_name", ""),
        song_id=song.id,
        revenue_amount=ticket_data.get("revenue_amount", ""),
        performance_date=ticket_data.get("performance_date"),
        reviewed_by=operator
    )
    db.add(ticket)
    db.flush()
    
    annotation.ticket_export_id = ticket.id
    annotation.song_id = song.id
    annotation.workflow_stage = "ticket_reviewed"
    annotation.updated_at = datetime.utcnow()
    
    db.flush()
    db.refresh(song)
    
    archive = db.query(ArchiveRecord).filter(
        ArchiveRecord.annotation_id == annotation_id
    ).first()
    
    needs_review = song.live_name != song.copyright_name
    
    if archive:
        old_missing = archive.missing_materials or []
        new_missing = [m for m in old_missing if m != "票务导出表"]
        if needs_review:
            archive.keep_reason = "已补全票务信息，同一首歌存在现场名和版权名差异，需音乐老师复核确认"
            archive.next_action = "转交音乐老师复核歌曲名称一致性"
            archive.next_action_owner = "音乐老师"
        else:
            archive.keep_reason = "已补全票务信息，待生成转调批注并入周报"
            archive.next_action = "待生成周报"
            archive.next_action_owner = "系统"
        archive.missing_materials = new_missing
        archive.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "annotation_id": annotation_id,
        "workflow_stage": "ticket_reviewed",
        "needs_teacher_review": needs_review,
        "note": "票务信息已补充，工作流进入票务复核完成阶段"
    }


def update_archive_remark(
    db: Session,
    archive_id: int,
    new_remark: str,
    operator: str = "老周"
) -> Dict:
    archive = db.query(ArchiveRecord).filter(ArchiveRecord.id == archive_id).first()
    if not archive:
        return {"error": "归档记录不存在"}
    
    annotation = db.query(TranspositionAnnotation).filter(
        TranspositionAnnotation.id == archive.annotation_id
    ).first()
    
    if annotation:
        old_remark = annotation.remark or ""
        annotation.remark = new_remark
        annotation.updated_at = datetime.utcnow()
        
        if old_remark != new_remark:
            change = ChangeHistory(
                archive_id=archive.id,
                field_name="remark",
                old_value=old_remark,
                new_value=new_remark,
                changed_by=operator,
                change_reason="备注更新"
            )
            db.add(change)
    
    db.commit()
    
    changes = db.query(ChangeHistory).filter(
        ChangeHistory.archive_id == archive_id
    ).order_by(ChangeHistory.changed_at.desc()).all()
    
    return {
        "status": "success",
        "archive_id": archive_id,
        "change_history": [
            {
                "field": c.field_name,
                "old": c.old_value,
                "new": c.new_value,
                "by": c.changed_by,
                "at": c.changed_at.isoformat() if c.changed_at else None,
                "reason": c.change_reason
            }
            for c in changes
        ]
    }


def run_transposition_calc(
    db: Session,
    annotation_id: int,
    original_key: str,
    target_key: str,
    operator: str = "音乐老师"
) -> Dict:
    annotation = db.query(TranspositionAnnotation).filter(
        TranspositionAnnotation.id == annotation_id
    ).first()
    
    if not annotation:
        return {"error": "批注记录不存在"}
    
    key_order = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    try:
        orig_idx = key_order.index(original_key.upper())
        tgt_idx = key_order.index(target_key.upper())
        steps = tgt_idx - orig_idx
    except ValueError:
        return {"error": "无效的调名"}
    
    calc = TranspositionCalc(
        parameter_version="v1.2.0",
        parameter_notes="采用十二平均律半音计数法，向上为正、向下为负；取舍理由：业界标准做法，兼顾古典乐理与流行演奏习惯；特殊处理：等音调优先选用常用调名（如Db而非C#）",
        original_key=original_key,
        target_key=target_key,
        transpose_steps=steps,
        calc_logic=f"原调{original_key}（索引{orig_idx}）→ 目标调{target_key}（索引{tgt_idx}），半音差{steps}",
        confidence="high" if abs(steps) <= 6 else "medium"
    )
    db.add(calc)
    db.flush()
    
    annotation.calc_id = calc.id
    annotation.annotation_content = f"转调计算：{original_key} → {target_key}，半音数{steps}（参数版本v1.2.0）"
    annotation.annotated_by = operator
    annotation.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "calc_id": calc.id,
        "parameter_version": calc.parameter_version,
        "parameter_notes": calc.parameter_notes,
        "result": calc.calc_logic,
        "confidence": calc.confidence
    }


def review_song_name(
    db: Session,
    song_id: int,
    approved: bool,
    reviewer: str = "音乐老师",
    review_note: str = ""
) -> Dict:
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        return {"error": "歌曲不存在"}
    
    song.review_status = "approved" if approved else "rejected"
    song.reviewed_by = reviewer
    song.reviewed_at = datetime.utcnow()
    song.needs_teacher_review = False
    
    annotations = db.query(TranspositionAnnotation).filter(
        TranspositionAnnotation.song_id == song_id
    ).all()
    
    for ann in annotations:
        archive = db.query(ArchiveRecord).filter(
            ArchiveRecord.annotation_id == ann.id
        ).first()
        if archive:
            if approved:
                archive.keep_reason = f"音乐老师已复核确认：现场名「{song.live_name}」与版权名「{song.copyright_name}」为同一首歌；{review_note}"
                archive.missing_materials = [m for m in (archive.missing_materials or []) if m != "音乐老师转调复核"]
                archive.next_action = "待生成周报"
                archive.next_action_owner = "系统"
            else:
                archive.keep_reason = f"音乐老师驳回：现场名与版权名不是同一首歌，需重新核对；{review_note}"
                archive.missing_materials = (archive.missing_materials or []) + ["重新核对歌曲名称"]
                archive.next_action = "找老周重新核对歌曲信息"
                archive.next_action_owner = "老周"
            archive.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "song_id": song_id,
        "review_status": song.review_status,
        "reviewed_by": reviewer,
        "note": "复核完成，相关归档记录已更新"
    }


def get_archive_detail_for_display(
    db: Session,
    archive_id: int,
    display_mode: str = "list"
) -> Dict:
    archive = db.query(ArchiveRecord).filter(ArchiveRecord.id == archive_id).first()
    if not archive:
        return {"error": "归档记录不存在"}
    
    annotation = db.query(TranspositionAnnotation).filter(
        TranspositionAnnotation.id == archive.annotation_id
    ).first()
    
    song = None
    photo = None
    ticket = None
    calc = None
    
    if annotation:
        if annotation.song_id:
            song = db.query(Song).filter(Song.id == annotation.song_id).first()
        if annotation.sign_in_photo_id:
            photo = db.query(SignInPhoto).filter(
                SignInPhoto.id == annotation.sign_in_photo_id
            ).first()
        if annotation.ticket_export_id:
            ticket = db.query(TicketExport).filter(
                TicketExport.id == annotation.ticket_export_id
            ).first()
        if annotation.calc_id:
            calc = db.query(TranspositionCalc).filter(
                TranspositionCalc.id == annotation.calc_id
            ).first()
    
    result = {
        "archive_id": archive.id,
        "archive_no": archive.archive_no,
        "display_mode": display_mode,
        "keep_reason": archive.keep_reason,
        "missing_materials": archive.missing_materials,
        "next_action": archive.next_action,
        "next_action_owner": archive.next_action_owner,
        "workflow_stage": annotation.workflow_stage if annotation else None,
        "song": {
            "id": song.id if song else None,
            "live_name": song.live_name if song else None,
            "copyright_name": song.copyright_name if song else None,
            "needs_teacher_review": song.needs_teacher_review if song else None,
            "review_status": song.review_status if song else None
        },
        "trace_back": {
            "sign_in_photo": {
                "id": photo.id if photo else None,
                "file_name": photo.file_name if photo else None,
                "file_path": photo.file_path if photo else None,
                "course_name": photo.course_name if photo else None,
                "sign_date": photo.sign_date.isoformat() if photo and photo.sign_date else None
            },
            "ticket_export": {
                "id": ticket.id if ticket else None,
                "file_name": ticket.file_name if ticket else None,
                "file_path": ticket.file_path if ticket else None,
                "revenue_amount": ticket.revenue_amount if ticket else None
            }
        }
    }
    
    if calc:
        result["calc_info"] = {
            "parameter_version": calc.parameter_version,
            "parameter_notes": calc.parameter_notes,
            "original_key": calc.original_key,
            "target_key": calc.target_key,
            "transpose_steps": calc.transpose_steps,
            "calc_logic": calc.calc_logic,
            "confidence": calc.confidence
        }
    
    if display_mode in ["3d", "chart"]:
        result["note"] = f"当前为{display_mode}展示模式，点击「追溯数据源」可查看原始签到照片或票务导出表"
        result["trace_back_enabled"] = True
    
    return result


def generate_weekly_report(
    db: Session,
    week_start: datetime = None,
    week_end: datetime = None
) -> Dict:
    if not week_start:
        today = datetime.utcnow().date()
        week_start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time())
    if not week_end:
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    archives = db.query(ArchiveRecord).filter(
        ArchiveRecord.created_at >= week_start,
        ArchiveRecord.created_at <= week_end
    ).all()
    
    needs_teacher = []
    needs_laozhou = []
    completed = []
    pending_ticket = []
    
    for arc in archives:
        annotation = arc.annotation
        song = annotation.song if annotation else None
        
        info = {
            "archive_no": arc.archive_no,
            "song_live": song.live_name if song else "",
            "song_copyright": song.copyright_name if song else "",
            "keep_reason": arc.keep_reason,
            "missing": arc.missing_materials,
            "next_action": arc.next_action
        }
        
        if arc.next_action_owner == "音乐老师":
            needs_teacher.append(info)
        elif arc.next_action_owner == "老周":
            needs_laozhou.append(info)
        elif annotation and annotation.workflow_stage == "weekly_reported":
            completed.append(info)
        elif annotation and annotation.workflow_stage == "photo_imported":
            pending_ticket.append(info)
        else:
            completed.append(info)
        
        if annotation:
            annotation.workflow_stage = "weekly_reported"
            annotation.updated_at = datetime.utcnow()
    
    summary_parts = []
    summary_parts.append(f"📋 本周归档周报（{week_start.strftime('%Y-%m-%d')} ~ {week_end.strftime('%Y-%m-%d')}）")
    summary_parts.append(f"")
    summary_parts.append(f"📊 本周共处理 {len(archives)} 条归档记录：")
    summary_parts.append(f"  ✅ 已完成：{len(completed)} 条")
    summary_parts.append(f"  ⏳ 待老周补票务：{len(pending_ticket)} 条")
    summary_parts.append(f"  🎵 待音乐老师复核：{len(needs_teacher)} 条")
    summary_parts.append(f"  🔄 待老周重核：{len(needs_laozhou)} 条")
    summary_parts.append(f"")
    
    if needs_teacher:
        summary_parts.append(f"🎵 【需音乐老师处理】共{len(needs_teacher)}条：")
        for item in needs_teacher:
            summary_parts.append(f"  - {item['archive_no']}：「{item['song_live']}」/「{item['song_copyright']}」")
            summary_parts.append(f"    为什么留着：{item['keep_reason']}")
            summary_parts.append(f"    缺什么：{', '.join(item['missing']) if item['missing'] else '无'}")
            summary_parts.append(f"    下一步：{item['next_action']}")
            summary_parts.append(f"")
    
    if needs_laozhou:
        summary_parts.append(f"🔄 【需老周处理】共{len(needs_laozhou)}条：")
        for item in needs_laozhou:
            summary_parts.append(f"  - {item['archive_no']}：「{item['song_live']}」")
            summary_parts.append(f"    为什么留着：{item['keep_reason']}")
            summary_parts.append(f"    缺什么：{', '.join(item['missing']) if item['missing'] else '无'}")
            summary_parts.append(f"    下一步：{item['next_action']}")
            summary_parts.append(f"")
    
    if pending_ticket:
        summary_parts.append(f"⏳ 【待老周补票务】共{len(pending_ticket)}条：")
        for item in pending_ticket:
            summary_parts.append(f"  - {item['archive_no']}：「{item['song_live']}」")
            summary_parts.append(f"    为什么留着：{item['keep_reason']}")
            summary_parts.append(f"    缺什么：{', '.join(item['missing']) if item['missing'] else '无'}")
            summary_parts.append(f"    下一步：{item['next_action']}")
            summary_parts.append(f"")
    
    human_summary = "\n".join(summary_parts)
    
    report = WeeklyReport(
        week_start=week_start,
        week_end=week_end,
        report_content={
            "needs_teacher": needs_teacher,
            "needs_laozhou": needs_laozhou,
            "completed": completed,
            "pending_ticket": pending_ticket
        },
        human_readable_summary=human_summary,
        archive_ids=[arc.id for arc in archives]
    )
    db.add(report)
    db.commit()
    
    return {
        "report_id": report.id,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "summary": human_summary,
        "details": report.report_content
    }
