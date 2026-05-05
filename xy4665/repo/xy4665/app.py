import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_file, make_response
from werkzeug.utils import secure_filename
from config import Config
from models import (
    db, AliasTemplate, FieldAlias, Team, Member, Boat, 
    RaceSchedule, Risk, ReviewNote, UnmappedRow, 
    ImportSession, ImportedFile
)
from import_service import FieldMapper, FileParser, DataImporter
from validation_service import ValidationService

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

def init_db():
    with app.app_context():
        db.create_all()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/templates', methods=['GET'])
def get_templates():
    templates = AliasTemplate.query.all()
    return jsonify({
        'templates': [t.to_dict() for t in templates]
    })

@app.route('/api/templates', methods=['POST'])
def create_template():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': '模板名称不能为空'}), 400
    
    existing = AliasTemplate.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': '模板名称已存在'}), 400
    
    template = AliasTemplate(
        name=data['name'],
        description=data.get('description', ''),
        is_default=data.get('is_default', False)
    )
    
    if template.is_default:
        AliasTemplate.query.update({'is_default': False})
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify(template.to_dict()), 201

@app.route('/api/templates/<int:template_id>', methods=['GET'])
def get_template(template_id):
    template = AliasTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': '模板不存在'}), 404
    
    result = template.to_dict()
    result['aliases'] = [a.to_dict() for a in template.aliases]
    return jsonify(result)

@app.route('/api/templates/<int:template_id>/aliases', methods=['POST'])
def add_field_alias(template_id):
    template = AliasTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': '模板不存在'}), 404
    
    data = request.get_json()
    if not data or 'standard_field' not in data or 'aliases' not in data:
        return jsonify({'error': '缺少必要字段'}), 400
    
    field_alias = FieldAlias(
        template_id=template_id,
        standard_field=data['standard_field'],
        aliases=','.join(data['aliases']) if isinstance(data['aliases'], list) else data['aliases'],
        description=data.get('description', '')
    )
    
    db.session.add(field_alias)
    db.session.commit()
    
    return jsonify(field_alias.to_dict()), 201

@app.route('/api/templates/<int:template_id>', methods=['PUT'])
def update_template(template_id):
    template = AliasTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': '模板不存在'}), 404
    
    data = request.get_json()
    if data.get('name'):
        existing = AliasTemplate.query.filter(
            AliasTemplate.name == data['name'],
            AliasTemplate.id != template_id
        ).first()
        if existing:
            return jsonify({'error': '模板名称已存在'}), 400
        template.name = data['name']
    
    if 'description' in data:
        template.description = data['description']
    
    if data.get('is_default'):
        AliasTemplate.query.update({'is_default': False})
        template.is_default = True
    
    db.session.commit()
    return jsonify(template.to_dict())

@app.route('/api/templates/<int:template_id>', methods=['DELETE'])
def delete_template(template_id):
    template = AliasTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': '模板不存在'}), 404
    
    if template.is_default:
        return jsonify({'error': '不能删除默认模板'}), 400
    
    db.session.delete(template)
    db.session.commit()
    return jsonify({'message': '模板已删除'})

@app.route('/api/import/session', methods=['POST'])
def create_import_session():
    data = request.get_json() or {}
    
    session = ImportSession(
        session_name=data.get('session_name', f'导入会话 {datetime.now().strftime("%Y%m%d_%H%M%S")}'),
        template_id=data.get('template_id')
    )
    
    db.session.add(session)
    db.session.commit()
    
    return jsonify(session.to_dict()), 201

@app.route('/api/import/session/<int:session_id>/files', methods=['POST'])
def import_files(session_id):
    session = ImportSession.query.get(session_id)
    if not session:
        return jsonify({'error': '导入会话不存在'}), 404
    
    if 'files' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    field_mapper = FieldMapper(session.template_id)
    importer = DataImporter(field_mapper)
    
    results = []
    total_success = 0
    total_error = 0
    
    for file in files:
        if file.filename == '':
            continue
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        file_type = 'json' if filename.lower().endswith('.json') else 'csv'
        
        imported_file = ImportedFile(
            session_id=session_id,
            file_name=filename,
            file_type=file_type,
            status='processing'
        )
        db.session.add(imported_file)
        db.session.commit()
        
        try:
            parser = FileParser(field_mapper)
            rows, parse_issues = parser.parse_file(filepath, file_type)
            
            imported_file.total_rows = len(rows)
            
            data_type_hint = request.form.get('data_type')
            import_result = importer.import_rows(rows, filename, data_type_hint)
            
            imported_file.success_rows = import_result['success_count']
            imported_file.error_rows = import_result['error_count']
            imported_file.status = 'completed'
            
            total_success += import_result['success_count']
            total_error += import_result['error_count']
            
            results.append({
                'file_name': filename,
                'total_rows': len(rows),
                'success_rows': import_result['success_count'],
                'error_rows': import_result['error_count'],
                'parse_issues': parse_issues,
                'unmapped_rows': import_result.get('unmapped_rows', [])
            })
            
        except Exception as e:
            imported_file.status = 'failed'
            imported_file.error_message = str(e)
            results.append({
                'file_name': filename,
                'error': str(e)
            })
        
        db.session.commit()
    
    session.file_count = len(files)
    session.status = 'completed'
    session.completed_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'session': session.to_dict(),
        'total_success': total_success,
        'total_error': total_error,
        'files': results
    })

