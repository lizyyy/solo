from datetime import datetime
from typing import Dict, List, Any
from io import StringIO
import csv
import json

from models import (
    Session,
    CollectionItem,
    Box,
    Seal,
    EnvironmentRecord,
    Photo,
    SignRecord,
    ValidationIssue,
    ReviewNote,
    HandoverChain,
    IssueSeverity,
    IssueType,
    ReviewStatus,
)


class BaseReportGenerator:
    def generate(self, session: Session) -> str:
        raise NotImplementedError("Subclasses must implement generate method")
    
    def _format_datetime(self, dt: datetime) -> str:
        return dt.strftime('%Y-%m-%d %H:%M:%S') if dt else '未知'
    
    def _get_issue_severity_name(self, severity: IssueSeverity) -> str:
        names = {
            IssueSeverity.CRITICAL: '严重',
            IssueSeverity.WARNING: '警告',
            IssueSeverity.INFO: '提示',
        }
        return names.get(severity, '未知')
    
    def _get_issue_type_name(self, issue_type: IssueType) -> str:
        names = {
            IssueType.DUPLICATE_PACKING: '重复装箱',
            IssueType.SEAL_BROKEN_CHAIN: '封签断链',
            IssueType.TIME_GAP: '时间空档',
            IssueType.PHOTO_MISSING: '照片缺失',
            IssueType.SIGN_ORDER_ERROR: '签收顺序异常',
            IssueType.TEMP_HUMIDITY_EXCEEDED: '温湿度超限',
        }
        return names.get(issue_type, '未知')
    
    def _get_review_status_name(self, status: ReviewStatus) -> str:
        names = {
            ReviewStatus.PENDING: '待处理',
            ReviewStatus.REVIEWED: '已复核',
            ReviewStatus.RESOLVED: '已解决',
            ReviewStatus.DISMISSED: '已忽略',
        }
        return names.get(status, '未知')


