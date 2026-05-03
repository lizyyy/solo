#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from modules.data_processor import DataProcessor
from modules.cluster_engine import ClusterEngine
from modules.quality_checker import QualityChecker
from modules.storage_manager import StorageManager

app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
STORAGE_DIR = os.path.join(DATA_DIR, 'projects')
SAMPLE_DATA_DIR = os.path.join(DATA_DIR, 'samples')

os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(SAMPLE_DATA_DIR, exist_ok=True)

storage = StorageManager(STORAGE_DIR)
data_processor = DataProcessor()
cluster_engine = ClusterEngine()
quality_checker = QualityChecker()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/projects', methods=['GET'])
def list_projects():
    projects = storage.list_projects()
    return jsonify({'success': True, 'projects': projects})

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    name = data.get('name', f'项目_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
    description = data.get('description', '')
    
    project_id = str(uuid.uuid4())[:8]
    project = {
        'id': project_id,
        'name': name,
        'description': description,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'data': None,
        'clusters': [],
        'quality_rules': quality_checker.get_default_rules(),
        'quality_issues': []
    }
    
    storage.save_project(project)
    return jsonify({'success': True, 'project': project})

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    return jsonify({'success': True, 'project': project})

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    result = storage.delete_project(project_id)
    if not result:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    return jsonify({'success': True})

@app.route('/api/projects/<project_id>/upload', methods=['POST'])
def upload_data(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '请选择文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '请选择文件'}), 400
    
    try:
        temp_path = os.path.join(STORAGE_DIR, f'temp_{uuid.uuid4()}.csv')
        file.save(temp_path)
        
        result = data_processor.load_and_validate(temp_path)
        
        if not result['valid']:
            os.remove(temp_path)
            return jsonify({'success': False, 'error': result['error'], 'details': result.get('details')}), 400
        
        df = result['dataframe']
        processed_data = data_processor.process_dataframe(df)
        
        project['data'] = processed_data
        project['updated_at'] = datetime.now().isoformat()
        project['original_filename'] = file.filename
        
        storage.save_project(project)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return jsonify({
            'success': True, 
            'project': project,
            'stats': {
                'total_sessions': len(processed_data['sessions']),
                'total_messages': sum(len(s['messages']) for s in processed_data['sessions']),
                'date_range': processed_data.get('date_range')
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'处理文件时出错: {str(e)}'}), 500

@app.route('/api/projects/<project_id>/cluster', methods=['POST'])
def run_clustering(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if not project.get('data'):
        return jsonify({'success': False, 'error': '请先上传数据'}), 400
    
    params = request.get_json() or {}
    n_clusters = params.get('n_clusters', 8)
    
    try:
        sessions = project['data']['sessions']
        texts = []
        session_indices = []
        
        for idx, session in enumerate(sessions):
            user_messages = [m['content'] for m in session['messages'] if m['role'] == 'user']
            if user_messages:
                combined_text = ' '.join(user_messages)
                texts.append(combined_text)
                session_indices.append(idx)
        
        if not texts:
            return jsonify({'success': False, 'error': '没有可聚类的用户消息'}), 400
        
        cluster_result = cluster_engine.cluster_texts(texts, n_clusters=n_clusters)
        
        clusters = []
        for cluster_id in range(cluster_result['n_clusters']):
            cluster_indices = [i for i, c in enumerate(cluster_result['labels']) if c == cluster_id]
            
            if not cluster_indices:
                continue
            
            cluster_sessions = []
            satisfaction_scores = []
            for i in cluster_indices:
                session_idx = session_indices[i]
                session = sessions[session_idx]
                cluster_sessions.append({
                    'session_id': session['session_id'],
                    'user_messages': [m['content'] for m in session['messages'] if m['role'] == 'user'],
                    'agent_messages': [m['content'] for m in session['messages'] if m['role'] == 'agent'],
                    'messages': session['messages'],
                    'satisfaction': session.get('satisfaction'),
                    'tags': session.get('tags', [])
                })
                if session.get('satisfaction') is not None:
                    satisfaction_scores.append(session['satisfaction'])
            
            top_terms = cluster_result['top_terms'].get(cluster_id, [])
            representative = cluster_result['representative'].get(cluster_id, '')
            
            cluster = {
                'id': cluster_id,
                'name': f'簇 {cluster_id + 1}: {top_terms[0] if top_terms else "未命名"}',
                'size': len(cluster_sessions),
                'sessions': cluster_sessions,
                'keywords': top_terms,
                'representative_text': representative,
                'satisfaction_stats': {
                    'mean': round(sum(satisfaction_scores) / len(satisfaction_scores), 2) if satisfaction_scores else None,
                    'count': len(satisfaction_scores),
                    'distribution': _calc_satisfaction_distribution(satisfaction_scores)
                },
                'quality_issues': [],
                'merged_from': []
            }
            clusters.append(cluster)
        
        clusters.sort(key=lambda x: x['size'], reverse=True)
        for i, cluster in enumerate(clusters):
            cluster['display_order'] = i
        
        project['clusters'] = clusters
        project['updated_at'] = datetime.now().isoformat()
        project['cluster_params'] = {
            'n_clusters': n_clusters,
            'algorithm': 'KMeans + TF-IDF',
            'timestamp': datetime.now().isoformat()
        }
        
        storage.save_project(project)
        
        return jsonify({
            'success': True,
            'project': project,
            'cluster_stats': {
                'total_clusters': len(clusters),
                'total_sessions_clustered': sum(c['size'] for c in clusters)
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'聚类失败: {str(e)}'}), 500

def _calc_satisfaction_distribution(scores):
    if not scores:
        return {}
    
    dist = {}
    for s in scores:
        key = str(s) if isinstance(s, (int, float)) else str(s)
        dist[key] = dist.get(key, 0) + 1
    
    return dist

@app.route('/api/projects/<project_id>/clusters/<cluster_id>/rename', methods=['POST'])
def rename_cluster(project_id, cluster_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    data = request.get_json()
    new_name = data.get('name', '').strip()
    
    if not new_name:
        return jsonify({'success': False, 'error': '请输入簇名称'}), 400
    
    for cluster in project['clusters']:
        if str(cluster['id']) == str(cluster_id) or cluster.get('display_order') == int(cluster_id):
            cluster['name'] = new_name
            project['updated_at'] = datetime.now().isoformat()
            storage.save_project(project)
            return jsonify({'success': True, 'cluster': cluster})
    
    return jsonify({'success': False, 'error': '簇不存在'}), 404

@app.route('/api/projects/<project_id>/clusters/merge', methods=['POST'])
def merge_clusters(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    data = request.get_json()
    source_cluster_ids = data.get('source_ids', [])
    target_cluster_id = data.get('target_id')
    new_name = data.get('name')
    
    if not source_cluster_ids or target_cluster_id is None:
        return jsonify({'success': False, 'error': '请选择要合并的簇'}), 400
    
    clusters = project['clusters']
    target_cluster = None
    source_clusters = []
    
    for cluster in clusters:
        if str(cluster['id']) == str(target_cluster_id):
            target_cluster = cluster
        if str(cluster['id']) in [str(x) for x in source_cluster_ids]:
            source_clusters.append(cluster)
    
    if not target_cluster or not source_clusters:
        return jsonify({'success': False, 'error': '未找到指定的簇'}), 404
    
    for source in source_clusters:
        if source['id'] != target_cluster['id']:
            target_cluster['sessions'].extend(source['sessions'])
            target_cluster['size'] = len(target_cluster['sessions'])
            target_cluster['keywords'] = list(set(target_cluster['keywords'] + source['keywords']))[:10]
            if 'merged_from' not in target_cluster:
                target_cluster['merged_from'] = []
            target_cluster['merged_from'].append({
                'id': source['id'],
                'name': source['name'],
                'size': source['size']
            })
    
    if new_name:
        target_cluster['name'] = new_name
    
    project['clusters'] = [c for c in clusters if c not in source_clusters or c['id'] == target_cluster['id']]
    
    for i, cluster in enumerate(project['clusters']):
        cluster['display_order'] = i
    
    all_scores = []
    for s in target_cluster['sessions']:
        if s.get('satisfaction') is not None:
            all_scores.append(s['satisfaction'])
    
    target_cluster['satisfaction_stats'] = {
        'mean': round(sum(all_scores) / len(all_scores), 2) if all_scores else None,
        'count': len(all_scores),
        'distribution': _calc_satisfaction_distribution(all_scores)
    }
    
    project['updated_at'] = datetime.now().isoformat()
    storage.save_project(project)
    
    return jsonify({'success': True, 'project': project})

@app.route('/api/projects/<project_id>/quality-rules', methods=['GET'])
def get_quality_rules(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    rules = project.get('quality_rules', quality_checker.get_default_rules())
    return jsonify({'success': True, 'rules': rules})

@app.route('/api/projects/<project_id>/quality-rules', methods=['POST'])
def update_quality_rules(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    data = request.get_json()
    rules = data.get('rules', [])
    
    if not isinstance(rules, list):
        return jsonify({'success': False, 'error': '规则格式错误'}), 400
    
    project['quality_rules'] = rules
    project['updated_at'] = datetime.now().isoformat()
    storage.save_project(project)
    
    return jsonify({'success': True, 'rules': rules})

@app.route('/api/projects/<project_id>/quality-check', methods=['POST'])
def run_quality_check(project_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    if not project.get('data') or not project.get('clusters'):
        return jsonify({'success': False, 'error': '请先上传数据并运行聚类'}), 400
    
    rules = project.get('quality_rules', quality_checker.get_default_rules())
    
    all_issues = []
    
    for cluster in project['clusters']:
        cluster_issues = []
        for session in cluster['sessions']:
            user_text = ' '.join(session.get('user_messages', []))
            agent_text = ' '.join(session.get('agent_messages', []))
            
            for rule in rules:
                if not rule.get('enabled', True):
                    continue
                
                issue = quality_checker.check_rule(rule, user_text, agent_text)
                if issue:
                    issue['session_id'] = session['session_id']
                    issue['cluster_id'] = cluster['id']
                    issue['cluster_name'] = cluster['name']
                    issue['timestamp'] = datetime.now().isoformat()
                    issue['id'] = str(uuid.uuid4())[:8]
                    cluster_issues.append(issue)
                    all_issues.append(issue)
        
        cluster['quality_issues'] = cluster_issues
    
    project['quality_issues'] = all_issues
    project['updated_at'] = datetime.now().isoformat()
    
    stats = {
        'total_issues': len(all_issues),
        'by_severity': {},
        'by_rule': {}
    }
    
    for issue in all_issues:
        sev = issue.get('severity', 'medium')
        stats['by_severity'][sev] = stats['by_severity'].get(sev, 0) + 1
        
        rule_name = issue.get('rule_name', '未知规则')
        stats['by_rule'][rule_name] = stats['by_rule'].get(rule_name, 0) + 1
    
    storage.save_project(project)
    
    return jsonify({
        'success': True,
        'issues': all_issues,
        'stats': stats,
        'project': project
    })

@app.route('/api/projects/<project_id>/quality-issues/<issue_id>/resolve', methods=['POST'])
def resolve_quality_issue(project_id, issue_id):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    data = request.get_json()
    resolution = data.get('resolution', '')
    resolved = data.get('resolved', True)
    
    issues = project.get('quality_issues', [])
    for issue in issues:
        if issue.get('id') == issue_id:
            issue['resolved'] = resolved
            issue['resolution'] = resolution
            issue['resolved_at'] = datetime.now().isoformat()
            break
    
    for cluster in project.get('clusters', []):
        for issue in cluster.get('quality_issues', []):
            if issue.get('id') == issue_id:
                issue['resolved'] = resolved
                issue['resolution'] = resolution
                issue['resolved_at'] = datetime.now().isoformat()
                break
    
    project['updated_at'] = datetime.now().isoformat()
    storage.save_project(project)
    
    return jsonify({'success': True})

@app.route('/api/projects/<project_id>/export/<format_type>', methods=['GET'])
def export_report(project_id, format_type):
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    from modules.report_generator import ReportGenerator
    generator = ReportGenerator()
    
    if format_type == 'markdown':
        content = generator.generate_markdown(project)
        filename = f"{project['name']}_周报_{datetime.now().strftime('%Y%m%d')}.md"
        return jsonify({'success': True, 'content': content, 'filename': filename})
    
    elif format_type == 'html':
        content = generator.generate_html(project)
        filename = f"{project['name']}_周报_{datetime.now().strftime('%Y%m%d')}.html"
        return jsonify({'success': True, 'content': content, 'filename': filename})
    
    else:
        return jsonify({'success': False, 'error': '不支持的导出格式'}), 400

@app.route('/api/sample-data', methods=['GET'])
def list_sample_data():
    samples = []
    if os.path.exists(SAMPLE_DATA_DIR):
        for f in os.listdir(SAMPLE_DATA_DIR):
            if f.endswith('.csv'):
                samples.append({
                    'name': f,
                    'path': os.path.join(SAMPLE_DATA_DIR, f)
                })
    return jsonify({'success': True, 'samples': samples})

@app.route('/api/sample-data/<filename>', methods=['POST'])
def load_sample_data(filename):
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'success': False, 'error': '缺少项目ID'}), 400
    
    project = storage.load_project(project_id)
    if not project:
        return jsonify({'success': False, 'error': '项目不存在'}), 404
    
    sample_path = os.path.join(SAMPLE_DATA_DIR, filename)
    if not os.path.exists(sample_path):
        return jsonify({'success': False, 'error': '示例数据不存在'}), 404
    
    try:
        result = data_processor.load_and_validate(sample_path)
        
        if not result['valid']:
            return jsonify({'success': False, 'error': result['error'], 'details': result.get('details')}), 400
        
        df = result['dataframe']
        processed_data = data_processor.process_dataframe(df)
        
        project['data'] = processed_data
        project['updated_at'] = datetime.now().isoformat()
        project['original_filename'] = filename
        project['is_sample'] = True
        
        storage.save_project(project)
        
        return jsonify({
            'success': True, 
            'project': project,
            'stats': {
                'total_sessions': len(processed_data['sessions']),
                'total_messages': sum(len(s['messages']) for s in processed_data['sessions']),
                'date_range': processed_data.get('date_range')
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f'加载示例数据失败: {str(e)}'}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("客服聊天意图聚类和质检台")
    print("=" * 60)
    print(f"数据目录: {DATA_DIR}")
    print(f"项目存储: {STORAGE_DIR}")
    print()
    print("启动服务中...")
    print("请在浏览器中访问: http://127.0.0.1:5000")
    print("=" * 60)
    
    app.run(debug=True, host='127.0.0.1', port=5000)
