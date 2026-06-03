"""Flask API 服务"""
import os
import io
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS

STATIC_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')

from .models import Handler
from .demo_data import create_demo_project, get_demo_process_steps, get_demo_csv_samples
from .data_import import import_safety_radius_json, import_routes_json, validate_safety_radius_overlap
from .origin_manager import set_coordinate_origin, get_origin_info, check_origin_consistency
from .route_calculator import detect_route_issues, recalculate_route_length, update_route_manual_length
from .workflow import (
    manual_fix_issue, rerun_issue, client_review_issue,
    escalate_to_client, process_issue_after_origin_check, get_workflow_status
)
from .visualization import export_layout_screenshot, export_issue_detail_screenshot
from .service import get_project_serializable, run_standard_three_step_process


app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='')
CORS(app)

_project_cache = {}


def _get_or_create_project(project_id: str = None, use_demo: bool = False):
    """获取或创建项目"""
    if use_demo:
        return create_demo_project()

    if project_id and project_id in _project_cache:
        return _project_cache[project_id]

    from .models import LayoutProject
    import time
    pid = project_id or f"PROJ-{int(time.time())}"
    project = LayoutProject(project_id=pid)
    _project_cache[pid] = project
    return project


@app.route('/')
def index():
    """小看板首页"""
    return send_from_directory(STATIC_FOLDER, 'index.html')


@app.route('/api/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({"status": "ok", "version": "1.0.0"})


@app.route('/api/demo/steps', methods=['GET'])
def demo_steps():
    """获取演示流程步骤"""
    return jsonify({"steps": get_demo_process_steps()})


@app.route('/api/demo/csv-samples', methods=['POST'])
def generate_csv_samples():
    """生成演示CSV样本"""
    output_dir = request.json.get('output_dir', './demo_data')
    files = get_demo_csv_samples(output_dir)
    return jsonify({"files": files})


@app.route('/api/project', methods=['POST'])
def create_project():
    """创建项目"""
    data = request.json or {}
    use_demo = data.get('use_demo', False)
    project_id = data.get('project_id')

    project = _get_or_create_project(project_id=project_id, use_demo=use_demo)
    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>', methods=['GET'])
def get_project(project_id):
    """获取项目详情"""
    if project_id not in _project_cache:
        return jsonify({"error": "项目不存在"}), 404
    return jsonify(get_project_serializable(_project_cache[project_id]))


@app.route('/api/project/<project_id>/import', methods=['POST'])
def import_data(project_id):
    """导入数据"""
    project = _get_or_create_project(project_id)
    data = request.json or {}

    if 'safety_radii' in data:
        import_safety_radius_json(data['safety_radii'], project)

    if 'routes' in data:
        import_routes_json(data['routes'], project)

    if 'coordinate_origin' in data:
        origin = data['coordinate_origin']
        set_coordinate_origin(
            project=project,
            origin_point=tuple(origin.get('origin_point', [0, 0])),
            description=origin.get('description', ''),
            calibration_date=origin.get('calibration_date', ''),
            calibrated_by=origin.get('calibrated_by', '园区运维小陶'),
            notes=origin.get('notes', '')
        )

    if data.get('detect_issues', True):
        detect_route_issues(project)

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/detect-issues', methods=['POST'])
def detect_issues(project_id):
    """检测问题"""
    project = _get_or_create_project(project_id)
    issues = detect_route_issues(project)
    overlap = validate_safety_radius_overlap(project)
    return jsonify({
        "route_issues": [i.issue_id for i in issues],
        "overlap_issues": overlap
    })


@app.route('/api/project/<project_id>/origin', methods=['GET'])
def get_origin(project_id):
    """获取坐标原点信息"""
    project = _get_or_create_project(project_id)
    origin_info = get_origin_info(project)
    origin_check = check_origin_consistency(project)
    return jsonify({
        "origin_info": origin_info,
        "origin_check": origin_check
    })


@app.route('/api/project/<project_id>/origin', methods=['PUT'])
def update_origin(project_id):
    """更新坐标原点"""
    project = _get_or_create_project(project_id)
    data = request.json or {}

    origin = set_coordinate_origin(
        project=project,
        origin_point=tuple(data.get('origin_point', [0, 0])),
        description=data.get('description', ''),
        calibration_date=data.get('calibration_date', ''),
        calibrated_by=data.get('calibrated_by', '园区运维小陶'),
        notes=data.get('notes', '')
    )

    return jsonify({
        "version": origin.version,
        "origin_point": origin.origin_point,
        "description": origin.description
    })


@app.route('/api/project/<project_id>/origin/process-issue/<issue_id>', methods=['POST'])
def process_after_origin_check(project_id, issue_id):
    """园区运维小陶看完坐标原点说明后处理问题"""
    project = _get_or_create_project(project_id)
    result = process_issue_after_origin_check(
        project=project,
        issue_id=issue_id,
        operator=Handler.PARK_OPS_XT
    )
    return jsonify(result)


@app.route('/api/project/<project_id>/issue/<issue_id>/fix', methods=['POST'])
def fix_issue(project_id, issue_id):
    """人工修正问题"""
    project = _get_or_create_project(project_id)
    data = request.json or {}

    result = manual_fix_issue(
        project=project,
        issue_id=issue_id,
        fix_notes=data.get('fix_notes', ''),
        operator=Handler.PARK_OPS_XT,
        corrected_value=data.get('corrected_value')
    )

    if not result:
        return jsonify({"error": "问题不存在"}), 404

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/issue/<issue_id>/rerun', methods=['POST'])
def rerun(project_id, issue_id):
    """重跑问题"""
    project = _get_or_create_project(project_id)
    result = rerun_issue(project, issue_id)

    if not result:
        return jsonify({"error": "问题不存在"}), 404

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/issue/<issue_id>/escalate', methods=['POST'])
def escalate(project_id, issue_id):
    """升级给展陈客户复核"""
    project = _get_or_create_project(project_id)
    result = escalate_to_client(project, issue_id, Handler.PARK_OPS_XT)

    if not result:
        return jsonify({"error": "问题不存在"}), 404

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/issue/<issue_id>/review', methods=['POST'])
def review(project_id, issue_id):
    """展陈客户复核问题"""
    project = _get_or_create_project(project_id)
    data = request.json or {}

    result = client_review_issue(
        project=project,
        issue_id=issue_id,
        approved=data.get('approved', False),
        review_notes=data.get('notes', ''),
        operator=Handler.EXHIBITION_CLIENT
    )

    if not result:
        return jsonify({"error": "问题不存在"}), 404

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/route/<route_id>/recalculate', methods=['POST'])
def recalculate_route(project_id, route_id):
    """重新计算路线长度"""
    project = _get_or_create_project(project_id)
    result = recalculate_route_length(project, route_id)

    if not result:
        return jsonify({"error": "路线不存在"}), 404

    return jsonify({
        "route_id": route_id,
        "calculated_length": result.calculated_length,
        "length_matched": result.length_matched
    })


@app.route('/api/project/<project_id>/route/<route_id>/update-manual', methods=['POST'])
def update_manual_length(project_id, route_id):
    """更新路线人工录入长度（补录）"""
    project = _get_or_create_project(project_id)
    data = request.json or {}

    result = update_route_manual_length(
        project=project,
        route_id=route_id,
        manual_length=data.get('manual_length', 0),
        operator=Handler.PARK_OPS_XT,
        is_supplementary=data.get('is_supplementary', True)
    )

    if not result:
        return jsonify({"error": "路线不存在"}), 404

    return jsonify(get_project_serializable(project))


@app.route('/api/project/<project_id>/export/report', methods=['GET'])
def export_report(project_id):
    """导出布局报告截图"""
    project = _get_or_create_project(project_id)
    output_dir = request.args.get('output_dir', './output')
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, f'{project_id}_layout_report.png')
    export_layout_screenshot(project, output_path)

    return send_file(output_path, mimetype='image/png', as_attachment=True)