@app.route('/api/import/files', methods=['POST'])
def quick_import():
    if 'files' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    session = ImportSession(
        session_name=f'快速导入 {datetime.now().strftime("%Y%m%d_%H%M%S")}'
    )
    db.session.add(session)
    db.session.commit()
    
    field_mapper = FieldMapper()
    importer = DataImporter(field_mapper)
    
    results = []
    total_success = 0
    total_error = 0
    
    for file in files:
        if file.filename == '':
            continue
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        file_type = 'json' if filename.lower().endswith('.json') else 'csv'
        
        imported_file = ImportedFile(
            session_id=session.id,
            file_name=filename,
            file_type=file_type,
            status='processing'
        )
        db.session.add(imported_file)
        db.session.commit()
        
        try:
            parser = FileParser(field_mapper)
            rows, parse_issues = parser.parse_file(filepath, file_type)
            
            imported_file.total_rows = len(rows)
            
            data_type_hint = request.form.get('data_type')
            import_result = importer.import_rows(rows, filename, data_type_hint)
            
            imported_file.success_rows = import_result['success_count']
            imported_file.error_rows = import_result['error_count']
            imported_file.status = 'completed'
            
            total_success += import_result['success_count']
            total_error += import_result['error_count']
            
            results.append({
                'file_name': filename,
                'total_rows': len(rows),
                'success_rows': import_result['success_count'],
                'error_rows': import_result['error_count']
            })
            
        except Exception as e:
            imported_file.status = 'failed'
            imported_file.error_message = str(e)
            results.append({
                'file_name': filename,
                'error': str(e)
            })
        
        db.session.commit()
    
    session.file_count = len(files)
    session.status = 'completed'
    session.completed_at = datetime.utcnow()
    db.session.commit()
    
    validation_service = ValidationService()
    validation_result = validation_service.run_all_validations()
    
    return jsonify({
        'session': session.to_dict(),
        'import_summary': {
            'total_files': len(files),
            'total_success': total_success,
            'total_error': total_error
        },
        'validation': validation_result,
        'files': results
    })

@app.route('/api/teams', methods=['GET'])
def get_teams():
    teams = Team.query.all()
    return jsonify({
        'teams': [t.to_dict() for t in teams]
    })

@app.route('/api/teams/<int:team_id>', methods=['GET'])
def get_team(team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'error': '队伍不存在'}), 404
    
    result = team.to_dict()
    result['members'] = [m.to_dict() for m in team.members]
    return jsonify(result)

@app.route('/api/members', methods=['GET'])
def get_members():
    team_id = request.args.get('team_id', type=int)
    query = Member.query
    
    if team_id:
        query = query.filter_by(team_id=team_id)
    
    members = query.all()
    return jsonify({
        'members': [m.to_dict() for m in members]
    })

@app.route('/api/members/<int:member_id>', methods=['GET'])
def get_member(member_id):
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': '队员不存在'}), 404
    return jsonify(member.to_dict())

@app.route('/api/boats', methods=['GET'])
def get_boats():
    boats = Boat.query.all()
    return jsonify({
        'boats': [b.to_dict() for b in boats]
    })

@app.route('/api/boats/<int:boat_id>', methods=['GET'])
def get_boat(boat_id):
    boat = Boat.query.get(boat_id)
    if not boat:
        return jsonify({'error': '船艇不存在'}), 404
    return jsonify(boat.to_dict())

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    schedules = RaceSchedule.query.order_by(
        RaceSchedule.race_date,
        RaceSchedule.start_time
    ).all()
    return jsonify({
        'schedules': [s.to_dict() for s in schedules]
    })

@app.route('/api/schedules/<int:schedule_id>', methods=['GET'])
def get_schedule(schedule_id):
    schedule = RaceSchedule.query.get(schedule_id)
    if not schedule:
        return jsonify({'error': '赛程不存在'}), 404
    return jsonify(schedule.to_dict())

