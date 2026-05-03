from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from typing import Dict, Any

from backend.config import Config
from backend.modules.parser import DataParser
from backend.modules.cluster import ClusterEngine
from backend.modules.storage import StateStorage
from backend.modules.exporter import Exporter


api_bp = Blueprint('api', __name__)

storage = None
parser = None


def init_services():
    global storage, parser
    Config.ensure_directories()
    storage = StateStorage(Config.STORAGE_DIR)
    parser = DataParser(Config.UPLOAD_DIR)


def json_response(data: Dict[str, Any], success: bool = True, 
                  message: str = "") -> tuple:
    response = {
        'success': success,
        'message': message,
        'data': data,
        'timestamp': datetime.now().isoformat()
    }
    return jsonify(response), 200 if success else 400


@api_bp.route('/health', methods=['GET'])
def health_check():
    return json_response({'status': 'healthy'})


@api_bp.route('/upload/complaints', methods=['POST'])
def upload_complaints():
    if 'file' not in request.files:
        return json_response({}, False, '没有上传文件')
    
    file = request.files['file']
    if file.filename == '':
        return json_response({}, False, '文件名不能为空')
    
    if not file.filename.endswith('.csv'):
        return json_response({}, False, '只支持 CSV 格式')
    
    try:
        filename = secure_filename(file.filename)
        file_path = os.path.join(Config.UPLOAD_DIR, filename)
        file.save(file_path)
        
        complaints = parser.parse_complaints_csv(file_path)
        
        return json_response({
            'filename': filename,
            'count': len(complaints),
            'sample': complaints[:3] if len(complaints) > 0 else []
        }, True, f'成功解析 {len(complaints)} 条投诉记录')
        
    except Exception as e:
        return json_response({}, False, f'解析失败: {str(e)}')


@api_bp.route('/upload/workorders', methods=['POST'])
def upload_workorders():
    if 'file' not in request.files:
        return json_response({}, False, '没有上传文件')
    
    file = request.files['file']
    if file.filename == '':
        return json_response({}, False, '文件名不能为空')
    
    if not file.filename.endswith('.json'):
        return json_response({}, False, '只支持 JSON 格式')
    
    try:
        filename = secure_filename(file.filename)
        file_path = os.path.join(Config.UPLOAD_DIR, filename)
        file.save(file_path)
        
        work_orders = parser.parse_work_orders_json(file_path)
        
        return json_response({
            'filename': filename,
            'count': len(work_orders),
            'sample': work_orders[:3] if len(work_orders) > 0 else []
        }, True, f'成功解析 {len(work_orders)} 条工单记录')
        
    except Exception as e:
        return json_response({}, False, f'解析失败: {str(e)}')


@api_bp.route('/upload/keywords', methods=['POST'])
def upload_keywords():
    if 'file' not in request.files:
        return json_response({}, False, '没有上传文件')
    
    file = request.files['file']
    if file.filename == '':
        return json_response({}, False, '文件名不能为空')
    
    if not file.filename.endswith('.csv'):
        return json_response({}, False, '只支持 CSV 格式')
    
    try:
        filename = secure_filename(file.filename)
        file_path = os.path.join(Config.UPLOAD_DIR, filename)
        file.save(file_path)
        
        keywords = parser.parse_keywords_csv(file_path)
        
        return json_response({
            'filename': filename,
            'streets': list(keywords.keys()),
            'keywords_count': sum(len(v) for v in keywords.values())
        }, True, f'成功解析 {len(keywords)} 个街道的关键词')
        
    except Exception as e:
        return json_response({}, False, f'解析失败: {str(e)}')


@api_bp.route('/cluster', methods=['POST'])
def run_clustering():
    data = request.get_json()
    
    if not data:
        return json_response({}, False, '请求数据为空')
    
    complaints = data.get('complaints', [])
    work_orders = data.get('work_orders', [])
    street_keywords = data.get('street_keywords', {})
    
    if not complaints:
        return json_response({}, False, '没有投诉数据')
    
    try:
        cluster_engine = ClusterEngine(
            similarity_threshold=Config.SIMILARITY_THRESHOLD,
            street_keywords=street_keywords
        )
        
        clusters = cluster_engine.cluster(complaints, work_orders)
        
        session_id = storage.create_new_session(
            complaints=complaints,
            work_orders=work_orders,
            street_keywords=street_keywords,
            clusters=clusters
        )
        
        stats = storage.get_statistics()
        
        return json_response({
            'session_id': session_id,
            'cluster_count': len(clusters),
            'complaint_count': len(complaints),
            'statistics': stats,
            'clusters': [
                {
                    'cluster_id': c.get('cluster_id'),
                    'count': c.get('count'),
                    'representative_summary': c.get('representative_summary'),
                    'keywords': c.get('keywords'),
                    'similarity_score': c.get('similarity_score'),
                    'similar_reasons': c.get('similar_reasons'),
                    'urgency_level': c.get('urgency_level'),
                    'district': c.get('district'),
                    'status': c.get('status')
                }
                for c in clusters
            ]
        }, True, f'聚类完成，生成 {len(clusters)} 个事件簇')
        
    except Exception as e:
        return json_response({}, False, f'聚类失败: {str(e)}')


