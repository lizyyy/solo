import os
import json
import re
from datetime import datetime
from io import BytesIO
import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import db, PromptTemplate, TemplateVersion, ApprovalRecord, GrayRecord, EffectRecord

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "data", "prompts.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

db.init_app(app)

os.makedirs(os.path.join(basedir, 'data'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'exports'), exist_ok=True)


def validate_variables(content, variables):
    errors = []
    warnings = []
    
    actual_vars = extract_variables_from_content(content)
    
    if actual_vars:
        if not variables:
            errors.append(f"提示词中发现未定义变量: {', '.join(actual_vars)}")
            return False, [], errors, warnings
        
        var_list = json.loads(variables) if isinstance(variables, str) else variables
        defined_var_names = [v.get('name', '') for v in var_list if v.get('name')]
        
        undefined_vars = [v for v in actual_vars if v not in defined_var_names]
        if undefined_vars:
            errors.append(f"提示词中发现未定义变量: {', '.join(undefined_vars)}")
        
        unused_vars = [v for v in defined_var_names if v not in actual_vars]
        if unused_vars:
            warnings.append(f"变量已定义但未在提示词中使用: {', '.join(unused_vars)}")
        
        return len(errors) == 0, [], errors, warnings
    else:
        if variables:
            var_list = json.loads(variables) if isinstance(variables, str) else variables
            defined_var_names = [v.get('name', '') for v in var_list if v.get('name')]
            if defined_var_names:
                warnings.append(f"已定义变量但提示词中未使用: {', '.join(defined_var_names)}")
        
        return True, [], [], warnings


def extract_variables_from_content(content):
    pattern = r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}'
    matches = re.findall(pattern, content)
    return sorted(list(set(matches)))