@app.route('/api/risks', methods=['GET'])
def get_risks():
    is_resolved = request.args.get('is_resolved', type=bool)
    severity = request.args.get('severity')
    risk_type = request.args.get('risk_type')
    
    query = Risk.query
    
    if is_resolved is not None:
        query = query.filter_by(is_resolved=is_resolved)
    if severity:
        query = query.filter_by(severity=severity)
    if risk_type:
        query = query.filter_by(risk_type=risk_type)
    
    risks = query.order_by(Risk.created_at.desc()).all()
    return jsonify({
        'risks': [r.to_dict() for r in risks]
    })

@app.route('/api/risks/<int:risk_id>', methods=['GET'])
def get_risk(risk_id):
    risk = Risk.query.get(risk_id)
    if not risk:
        return jsonify({'error': '风险不存在'}), 404
    return jsonify(risk.to_dict())

@app.route('/api/risks/<int:risk_id>/resolve', methods=['POST'])
def resolve_risk(risk_id):
    risk = Risk.query.get(risk_id)
    if not risk:
        return jsonify({'error': '风险不存在'}), 404
    
    data = request.get_json() or {}
    
    risk.is_resolved = True
    risk.resolved_at = datetime.utcnow()
    risk.resolved_by = data.get('resolved_by', '裁判')
    risk.resolved_note = data.get('resolved_note', '')
    
    db.session.commit()
    return jsonify(risk.to_dict())

@app.route('/api/validate', methods=['POST'])
def run_validation():
    validation_service = ValidationService()
    result = validation_service.run_all_validations()
    return jsonify(result)

@app.route('/api/validate/member/<int:member_id>', methods=['GET'])
def validate_member(member_id):
    validation_service = ValidationService()
    result = validation_service.validate_member(member_id)
    return jsonify(result)

@app.route('/api/validate/team/<int:team_id>', methods=['GET'])
def validate_team(team_id):
    validation_service = ValidationService()
    result = validation_service.validate_team(team_id)
    return jsonify(result)

@app.route('/api/unmapped', methods=['GET'])
def get_unmapped_rows():
    is_resolved = request.args.get('is_resolved', type=bool)
    source_file = request.args.get('source_file')
    
    query = UnmappedRow.query
    
    if is_resolved is not None:
        query = query.filter_by(is_resolved=is_resolved)
    if source_file:
        query = query.filter_by(source_file=source_file)
    
    unmapped = query.order_by(
        UnmappedRow.source_file,
        UnmappedRow.row_number
    ).all()
    
    return jsonify({
        'unmapped_rows': [u.to_dict() for u in unmapped]
    })

@app.route('/api/unmapped/<int:row_id>/resolve', methods=['POST'])
def resolve_unmapped(row_id):
    unmapped = UnmappedRow.query.get(row_id)
    if not unmapped:
        return jsonify({'error': '记录不存在'}), 404
    
    data = request.get_json() or {}
    
    unmapped.is_resolved = True
    unmapped.resolved_note = data.get('resolved_note', '')
    
    db.session.commit()
    return jsonify(unmapped.to_dict())

@app.route('/api/notes', methods=['GET'])
def get_notes():
    related_type = request.args.get('related_type')
    related_id = request.args.get('related_id', type=int)
    
    query = ReviewNote.query
    
    if related_type:
        query = query.filter_by(related_type=related_type)
    if related_id:
        query = query.filter_by(related_id=related_id)
    
    notes = query.order_by(ReviewNote.created_at.desc()).all()
    return jsonify({
        'notes': [n.to_dict() for n in notes]
    })