@api_bp.route('/clusters', methods=['GET'])
def get_clusters():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    status_filter = request.args.get('status')
    district_filter = request.args.get('district')
    urgency_filter = request.args.get('urgency')
    
    clusters = storage.get_clusters(
        status_filter=status_filter,
        district_filter=district_filter,
        urgency_filter=urgency_filter
    )
    
    cluster_list = []
    for c in clusters:
        cluster_list.append({
            'cluster_id': c.get('cluster_id'),
            'count': c.get('count'),
            'complaint_ids': c.get('complaint_ids'),
            'representative_summary': c.get('representative_summary'),
            'keywords': c.get('keywords'),
            'similarity_score': c.get('similarity_score'),
            'similar_reasons': c.get('similar_reasons'),
            'urgency_level': c.get('urgency_level'),
            'district': c.get('district'),
            'status': c.get('status'),
            'assigned_department': c.get('assigned_department'),
            'review_notes': c.get('review_notes'),
            'work_orders_count': len(c.get('work_orders', [])),
            'percentage': c.get('percentage')
        })
    
    return json_response({
        'total': len(cluster_list),
        'clusters': cluster_list
    })


@api_bp.route('/clusters/<cluster_id>', methods=['GET'])
def get_cluster_detail(cluster_id):
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    cluster = storage.get_cluster(cluster_id)
    
    if not cluster:
        return json_response({}, False, f'找不到簇 {cluster_id}')
    
    return json_response({
        'cluster_id': cluster.get('cluster_id'),
        'count': cluster.get('count'),
        'complaint_ids': cluster.get('complaint_ids'),
        'complaints': cluster.get('complaints'),
        'representative_summary': cluster.get('representative_summary'),
        'keywords': cluster.get('keywords'),
        'similarity_score': cluster.get('similarity_score'),
        'similar_reasons': cluster.get('similar_reasons'),
        'urgency_level': cluster.get('urgency_level'),
        'district': cluster.get('district'),
        'status': cluster.get('status'),
        'assigned_department': cluster.get('assigned_department'),
        'review_notes': cluster.get('review_notes'),
        'work_orders': cluster.get('work_orders'),
        'created_at': cluster.get('created_at'),
        'updated_at': cluster.get('updated_at')
    })


@api_bp.route('/clusters/<cluster_id>/status', methods=['PUT'])
def update_cluster_status(cluster_id):
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    data = request.get_json()
    status = data.get('status') if data else None
    
    if not status:
        return json_response({}, False, '状态不能为空')
    
    if storage.update_cluster_status(cluster_id, status):
        return json_response({
            'cluster_id': cluster_id,
            'new_status': status
        }, True, f'状态已更新为 {status}')
    else:
        return json_response({}, False, '更新失败')


@api_bp.route('/clusters/<cluster_id>/assign', methods=['PUT'])
def assign_department(cluster_id):
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    data = request.get_json()
    department = data.get('department') if data else None
    
    if not department:
        return json_response({}, False, '部门不能为空')
    
    if storage.assign_department(cluster_id, department):
        return json_response({
            'cluster_id': cluster_id,
            'assigned_department': department
        }, True, f'已指派给 {department}')
    else:
        return json_response({}, False, '指派失败')


@api_bp.route('/clusters/<cluster_id>/notes', methods=['POST'])
def add_review_note(cluster_id):
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    data = request.get_json()
    note = data.get('note') if data else None
    
    if not note:
        return json_response({}, False, '备注不能为空')
    
    if storage.add_review_note(cluster_id, note):
        cluster = storage.get_cluster(cluster_id)
        return json_response({
            'cluster_id': cluster_id,
            'review_notes': cluster.get('review_notes') if cluster else ''
        }, True, '备注已添加')
    else:
        return json_response({}, False, '添加备注失败')


