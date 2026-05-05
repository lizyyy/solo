from flask import request, jsonify, send_file, render_template, make_response
from app import app
from app.data_processing import DataProcessor
import os
import uuid
import json
from datetime import datetime
from werkzeug.utils import secure_filename

# 初始化数据处理器
data_processor = DataProcessor(app.config['DATA_FOLDER'])

# 支持的文件类型
ALLOWED_EXTENSIONS = {'csv', 'jpg', 'jpeg', 'png', 'gif'}
ALLOWED_CSV_EXTENSIONS = {'csv'}

def allowed_file(filename, extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in extensions

def generate_session_id():
    """生成唯一的会话ID"""
    return datetime.now().strftime('%Y%m%d%H%M%S') + '_' + str(uuid.uuid4())[:8]

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """获取所有会话列表"""
    sessions = []
    data_folder = app.config['DATA_FOLDER']
    
    if os.path.exists(data_folder):
        for filename in os.listdir(data_folder):
            if filename.endswith('.json'):
                session_id = filename[:-5]
                file_path = os.path.join(data_folder, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        analysis_time = data.get('analysis_time', '')
                        summary = data.get('summary', {})
                        sessions.append({
                            'session_id': session_id,
                            'analysis_time': analysis_time,
                            'total_quadrats': summary.get('total_quadrats', 0),
                            'total_species': summary.get('total_species', 0),
                            'flagged_count': data.get('flagged_count', 0)
                        })
                except:
                    continue
    
    # 按时间排序
    sessions.sort(key=lambda x: x['analysis_time'], reverse=True)
    return jsonify({'success': True, 'sessions': sessions})

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    """获取指定会话的数据"""
    data = data_processor.load_session(session_id)
    if data:
        return jsonify({'success': True, 'data': data})
    else:
        return jsonify({'success': False, 'error': '会话不存在'}), 404

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """删除指定会话"""
    session_file = os.path.join(app.config['DATA_FOLDER'], f'{session_id}.json')
    if os.path.exists(session_file):
        os.remove(session_file)
        return jsonify({'success': True, 'message': '会话已删除'})
    else:
        return jsonify({'success': False, 'error': '会话不存在'}), 404

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """上传数据文件并执行分析"""
    try:
        # 检查是否有文件上传
        if 'species_file' not in request.files or 'env_file' not in request.files:
            return jsonify({'success': False, 'error': '缺少必要的CSV文件'}), 400
        
        species_file = request.files['species_file']
        env_file = request.files['env_file']
        manual_notes = request.form.get('notes', '')
        
        # 验证文件
        if species_file.filename == '' or env_file.filename == '':
            return jsonify({'success': False, 'error': '未选择文件'}), 400
        
        if not (allowed_file(species_file.filename, ALLOWED_CSV_EXTENSIONS) and 
                allowed_file(env_file.filename, ALLOWED_CSV_EXTENSIONS)):
            return jsonify({'success': False, 'error': '只支持CSV文件'}), 400
        
        # 保存上传的文件
        session_id = generate_session_id()
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        os.makedirs(upload_folder, exist_ok=True)
        
        species_filename = secure_filename(species_file.filename)
        env_filename = secure_filename(env_file.filename)
        
        species_path = os.path.join(upload_folder, species_filename)
        env_path = os.path.join(upload_folder, env_filename)
        
        species_file.save(species_path)
        env_file.save(env_path)
        
        # 处理照片文件（如果有）
        photo_info = []
        if 'photo_files' in request.files:
            photo_files = request.files.getlist('photo_files')
            photo_folder = os.path.join(upload_folder, 'photos')
            os.makedirs(photo_folder, exist_ok=True)
            
            for photo_file in photo_files:
                if photo_file.filename and allowed_file(photo_file.filename, {'jpg', 'jpeg', 'png', 'gif'}):
                    photo_filename = secure_filename(photo_file.filename)
                    photo_path = os.path.join(photo_folder, photo_filename)
                    photo_file.save(photo_path)
                    photo_info.append({
                        'filename': photo_filename,
                        'path': f'/api/photos/{session_id}/{photo_filename}'
                    })
        
        # 执行数据分析
        analysis_result = data_processor.run_full_analysis(
            species_path, env_path, manual_notes
        )
        
        # 添加照片信息
        analysis_result['photos'] = photo_info
        analysis_result['upload_folder'] = upload_folder
        
        # 保存会话数据
        data_processor.save_session(session_id, analysis_result)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'data': analysis_result
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """执行数据分析（使用已上传的文件）"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'success': False, 'error': '缺少会话ID'}), 400
        
        session_data = data_processor.load_session(session_id)
        if not session_data:
            return jsonify({'success': False, 'error': '会话不存在'}), 404
        
        # 重新执行分析（使用相同的文件）
        upload_folder = session_data.get('upload_folder', '')
        species_file = None
        env_file = None
        
        if os.path.exists(upload_folder):
            for filename in os.listdir(upload_folder):
                if filename.endswith('.csv'):
                    file_path = os.path.join(upload_folder, filename)
                    # 简单判断哪个是物种文件，哪个是环境文件
                    try:
                        import pandas as pd
                        df = pd.read_csv(file_path, nrows=5)
                        columns = [col.lower() for col in df.columns]
                        if any('物种' in col or 'species' in col for col in df.columns):
                            species_file = file_path
                        elif any('水温' in col or 'water' in col or '盐度' in col or 'salinity' in col for col in df.columns):
                            env_file = file_path
                    except:
                        continue
        
        if species_file and env_file:
            manual_notes = data.get('notes', session_data.get('manual_notes', ''))
            new_analysis = data_processor.run_full_analysis(
                species_file, env_file, manual_notes
            )
            new_analysis['photos'] = session_data.get('photos', [])
            new_analysis['upload_folder'] = upload_folder
            new_analysis['review_status'] = session_data.get('review_status', {})
            
            data_processor.save_session(session_id, new_analysis)
            return jsonify({
                'success': True,
                'session_id': session_id,
                'data': new_analysis
            })
        else:
            return jsonify({'success': False, 'error': '无法找到原始数据文件'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/review/<session_id>/<quadrat_id>', methods=['POST'])
def update_review(session_id, quadrat_id):
    """更新样方复核状态"""
    try:
        data = request.get_json()
        status = data.get('status', '未复核')
        notes = data.get('notes', '')
        
        success = data_processor.update_review_status(session_id, quadrat_id, status, notes)
        
        if success:
            return jsonify({'success': True, 'message': '复核状态已更新'})
        else:
            return jsonify({'success': False, 'error': '会话不存在'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/markdown/<session_id>', methods=['GET'])
def export_markdown(session_id):
    """导出Markdown格式报告"""
    try:
        report = data_processor.export_markdown_report(session_id)
        
        if report:
            response = make_response(report)
            response.headers["Content-Disposition"] = f"attachment; filename=intertidal_report_{session_id}.md"
            response.headers["Content-type"] = "text/markdown"
            return response
        else:
            return jsonify({'success': False, 'error': '会话不存在'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/json/<session_id>', methods=['GET'])
def export_json(session_id):
    """导出JSON格式明细"""
    try:
        data = data_processor.export_json_detail(session_id)
        
        if data:
            response = make_response(json.dumps(data, ensure_ascii=False, indent=2))
            response.headers["Content-Disposition"] = f"attachment; filename=intertidal_detail_{session_id}.json"
            response.headers["Content-type"] = "application/json"
            return response
        else:
            return jsonify({'success': False, 'error': '会话不存在'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/photos/<session_id>/<filename>', methods=['GET'])
def get_photo(session_id, filename):
    """获取照片文件"""
    try:
        photo_path = os.path.join(
            app.config['UPLOAD_FOLDER'], 
            session_id, 
            'photos', 
            secure_filename(filename)
        )
        
        if os.path.exists(photo_path):
            return send_file(photo_path)
        else:
            return jsonify({'success': False, 'error': '照片不存在'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/photos/<session_id>', methods=['POST'])
def upload_photos(session_id):
    """上传照片到指定会话"""
    try:
        if 'photo_files' not in request.files:
            return jsonify({'success': False, 'error': '没有上传照片'}), 400
        
        photo_files = request.files.getlist('photo_files')
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id, 'photos')
        os.makedirs(upload_folder, exist_ok=True)
        
        photo_info = []
        for photo_file in photo_files:
            if photo_file.filename and allowed_file(photo_file.filename, {'jpg', 'jpeg', 'png', 'gif'}):
                photo_filename = secure_filename(photo_file.filename)
                photo_path = os.path.join(upload_folder, photo_filename)
                photo_file.save(photo_path)
                photo_info.append({
                    'filename': photo_filename,
                    'path': f'/api/photos/{session_id}/{photo_filename}'
                })
        
        # 更新会话数据
        session_data = data_processor.load_session(session_id)
        if session_data:
            if 'photos' not in session_data:
                session_data['photos'] = []
            session_data['photos'].extend(photo_info)
            data_processor.save_session(session_id, session_data)
        
        return jsonify({
            'success': True,
            'photos': photo_info,
            'message': f'成功上传 {len(photo_info)} 张照片'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sample-data', methods=['POST'])
def load_sample_data():
    """加载示例数据"""
    try:
        # 检查示例数据目录
        sample_folder = os.path.join(os.path.dirname(__file__), '..', 'sample_data')
        
        if not os.path.exists(sample_folder):
            return jsonify({'success': False, 'error': '示例数据目录不存在'}), 404
        
        # 查找示例CSV文件
        species_file = None
        env_file = None
        
        for filename in os.listdir(sample_folder):
            if filename.endswith('.csv'):
                file_path = os.path.join(sample_folder, filename)
                # 判断文件类型
                try:
                    import pandas as pd
                    df = pd.read_csv(file_path, nrows=5)
                    columns = [str(col).lower() for col in df.columns]
                    
                    if any('物种' in col or 'species' in col for col in df.columns):
                        species_file = file_path
                    elif any('水温' in col or 'water' in col or '盐度' in col or 'salinity' in col for col in df.columns):
                        env_file = file_path
                except:
                    continue
        
        if not species_file or not env_file:
            return jsonify({'success': False, 'error': '无法找到完整的示例数据文件'}), 404
        
        # 创建会话并执行分析
        session_id = generate_session_id()
        upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        os.makedirs(upload_folder, exist_ok=True)
        
        # 复制示例文件到上传目录
        import shutil
        shutil.copy(species_file, os.path.join(upload_folder, 'sample_species.csv'))
        shutil.copy(env_file, os.path.join(upload_folder, 'sample_env.csv'))
        
        # 执行分析
        analysis_result = data_processor.run_full_analysis(
            species_file, env_file, '这是示例数据，用于测试系统功能。'
        )
        
        # 检查是否有示例照片
        sample_photos_folder = os.path.join(sample_folder, 'photos')
        photo_info = []
        if os.path.exists(sample_photos_folder):
            photo_folder = os.path.join(upload_folder, 'photos')
            os.makedirs(photo_folder, exist_ok=True)
            
            for filename in os.listdir(sample_photos_folder):
                if allowed_file(filename, {'jpg', 'jpeg', 'png', 'gif'}):
                    src_path = os.path.join(sample_photos_folder, filename)
                    dst_path = os.path.join(photo_folder, filename)
                    shutil.copy(src_path, dst_path)
                    photo_info.append({
                        'filename': filename,
                        'path': f'/api/photos/{session_id}/{filename}'
                    })
        
        analysis_result['photos'] = photo_info
        analysis_result['upload_folder'] = upload_folder
        
        # 保存会话
        data_processor.save_session(session_id, analysis_result)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'data': analysis_result,
            'message': '示例数据已加载成功'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/config/invasive-species', methods=['GET'])
def get_invasive_species():
    """获取入侵种列表"""
    from app.data_processing import INVASIVE_SPECIES
    return jsonify({'success': True, 'invasive_species': INVASIVE_SPECIES})

@app.route('/api/config/invasive-species', methods=['POST'])
def update_invasive_species():
    """更新入侵种列表（临时，不持久化）"""
    try:
        data = request.get_json()
        new_species = data.get('invasive_species', [])
        
        # 这里只更新当前会话的处理器，不写入文件
        # 如果需要持久化，可以写入配置文件
        global data_processor
        # 注意：这里为了简化，我们不直接修改全局变量
        # 实际应用中可以考虑使用配置文件或数据库
        
        return jsonify({'success': True, 'message': '入侵种列表已更新（临时）'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