@app.route('/api/templates', methods=['GET'])
def get_templates():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    scenario = request.args.get('scenario')
    status = request.args.get('status')
    search = request.args.get('search', '')

    query = PromptTemplate.query

    if scenario and scenario != 'all':
        query = query.filter(PromptTemplate.scenario == scenario)
    if status and status != 'all':
        query = query.filter(PromptTemplate.status == status)
    if search:
        query = query.filter(
            (PromptTemplate.name.contains(search)) |
            (PromptTemplate.description.contains(search))
        )

    templates = query.order_by(PromptTemplate.updated_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for t in templates.items:
        latest_version = TemplateVersion.query.filter_by(
            template_id=t.template_id,
            version=t.current_version
        ).first()
        result.append({
            'template_id': t.template_id,
            'name': t.name,
            'description': t.description,
            'scenario': t.scenario,
            'status': t.status,
            'current_version': t.current_version,
            'created_at': t.created_at.isoformat(),
            'updated_at': t.updated_at.isoformat(),
            'created_by': t.created_by,
            'variables': json.loads(latest_version.variables) if latest_version and latest_version.variables else []
        })

    return jsonify({
        'data': result,
        'total': templates.total,
        'page': page,
        'per_page': per_page,
        'pages': templates.pages
    })


@app.route('/api/templates/<template_id>', methods=['GET'])
def get_template_detail(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    versions = TemplateVersion.query.filter_by(template_id=template_id).order_by(TemplateVersion.version.desc()).all()
    approvals = ApprovalRecord.query.filter_by(template_id=template_id).order_by(ApprovalRecord.created_at.desc()).all()
    gray_records = GrayRecord.query.filter_by(template_id=template_id).order_by(GrayRecord.start_time.desc()).all()
    effect_records = EffectRecord.query.filter_by(template_id=template_id).order_by(EffectRecord.recorded_at.desc()).all()

    timeline = []

    for v in versions:
        timeline.append({
            'type': 'version',
            'version': v.version,
            'time': v.created_at.isoformat(),
            'user': v.created_by,
            'message': f'创建版本 v{v.version}',
            'changelog': v.changelog
        })

    for a in approvals:
        timeline.append({
            'type': 'approval',
            'version': a.version,
            'time': a.created_at.isoformat(),
            'user': a.approver,
            'message': f'审批{"通过" if a.status == "approved" else "驳回"}',
            'status': a.status,
            'opinion': a.opinion
        })

    for g in gray_records:
        timeline.append({
            'type': 'gray',
            'version': g.version,
            'time': g.start_time.isoformat() if g.start_time else g.created_at.isoformat(),
            'user': g.created_by,
            'message': f'灰度发布 {g.traffic_percent}% 流量' + (' (已回滚)' if g.rolled_back else ''),
            'status': g.status,
            'rolled_back': g.rolled_back
        })

    for e in effect_records:
        timeline.append({
            'type': 'effect',
            'version': e.version,
            'time': e.recorded_at.isoformat(),
            'user': 'system',
            'message': f'效果记录: {e.metric_name} = {e.metric_value}',
            'metric_name': e.metric_name,
            'metric_value': e.metric_value
        })

    timeline.sort(key=lambda x: x['time'], reverse=True)

    return jsonify({
        'template': {
            'template_id': template.template_id,
            'name': template.name,
            'description': template.description,
            'scenario': template.scenario,
            'status': template.status,
            'current_version': template.current_version,
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat(),
            'created_by': template.created_by
        },
        'versions': [{
            'version': v.version,
            'content': v.content,
            'variables': json.loads(v.variables) if v.variables else [],
            'created_at': v.created_at.isoformat(),
            'created_by': v.created_by,
            'changelog': v.changelog
        } for v in versions],
        'approvals': [{
            'version': a.version,
            'approver': a.approver,
            'opinion': a.opinion,
            'status': a.status,
            'created_at': a.created_at.isoformat(),
            'approved_at': a.approved_at.isoformat() if a.approved_at else None
        } for a in approvals],
        'gray_records': [{
            'version': g.version,
            'traffic_percent': g.traffic_percent,
            'start_time': g.start_time.isoformat() if g.start_time else None,
            'end_time': g.end_time.isoformat() if g.end_time else None,
            'status': g.status,
            'rolled_back': g.rolled_back,
            'rollback_reason': g.rollback_reason
        } for g in gray_records],
        'effect_records': [{
            'version': e.version,
            'metric_name': e.metric_name,
            'metric_value': e.metric_value,
            'baseline_value': e.baseline_value,
            'sample_size': e.sample_size,
            'recorded_at': e.recorded_at.isoformat(),
            'notes': e.notes
        } for e in effect_records],
        'timeline': timeline
    })


@app.route('/api/templates', methods=['POST'])
def create_template():
    data = request.json

    template_id = data.get('template_id')
    if not template_id:
        return jsonify({'error': 'template_id is required'}), 400

    existing = PromptTemplate.query.filter_by(template_id=template_id).first()
    if existing:
        return jsonify({'error': 'Template ID already exists'}), 400

    variables = data.get('variables', [])
    content = data.get('content', '')

    is_valid, _, errors, warnings = validate_variables(content, json.dumps(variables))
    if not is_valid:
        return jsonify({'error': '; '.join(errors)}), 400

    template = PromptTemplate(
        template_id=template_id,
        name=data.get('name', ''),
        description=data.get('description', ''),
        scenario=data.get('scenario', 'general'),
        status='draft',
        current_version=1,
        created_by=data.get('created_by', 'system')
    )

    version = TemplateVersion(
        template_id=template_id,
        version=1,
        content=content,
        variables=json.dumps(variables),
        created_by=data.get('created_by', 'system'),
        changelog=data.get('changelog', 'Initial version')
    )

    db.session.add(template)
    db.session.add(version)
    db.session.commit()

    return jsonify({'message': 'Template created successfully', 'template_id': template_id}), 201


@app.route('/api/templates/<template_id>/versions', methods=['POST'])
def create_version(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    data = request.json
    new_version = template.current_version + 1

    variables = data.get('variables', [])
    content = data.get('content', '')

    is_valid, _, errors, warnings = validate_variables(content, json.dumps(variables))
    if not is_valid:
        return jsonify({'error': '; '.join(errors)}), 400

    version = TemplateVersion(
        template_id=template_id,
        version=new_version,
        content=content,
        variables=json.dumps(variables),
        created_by=data.get('created_by', 'system'),
        changelog=data.get('changelog', '')
    )

    template.current_version = new_version
    template.updated_at = datetime.utcnow()

    db.session.add(version)
    db.session.commit()

    return jsonify({'message': 'Version created successfully', 'version': new_version})


@app.route('/api/templates/<template_id>/submit', methods=['POST'])
def submit_for_approval(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status not in ['draft', 'rejected']:
        return jsonify({'error': 'Only draft or rejected templates can be submitted'}), 400

    data = request.json

    approval = ApprovalRecord(
        template_id=template_id,
        version=template.current_version,
        approver=data.get('approver', ''),
        opinion='',
        status='pending'
    )

    template.status = 'pending_approval'
    template.updated_at = datetime.utcnow()

    db.session.add(approval)
    db.session.commit()

    return jsonify({'message': 'Submitted for approval successfully'})


@app.route('/api/templates/<template_id>/approve', methods=['POST'])
def approve_template(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status != 'pending_approval':
        return jsonify({'error': 'Only pending approval templates can be approved'}), 400

    data = request.json

    approval = ApprovalRecord.query.filter_by(
        template_id=template_id,
        version=template.current_version,
        status='pending'
    ).first()

    if approval:
        approval.status = 'approved'
        approval.opinion = data.get('opinion', '')
        approval.approved_at = datetime.utcnow()

    template.status = 'approved'
    template.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'message': 'Template approved successfully'})


@app.route('/api/templates/<template_id>/reject', methods=['POST'])
def reject_template(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status != 'pending_approval':
        return jsonify({'error': 'Only pending approval templates can be rejected'}), 400

    data = request.json

    approval = ApprovalRecord.query.filter_by(
        template_id=template_id,
        version=template.current_version,
        status='pending'
    ).first()

    if approval:
        approval.status = 'rejected'
        approval.opinion = data.get('opinion', '')

    template.status = 'rejected'
    template.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'message': 'Template rejected successfully'})


@app.route('/api/templates/<template_id>/gray', methods=['POST'])
def start_gray(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status not in ['approved', 'gray']:
        return jsonify({'error': 'Only approved templates can start gray'}), 400

    data = request.json
    traffic_percent = data.get('traffic_percent', 10)

    gray = GrayRecord(
        template_id=template_id,
        version=template.current_version,
        traffic_percent=traffic_percent,
        start_time=datetime.utcnow(),
        status='active',
        created_by=data.get('created_by', 'system')
    )

    template.status = 'gray'
    template.updated_at = datetime.utcnow()

    db.session.add(gray)
    db.session.commit()

    return jsonify({'message': 'Gray release started successfully'})


@app.route('/api/templates/<template_id>/rollback', methods=['POST'])
def rollback_gray(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status != 'gray':
        return jsonify({'error': 'Only gray templates can be rolled back'}), 400

    data = request.json

    gray = GrayRecord.query.filter_by(
        template_id=template_id,
        version=template.current_version,
        status='active'
    ).first()

    if gray:
        gray.status = 'rolled_back'
        gray.rolled_back = True
        gray.end_time = datetime.utcnow()
        gray.rollback_reason = data.get('reason', '')

    template.status = 'approved'
    template.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'message': 'Gray rolled back successfully'})


@app.route('/api/templates/<template_id>/publish', methods=['POST'])
def publish_template(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    if template.status not in ['approved', 'gray']:
        return jsonify({'error': 'Only approved or gray templates can be published'}), 400

    gray = GrayRecord.query.filter_by(
        template_id=template_id,
        version=template.current_version,
        status='active'
    ).first()

    if gray:
        gray.status = 'completed'
        gray.end_time = datetime.utcnow()

    template.status = 'published'
    template.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'message': 'Template published successfully'})


@app.route('/api/templates/<template_id>/effect', methods=['POST'])
def add_effect_record(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    data = request.json

    effect = EffectRecord(
        template_id=template_id,
        version=template.current_version,
        metric_name=data.get('metric_name', ''),
        metric_value=data.get('metric_value', 0),
        baseline_value=data.get('baseline_value'),
        sample_size=data.get('sample_size'),
        notes=data.get('notes', '')
    )

    db.session.add(effect)
    db.session.commit()

    return jsonify({'message': 'Effect record added successfully'})


@app.route('/api/templates/import', methods=['POST'])
def import_templates():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename.endswith('.xlsx'):
        df = pd.read_excel(file)
    elif file.filename.endswith('.csv'):
        df = pd.read_csv(file)
    else:
        return jsonify({'error': 'Unsupported file format'}), 400

    imported = 0
    errors = []

    for _, row in df.iterrows():
        try:
            template_id = str(row.get('template_id', '')).strip()
            if not template_id:
                continue

            existing = PromptTemplate.query.filter_by(template_id=template_id).first()
            if existing:
                errors.append(f'Template {template_id} already exists')
                continue

            variables_str = str(row.get('variables', '[]'))
            content = str(row.get('content', ''))
            
            try:
                variables = json.loads(variables_str)
            except:
                variables = extract_variables_from_content(content)
                variables = [{'name': v, 'type': 'string', 'required': True} for v in variables]

            is_valid, _, var_errors, _ = validate_variables(content, json.dumps(variables))
            if not is_valid:
                errors.append(f'Template {template_id}: {"; ".join(var_errors)}')
                continue

            template = PromptTemplate(
                template_id=template_id,
                name=str(row.get('name', template_id)),
                description=str(row.get('description', '')),
                scenario=str(row.get('scenario', 'general')),
                status='draft',
                current_version=1,
                created_by=str(row.get('created_by', 'import'))
            )

            version = TemplateVersion(
                template_id=template_id,
                version=1,
                content=str(row.get('content', '')),
                variables=json.dumps(variables),
                created_by=str(row.get('created_by', 'import')),
                changelog='Imported'
            )

            db.session.add(template)
            db.session.add(version)
            imported += 1
        except Exception as e:
            errors.append(f'Row {_}: {str(e)}')

    db.session.commit()

    return jsonify({'message': f'Imported {imported} templates', 'imported': imported, 'errors': errors})


@app.route('/api/templates/export', methods=['GET'])
def export_templates():
    templates = PromptTemplate.query.all()

    data = []
    for t in templates:
        version = TemplateVersion.query.filter_by(
            template_id=t.template_id,
            version=t.current_version
        ).first()

        data.append({
            'template_id': t.template_id,
            'name': t.name,
            'description': t.description,
            'scenario': t.scenario,
            'status': t.status,
            'current_version': t.current_version,
            'content': version.content if version else '',
            'variables': version.variables if version else '[]',
            'created_at': t.created_at.isoformat(),
            'created_by': t.created_by
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Templates')

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'prompt_templates_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )


@app.route('/api/templates/<template_id>/export', methods=['GET'])
def export_single_template(template_id):
    template = PromptTemplate.query.filter_by(template_id=template_id).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    versions = TemplateVersion.query.filter_by(template_id=template_id).order_by(TemplateVersion.version).all()

    data = []
    for v in versions:
        data.append({
            'template_id': template.template_id,
            'name': template.name,
            'version': v.version,
            'content': v.content,
            'variables': v.variables,
            'created_at': v.created_at.isoformat(),
            'created_by': v.created_by,
            'changelog': v.changelog
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Versions')

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'{template_id}_versions_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )


@app.route('/api/scenarios', methods=['GET'])
def get_scenarios():
    scenarios = db.session.query(PromptTemplate.scenario).distinct().all()
    return jsonify({'scenarios': [s[0] for s in scenarios if s[0]]})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    total = PromptTemplate.query.count()
    by_status = db.session.query(
        PromptTemplate.status,
        db.func.count(PromptTemplate.id)
    ).group_by(PromptTemplate.status).all()

    by_scenario = db.session.query(
        PromptTemplate.scenario,
        db.func.count(PromptTemplate.id)
    ).group_by(PromptTemplate.scenario).all()

    return jsonify({
        'total': total,
        'by_status': dict(by_status),
        'by_scenario': dict(by_scenario)
    })


@app.route('/api/validate-variables', methods=['POST'])
def validate_variables_api():
    data = request.json
    content = data.get('content', '')
    variables = data.get('variables', [])
    
    is_valid, _, errors, warnings = validate_variables(content, json.dumps(variables))
    detected_variables = extract_variables_from_content(content)
    
    return jsonify({
        'valid': is_valid,
        'errors': errors,
        'warnings': warnings,
        'detected_variables': detected_variables
    })


def init_demo_data():
    if PromptTemplate.query.count() > 0:
        return

    templates = [
        {
            'template_id': 'customer_service_001',
            'name': '客服智能回复模板',
            'description': '用于处理客户常见问题的智能回复模板',
            'scenario': 'customer_service',
            'status': 'published',
            'content': '''你是一个专业的客服代表。请根据客户问题提供友好、准确的回答。

客户问题：{customer_question}
订单信息：{order_info}

请按照以下格式回答：
1. 问候客户
2. 直接回答问题
3. 提供进一步帮助''',
            'variables': [
                {'name': 'customer_question', 'type': 'string', 'required': True},
                {'name': 'order_info', 'type': 'string', 'required': False}
            ],
            'created_by': '张三',
            'changelog': '初始版本'
        },
        {
            'template_id': 'code_review_001',
            'name': '代码审查助手',
            'description': '自动化代码审查提示词模板',
            'scenario': 'code_review',
            'status': 'gray',
            'content': '''请审查以下代码，关注以下方面：
1. 代码质量和可读性
2. 潜在bug和安全问题
3. 性能优化建议
4. 最佳实践遵循情况

代码：
{code_snippet}

编程语言：{language}
审查重点：{focus_areas}

请提供结构化的审查报告。''',
            'variables': [
                {'name': 'code_snippet', 'type': 'string', 'required': True},
                {'name': 'language', 'type': 'string', 'required': True},
                {'name': 'focus_areas', 'type': 'string', 'required': False}
            ],
            'created_by': '李四',
            'changelog': '增加性能检查项'
        },
        {
            'template_id': 'summary_001',
            'name': '文档摘要生成器',
            'description': '生成文档摘要的提示词模板',
            'scenario': 'content_generation',
            'status': 'pending_approval',
            'content': '''请为以下文档生成摘要：

文档内容：
{document_content}

要求：
- 摘要长度：{length}字
- 重点突出：{emphasis}
- 目标读者：{target_audience}

请提供清晰、准确的摘要。''',
            'variables': [
                {'name': 'document_content', 'type': 'string', 'required': True},
                {'name': 'length', 'type': 'number', 'required': True},
                {'name': 'emphasis', 'type': 'string', 'required': False},
                {'name': 'target_audience', 'type': 'string', 'required': False}
            ],
            'created_by': '王五',
            'changelog': '新增目标读者参数'
        },
        {
            'template_id': 'translation_001',
            'name': '专业翻译模板',
            'description': '专业领域翻译的提示词模板',
            'scenario': 'translation',
            'status': 'approved',
            'content': '''请将以下文本从{source_lang}翻译成{target_lang}。

领域：{domain}
原文：
{source_text}

要求：
- 保持专业术语准确
- 保持原文语气
- 保留格式

翻译结果：''',
            'variables': [
                {'name': 'source_lang', 'type': 'string', 'required': True},
                {'name': 'target_lang', 'type': 'string', 'required': True},
                {'name': 'domain', 'type': 'string', 'required': True},
                {'name': 'source_text', 'type': 'string', 'required': True}
            ],
            'created_by': '赵六',
            'changelog': '新增领域参数'
        },
        {
            'template_id': 'analysis_001',
            'name': '数据分析报告',
            'description': '生成数据分析报告的提示词模板',
            'scenario': 'data_analysis',
            'status': 'draft',
            'content': '''请分析以下数据并生成报告：

数据：
{dataset}

分析维度：{dimensions}
业务目标：{business_goal}

请提供：
1. 数据概览
2. 关键发现
3. 趋势分析
4. 建议措施''',
            'variables': [
                {'name': 'dataset', 'type': 'string', 'required': True},
                {'name': 'dimensions', 'type': 'string', 'required': True},
                {'name': 'business_goal', 'type': 'string', 'required': False}
            ],
            'created_by': '钱七',
            'changelog': '初始版本'
        }
    ]

    for t in templates:
        template = PromptTemplate(
            template_id=t['template_id'],
            name=t['name'],
            description=t['description'],
            scenario=t['scenario'],
            status=t['status'],
            current_version=1,
            created_by=t['created_by']
        )

        version = TemplateVersion(
            template_id=t['template_id'],
            version=1,
            content=t['content'],
            variables=json.dumps(t['variables']),
            created_by=t['created_by'],
            changelog=t['changelog']
        )

        db.session.add(template)
        db.session.add(version)

        if t['status'] in ['pending_approval', 'approved', 'published', 'gray']:
            approval = ApprovalRecord(
                template_id=t['template_id'],
                version=1,
                approver='审批人A',
                opinion='符合要求，通过审批。' if t['status'] != 'rejected' else '需要修改。',
                status='approved' if t['status'] in ['approved', 'published', 'gray'] else 'pending',
                approved_at=datetime.utcnow() if t['status'] in ['approved', 'published', 'gray'] else None
            )
            db.session.add(approval)

        if t['status'] == 'gray':
            gray = GrayRecord(
                template_id=t['template_id'],
                version=1,
                traffic_percent=30,
                start_time=datetime.utcnow(),
                status='active',
                created_by='运营'
            )
            db.session.add(gray)

        if t['status'] == 'published':
            effect = EffectRecord(
                template_id=t['template_id'],
                version=1,
                metric_name='准确率',
                metric_value=92.5,
                baseline_value=85.0,
                sample_size=1000,
                notes='生产环境效果良好'
            )
            db.session.add(effect)

    db.session.commit()


with app.app_context():
    db.create_all()
    init_demo_data()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