@api_bp.route('/clusters/<cluster_id>/split', methods=['POST'])
def split_cluster(cluster_id):
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    data = request.get_json()
    split_indices = data.get('split_indices') if data else None
    
    if not split_indices or not isinstance(split_indices, list):
        return json_response({}, False, '拆分索引格式错误')
    
    original_cluster = storage.get_cluster(cluster_id)
    if not original_cluster:
        return json_response({}, False, f'找不到簇 {cluster_id}')
    
    cluster_engine = ClusterEngine(
        similarity_threshold=Config.SIMILARITY_THRESHOLD,
        street_keywords=storage.current_session.get('street_keywords', {})
    )
    
    new_clusters = cluster_engine.split_cluster(original_cluster, split_indices)
    
    if storage.split_cluster(cluster_id, new_clusters):
        return json_response({
            'original_cluster_id': cluster_id,
            'new_clusters_count': len(new_clusters),
            'new_clusters': [
                {
                    'cluster_id': c.get('cluster_id'),
                    'count': c.get('count'),
                    'complaint_ids': c.get('complaint_ids')
                }
                for c in new_clusters
            ]
        }, True, f'已拆分为 {len(new_clusters)} 个新簇')
    else:
        return json_response({}, False, '拆分失败')


@api_bp.route('/clusters/merge', methods=['POST'])
def merge_clusters():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    data = request.get_json()
    cluster_ids = data.get('cluster_ids') if data else None
    
    if not cluster_ids or len(cluster_ids) < 2:
        return json_response({}, False, '至少需要选择2个簇进行合并')
    
    clusters_to_merge = []
    for cid in cluster_ids:
        cluster = storage.get_cluster(cid)
        if not cluster:
            return json_response({}, False, f'找不到簇 {cid}')
        clusters_to_merge.append(cluster)
    
    cluster_engine = ClusterEngine(
        similarity_threshold=Config.SIMILARITY_THRESHOLD,
        street_keywords=storage.current_session.get('street_keywords', {})
    )
    
    merged_cluster = cluster_engine.merge_clusters(clusters_to_merge)
    
    if storage.merge_clusters(cluster_ids, merged_cluster):
        return json_response({
            'merged_from': cluster_ids,
            'new_cluster_id': merged_cluster.get('cluster_id'),
            'count': merged_cluster.get('count'),
            'representative_summary': merged_cluster.get('representative_summary')
        }, True, f'已合并为 {merged_cluster.get("cluster_id")}')
    else:
        return json_response({}, False, '合并失败')


@api_bp.route('/statistics', methods=['GET'])
def get_statistics():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    stats = storage.get_statistics()
    return json_response(stats)


@api_bp.route('/sessions', methods=['GET'])
def list_sessions():
    sessions = storage.list_sessions()
    return json_response({
        'sessions': sessions,
        'current_session_id': storage.current_session.get('session_id')
    })


@api_bp.route('/sessions/<session_id>', methods=['GET'])
def load_session(session_id):
    if storage.load_session(session_id):
        stats = storage.get_statistics()
        return json_response({
            'session_id': session_id,
            'statistics': stats
        }, True, '会话已加载')
    else:
        return json_response({}, False, '加载会话失败')


@api_bp.route('/export/weekly-report', methods=['GET'])
def export_weekly_report():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    exporter = Exporter(Config.EXPORT_DIR)
    
    clusters = storage.get_clusters()
    stats = storage.get_statistics()
    
    try:
        file_path = exporter.export_weekly_report(clusters, stats)
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='text/markdown'
        )
    except Exception as e:
        return json_response({}, False, f'导出失败: {str(e)}')


@api_bp.route('/export/dispatch-suggestions', methods=['GET'])
def export_dispatch_suggestions():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    exporter = Exporter(Config.EXPORT_DIR)
    
    clusters = storage.get_clusters()
    
    try:
        file_path = exporter.export_dispatch_suggestions(clusters)
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='text/csv'
        )
    except Exception as e:
        return json_response({}, False, f'导出失败: {str(e)}')


@api_bp.route('/export/clusters-json', methods=['GET'])
def export_clusters_json():
    if not storage or not storage.current_session.get('session_id'):
        return json_response({}, False, '没有活跃的会话')
    
    exporter = Exporter(Config.EXPORT_DIR)
    
    clusters = storage.get_clusters()
    stats = storage.get_statistics()
    
    try:
        file_path = exporter.export_clusters_json(clusters, stats)
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype='application/json'
        )
    except Exception as e:
        return json_response({}, False, f'导出失败: {str(e)}')
