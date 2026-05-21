from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime
import re
import os
import json

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

def create_document(db: Session, filename: str, content: str = None, file_size: int = None):
    db_document = models.Document(
        filename=filename,
        content=content,
        file_size=file_size or (len(content) if content else None),
        status=models.DocumentStatus.CREATED
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    add_status_history(db, db_document.id, None, models.DocumentStatus.CREATED, "文档创建成功")
    return db_document

def update_document_content(db: Session, document_id: int, content: str):
    document = get_document(db, document_id)
    if not document:
        return None
    
    document.content = content
    document.file_size = len(content)
    document.updated_at = datetime.utcnow()
    
    if document.status == models.DocumentStatus.CREATED and content:
        add_status_history(db, document_id, document.status, document.status, "文档内容已更新")
    
    db.commit()
    db.refresh(document)
    return document

def get_document(db: Session, document_id: int):
    return db.query(models.Document).filter(models.Document.id == document_id).first()

def get_documents(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.Document)
    if status:
        query = query.filter(models.Document.status == status)
    return query.order_by(models.Document.created_at.desc()).offset(skip).limit(limit).all()

def update_document_status(db: Session, document_id: int, new_status: str, message: str = None):
    document = get_document(db, document_id)
    if not document:
        return None
    
    old_status = document.status
    document.status = new_status
    document.updated_at = datetime.utcnow()
    
    add_status_history(db, document_id, old_status, new_status, message)
    
    db.commit()
    db.refresh(document)
    return document

def add_status_history(db: Session, document_id: int, from_status: str, to_status: str, message: str = None):
    history = models.StatusHistory(
        document_id=document_id,
        from_status=from_status,
        to_status=to_status,
        message=message
    )
    db.add(history)
    db.commit()
    return history

def clear_old_hits(db: Session, document_id: int):
    db.query(models.SensitiveHit).filter(models.SensitiveHit.document_id == document_id).delete()
    db.commit()

def apply_masking(content: str, rules):
    if not content:
        return content, []
    
    lines = content.split('\n')
    all_hits = []
    
    rule_priority = {
        'id_card': 1,
        'address': 2,
        'name': 3,
        'phone': 4,
        'email': 5,
    }
    
    for rule in sorted(rules, key=lambda r: rule_priority.get(r.rule_type, 99)):
        try:
            pattern = re.compile(rule.pattern)
            for line_num, line in enumerate(lines, 1):
                line_hits = []
                for match in pattern.finditer(line):
                    full_match_start = match.start()
                    full_match_end = match.end()
                    matched_text = match.group()
                    
                    if rule.rule_type == 'name':
                        if matched_text.startswith(('：', ':')):
                            name_match = re.search(r'([\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*)', matched_text)
                            if name_match:
                                actual_text = name_match.group(1)
                                actual_start = match.start() + name_match.start(1)
                                actual_end = match.start() + name_match.end(1)
                            else:
                                continue
                        else:
                            actual_text = matched_text
                            actual_start = match.start()
                            actual_end = match.end()
                        
                        column_offset = actual_start + 1
                    elif rule.rule_type == 'id_card' and '身份证号' in matched_text:
                        id_match = re.search(r'\d{17}[\dXx]', matched_text)
                        if id_match:
                            actual_text = id_match.group()
                            actual_start = match.start() + id_match.start()
                            actual_end = match.start() + id_match.end()
                            column_offset = actual_start + 1
                        else:
                            continue
                    else:
                        actual_text = matched_text
                        actual_start = match.start()
                        actual_end = match.end()
                        column_offset = match.start() + 1
                    
                    line_hits.append({
                        'rule_id': rule.id,
                        'rule_type': rule.rule_type,
                        'matched_text': actual_text,
                        'full_match': matched_text,
                        'full_start': full_match_start,
                        'full_end': full_match_end,
                        'actual_start': actual_start,
                        'actual_end': actual_end,
                        'line_number': line_num,
                        'column_number': column_offset,
                        'context': line.strip(),
                        'replacement': rule.replacement,
                        'pattern': rule.pattern
                    })
                
                all_hits.extend(line_hits)
        except re.error:
            continue
    
    final_hits = []
    for line_num in range(1, len(lines) + 1):
        line_hits = [h for h in all_hits if h['line_number'] == line_num]
        covered_ranges = []
        
        for hit in sorted(line_hits, key=lambda h: rule_priority.get(h['rule_type'], 99)):
            overlap = False
            for (s, e) in covered_ranges:
                if not (hit['full_end'] <= s or hit['full_start'] >= e):
                    overlap = True
                    break
            
            if not overlap:
                covered_ranges.append((hit['full_start'], hit['full_end']))
                final_hits.append(hit)
    
    for hit in sorted(final_hits, key=lambda x: (x['line_number'], -x['full_start'])):
        line_idx = hit['line_number'] - 1
        original_line = lines[line_idx]
        full_match = hit['full_match']
        replacement = hit['replacement']
        start_pos = hit['full_start']
        
        new_line = original_line[:start_pos] + replacement + original_line[start_pos + len(full_match):]
        lines[line_idx] = new_line
        
        offset = len(replacement) - len(full_match)
        for other_hit in final_hits:
            if other_hit['line_number'] == hit['line_number'] and other_hit['full_start'] > hit['full_start']:
                other_hit['full_start'] += offset
                other_hit['full_end'] += offset
                other_hit['actual_start'] += offset
                other_hit['actual_end'] += offset
                other_hit['column_number'] += offset
    
    clean_hits = []
    for hit in final_hits:
        clean_hit = {
            'rule_id': hit['rule_id'],
            'matched_text': hit['matched_text'],
            'line_number': hit['line_number'],
            'column_number': hit['column_number'],
            'context': hit['context'],
            'replacement': hit['replacement']
        }
        clean_hits.append(clean_hit)
    
    masked_content = '\n'.join(lines)
    return masked_content, clean_hits

def scan_document(db: Session, document_id: int):
    document = get_document(db, document_id)
    if not document:
        return None
    
    if not document.content:
        update_document_status(db, document_id, models.DocumentStatus.ERROR, "文档内容为空，无法扫描")
        return document
    
    update_document_status(db, document_id, models.DocumentStatus.SCANNING, "开始扫描敏感信息")
    
    try:
        clear_old_hits(db, document_id)
        
        rules = db.query(models.MaskingRule).filter(models.MaskingRule.is_active == True).all()
        
        content = document.content
        masked_content, hits_data = apply_masking(content, rules)
        
        for hit_data in hits_data:
            hit = models.SensitiveHit(
                document_id=document_id,
                rule_id=hit_data['rule_id'],
                matched_text=hit_data['matched_text'],
                line_number=hit_data['line_number'],
                column_number=hit_data['column_number'],
                context=hit_data['context'],
                status="pending"
            )
            db.add(hit)
        
        document.masked_content = masked_content
        db.commit()
        
        update_document_status(db, document_id, models.DocumentStatus.SCAN_COMPLETED, 
                               f"敏感信息扫描完成，共发现 {len(hits_data)} 处敏感信息")
        update_document_status(db, document_id, models.DocumentStatus.PENDING_REVIEW, "等待人工复核")
        
    except Exception as e:
        update_document_status(db, document_id, models.DocumentStatus.ERROR, f"扫描失败: {str(e)}")
    
    db.refresh(document)
    return document

def create_review(db: Session, document_id: int, review: schemas.ReviewCreate):
    db_review = models.Review(
        document_id=document_id,
        reviewer=review.reviewer,
        comment=review.comment,
        decision=review.decision
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    if review.decision == "approve":
        update_document_status(db, document_id, models.DocumentStatus.REVIEW_COMPLETED, "人工复核通过")
        update_document_status(db, document_id, models.DocumentStatus.GENERATING_VERSION, "开始生成版本")
        generate_version(db, document_id)
    elif review.decision == "reject":
        update_document_status(db, document_id, models.DocumentStatus.ERROR, f"人工复核驳回: {review.comment or '未通过'}")
    
    return db_review

def generate_hit_report(document, hits, version_number):
    report_lines = []
    report_lines.append("=" * 60)
    report_lines.append("敏感信息脱敏命中报告")
    report_lines.append("=" * 60)
    report_lines.append(f"文档名称: {document.filename}")
    report_lines.append(f"文档ID: {document.id}")
    report_lines.append(f"版本号: {version_number}")
    report_lines.append(f"生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append(f"命中总数: {len(hits)}")
    report_lines.append("")
    report_lines.append("-" * 60)
    report_lines.append("命中详情:")
    report_lines.append("-" * 60)
    
    for i, hit in enumerate(hits, 1):
        report_lines.append(f"命中 #{i}:")
        report_lines.append(f"  敏感内容: {hit.matched_text}")
        report_lines.append(f"  位置: 第 {hit.line_number} 行, 第 {hit.column_number} 列")
        report_lines.append(f"  上下文: {hit.context}")
        report_lines.append("")
    
    report_lines.append("=" * 60)
    report_lines.append("报告结束")
    report_lines.append("=" * 60)
    
    return "\n".join(report_lines)

def generate_version(db: Session, document_id: int):
    document = get_document(db, document_id)
    if not document:
        return None
    
    version_count = db.query(models.ExportVersion).filter(models.ExportVersion.document_id == document_id).count()
    version_number = f"v{version_count + 1}.0"
    
    masked_file_path = os.path.join(EXPORT_DIR, f"{document_id}_{version_number}_masked.txt")
    report_file_path = os.path.join(EXPORT_DIR, f"{document_id}_{version_number}_report.txt")
    
    try:
        with open(masked_file_path, 'w', encoding='utf-8') as f:
            f.write(document.masked_content or document.content or "")
        
        hits = db.query(models.SensitiveHit).filter(models.SensitiveHit.document_id == document_id).all()
        report_content = generate_hit_report(document, hits, version_number)
        with open(report_file_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
    except Exception as e:
        update_document_status(db, document_id, models.DocumentStatus.ERROR, f"生成版本文件失败: {str(e)}")
        return None
    
    version = models.ExportVersion(
        document_id=document_id,
        version_number=version_number,
        file_path=masked_file_path,
        report_path=report_file_path
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    
    update_document_status(db, document_id, models.DocumentStatus.VERSION_GENERATED, f"版本 {version_number} 生成成功")
    update_document_status(db, document_id, models.DocumentStatus.PENDING_AUTHORIZATION, "等待下载授权")
    
    return version

def get_version_file_content(version):
    if not version or not version.file_path:
        return None
    try:
        with open(version.file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None

def get_version_report_content(version):
    if not version or not version.report_path:
        return None
    try:
        with open(version.report_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None

def authorize_version(db: Session, version_id: int, authorized_by: str):
    version = db.query(models.ExportVersion).filter(models.ExportVersion.id == version_id).first()
    if not version:
        return None
    
    version.is_authorized = True
    version.authorized_by = authorized_by
    version.authorized_at = datetime.utcnow()
    db.commit()
    db.refresh(version)
    
    update_document_status(db, version.document_id, models.DocumentStatus.AUTHORIZED, 
                           f"版本 {version.version_number} 下载已授权")
    
    return version

def record_download(db: Session, version_id: int, downloaded_by: str, ip_address: str = None):
    record = models.DownloadRecord(
        version_id=version_id,
        downloaded_by=downloaded_by,
        ip_address=ip_address
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    
    version = db.query(models.ExportVersion).filter(models.ExportVersion.id == version_id).first()
    if version:
        update_document_status(db, version.document_id, models.DocumentStatus.EXPORTING, "开始导出")
        update_document_status(db, version.document_id, models.DocumentStatus.EXPORTED, 
                               f"导出完成，下载人: {downloaded_by}")
    
    return record

def get_document_with_details(db: Session, document_id: int):
    document = get_document(db, document_id)
    if not document:
        return None
    
    return document

def init_default_rules(db: Session):
    existing = db.query(models.MaskingRule).count()
    if existing > 0:
        return
    
    default_rules = [
        {"name": "姓名脱敏-冒号格式", "rule_type": models.MaskingRuleType.NAME, 
         "pattern": r"[：:]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*\s*(?=，|,|身份证|电话|住址|签字|。|；|;|\s|$)", "replacement": "：**"},
        {"name": "姓名脱敏-签字格式", "rule_type": models.MaskingRuleType.NAME, 
         "pattern": r"[\u4e00-\u9fa5]{2,3}\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3}(?:\s*[/、,，\s]\s*[\u4e00-\u9fa5]{2,3})*(?=\s*签字|\s*签名|$)", "replacement": "**/**"},
        {"name": "身份证号脱敏", "rule_type": models.MaskingRuleType.ID_CARD, 
         "pattern": r"身份证号[：:]\s*\d{17}[\dXx]", "replacement": "身份证号：**************"},
        {"name": "手机号脱敏", "rule_type": models.MaskingRuleType.PHONE, 
         "pattern": r"(?<![\d])1[3-9]\d{9}(?![\d])", "replacement": "138****8000"},
        {"name": "邮箱脱敏", "rule_type": models.MaskingRuleType.EMAIL, 
         "pattern": r"[\w.-]+@[\w.-]+\.\w+", "replacement": "***@example.com"},
        {"name": "住址脱敏", "rule_type": models.MaskingRuleType.ADDRESS, 
         "pattern": r"住址[：:][\u4e00-\u9fa50-9]+", "replacement": "住址：***"}
    ]
    
    for rule_data in default_rules:
        rule = models.MaskingRule(**rule_data)
        db.add(rule)
    
    db.commit()