class MarkdownReportGenerator(BaseReportGenerator):
    def generate(self, session: Session) -> str:
        lines = []
        
        lines.append(f'# 借展装箱交接核对报告')
        lines.append('')
        lines.append(f'**会话名称：** {session.name}')
        lines.append(f'**会话ID：** {session.session_id}')
        lines.append(f'**生成时间：** {self._format_datetime(datetime.now())}')
        lines.append(f'**创建时间：** {self._format_datetime(session.created_at)}')
        lines.append('')
        
        if session.description:
            lines.append('## 会话描述')
            lines.append('')
            lines.append(session.description)
            lines.append('')
        
        lines.append('## 数据概览')
        lines.append('')
        lines.append('| 数据类型 | 数量 |')
        lines.append('|---------|------|')
        lines.append(f'| 藏品数量 | {len(session.items)} |')
        lines.append(f'| 箱子数量 | {len(session.boxes)} |')
        lines.append(f'| 封签数量 | {len(session.seals)} |')
        lines.append(f'| 环境记录 | {len(session.env_records)} |')
        lines.append(f'| 照片记录 | {len(session.photos)} |')
        lines.append(f'| 签收记录 | {len(session.sign_records)} |')
        lines.append('')
        
        issues_by_severity = {
            'critical': [],
            'warning': [],
            'info': [],
        }
        
        for issue in session.issues.values():
            sev = issue.severity.value if issue.severity else 'info'
            issues_by_severity[sev].append(issue)
        
        lines.append('## 问题统计')
        lines.append('')
        lines.append('| 严重程度 | 数量 |')
        lines.append('|---------|------|')
        lines.append(f'| 严重 | {len(issues_by_severity["critical"])} |')
        lines.append(f'| 警告 | {len(issues_by_severity["warning"])} |')
        lines.append(f'| 提示 | {len(issues_by_severity["info"])} |')
        lines.append('')
        
        if issues_by_severity['critical'] or issues_by_severity['warning'] or issues_by_severity['info']:
            lines.append('## 问题详情')
            lines.append('')
            
            if issues_by_severity['critical']:
                lines.append('### 严重问题')
                lines.append('')
                for issue in issues_by_severity['critical']:
                    lines.append(f'#### {self._get_issue_type_name(issue.issue_type)}')
                    lines.append('')
                    lines.append(f'**状态：** {self._get_review_status_name(issue.review_status)}')
                    lines.append(f'**描述：** {issue.message}')
                    
                    if issue.affected_items:
                        lines.append(f'**影响藏品：** {", ".join(issue.affected_items)}')
                    if issue.affected_boxes:
                        lines.append(f'**影响箱子：** {", ".join(issue.affected_boxes)}')
                    if issue.affected_seals:
                        lines.append(f'**影响封签：** {", ".join(issue.affected_seals)}')
                    
                    if issue.review_notes:
                        lines.append('')
                        lines.append('**复核记录：**')
                        lines.append('')
                        for note in issue.review_notes:
                            lines.append(f'- **{note.author}** ({self._format_datetime(note.timestamp)}): {note.content}')
                            if note.status_change:
                                lines.append(f'  状态变更为：{self._get_review_status_name(note.status_change)}')
                    
                    lines.append('')
            
            if issues_by_severity['warning']:
                lines.append('### 警告问题')
                lines.append('')
                for issue in issues_by_severity['warning']:
                    lines.append(f'- **{self._get_issue_type_name(issue.issue_type)}** [{self._get_review_status_name(issue.review_status)}]: {issue.message}')
                lines.append('')
            
            if issues_by_severity['info']:
                lines.append('### 提示问题')
                lines.append('')
                for issue in issues_by_severity['info']:
                    lines.append(f'- **{self._get_issue_type_name(issue.issue_type)}** [{self._get_review_status_name(issue.review_status)}]: {issue.message}')
                lines.append('')
        
        if session.items:
            lines.append('## 藏品列表')
            lines.append('')
            lines.append('| 藏品编号 | 名称 | 类别 | 箱号 | 状态 |')
            lines.append('|---------|------|------|------|------|')
            for item_id, item in session.items.items():
                has_issue = any(item_id in issue.affected_items for issue in session.issues.values())
                status = '有问题' if has_issue else '正常'
                lines.append(f'| {item.item_id} | {item.name} | {item.category or "-"} | {item.box_id or "未装箱"} | {status} |')
            lines.append('')
        
        if session.boxes:
            lines.append('## 箱子列表')
            lines.append('')
            lines.append('| 箱号 | 描述 | 藏品数 | 封签数 | 状态 |')
            lines.append('|------|------|--------|--------|------|')
            for box_id, box in session.boxes.items():
                has_issue = any(box_id in issue.affected_boxes for issue in session.issues.values())
                status = '有问题' if has_issue else '正常'
                lines.append(f'| {box.box_id} | {box.description or "-"} | {len(box.item_ids)} | {len(box.seal_ids)} | {status} |')
            lines.append('')
        
        if session.env_records:
            loggers: Dict[str, Dict[str, Any]] = {}
            for record_id, record in session.env_records.items():
                if record.logger_id not in loggers:
                    loggers[record.logger_id] = {
                        'count': 0,
                        'temps': [],
                        'humidities': [],
                        'has_exceed': False,
                    }
                loggers[record.logger_id]['count'] += 1
                loggers[record.logger_id]['temps'].append(record.temperature)
                loggers[record.logger_id]['humidities'].append(record.humidity)
                if record.is_temperature_exceeded or record.is_humidity_exceeded:
                    loggers[record.logger_id]['has_exceed'] = True
            
            lines.append('## 环境记录概览')
            lines.append('')
            lines.append('| 记录仪编号 | 记录数 | 温度范围 | 湿度范围 | 状态 |')
            lines.append('|-----------|--------|----------|----------|------|')
            for logger_id, data in loggers.items():
                temp_min = min(data['temps']) if data['temps'] else 0
                temp_max = max(data['temps']) if data['temps'] else 0
                hum_min = min(data['humidities']) if data['humidities'] else 0
                hum_max = max(data['humidities']) if data['humidities'] else 0
                status = '超限' if data['has_exceed'] else '正常'
                lines.append(f'| {logger_id} | {data["count"]} | {temp_min:.1f}°C ~ {temp_max:.1f}°C | {hum_min:.1f}% ~ {hum_max:.1f}% | {status} |')
            lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append('*本报告由借展装箱交接核对台自动生成*')
        
        return '\n'.join(lines)


