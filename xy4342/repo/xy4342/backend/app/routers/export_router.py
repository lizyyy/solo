from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import os
import json
import csv
import io

from ..database import get_db, UPLOAD_DIR
from .. import models, schemas

router = APIRouter()

EXPORT_DIR = os.path.join(UPLOAD_DIR, "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

def _get_issues_for_export(
    db: Session,
    include_statuses: Optional[List[str]] = None,
    include_categories: Optional[List[str]] = None
) -> List[models.Issue]:
    query = db.query(models.Issue)
    
    if include_statuses:
        status_enums = [schemas.IssueStatus(s) for s in include_statuses]
        query = query.filter(models.Issue.status.in_(status_enums))
    
    if include_categories:
        cat_enums = [schemas.IssueCategory(c) for c in include_categories]
        query = query.filter(models.Issue.category.in_(cat_enums))
    
    return query.order_by(
        models.Issue.severity.desc(),
        models.Issue.created_at
    ).all()

def _generate_markdown_report(
    db: Session,
    issues: List[models.Issue],
    overview: dict
) -> str:
    lines = []
    
    lines.append("# 分镜连续性检查报告")
    lines.append(f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("## 概览")
    lines.append("")
    lines.append(f"- 章节数: {overview.get('chapters', 0)}")
    lines.append(f"- 分镜格数: {overview.get('panels', 0)}")
    lines.append(f"- 角色数: {overview.get('characters', 0)}")
    lines.append(f"- 对白数: {overview.get('dialogues', 0)}")
    lines.append(f"- **问题总数: {len(issues)}**")
    lines.append("")
    
    by_status = overview.get('issues_by_status', {})
    if by_status:
        lines.append("### 按状态统计")
        lines.append("")
        for status, count in by_status.items():
            status_label = {
                'open': '待处理',
                'dismissed': '已忽略',
                'confirmed': '已确认',
                'fixed': '已修复'
            }.get(status, status)
            lines.append(f"- {status_label}: {count}")
        lines.append("")
    
    by_category = overview.get('issues_by_category', {})
    if by_category:
        lines.append("### 按类别统计")
        lines.append("")
        for category, count in by_category.items():
            cat_label = {
                'costume': '服装不一致',
                'prop': '道具不一致',
                'timeline': '时间线问题',
                'address': '称呼不一致',
                'similarity': '文本相似',
                'other': '其他问题'
            }.get(category, category)
            lines.append(f"- {cat_label}: {count}")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("## 问题详情")
    lines.append("")
    
    categories = {}
    for issue in issues:
        cat = issue.category.value
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(issue)
    
    for category, cat_issues in categories.items():
        cat_label = {
            'costume': '服装不一致',
            'prop': '道具不一致',
            'timeline': '时间线问题',
            'address': '称呼不一致',
            'similarity': '文本相似',
            'other': '其他问题'
        }.get(category, category)
        
        lines.append(f"### {cat_label} ({len(cat_issues)}个问题)")
        lines.append("")
        
        for idx, issue in enumerate(cat_issues, 1):
            sev_label = {
                'critical': '🔴 严重',
                'high': '🟠 高',
                'medium': '🟡 中',
                'low': '🟢 低'
            }.get(issue.severity.value, issue.severity.value)
            
            status_label = {
                'open': '待处理',
                'dismissed': '已忽略',
                'confirmed': '已确认',
                'fixed': '已修复'
            }.get(issue.status.value, issue.status.value)
            
            lines.append(f"**{idx}. {issue.title}**")
            lines.append(f"   - 严重程度: {sev_label}")
            lines.append(f"   - 状态: {status_label}")
            lines.append(f"   - 置信度: {issue.confidence}%")
            
            if issue.description:
                desc_lines = issue.description.split('\n')
                lines.append(f"   - 描述:")
                for dl in desc_lines:
                    lines.append(f"     > {dl}")
            
            if issue.affected_panels:
                lines.append(f"   - 影响格数: {issue.affected_panels}")
            
            reviews = db.query(models.Review).filter(
                models.Review.issue_id == issue.id
            ).all()
            
            if reviews:
                lines.append(f"   - 复核记录:")
                for rev in reviews:
                    rev_time = rev.created_at.strftime('%Y-%m-%d %H:%M')
                    lines.append(f"     - [{rev_time}] {rev.reviewer}:")
                    if rev.decision:
                        lines.append(f"       决定: {rev.decision}")
                    if rev.comment:
                        lines.append(f"       意见: {rev.comment}")
            
            lines.append("")
        
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append("*本报告由分镜连续性检查台自动生成*")
    
    return "\n".join(lines)

def _generate_csv_export(issues: List[models.Issue]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        'ID', '标题', '类别', '严重程度', '状态',
        '描述', '影响格数', '影响章节', '规则名称',
        '置信度', '创建时间', '更新时间'
    ])
    
    for issue in issues:
        writer.writerow([
            issue.id,
            issue.title,
            {
                'costume': '服装',
                'prop': '道具',
                'timeline': '时间线',
                'address': '称呼',
                'similarity': '文本相似',
                'other': '其他'
            }.get(issue.category.value, issue.category.value),
            {
                'critical': '严重',
                'high': '高',
                'medium': '中',
                'low': '低'
            }.get(issue.severity.value, issue.severity.value),
            {
                'open': '待处理',
                'dismissed': '已忽略',
                'confirmed': '已确认',
                'fixed': '已修复'
            }.get(issue.status.value, issue.status.value),
            issue.description or '',
            issue.affected_panels or '',
            issue.affected_chapters or '',
            issue.rule_name or '',
            issue.confidence,
            issue.created_at.strftime('%Y-%m-%d %H:%M:%S') if issue.created_at else '',
            issue.updated_at.strftime('%Y-%m-%d %H:%M:%S') if issue.updated_at else ''
        ])
    
    return output.getvalue()

def _generate_json_audit(
    db: Session,
    issues: List[models.Issue],
    overview: dict
) -> dict:
    from sqlalchemy import func
    
    chapters = db.query(models.Chapter).order_by(models.Chapter.chapter_number).all()
    chapters_data = []
    for chap in chapters:
        chap_dict = {
            'id': chap.id,
            'chapter_number': chap.chapter_number,
            'chapter_title': chap.chapter_title,
            'panels_count': len(chap.panels),
            'dialogues_count': len(chap.dialogues)
        }
        chapters_data.append(chap_dict)
    
    characters = db.query(models.Character).all()
    characters_data = []
    for char in characters:
        characters_data.append({
            'id': char.id,
            'name': char.name,
            'full_name': char.full_name,
            'aliases': char.aliases,
            'costume_default': char.costume_default,
            'props_default': char.props_default
        })
    
    issues_data = []
    for issue in issues:
        reviews = db.query(models.Review).filter(
            models.Review.issue_id == issue.id
        ).all()
        
        issues_data.append({
            'id': issue.id,
            'title': issue.title,
            'category': issue.category.value,
            'severity': issue.severity.value,
            'status': issue.status.value,
            'description': issue.description,
            'affected_panels': issue.affected_panels,
            'affected_chapters': issue.affected_chapters,
            'rule_name': issue.rule_name,
            'confidence': issue.confidence,
            'created_at': issue.created_at.isoformat() if issue.created_at else None,
            'reviews': [{
                'id': r.id,
                'reviewer': r.reviewer,
                'comment': r.comment,
                'decision': r.decision,
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in reviews]
        })
    
    return {
        'audit_info': {
            'generated_at': datetime.now().isoformat(),
            'version': '1.0.0'
        },
        'overview': overview,
        'chapters': chapters_data,
        'characters': characters_data,
        'issues': issues_data
    }

@router.get("/markdown")
def export_markdown(
    include_statuses: Optional[str] = Query(None),
    include_categories: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    status_list = include_statuses.split(',') if include_statuses else None
    category_list = include_categories.split(',') if include_categories else None
    
    issues = _get_issues_for_export(db, status_list, category_list)
    
    from sqlalchemy import func
    overview = {
        'chapters': db.query(models.Chapter).count(),
        'panels': db.query(models.Panel).count(),
        'characters': db.query(models.Character).count(),
        'dialogues': db.query(models.Dialogue).count(),
        'issues_by_status': {},
        'issues_by_category': {}
    }
    
    by_status = db.query(
        models.Issue.status,
        func.count(models.Issue.id)
    ).group_by(models.Issue.status).all()
    overview['issues_by_status'] = {s.value: c for s, c in by_status}
    
    by_category = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    overview['issues_by_category'] = {c.value: cnt for c, cnt in by_category}
    
    markdown = _generate_markdown_report(db, issues, overview)
    
    filename = f"continuity_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(markdown)
    
    return FileResponse(
        path=filepath,
        media_type='text/markdown',
        filename=filename
    )

@router.get("/csv")
def export_csv(
    include_statuses: Optional[str] = Query(None),
    include_categories: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    status_list = include_statuses.split(',') if include_statuses else None
    category_list = include_categories.split(',') if include_categories else None
    
    issues = _get_issues_for_export(db, status_list, category_list)
    csv_content = _generate_csv_export(issues)
    
    filename = f"issues_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8-sig') as f:
        f.write(csv_content)
    
    return FileResponse(
        path=filepath,
        media_type='text/csv',
        filename=filename
    )

@router.get("/json")
def export_json(
    include_statuses: Optional[str] = Query(None),
    include_categories: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    status_list = include_statuses.split(',') if include_statuses else None
    category_list = include_categories.split(',') if include_categories else None
    
    issues = _get_issues_for_export(db, status_list, category_list)
    
    from sqlalchemy import func
    overview = {
        'chapters': db.query(models.Chapter).count(),
        'panels': db.query(models.Panel).count(),
        'characters': db.query(models.Character).count(),
        'dialogues': db.query(models.Dialogue).count(),
        'issues_by_status': {},
        'issues_by_category': {}
    }
    
    by_status = db.query(
        models.Issue.status,
        func.count(models.Issue.id)
    ).group_by(models.Issue.status).all()
    overview['issues_by_status'] = {s.value: c for s, c in by_status}
    
    by_category = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    overview['issues_by_category'] = {c.value: cnt for c, cnt in by_category}
    
    audit_data = _generate_json_audit(db, issues, overview)
    
    filename = f"audit_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)
    
    return FileResponse(
        path=filepath,
        media_type='application/json',
        filename=filename
    )
