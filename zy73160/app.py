import os
import json
import uuid
import traceback
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
import numpy as np

from config import Config
from models import db, Problem, ProblemVersion, Answer, ProblemAnswer, CheckTask, CheckResult, AnomalyRecord, CheckState

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['REPORT_FOLDER'], exist_ok=True)

PARAMS_VERSION = "v2.1.0"


def to_dict(model, exclude=None):
    exclude = exclude or []
    data = {}
    for c in model.__table__.columns:
        if c.name not in exclude:
            val = getattr(model, c.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            data[c.name] = val
    return data


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/handover')
def handover():
    return render_template('handover.html')


@app.route('/review/<int:task_id>')
def review(task_id):
    return render_template('review.html', task_id=task_id)


@app.route('/api/problems', methods=['GET'])
def get_problems():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    keyword = request.args.get('keyword')

    query = Problem.query
    if status:
        query = query.filter(Problem.current_status == status)
    if keyword:
        query = query.filter(
            (Problem.title.contains(keyword)) |
            (Problem.problem_id.contains(keyword))
        )

    pagination = query.order_by(Problem.updated_at.desc()).paginate(page=page, per_page=per_page)
    problems = []
    for p in pagination.items:
        pd = to_dict(p)
        pd['version_count'] = len(p.versions)
        pd['answer_count'] = len(p.answers)
        pd['anomaly_count'] = len([a for a in p.anomalies if not a.is_resolved])
        problems.append(pd)

    return jsonify({
        'problems': problems,
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })


@app.route('/api/problems/<int:problem_id>', methods=['GET'])
def get_problem(problem_id):
    problem = Problem.query.get_or_404(problem_id)
    data = to_dict(problem)
    data['versions'] = [to_dict(v) for v in sorted(problem.versions, key=lambda x: x.version, reverse=True)]
    data['answers'] = []
    for pa in problem.answers:
        answer_data = to_dict(pa.answer)
        answer_data['problem_answer'] = to_dict(pa)
        data['answers'].append(answer_data)
    data['anomalies'] = [to_dict(a) for a in problem.anomalies]
    return jsonify(data)


@app.route('/api/problems', methods=['POST'])
def create_problem():
    data = request.json
    problem = Problem(
        problem_id=data.get('problem_id', f"P{uuid.uuid4().hex[:8]}"),
        title=data['title'],
        description=data.get('description'),
        matrix_data=json.dumps(data.get('matrix_data', [])) if isinstance(data.get('matrix_data'), list) else data.get('matrix_data'),
        current_status='pending'
    )
    db.session.add(problem)
    db.session.flush()

    version = ProblemVersion(
        problem_id=problem.id,
        version=1,
        remark=data.get('remark', '初始创建'),
        modified_by=data.get('modified_by', 'system'),
        change_log='创建题目'
    )
    db.session.add(version)
    db.session.commit()

    return jsonify({'id': problem.id, 'problem_id': problem.problem_id}), 201


@app.route('/api/problems/<int:problem_id>', methods=['PUT'])
def update_problem(problem_id):
    problem = Problem.query.get_or_404(problem_id)
    data = request.json

    change_logs = []
    if data.get('title') and data['title'] != problem.title:
        problem.title = data['title']
        change_logs.append(f"标题: {problem.title} -> {data['title']}")
    if 'description' in data and data['description'] != problem.description:
        problem.description = data['description']
        change_logs.append('描述已更新')
    if 'matrix_data' in data:
        new_matrix = json.dumps(data['matrix_data']) if isinstance(data['matrix_data'], list) else data['matrix_data']
        if new_matrix != problem.matrix_data:
            problem.matrix_data = new_matrix
            change_logs.append('矩阵数据已更新')
    if data.get('current_status'):
        problem.current_status = data['current_status']
        change_logs.append(f"状态: {problem.current_status} -> {data['current_status']}")

    if data.get('remark') or change_logs:
        max_version = max((v.version for v in problem.versions), default=0)
        screenshot_path = None
        if data.get('screenshot'):
            screenshot_path = save_screenshot(data['screenshot'], problem.problem_id, max_version + 1)

        version = ProblemVersion(
            problem_id=problem.id,
            version=max_version + 1,
            remark=data.get('remark', ''),
            screenshot_path=screenshot_path,
            modified_by=data.get('modified_by', 'system'),
            change_log='; '.join(change_logs) if change_logs else '添加备注'
        )
        db.session.add(version)

    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/problems/<int:problem_id>/versions', methods=['GET'])
def get_problem_versions(problem_id):
    problem = Problem.query.get_or_404(problem_id)
    versions = sorted(problem.versions, key=lambda x: x.version, reverse=True)
    return jsonify([to_dict(v) for v in versions])


@app.route('/api/answers', methods=['POST'])
def create_answer():
    data = request.json
    answer = Answer(
        answer_id=data.get('answer_id', f"A{uuid.uuid4().hex[:8]}"),
        version=data['version'],
        content=json.dumps(data['content']) if isinstance(data.get('content'), (dict, list)) else data['content'],
        source=data.get('source', 'manual')
    )
    db.session.add(answer)
    db.session.commit()
    return jsonify({'id': answer.id, 'answer_id': answer.answer_id}), 201


@app.route('/api/problems/<int:problem_id>/answers', methods=['POST'])
def link_problem_answer(problem_id):
    data = request.json
    answer_id = data['answer_id']
    answer = Answer.query.get_or_404(answer_id)

    existing = ProblemAnswer.query.filter_by(problem_id=problem_id, answer_id=answer_id).first()
    if existing:
        return jsonify({'error': '关联已存在'}), 400

    pa = ProblemAnswer(
        problem_id=problem_id,
        answer_id=answer_id,
        coverage_status=data.get('coverage_status', 'pending'),
        match_score=data.get('match_score')
    )
    db.session.add(pa)
    db.session.commit()

    check_answer_coverage(problem_id)
    return jsonify({'success': True, 'id': pa.id}), 201


@app.route('/api/problem-answers/<int:pa_id>/override', methods=['POST'])
def override_problem_answer(pa_id):
    pa = ProblemAnswer.query.get_or_404(pa_id)
    data = request.json
    pa.is_manual_override = True
    pa.override_reason = data.get('reason')
    pa.override_by = data.get('by', 'manual')
    pa.override_at = datetime.utcnow()
    pa.coverage_status = data.get('status', pa.coverage_status)
    db.session.commit()
    check_answer_coverage(pa.problem_id)
    return jsonify({'success': True})


def check_answer_coverage(problem_id):
    problem = Problem.query.get(problem_id)
    pas = problem.answers
    covered = [pa for pa in pas if pa.coverage_status == 'covered']
    if len(covered) >= 2:
        problem.current_status = 'double_covered'
    elif len(covered) == 1:
        problem.current_status = 'single_covered'
    else:
        problem.current_status = 'pending'
    db.session.commit()


@app.route('/api/check/tasks', methods=['GET'])
def get_check_tasks():
    tasks = CheckTask.query.order_by(CheckTask.started_at.desc()).all()
    results = []
    for t in tasks:
        td = to_dict(t)
        td['result_count'] = len(t.results)
        td['anomaly_count'] = len([r for r in t.results if r.is_anomaly])
        td['pending_count'] = len([r for r in t.results if r.processing_status == 'pending'])
        td['manual_count'] = len([r for r in t.results if r.is_manual_judgment])
        results.append(td)
    return jsonify(results)


@app.route('/api/check/tasks', methods=['POST'])
def create_check_task():
    data = request.json
    problem_ids = data.get('problem_ids', [])

    if not problem_ids:
        problems = Problem.query.all()
        problem_ids = [p.id for p in problems]

    task = CheckTask(
        task_id=f"TASK{uuid.uuid4().hex[:8]}",
        name=data.get('name', f"批量验算_{datetime.now().strftime('%Y%m%d_%H%M')}"),
        params_version=PARAMS_VERSION,
        parameters=json.dumps(data.get('parameters', {})),
        created_by=data.get('created_by', 'system'),
        status='running'
    )
    db.session.add(task)
    db.session.flush()

    for pid in problem_ids:
        result = CheckResult(
            task_id=task.id,
            problem_id=pid,
            processing_status='pending'
        )
        db.session.add(result)

    db.session.commit()
    save_check_state('last_task_id', str(task.id))
    return jsonify({'task_id': task.task_id, 'id': task.id}), 201


@app.route('/api/check/tasks/<int:task_id>/run', methods=['POST'])
def run_check_task(task_id):
    task = CheckTask.query.get_or_404(task_id)
    task.status = 'running'
    db.session.commit()

    try:
        for result in task.results:
            process_check_result(result)
        task.status = 'completed'
        task.completed_at = datetime.utcnow()
        db.session.commit()

        report_path = generate_markdown_report(task)
        task.report_path = report_path
        db.session.commit()

        save_check_state('last_completed_task_id', str(task.id))
        return jsonify({'success': True, 'report_path': report_path})
    except Exception as e:
        task.status = 'failed'
        db.session.commit()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def process_check_result(result):
    problem = result.problem
    result.processing_status = 'processing'
    db.session.commit()

    try:
        matrix_data = json.loads(problem.matrix_data) if problem.matrix_data else []
        if not matrix_data:
            result.processing_status = 'error'
            result.is_anomaly = True
            result.anomaly_type = 'no_data'
            result.anomaly_explanation = '题目缺少矩阵数据'
            db.session.commit()
            return

        is_duplicate = check_duplicate_sample(problem.problem_id, matrix_data)
        if is_duplicate:
            result.is_anomaly = True
            result.anomaly_type = 'duplicate_sample'
            result.anomaly_explanation = f"检测到重复样本：{is_duplicate}"
            record_anomaly(problem.id, 'duplicate_sample', result.anomaly_explanation)

        calc_result = matrix_decomposition(matrix_data)
        expected_result = extract_expected_result(problem)

        result.calc_result = json.dumps(calc_result)
        result.expected_result = json.dumps(expected_result) if expected_result else None

        is_match = compare_results(calc_result, expected_result)

        if is_duplicate:
            result.processing_status = 'skipped'
        elif is_match:
            result.processing_status = 'passed'
        else:
            result.processing_status = 'failed'
            result.diff_detail = generate_diff_detail(calc_result, expected_result)

        db.session.commit()
    except Exception as e:
        result.processing_status = 'error'
        result.is_anomaly = True
        result.anomaly_type = 'calculation_error'
        result.anomaly_explanation = str(e)
        db.session.commit()


def matrix_decomposition(matrix_data):
    try:
        A = np.array(matrix_data, dtype=float)
        if A.shape[0] != A.shape[1]:
            return {
                'error': '非方阵',
                'shape': A.shape,
                'method': 'svd'
            }

        eigenvalues, eigenvectors = np.linalg.eig(A)
        U, S, Vt = np.linalg.svd(A)

        return {
            'eigenvalues': eigenvalues.tolist(),
            'eigenvectors': eigenvectors.tolist(),
            'svd_U': U.tolist(),
            'svd_S': S.tolist(),
            'svd_Vt': Vt.tolist(),
            'determinant': float(np.linalg.det(A)),
            'rank': int(np.linalg.matrix_rank(A)),
            'params_version': PARAMS_VERSION
        }
    except Exception as e:
        return {'error': str(e)}


def check_duplicate_sample(current_problem_id, matrix_data):
    matrix_str = json.dumps(matrix_data, sort_keys=True)
    existing = Problem.query.filter(
        Problem.problem_id != current_problem_id,
        Problem.matrix_data == json.dumps(matrix_data)
    ).first()
    if existing:
        return f"与题目 {existing.problem_id} ({existing.title}) 矩阵数据完全相同"
    return None


def extract_expected_result(problem):
    covered_answers = [pa for pa in problem.answers if pa.coverage_status == 'covered']
    if not covered_answers:
        return None
    pa = covered_answers[0]
    try:
        return json.loads(pa.answer.content)
    except:
        return {'raw': pa.answer.content}


def compare_results(calc, expected):
    if not expected or 'error' in calc:
        return False
    if 'eigenvalues' in expected and 'eigenvalues' in calc:
        calc_ev = sorted([abs(x) for x in calc['eigenvalues']])
        exp_ev = sorted([abs(x) for x in expected['eigenvalues']])
        if len(calc_ev) != len(exp_ev):
            return False
        return all(abs(c - e) < 1e-6 for c, e in zip(calc_ev, exp_ev))
    return str(calc) == str(expected)


def generate_diff_detail(calc, expected):
    diffs = []
    if not expected:
        return "无预期结果"
    if 'eigenvalues' in calc and 'eigenvalues' in expected:
        calc_ev = sorted(calc['eigenvalues'], key=abs)
        exp_ev = sorted(expected['eigenvalues'], key=abs)
        for i, (c, e) in enumerate(zip(calc_ev, exp_ev)):
            if abs(c - e) > 1e-6:
                diffs.append(f"特征值[{i}]: 计算={c:.6f}, 预期={e:.6f}, 差值={abs(c-e):.6e}")
    return '\n'.join(diffs) if diffs else "差异在容差范围内"


def record_anomaly(problem_id, anomaly_type, description):
    existing = AnomalyRecord.query.filter_by(
        problem_id=problem_id,
        anomaly_type=anomaly_type,
        is_resolved=False
    ).first()
    if not existing:
        anomaly = AnomalyRecord(
            problem_id=problem_id,
            anomaly_type=anomaly_type,
            description=description
        )
        db.session.add(anomaly)
        db.session.commit()


@app.route('/api/check/tasks/<int:task_id>/results', methods=['GET'])
def get_task_results(task_id):
    task = CheckTask.query.get_or_404(task_id)
    results = []
    for r in task.results:
        rd = to_dict(r)
        rd['problem'] = {
            'id': r.problem.id,
            'problem_id': r.problem.problem_id,
            'title': r.problem.title
        }
        try:
            if r.calc_result:
                rd['calc_result'] = json.loads(r.calc_result)
            if r.expected_result:
                rd['expected_result'] = json.loads(r.expected_result)
        except:
            pass
        results.append(rd)

    summary = {
        'total': len(task.results),
        'passed': len([r for r in task.results if r.processing_status == 'passed']),
        'failed': len([r for r in task.results if r.processing_status == 'failed']),
        'skipped': len([r for r in task.results if r.processing_status == 'skipped']),
        'error': len([r for r in task.results if r.processing_status == 'error']),
        'pending': len([r for r in task.results if r.processing_status == 'pending']),
        'anomalies': len([r for r in task.results if r.is_anomaly]),
        'manual_judgments': len([r for r in task.results if r.is_manual_judgment])
    }

    return jsonify({
        'task': to_dict(task),
        'results': results,
        'summary': summary,
        'params_version': PARAMS_VERSION
    })


@app.route('/api/check/results/<int:result_id>/judgment', methods=['POST'])
def manual_judgment(result_id):
    result = CheckResult.query.get_or_404(result_id)
    data = request.json
    result.is_manual_judgment = True
    result.judgment_result = data['result']
    result.judgment_reason = data.get('reason', '')
    result.judgment_by = data.get('by', 'manual')
    result.judgment_at = datetime.utcnow()
    db.session.commit()

    task = CheckTask.query.get(result.task_id)
    report_path = None
    if task and task.status == 'completed':
        report_path = generate_markdown_report(task)
        task.report_path = report_path
        db.session.commit()

    return jsonify({'success': True, 'report_updated': report_path is not None, 'report_path': report_path})


@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    unresolved = request.args.get('unresolved', 'true').lower() == 'true'
    query = AnomalyRecord.query
    if unresolved:
        query = query.filter_by(is_resolved=False)
    anomalies = query.order_by(AnomalyRecord.detected_at.desc()).all()
    results = []
    for a in anomalies:
        ad = to_dict(a)
        ad['problem'] = {
            'id': a.problem.id,
            'problem_id': a.problem.problem_id,
            'title': a.problem.title
        }
        results.append(ad)
    return jsonify(results)


@app.route('/api/anomalies/<int:anomaly_id>/resolve', methods=['POST'])
def resolve_anomaly(anomaly_id):
    anomaly = AnomalyRecord.query.get_or_404(anomaly_id)
    data = request.json
    anomaly.is_resolved = True
    anomaly.resolution = data.get('resolution', '')
    anomaly.resolved_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/states', methods=['GET'])
def get_states():
    states = CheckState.query.all()
    return jsonify({s.key: s.value for s in states})


@app.route('/api/states/<key>', methods=['GET'])
def get_state(key):
    state = CheckState.query.filter_by(key=key).first()
    return jsonify({'key': key, 'value': state.value if state else None})


def save_check_state(key, value, updated_by='system'):
    state = CheckState.query.filter_by(key=key).first()
    if state:
        state.value = value
        state.updated_by = updated_by
    else:
        state = CheckState(key=key, value=value, updated_by=updated_by)
        db.session.add(state)
    db.session.commit()


@app.route('/api/reports/<int:task_id>/markdown', methods=['GET'])
def get_report_markdown(task_id):
    task = CheckTask.query.get_or_404(task_id)
    force_refresh = request.args.get('force', '0') == '1'

    if not force_refresh and task.report_path and os.path.exists(task.report_path):
        with open(task.report_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({
            'content': content,
            'path': task.report_path,
            'regenerated': False,
            'generated_at': datetime.fromtimestamp(os.path.getmtime(task.report_path)).isoformat()
        })

    report_path = generate_markdown_report(task)
    task.report_path = report_path
    db.session.commit()

    with open(report_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return jsonify({
        'content': content,
        'path': report_path,
        'regenerated': True,
        'generated_at': datetime.fromtimestamp(os.path.getmtime(report_path)).isoformat()
    })


def generate_markdown_report(task):
    results = task.results
    total = len(results)
    passed_auto = [r for r in results if r.processing_status == 'passed']
    failed_auto = [r for r in results if r.processing_status == 'failed']
    skipped_auto = [r for r in results if r.processing_status == 'skipped']
    error_auto = [r for r in results if r.processing_status == 'error']
    anomalies = [r for r in results if r.is_anomaly]
    manual = [r for r in results if r.is_manual_judgment]

    def final_status(r):
        if r.is_manual_judgment:
            return r.judgment_result
        return r.processing_status

    final_passed = len([r for r in results if final_status(r) == 'passed'])
    final_failed = len([r for r in results if final_status(r) == 'failed'])
    final_skipped = len([r for r in results if final_status(r) == 'skipped'])
    final_error = len([r for r in results if final_status(r) == 'error'])

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    lines = []
    lines.append(f"# 矩阵分解批量验算报告")
    lines.append("")
    lines.append("> **说明**: 本报告基于数据库最新结果自动生成，数据与复核页保持同步，每次人工改判后自动刷新。")
    lines.append("")
    lines.append(f"**任务ID**: `{task.task_id}`")
    lines.append(f"**任务名称**: {task.name}")
    lines.append(f"**核心参数版本**: `{task.params_version}`")
    lines.append(f"**报告生成时间**: {now_str}")
    lines.append(f"**验算开始时间**: {task.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**验算完成时间**: {task.completed_at.strftime('%Y-%m-%d %H:%M:%S') if task.completed_at else '未完成'}")
    lines.append(f"**任务状态**: {task.status}")
    lines.append(f"**改判刷新次数**: {len(manual)} 次人工改判（报告已同步）")
    lines.append("")

    lines.append("---")
    lines.append("")

    lines.append("## 一、自动判定汇总（按算法输出）")
    lines.append("")
    lines.append("| 状态 | 数量 | 占比 |")
    lines.append("|------|------|------|")
    lines.append(f"| 通过 | {len(passed_auto)} | {len(passed_auto)/total*100:.1f}% |" if total else "| 通过 | 0 | 0% |")
    lines.append(f"| 失败 | {len(failed_auto)} | {len(failed_auto)/total*100:.1f}% |" if total else "| 失败 | 0 | 0% |")
    lines.append(f"| 跳过 | {len(skipped_auto)} | {len(skipped_auto)/total*100:.1f}% |" if total else "| 跳过 | 0 | 0% |")
    lines.append(f"| 错误 | {len(error_auto)} | {len(error_auto)/total*100:.1f}% |" if total else "| 错误 | 0 | 0% |")
    lines.append(f"| **总计** | **{total}** | **100%** |")
    lines.append("")

    lines.append("## 二、最终处理状态汇总（含人工改判）")
    lines.append("")
    lines.append("| 最终状态 | 数量 | 占比 | 说明 |")
    lines.append("|----------|------|------|------|")
    lines.append(f"| 通过 | {final_passed} | {final_passed/total*100:.1f}% | 算法通过 + 人工改判为通过 |" if total else "| 通过 | 0 | 0% | |")
    lines.append(f"| 失败 | {final_failed} | {final_failed/total*100:.1f}% | 算法失败 + 人工改判为失败 |" if total else "| 失败 | 0 | 0% | |")
    lines.append(f"| 跳过 | {final_skipped} | {final_skipped/total*100:.1f}% | 重复样本等原因跳过 |" if total else "| 跳过 | 0 | 0% | |")
    lines.append(f"| 错误 | {final_error} | {final_error/total*100:.1f}% | 计算错误 |" if total else "| 错误 | 0 | 0% | |")
    lines.append(f"| **合计** | **{total}** | **100%** | |")
    lines.append("")
    lines.append(f"- 人工改判数量: {len(manual)} 道题")
    lines.append(f"- 异常样本数量: {len(anomalies)} 道题")
    lines.append("")

    lines.append("---")
    lines.append("")

    if anomalies:
        lines.append("## 三、异常与说明（保留原始原因）")
        lines.append("")
        lines.append("| 题目ID | 标题 | 异常类型 | 异常解释 | 参数版本 | 人工处理状态 |")
        lines.append("|--------|------|----------|----------|----------|--------------|")
        for r in anomalies:
            p = r.problem
            human = f"已改判为 **{r.judgment_result}**" if r.is_manual_judgment else "待处理"
            explanation = (r.anomaly_explanation or '').replace('\n', ' ').replace('|', '/')
            lines.append(f"| {p.problem_id} | {p.title} | `{r.anomaly_type}` | {explanation} | `{task.params_version}` | {human} |")
        lines.append("")

    if manual:
        lines.append("## 四、人工改判明细")
        lines.append("")
        for idx, r in enumerate(manual, 1):
            p = r.problem
            lines.append(f"### 4.{idx} {p.problem_id} - {p.title}")
            lines.append("")
            lines.append(f"- **自动判定状态**: `{r.processing_status}`")
            lines.append(f"- **人工改判结果**: `{r.judgment_result}`")
            no_desc = "(无说明)"
            reason_text = r.judgment_reason if r.judgment_reason else no_desc
            lines.append(f"- **改判说明**: {reason_text}")
            lines.append(f"- **改判人**: {r.judgment_by or '未知'}")
            lines.append(f"- **改判时间**: {r.judgment_at.strftime('%Y-%m-%d %H:%M') if r.judgment_at else '未知'}")
            if r.anomaly_explanation:
                lines.append(f"- **关联异常**: {r.anomaly_type} - {r.anomaly_explanation}")
            lines.append(f"- **参数版本**: `{task.params_version}`")
            lines.append("")

    lines.append("## 五、逐题详细结果（自动判定 + 人工改判）")
    lines.append("")
    lines.append("| 题目ID | 标题 | 自动判定 | 最终状态 | 是否异常 | 异常类型 | 人工改判 | 改判说明 | 参数版本 | 备注 |")
    lines.append("|--------|------|----------|----------|----------|----------|----------|----------|----------|------|")
    for r in results:
        p = r.problem
        auto = r.processing_status
        final = final_status(r)
        is_anomaly = '是' if r.is_anomaly else '否'
        anomaly_t = r.anomaly_type or '-'
        is_manual = r.judgment_result if r.is_manual_judgment else '否'
        manual_reason = (r.judgment_reason or '').replace('\n', ' ').replace('|', '/') if r.is_manual_judgment else '-'
        remarks = []
        if r.diff_detail and r.processing_status == 'failed' and not r.is_manual_judgment:
            remarks.append(f"差异: {r.diff_detail[:50]}")
        if r.anomaly_explanation:
            remarks.append(f"原因: {r.anomaly_explanation[:30]}")
        remark_str = '; '.join(remarks) if remarks else '-'
        lines.append(f"| {p.problem_id} | {p.title} | {auto} | **{final}** | {is_anomaly} | {anomaly_t} | {is_manual} | {manual_reason} | `{task.params_version}` | {remark_str} |")
    lines.append("")

    lines.append("---")
    lines.append("")

    lines.append("## 六、每道题完整记录")
    lines.append("")
    for idx, r in enumerate(results, 1):
        p = r.problem
        lines.append(f"### 6.{idx} {p.problem_id} - {p.title}")
        lines.append("")
        lines.append(f"- **题目ID**: `{p.problem_id}`")
        desc_text = p.description if p.description else "(无)"
        lines.append(f"- **题目描述**: {desc_text}")
        lines.append(f"- **核心参数版本**: `{task.params_version}`")
        lines.append(f"- **自动判定处理状态**: `{r.processing_status}`")
        lines.append(f"- **最终处理状态**: `{final_status(r)}` {'(人工改判)' if r.is_manual_judgment else '(算法判定)'}")
        lines.append(f"- **是否异常**: {'是' if r.is_anomaly else '否'}")
        if r.is_anomaly:
            lines.append(f"  - **异常类型**: `{r.anomaly_type}`")
            lines.append(f"  - **异常解释**: {r.anomaly_explanation or '无'}")
        if r.is_manual_judgment:
            no_desc2 = "(无说明)"
            reason_text2 = r.judgment_reason if r.judgment_reason else no_desc2
            lines.append(f"- **人工改判**:")
            lines.append(f"  - **改判结果**: `{r.judgment_result}`")
            lines.append(f"  - **改判说明**: {reason_text2}")
            lines.append(f"  - **改判人**: {r.judgment_by or '未知'}")
            lines.append(f"  - **改判时间**: {r.judgment_at.strftime('%Y-%m-%d %H:%M:%S') if r.judgment_at else '未知'}")
        if r.diff_detail:
            lines.append(f"- **差异详情**:")
            lines.append("")
            lines.append("```")
            lines.append(r.diff_detail)
            lines.append("```")
            lines.append("")
        lines.append("")

    lines.append("---")
    lines.append("")

    lines.append("## 七、题目历史材料（备注、截图、版本记录 - 保留不丢失）")
    lines.append("")
    has_history = False
    for r in results:
        p = r.problem
        versions = sorted(p.versions, key=lambda v: v.version, reverse=True)
        problem_anomalies = p.anomalies
        if versions or problem_anomalies:
            has_history = True
            lines.append(f"### {p.problem_id} - {p.title}")
            lines.append("")

            if versions:
                lines.append("**版本历史**:")
                lines.append("")
                lines.append("| 版本 | 备注 | 修改人 | 修改时间 | 变更记录 | 截图 |")
                lines.append("|------|------|--------|----------|----------|------|")
                for v in versions:
                    screenshot_link = f"[查看截图]({v.screenshot_path})" if v.screenshot_path else '-'
                    remark = (v.remark or '').replace('\n', ' ').replace('|', '/')
                    change_log = (v.change_log or '').replace('\n', ' ').replace('|', '/')
                    lines.append(f"| v{v.version} | {remark} | {v.modified_by or '-'} | {v.created_at.strftime('%Y-%m-%d %H:%M') if v.created_at else '-'} | {change_log} | {screenshot_link} |")
                lines.append("")

            if problem_anomalies:
                lines.append("**异常历史**:")
                lines.append("")
                for a in problem_anomalies:
                    status_str = f"✅ 已解决 - {a.resolution}" if a.is_resolved else "⚠️ 未解决"
                    lines.append(f"- [{a.anomaly_type}：{a.description}（检测于{a.detected_at.strftime('%Y-%m-%d')}） - {status_str}")
                lines.append("")

    if not has_history:
        lines.append("（无历史材料）")
        lines.append("")

    lines.append("---")
    lines.append("")

    lines.append("## 八、验算参数")
    lines.append("")
    lines.append(f"**参数版本号**: `{task.params_version}`")
    lines.append("")
    try:
        params = json.loads(task.parameters) if task.parameters else {}
        if params:
            for k, v in params.items():
                lines.append(f"- **{k}**: {v}")
        else:
            lines.append("- 无额外自定义参数")
    except:
        lines.append(f"- 原始参数: {task.parameters}")
    lines.append("")
    lines.append(f"- 矩阵分解算法: numpy.linalg.eig（特征值分解 + numpy.linalg.svd（奇异值分解）")
    lines.append(f"- 特征值容差: 1e-6")
    lines.append("")
    lines.append("---")
    lines.append(f"*报告生成时间: {now_str}，基于数据库最新记录生成*")

    content = '\n'.join(lines)

    report_path = os.path.join(app.config['REPORT_FOLDER'], f"report_{task.task_id}.md")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return report_path


@app.route('/api/export/<int:task_id>', methods=['GET'])
def export_results(task_id):
    task = CheckTask.query.get_or_404(task_id)
    data = []
    for r in task.results:
        p = r.problem
        data.append({
            'problem_id': p.problem_id,
            'title': p.title,
            'processing_status': r.processing_status,
            'is_anomaly': r.is_anomaly,
            'anomaly_type': r.anomaly_type,
            'anomaly_explanation': r.anomaly_explanation,
            'is_manual_judgment': r.is_manual_judgment,
            'judgment_result': r.judgment_result,
            'judgment_reason': r.judgment_reason,
            'calc_result': r.calc_result,
            'diff_detail': r.diff_detail
        })
    return jsonify({
        'task': to_dict(task),
        'params_version': PARAMS_VERSION,
        'exported_at': datetime.utcnow().isoformat(),
        'data': data
    })


@app.route('/api/upload/screenshot', methods=['POST'])
def upload_screenshot():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '文件名空'}), 400
    if file:
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        return jsonify({'path': filepath, 'url': f'/uploads/{filename}'})


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/api/handover/info', methods=['GET'])
def get_handover_info():
    last_task_id = CheckState.query.filter_by(key='last_completed_task_id').first()
    last_task = None
    if last_task_id and last_task_id.value:
        task = CheckTask.query.get(int(last_task_id.value))
        if task:
            last_task = to_dict(task)
            results_summary = {
                'total': len(task.results),
                'passed': len([r for r in task.results if r.processing_status == 'passed']),
                'anomalies': len([r for r in task.results if r.is_anomaly]),
                'pending_manual': len([r for r in task.results if r.is_anomaly and not r.is_manual_judgment])
            }
            last_task['summary'] = results_summary

    anomalies = AnomalyRecord.query.filter_by(is_resolved=False).all()
    anomaly_info = []
    for a in anomalies:
        anomaly_info.append({
            'id': a.id,
            'problem_id': a.problem.problem_id,
            'title': a.problem.title,
            'anomaly_type': a.anomaly_type,
            'description': a.description,
            'detected_at': a.detected_at.isoformat()
        })

    sample_problems = Problem.query.limit(3).all()
    samples = []
    for p in sample_problems:
        samples.append({
            'id': p.id,
            'problem_id': p.problem_id,
            'title': p.title,
            'status': p.current_status,
            'version_count': len(p.versions)
        })

    return jsonify({
        'last_task': last_task,
        'anomalies': anomaly_info,
        'samples': samples,
        'params_version': PARAMS_VERSION,
        'quick_links': {
            'problems': '/#/problems',
            'anomalies': '/#/anomalies',
            'tasks': '/#/tasks',
            'export_template': '/api/export/{task_id}'
        }
    })


def save_screenshot(data, problem_id, version):
    import base64
    if data.startswith('data:image'):
        header, encoded = data.split(',', 1)
        ext = header.split('/')[1].split(';')[0]
        filename = f"{problem_id}_v{version}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        with open(filepath, 'wb') as f:
            f.write(base64.b64decode(encoded))
        return filepath
    return None


with app.app_context():
    db.create_all()

    if Problem.query.count() == 0:
        sample_problems = [
            {
                'problem_id': 'P001',
                'title': '2阶对称矩阵特征值分解',
                'description': '验证对称矩阵的特征值分解正确性',
                'matrix_data': [[4, 1], [1, 4]],
                'remark': '入门样例，特征值应为5和3'
            },
            {
                'problem_id': 'P002',
                'title': '3阶方阵奇异值分解',
                'description': '验证SVD分解的正确性',
                'matrix_data': [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                'remark': '经典测试用例，注意秩亏问题'
            },
            {
                'problem_id': 'P003',
                'title': '重复样本测试',
                'description': '与P001矩阵相同，用于测试重复检测',
                'matrix_data': [[4, 1], [1, 4]],
                'remark': '故意重复，验证异常检测'
            }
        ]

        for sp in sample_problems:
            p = Problem(
                problem_id=sp['problem_id'],
                title=sp['title'],
                description=sp['description'],
                matrix_data=json.dumps(sp['matrix_data']),
                current_status='pending'
            )
            db.session.add(p)
            db.session.flush()
            v = ProblemVersion(
                problem_id=p.id,
                version=1,
                remark=sp['remark'],
                modified_by='init',
                change_log='初始化样例数据'
            )
            db.session.add(v)

        sample_answers = [
            {
                'answer_id': 'A001',
                'version': 'v1.0',
                'content': json.dumps({'eigenvalues': [5.0, 3.0]}),
                'source': '教材答案'
            },
            {
                'answer_id': 'A002',
                'version': 'v2.0',
                'content': json.dumps({'eigenvalues': [5.0, 3.0]}),
                'source': '网络资料'
            }
        ]

        for sa in sample_answers:
            a = Answer(**sa)
            db.session.add(a)

        db.session.commit()

        p1 = Problem.query.filter_by(problem_id='P001').first()
        a1 = Answer.query.filter_by(answer_id='A001').first()
        a2 = Answer.query.filter_by(answer_id='A002').first()

        pa1 = ProblemAnswer(problem_id=p1.id, answer_id=a1.id, coverage_status='covered', match_score=1.0)
        pa2 = ProblemAnswer(problem_id=p1.id, answer_id=a2.id, coverage_status='covered', match_score=1.0)
        db.session.add(pa1)
        db.session.add(pa2)
        p1.current_status = 'double_covered'
        db.session.commit()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