@app.route('/api/notes', methods=['POST'])
def create_note():
    data = request.get_json()
    if not data or 'note' not in data:
        return jsonify({'error': '备注内容不能为空'}), 400
    
    note = ReviewNote(
        related_type=data.get('related_type'),
        related_id=data.get('related_id'),
        note=data['note'],
        reviewer=data.get('reviewer', '裁判')
    )
    
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    teams = Team.query.all()
    risks = Risk.query.filter_by(is_resolved=False).order_by(Risk.severity.desc()).all()
    unmapped = UnmappedRow.query.filter_by(is_resolved=False).all()
    schedules = RaceSchedule.query.order_by(
        RaceSchedule.race_date,
        RaceSchedule.start_time
    ).all()
    
    md_content = f"""# 龙舟赛裁判复核单

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 1. 队伍信息概览

| 队伍名称 | 所属社区 | 队员人数 | 来源文件 |
|---------|---------|---------|---------|
"""
    
    for team in teams:
        member_count = team.members.count()
        md_content += f"| {team.name} | {team.community or '-'} | {member_count} | {team.source_file or '-'} |\n"
    
    md_content += f"""
---

## 2. 风险预警 ({len(risks)} 项)

### 错误级别风险 ({len([r for r in risks if r.severity == 'error'])} 项)

"""
    
    for risk in [r for r in risks if r.severity == 'error']:
        md_content += f"""
#### {risk.title}

- **类型**: {risk.risk_type}
- **来源**: {risk.source_file or '-'} (行 {risk.source_row or '-'})
- **描述**: {risk.description or '-'}

"""
    
    md_content += f"""
### 警告级别风险 ({len([r for r in risks if r.severity == 'warning'])} 项)

"""
    
    for risk in [r for r in risks if r.severity == 'warning']:
        md_content += f"""
#### {risk.title}

- **类型**: {risk.risk_type}
- **来源**: {risk.source_file or '-'} (行 {risk.source_row or '-'})
- **描述**: {risk.description or '-'}

"""
    
    md_content += f"""
---

## 3. 无法映射的数据 ({len(unmapped)} 项)

| 源文件 | 行号 | 字段名 | 错误信息 |
|-------|------|--------|---------|
"""
    
    for row in unmapped:
        md_content += f"| {row.source_file} | {row.row_number} | {row.field_name or '-'} | {row.error_message or '-'} |\n"
    
    md_content += f"""
---

## 4. 赛程安排

| 赛事名称 | 日期 | 时间 | 赛道 | 船号 | 队伍 | 轮次 |
|---------|------|------|------|------|------|------|
"""
    
    for s in schedules:
        team_name = s.team.name if s.team else '-'
        md_content += f"| {s.race_name} | {s.race_date} | {s.start_time}-{s.end_time} | {s.track_number or '-'} | {s.boat_number or '-'} | {team_name} | {s.round_type or '-'} |\n"
    
    md_content += """
---

## 5. 复核记录

[ ] 队伍信息已核对
[ ] 队员身份已核实
[ ] 船艇分配已确认
[ ] 赛程安排无冲突
[ ] 所有风险已处理

**复核人**: _______________
**复核时间**: _______________
"""
    
    response = make_response(md_content)
    response.headers["Content-Disposition"] = f"attachment; filename=review_checklist_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    response.headers["Content-type"] = "text/markdown"
    return response

@app.route('/api/export/json', methods=['GET'])
def export_json():
    teams = Team.query.all()
    members = Member.query.all()
    boats = Boat.query.all()
    schedules = RaceSchedule.query.all()
    risks = Risk.query.all()
    unmapped = UnmappedRow.query.all()
    notes = ReviewNote.query.all()
    
    export_data = {
        'export_metadata': {
            'export_time': datetime.utcnow().isoformat(),
            'version': '1.0'
        },
        'teams': [t.to_dict() for t in teams],
        'members': [m.to_dict() for m in members],
        'boats': [b.to_dict() for b in boats],
        'schedules': [s.to_dict() for s in schedules],
        'risks': [r.to_dict() for r in risks],
        'unmapped_rows': [u.to_dict() for u in unmapped],
        'review_notes': [n.to_dict() for n in notes],
        'statistics': {
            'team_count': len(teams),
            'member_count': len(members),
            'boat_count': len(boats),
            'schedule_count': len(schedules),
            'unresolved_risks': len([r for r in risks if not r.is_resolved]),
            'unresolved_unmapped': len([u for u in unmapped if not u.is_resolved])
        }
    }
    
    response = make_response(json.dumps(export_data, ensure_ascii=False, indent=2))
    response.headers["Content-Disposition"] = f"attachment; filename=audit_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    response.headers["Content-type"] = "application/json"
    return response

@app.route('/api/stats', methods=['GET'])
def get_stats():
    team_count = Team.query.count()
    member_count = Member.query.count()
    boat_count = Boat.query.count()
    schedule_count = RaceSchedule.query.count()
    unresolved_risks = Risk.query.filter_by(is_resolved=False).count()
    unresolved_unmapped = UnmappedRow.query.filter_by(is_resolved=False).count()
    
    return jsonify({
        'statistics': {
            'team_count': team_count,
            'member_count': member_count,
            'boat_count': boat_count,
            'schedule_count': schedule_count,
            'unresolved_risks': unresolved_risks,
            'unresolved_unmapped': unresolved_unmapped
        }
    })

@app.route('/api/clear', methods=['POST'])
def clear_all_data():
    data = request.get_json() or {}
    confirm = data.get('confirm', False)
    
    if not confirm:
        return jsonify({'error': '需要确认才能清除数据'}), 400
    
    try:
        ReviewNote.query.delete()
        UnmappedRow.query.delete()
        Risk.query.delete()
        RaceSchedule.query.delete()
        Member.query.delete()
        Boat.query.delete()
        Team.query.delete()
        ImportedFile.query.delete()
        ImportSession.query.delete()
        db.session.commit()
        
        return jsonify({'message': '所有数据已清除'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
