import json
from datetime import datetime
from app.models.plate_model import PlateModel
from app.models.acid_bath_model import AcidBathModel
from app.models.color_separation_model import ColorSeparationModel
from app.models.test_print_model import TestPrintModel
from app.models.appointment_model import AppointmentModel
from app.models.review_model import ReviewIssueModel, ManualDecisionModel, ProcessingNoteModel
from app.database.connection import get_db_connection


class ExportService:
    @staticmethod
    def export_markdown_checklist(file_path):
        plates = PlateModel.get_all()
        latest_baths = AcidBathModel.get_latest_by_bath()
        
        lines = []
        lines.append('# 铜版蚀刻开工清单')
        lines.append(f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append('')
        lines.append('---')
        lines.append('')
        
        lines.append('## 酸槽状态概览')
        lines.append('')
        if latest_baths:
            lines.append('| 酸槽编号 | 浓度(%) | 温度(℃) | 通风状态 |')
            lines.append('|----------|---------|---------|----------|')
            for bath in latest_baths:
                lines.append(f'| {bath["bath_number"]} | {bath["concentration"] or "-"} | {bath["temperature"] or "-"} | {bath["ventilation_status"] or "-"} |')
        else:
            lines.append('*暂无酸槽记录*')
        lines.append('')
        
        lines.append('---')
        lines.append('')
        
        lines.append('## 版材清单')
        lines.append('')
        
        for plate in plates:
            plate_number = plate['plate_number']
            
            lines.append(f'### 版号: {plate_number}')
            lines.append('')
            
            lines.append('**基本信息:**')
            lines.append(f'- 学生姓名: {plate["student_name"] or "-"}')
            lines.append(f'- 版材类型: {plate["plate_type"] or "-"}')
            lines.append(f'- 版材尺寸: {plate["plate_size"] or "-"}')
            lines.append(f'- 预估蚀刻时间: {plate["estimated_etching_time"] or "-"} 分钟')
            lines.append('')
            
            issues = ReviewIssueModel.get_by_plate_number(plate_number)
            decisions = ManualDecisionModel.get_by_plate_number(plate_number)
            
            if issues:
                lines.append('**检测问题:**')
                lines.append('')
                for issue in issues:
                    status = '已处理' if any(d['issue_id'] == issue['id'] for d in decisions) else '待处理'
                    severity_icon = '🔴' if issue['severity'] == 'error' else '🟡'
                    lines.append(f'{severity_icon} **[{status}]** {issue["issue_description"]}')
                    lines.append('')
            else:
                lines.append('**检测问题:** 无')
                lines.append('')
            
            separations = ColorSeparationModel.get_by_plate_number(plate_number)
            if separations:
                lines.append('**套色信息:**')
                lines.append('')
                lines.append('| 顺序 | 颜色 | 蚀刻深度 | 备注 |')
                lines.append('|------|------|----------|------|')
                for sep in separations:
                    lines.append(f'| {sep["color_order"] or "-"} | {sep["color_name"] or "-"} | {sep["etching_depth"] or "-"} | {sep["notes"] or "-"} |')
                lines.append('')
            
            appointments = AppointmentModel.get_by_plate_number(plate_number)
            if appointments:
                lines.append('**预约信息:**')
                lines.append('')
                lines.append('| 日期 | 时间 | 酸槽 | 备注 |')
                lines.append('|------|------|------|------|')
                for appt in appointments:
                    time_str = f'{appt["start_time"] or "-"} - {appt["end_time"] or "-"}'
                    lines.append(f'| {appt["appointment_date"] or "-"} | {time_str} | {appt["bath_number"] or "-"} | {appt["notes"] or "-"} |')
                lines.append('')
            
            notes = ProcessingNoteModel.get_by_plate_number(plate_number)
            if notes:
                lines.append('**处理备注:**')
                lines.append('')
                for note in notes:
                    lines.append(f'> {note["note_content"]}')
                    lines.append(f'> *{note["created_at"]}*')
                    lines.append('')
            
            lines.append('---')
            lines.append('')
        
        content = '\n'.join(lines)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        ExportService._record_export('markdown', file_path, len(plates))
        return len(plates)

    @staticmethod
    def export_json_audit(file_path):
        audit_data = {
            'export_time': datetime.now().isoformat(),
            'version': '1.0',
            'data': {}
        }
        
        plates = PlateModel.get_all()
        audit_data['data']['plates'] = []
        
        for plate in plates:
            plate_data = dict(plate)
            plate_number = plate['plate_number']
            
            separations = ColorSeparationModel.get_by_plate_number(plate_number)
            plate_data['color_separations'] = [dict(s) for s in separations]
            
            appointments = AppointmentModel.get_by_plate_number(plate_number)
            plate_data['appointments'] = [dict(a) for a in appointments]
            
            test_prints = TestPrintModel.get_by_plate_number(plate_number)
            plate_data['test_prints'] = [dict(t) for t in test_prints]
            
            issues = ReviewIssueModel.get_by_plate_number(plate_number)
            plate_data['issues'] = [dict(i) for i in issues]
            
            decisions = ManualDecisionModel.get_by_plate_number(plate_number)
            plate_data['manual_decisions'] = [dict(d) for d in decisions]
            
            notes = ProcessingNoteModel.get_by_plate_number(plate_number)
            plate_data['processing_notes'] = [dict(n) for n in notes]
            
            audit_data['data']['plates'].append(plate_data)
        
        baths = AcidBathModel.get_all()
        audit_data['data']['acid_baths'] = [dict(b) for b in baths]
        
        all_issues = ReviewIssueModel.get_all()
        audit_data['data']['all_issues'] = [dict(i) for i in all_issues]
        
        all_decisions = ManualDecisionModel.get_all()
        audit_data['data']['all_decisions'] = [dict(d) for d in all_decisions]
        
        statistics = ExportService._calculate_statistics()
        audit_data['statistics'] = statistics
        
        content = json.dumps(audit_data, ensure_ascii=False, indent=2, default=str)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        ExportService._record_export('json', file_path, len(plates))
        return len(plates)

    @staticmethod
    def _calculate_statistics():
        plates = PlateModel.get_all()
        issues = ReviewIssueModel.get_all()
        decisions = ManualDecisionModel.get_all()
        
        error_issues = [i for i in issues if i['severity'] == 'error']
        warning_issues = [i for i in issues if i['severity'] == 'warning']
        
        resolved_issue_ids = set(d['issue_id'] for d in decisions if d['issue_id'])
        unresolved_issues = [i for i in issues if i['id'] not in resolved_issue_ids]
        
        return {
            'total_plates': len(plates),
            'total_issues': len(issues),
            'error_issues': len(error_issues),
            'warning_issues': len(warning_issues),
            'unresolved_issues': len(unresolved_issues),
            'total_decisions': len(decisions)
        }

    @staticmethod
    def _record_export(export_type, file_path, plate_count):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO export_history (export_type, file_path, plate_count)
                VALUES (?, ?, ?)
            ''', (export_type, file_path, plate_count))
            conn.commit()
        except:
            pass