@app.route('/api/project/<project_id>/export/issue/<issue_id>', methods=['GET'])
def export_issue_detail(project_id, issue_id):
    """导出问题详情截图"""
    project = _get_or_create_project(project_id)
    output_dir = request.args.get('output_dir', './output')
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, f'{project_id}_issue_{issue_id}.png')
    result = export_issue_detail_screenshot(project, issue_id, output_path)

    if not result:
        return jsonify({"error": "问题不存在"}), 404

    return send_file(output_path, mimetype='image/png', as_attachment=True)


@app.route('/api/three-step-process', methods=['POST'])
def run_three_step():
    """运行标准三步流程"""
    data = request.json or {}
    use_demo = data.get('use_demo', False)
    output_dir = data.get('output_dir', './output')

    result = run_standard_three_step_process(
        safety_radius_path=data.get('safety_radius_path'),
        routes_path=data.get('routes_path'),
        safety_radius_data=data.get('safety_radius_data'),
        routes_data=data.get('routes_data'),
        origin_point=tuple(data.get('origin_point', [0, 0])),
        origin_description=data.get('origin_description', ''),
        origin_calibration_date=data.get('origin_calibration_date', ''),
        origin_calibrated_by=data.get('origin_calibrated_by', '园区运维小陶'),
        output_dir=output_dir,
        use_demo=use_demo
    )

    project = result.pop('project')
    if project:
        _project_cache[project.project_id] = project
        result['project_id'] = project.project_id

    return jsonify(result)


@app.route('/api/project/<project_id>/workflow-status', methods=['GET'])
def workflow_status(project_id):
    """获取工作流状态"""
    project = _get_or_create_project(project_id)
    return jsonify(get_workflow_status(project))


def run_server(host: str = '0.0.0.0', port: int = 5000, debug: bool = False):
    """启动API服务器"""
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    run_server()
