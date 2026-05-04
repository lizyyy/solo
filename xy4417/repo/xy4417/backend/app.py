from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import sqlite3
import json
import os
import uuid
from datetime import datetime
from calculations import Calculator
from utils import export_markdown, export_json_audit

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_PATH = os.path.join(DATA_DIR, 'railway.db')

def init_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            data TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_records (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            notes TEXT,
            adjusted_sections TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, created_at, updated_at FROM projects')
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO projects (id, name, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)',
        (project_id, data.get('name', '未命名项目'), now, now, json.dumps(data.get('data', {})))
    )
    conn.commit()
    conn.close()
    
    return jsonify({'id': project_id, 'message': '项目创建成功'})

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    conn.close()
    
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    return jsonify({
        'id': project['id'],
        'name': project['name'],
        'created_at': project['created_at'],
        'updated_at': project['updated_at'],
        'data': json.loads(project['data'])
    })

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.json
    now = datetime.now().isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE projects SET name = ?, updated_at = ?, data = ? WHERE id = ?',
        (data.get('name', '未命名项目'), now, json.dumps(data.get('data', {})), project_id)
    )
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': '项目不存在'}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '项目更新成功'})

@app.route('/api/projects/<project_id>/calculate', methods=['POST'])
def calculate(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    conn.close()
    
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    project_data = json.loads(project['data'])
    calculator = Calculator(project_data)
    
    results = calculator.calculate_all()
    
    return jsonify(results)

@app.route('/api/projects/<project_id>/review', methods=['POST'])
def add_review(project_id):
    data = request.json
    review_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': '项目不存在'}), 404
    
    cursor.execute(
        'INSERT INTO review_records (id, project_id, created_at, notes, adjusted_sections) VALUES (?, ?, ?, ?, ?)',
        (review_id, project_id, now, data.get('notes', ''), json.dumps(data.get('adjusted_sections', [])))
    )
    conn.commit()
    conn.close()
    
    return jsonify({'id': review_id, 'message': '复核记录添加成功'})

@app.route('/api/projects/<project_id>/reviews', methods=['GET'])
def get_reviews(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM review_records WHERE project_id = ? ORDER BY created_at DESC', (project_id,))
    reviews = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    for review in reviews:
        review['adjusted_sections'] = json.loads(review['adjusted_sections'])
    
    return jsonify(reviews)

@app.route('/api/projects/<project_id>/export/markdown', methods=['GET'])
def export_to_markdown(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    
    cursor.execute('SELECT * FROM review_records WHERE project_id = ? ORDER BY created_at DESC', (project_id,))
    reviews = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    project_data = json.loads(project['data'])
    calculator = Calculator(project_data)
    results = calculator.calculate_all()
    
    for review in reviews:
        review['adjusted_sections'] = json.loads(review['adjusted_sections'])
    
    markdown_content = export_markdown(project, project_data, results, reviews)
    
    temp_path = os.path.join(DATA_DIR, f'railway_{project_id}.md')
    with open(temp_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    return send_file(temp_path, as_attachment=True, download_name=f'{project["name"]}_排查单.md')

@app.route('/api/projects/<project_id>/export/json', methods=['GET'])
def export_to_json(project_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
    project = cursor.fetchone()
    
    cursor.execute('SELECT * FROM review_records WHERE project_id = ? ORDER BY created_at DESC', (project_id,))
    reviews = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    if not project:
        return jsonify({'error': '项目不存在'}), 404
    
    project_data = json.loads(project['data'])
    calculator = Calculator(project_data)
    results = calculator.calculate_all()
    
    for review in reviews:
        review['adjusted_sections'] = json.loads(review['adjusted_sections'])
    
    json_content = export_json_audit(project, project_data, results, reviews)
    
    temp_path = os.path.join(DATA_DIR, f'railway_{project_id}.json')
    with open(temp_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(json_content, ensure_ascii=False, indent=2))
    
    return send_file(temp_path, as_attachment=True, download_name=f'{project["name"]}_审计包.json')

@app.route('/')
def index():
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    return send_file(frontend_path)

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