class CSVReportGenerator(BaseReportGenerator):
    def generate(self, session: Session) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['会话信息'])
        writer.writerow(['会话名称', session.name])
        writer.writerow(['会话ID', session.session_id])
        writer.writerow(['描述', session.description or ''])
        writer.writerow(['创建时间', self._format_datetime(session.created_at)])
        writer.writerow(['更新时间', self._format_datetime(session.updated_at)])
        writer.writerow([])
        
        writer.writerow(['问题统计'])
        critical_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in session.issues.values() if i.severity == IssueSeverity.INFO)
        writer.writerow(['严重问题', critical_count])
        writer.writerow(['警告问题', warning_count])
        writer.writerow(['提示问题', info_count])
        writer.writerow([])
        
        if session.issues:
            writer.writerow(['问题详情'])
            writer.writerow([
                '问题ID', '问题类型', '严重程度', '状态', '描述',
                '影响藏品', '影响箱子', '影响封签'
            ])
            for issue_id, issue in session.issues.items():
                writer.writerow([
                    issue.issue_id,
                    self._get_issue_type_name(issue.issue_type),
                    self._get_issue_severity_name(issue.severity),
                    self._get_review_status_name(issue.review_status),
                    issue.message,
                    ', '.join(issue.affected_items) if issue.affected_items else '',
                    ', '.join(issue.affected_boxes) if issue.affected_boxes else '',
                    ', '.join(issue.affected_seals) if issue.affected_seals else '',
                ])
            writer.writerow([])
        
        if session.items:
            writer.writerow(['藏品列表'])
            writer.writerow(['藏品编号', '名称', '类别', '描述', '尺寸', '重量', '状态', '箱号'])
            for item_id, item in session.items.items():
                has_issue = any(item_id in issue.affected_items for issue in session.issues.values())
                writer.writerow([
                    item.item_id,
                    item.name,
                    item.category or '',
                    item.description or '',
                    item.dimensions or '',
                    item.weight or '',
                    '有问题' if has_issue else '正常',
                    item.box_id or '',
                ])
            writer.writerow([])
        
        if session.boxes:
            writer.writerow(['箱子列表'])
            writer.writerow(['箱号', '描述', '类型', '尺寸', '藏品数', '封签数', '状态'])
            for box_id, box in session.boxes.items():
                has_issue = any(box_id in issue.affected_boxes for issue in session.issues.values())
                writer.writerow([
                    box.box_id,
                    box.description or '',
                    box.type or '',
                    box.dimension or '',
                    len(box.item_ids),
                    len(box.seal_ids),
                    '有问题' if has_issue else '正常',
                ])
            writer.writerow([])
        
        if session.seals:
            writer.writerow(['封签列表'])
            writer.writerow([
                '封签编号', '箱号', '加封时间', '启封时间',
                '加封人', '启封人', '前驱封签', '后继封签', '是否完整'
            ])
            for seal_id, seal in session.seals.items():
                writer.writerow([
                    seal.seal_id,
                    seal.box_id,
                    self._format_datetime(seal.applied_at),
                    self._format_datetime(seal.removed_at),
                    seal.applied_by or '',
                    seal.removed_by or '',
                    seal.previous_seal_id or '',
                    seal.next_seal_id or '',
                    '是' if seal.is_intact else '否',
                ])
            writer.writerow([])
        
        if session.sign_records:
            writer.writerow(['签收记录'])
            writer.writerow([
                '记录ID', '签收人', '角色', '动作', '箱号',
                '藏品号', '封签号', '时间', '地点', '备注', '顺序'
            ])
            for sign_id, sign in session.sign_records.items():
                writer.writerow([
                    sign.sign_id,
                    sign.person_name,
                    sign.role or '',
                    sign.action,
                    sign.box_id or '',
                    sign.item_id or '',
                    sign.seal_id or '',
                    self._format_datetime(sign.timestamp),
                    sign.location or '',
                    sign.notes or '',
                    sign.order,
                ])
            writer.writerow([])
        
        return output.getvalue()


class JSONReportGenerator(BaseReportGenerator):
    def generate(self, session: Session) -> str:
        from storage.session_store import SessionSerializer
        
        data = {
            'report_info': {
                'generated_at': datetime.now().isoformat(),
                'session_id': session.session_id,
                'session_name': session.name,
                'session_description': session.description,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'updated_at': session.updated_at.isoformat() if session.updated_at else None,
            },
            'summary': {
                'item_count': len(session.items),
                'box_count': len(session.boxes),
                'seal_count': len(session.seals),
                'env_record_count': len(session.env_records),
                'photo_count': len(session.photos),
                'sign_count': len(session.sign_records),
                'issue_count': len(session.issues),
                'issues_by_severity': {
                    'critical': sum(1 for i in session.issues.values() if i.severity == IssueSeverity.CRITICAL),
                    'warning': sum(1 for i in session.issues.values() if i.severity == IssueSeverity.WARNING),
                    'info': sum(1 for i in session.issues.values() if i.severity == IssueSeverity.INFO),
                }
            },
            'items': [],
            'boxes': [],
            'seals': [],
            'env_records': [],
            'photos': [],
            'sign_records': [],
            'issues': [],
        }
        
        for item_id, item in session.items.items():
            has_issue = any(item_id in issue.affected_items for issue in session.issues.values())
            data['items'].append({
                'item_id': item.item_id,
                'name': item.name,
                'category': item.category,
                'description': item.description,
                'dimensions': item.dimensions,
                'weight': item.weight,
                'condition': item.condition,
                'insurance_value': item.insurance_value,
                'box_id': item.box_id,
                'has_issue': has_issue,
            })
        
        for box_id, box in session.boxes.items():
            has_issue = any(box_id in issue.affected_boxes for issue in session.issues.values())
            data['boxes'].append({
                'box_id': box.box_id,
                'description': box.description,
                'type': box.type,
                'dimension': box.dimension,
                'item_ids': box.item_ids,
                'seal_ids': box.seal_ids,
                'has_issue': has_issue,
            })
        
        for seal_id, seal in session.seals.items():
            data['seals'].append({
                'seal_id': seal.seal_id,
                'box_id': seal.box_id,
                'applied_at': seal.applied_at.isoformat() if seal.applied_at else None,
                'removed_at': seal.removed_at.isoformat() if seal.removed_at else None,
                'applied_by': seal.applied_by,
                'removed_by': seal.removed_by,
                'previous_seal_id': seal.previous_seal_id,
                'next_seal_id': seal.next_seal_id,
                'is_intact': seal.is_intact,
            })
        
        for record_id, record in session.env_records.items():
            data['env_records'].append({
                'record_id': record.record_id,
                'logger_id': record.logger_id,
                'box_id': record.box_id,
                'timestamp': record.timestamp.isoformat() if record.timestamp else None,
                'temperature': record.temperature,
                'humidity': record.humidity,
                'temp_min': record.temp_min,
                'temp_max': record.temp_max,
                'humidity_min': record.humidity_min,
                'humidity_max': record.humidity_max,
                'is_temperature_exceeded': record.is_temperature_exceeded,
                'is_humidity_exceeded': record.is_humidity_exceeded,
            })
        
        for photo_id, photo in session.photos.items():
            data['photos'].append({
                'photo_id': photo.photo_id,
                'filename': photo.filename,
                'description': photo.description,
                'category': photo.category,
                'box_id': photo.box_id,
                'item_id': photo.item_id,
                'seal_id': photo.seal_id,
                'timestamp': photo.timestamp.isoformat() if photo.timestamp else None,
                'photographer': photo.photographer,
            })
        
        for sign_id, sign in session.sign_records.items():
            data['sign_records'].append({
                'sign_id': sign.sign_id,
                'person_name': sign.person_name,
                'role': sign.role,
                'action': sign.action,
                'box_id': sign.box_id,
                'item_id': sign.item_id,
                'seal_id': sign.seal_id,
                'timestamp': sign.timestamp.isoformat() if sign.timestamp else None,
                'location': sign.location,
                'notes': sign.notes,
                'order': sign.order,
            })
        
        for issue_id, issue in session.issues.items():
            notes_data = []
            for note in issue.review_notes:
                notes_data.append({
                    'note_id': note.note_id,
                    'author': note.author,
                    'content': note.content,
                    'timestamp': note.timestamp.isoformat() if note.timestamp else None,
                    'status_change': note.status_change.value if note.status_change else None,
                })
            
            data['issues'].append({
                'issue_id': issue.issue_id,
                'issue_type': issue.issue_type.value if issue.issue_type else None,
                'issue_type_name': self._get_issue_type_name(issue.issue_type),
                'severity': issue.severity.value if issue.severity else None,
                'severity_name': self._get_issue_severity_name(issue.severity),
                'message': issue.message,
                'affected_items': issue.affected_items,
                'affected_boxes': issue.affected_boxes,
                'affected_seals': issue.affected_seals,
                'review_status': issue.review_status.value if issue.review_status else None,
                'review_status_name': self._get_review_status_name(issue.review_status),
                'review_notes': notes_data,
            })
        
        return json.dumps(data, ensure_ascii=False, indent=2)
