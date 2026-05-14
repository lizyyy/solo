from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import sqlite3
import json
import csv
import io
from datetime import datetime
from typing import List, Dict, Any

app = Flask(__name__)
CORS(app)
DATABASE = 'oj_queue.db'


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS problem_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_id TEXT NOT NULL,
            version TEXT NOT NULL,
            title TEXT NOT NULL,
            original_input TEXT NOT NULL,
            processed_result TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(problem_id, version)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id TEXT UNIQUE NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            problem_id TEXT NOT NULL,
            problem_version TEXT NOT NULL,
            status TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            language TEXT,
            submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            judge_time TIMESTAMP,
            judge_machine TEXT,
            original_code TEXT,
            judge_log TEXT,
            is_cheating BOOLEAN DEFAULT 0,
            cheating_reason TEXT,
            cheating_marked_by TEXT,
            cheating_marked_at TIMESTAMP,
            review_status TEXT DEFAULT 'pending',
            review_notes TEXT,
            FOREIGN KEY (problem_id, problem_version) REFERENCES problem_versions(problem_id, version)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS judge_machines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            machine_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            current_task TEXT,
            last_heartbeat TIMESTAMP,
            cpu_usage REAL,
            memory_usage REAL,
            total_tasks INTEGER DEFAULT 0,
            failed_tasks INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rejudge_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT UNIQUE NOT NULL,
            problem_id TEXT NOT NULL,
            problem_version TEXT NOT NULL,
            submission_ids TEXT,
            status TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            reason TEXT,
            error_message TEXT,
            fix_path TEXT,
            total_submissions INTEGER DEFAULT 0,
            processed_submissions INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cheating_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id TEXT NOT NULL,
            marked_by TEXT NOT NULL,
            marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reason TEXT NOT NULL,
            evidence TEXT,
            status TEXT DEFAULT 'pending',
            review_notes TEXT,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP,
            FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
        )
    ''')
    
    conn.commit()
    conn.close()


def init_dirty_data():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM problem_versions')
    if cursor.fetchone()[0] > 0:
        conn.close()
        return
    
    problem_versions = [
        ('P1001', 'v1.0', '两数之和', '[1,2,3,4,5]', '{"test_cases": 5, "time_limit": 1000}'),
        ('P1001', 'v1.1', '两数之和', '[1,2,3,4,5,6]', '{"test_cases": 6, "time_limit": 1000}'),
        ('P1002', 'v1.0', '链表反转', '[[1,2,3],[4,5]]', '{"test_cases": 2, "time_limit": 2000}'),
        ('P1003', 'v1.0', '二叉树遍历', '["root"]', '{"test_cases": 3, "time_limit": 1500}'),
    ]
    cursor.executemany('''
        INSERT INTO problem_versions (problem_id, version, title, original_input, processed_result)
        VALUES (?, ?, ?, ?, ?)
    ''', problem_versions)
    
    submissions = [
        ('S001', 'U001', '张三', 'P1001', 'v1.0', 'Accepted', 100, 'Python', '2024-01-15 10:30:00', '2024-01-15 10:30:05', 'judge-01', 'print("hello")', 'All tests passed', 0, None, None, None, 'approved', None),
        ('S002', 'U002', '李四', 'P1001', 'v1.0', 'Wrong Answer', 60, 'C++', '2024-01-15 10:35:00', '2024-01-15 10:35:10', 'judge-01', 'int main(){}', 'Test case 3 failed', 0, None, None, None, 'pending', None),
        ('S003', 'U003', '王五', 'P1001', 'v1.1', 'Accepted', 100, 'Java', '2024-01-15 11:00:00', '2024-01-15 11:00:15', 'judge-02', 'public class Main{}', 'All tests passed', 1, '代码相似度95% - 与S001重复', 'admin', '2024-01-15 14:00:00', 'pending', '需要复核'),
        ('S004', 'U004', '赵六', 'P1002', 'v1.0', 'Runtime Error', 0, 'Python', '2024-01-15 11:30:00', '2024-01-15 11:30:08', 'judge-02', 'def solve(): pass', 'IndexError', 0, None, None, None, 'approved', None),
        ('S005', 'U005', '钱七', 'P1002', 'v1.0', 'Accepted', 100, 'C++', '2024-01-15 12:00:00', '2024-01-15 12:00:20', 'judge-03', 'struct ListNode{}', 'All tests passed', 1, '使用了禁止的库函数', 'admin', '2024-01-15 15:00:00', 'rejected', '误判，代码符合规范'),
        ('S006', 'U001', '张三', 'P1003', 'v1.0', 'Time Limit Exceeded', 30, 'Python', '2024-01-15 14:00:00', '2024-01-15 14:01:30', 'judge-03', 'def dfs(): pass', 'TLE on case 2', 0, None, None, None, 'pending', None),
        ('S007', 'U006', '孙八', 'P1001', 'v1.1', 'Accepted', 100, 'Java', '2024-01-15 14:30:00', '2024-01-15 14:30:25', 'judge-01', 'class Solution{}', 'All tests passed', 0, None, None, None, 'approved', None),
    ]
    cursor.executemany('''
        INSERT INTO submissions (submission_id, user_id, username, problem_id, problem_version, status, score, language, submit_time, judge_time, judge_machine, original_code, judge_log, is_cheating, cheating_reason, cheating_marked_by, cheating_marked_at, review_status, review_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', submissions)
    
    judge_machines = [
        ('judge-01', '评测机-01', 'online', 'S007', '2024-01-15 14:30:25', 45.5, 62.3, 150, 5),
        ('judge-02', '评测机-02', 'online', None, '2024-01-15 14:30:00', 30.2, 55.1, 120, 3),
        ('judge-03', '评测机-03', 'offline', None, '2024-01-15 12:00:20', 0, 0, 100, 10),
        ('judge-04', '评测机-04', 'busy', 'S008', '2024-01-15 14:29:00', 85.0, 78.5, 200, 8),
    ]
    cursor.executemany('''
        INSERT INTO judge_machines (machine_id, name, status, current_task, last_heartbeat, cpu_usage, memory_usage, total_tasks, failed_tasks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', judge_machines)
    
    rejudge_tasks = [
        ('R001', 'P1001', 'v1.0', 'S001,S002', 'completed', 'admin', '2024-01-15 13:00:00', '2024-01-15 13:00:05', '2024-01-15 13:05:00', '修复测试用例错误', None, None, 2, 2, 2, 0),
        ('R002', 'P1002', 'v1.0', 'S004,S005', 'failed', 'admin', '2024-01-15 16:00:00', '2024-01-15 16:00:10', None, '更新时间限制', '数据库连接超时', '1. 检查评测机judge-03状态\n2. 重启数据库服务\n3. 重新提交重判任务', 2, 1, 1, 1),
        ('R003', 'P1003', 'v1.0', 'S006', 'pending', 'admin', '2024-01-15 17:00:00', None, None, '优化时间限制', None, None, 1, 0, 0, 0),
    ]
    cursor.executemany('''
        INSERT INTO rejudge_tasks (task_id, problem_id, problem_version, submission_ids, status, created_by, created_at, started_at, completed_at, reason, error_message, fix_path, total_submissions, processed_submissions, success_count, failed_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', rejudge_tasks)
    
    cheating_records = [
        ('S003', 'admin', '2024-01-15 14:00:00', '代码相似度95% - 与S001重复', '相似度检测报告', 'pending', '需要复核', None, None),
        ('S005', 'admin', '2024-01-15 15:00:00', '使用了禁止的库函数', '代码审查记录', 'rejected', '误判，代码符合规范', 'reviewer1', '2024-01-15 16:00:00'),
    ]
    cursor.executemany('''
        INSERT INTO cheating_records (submission_id, marked_by, marked_at, reason, evidence, status, review_notes, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', cheating_records)
    
    conn.commit()
    conn.close()


@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    problem_id = request.args.get('problem_id')
    is_cheating = request.args.get('is_cheating')
    review_status = request.args.get('review_status')
    user_id = request.args.get('user_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    query = 'SELECT * FROM submissions WHERE 1=1'
    params = []
    
    if status:
        query += ' AND status = ?'
        params.append(status)
    if problem_id:
        query += ' AND problem_id = ?'
        params.append(problem_id)
    if is_cheating:
        query += ' AND is_cheating = ?'
        params.append(1 if is_cheating == 'true' else 0)
    if review_status:
        query += ' AND review_status = ?'
        params.append(review_status)
    if user_id:
        query += ' AND user_id = ?'
        params.append(user_id)
    
    query += ' ORDER BY submit_time DESC LIMIT ? OFFSET ?'
    params.extend([per_page, (page - 1) * per_page])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    submissions = []
    for row in rows:
        submissions.append({
            'id': row['id'],
            'submission_id': row['submission_id'],
            'user_id': row['user_id'],
            'username': row['username'],
            'problem_id': row['problem_id'],
            'problem_version': row['problem_version'],
            'status': row['status'],
            'score': row['score'],
            'language': row['language'],
            'submit_time': row['submit_time'],
            'judge_time': row['judge_time'],
            'judge_machine': row['judge_machine'],
            'is_cheating': bool(row['is_cheating']),
            'cheating_reason': row['cheating_reason'],
            'review_status': row['review_status'],
        })
    
    cursor.execute('SELECT COUNT(*) as count FROM submissions')
    total = cursor.fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'data': submissions,
        'total': total,
        'page': page,
        'per_page': per_page
    })


@app.route('/api/submissions/<submission_id>', methods=['GET'])
def get_submission_detail(submission_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM submissions WHERE submission_id = ?', (submission_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({'error': 'Submission not found'}), 404
    
    submission = {
        'id': row['id'],
        'submission_id': row['submission_id'],
        'user_id': row['user_id'],
        'username': row['username'],
        'problem_id': row['problem_id'],
        'problem_version': row['problem_version'],
        'status': row['status'],
        'score': row['score'],
        'language': row['language'],
        'submit_time': row['submit_time'],
        'judge_time': row['judge_time'],
        'judge_machine': row['judge_machine'],
        'original_code': row['original_code'],
        'judge_log': row['judge_log'],
        'is_cheating': bool(row['is_cheating']),
        'cheating_reason': row['cheating_reason'],
        'cheating_marked_by': row['cheating_marked_by'],
        'cheating_marked_at': row['cheating_marked_at'],
        'review_status': row['review_status'],
        'review_notes': row['review_notes'],
    }
    
    cursor.execute('SELECT * FROM problem_versions WHERE problem_id = ? AND version = ?', 
                   (row['problem_id'], row['problem_version']))
    pv_row = cursor.fetchone()
    if pv_row:
        submission['problem_version_detail'] = {
            'title': pv_row['title'],
            'original_input': pv_row['original_input'],
            'processed_result': pv_row['processed_result'],
            'created_at': pv_row['created_at'],
        }
    
    conn.close()
    return jsonify(submission)


@app.route('/api/submissions/<submission_id>/mark-cheating', methods=['POST'])
def mark_cheating(submission_id):
    data = request.json
    reason = data.get('reason')
    marked_by = data.get('marked_by', 'admin')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE submissions 
        SET is_cheating = 1, cheating_reason = ?, cheating_marked_by = ?, cheating_marked_at = CURRENT_TIMESTAMP, review_status = 'pending'
        WHERE submission_id = ?
    ''', (reason, marked_by, submission_id))
    
    cursor.execute('''
        INSERT INTO cheating_records (submission_id, marked_by, marked_at, reason, status)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'pending')
    ''', (submission_id, marked_by, reason))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})


@app.route('/api/submissions/<submission_id>/review', methods=['POST'])
def review_submission(submission_id):
    data = request.json
    review_status = data.get('review_status')
    review_notes = data.get('review_notes')
    reviewed_by = data.get('reviewed_by', 'admin')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE submissions 
        SET review_status = ?, review_notes = ?
        WHERE submission_id = ?
    ''', (review_status, review_notes, submission_id))
    
    if review_status == 'rejected':
        cursor.execute('''
            UPDATE submissions 
            SET is_cheating = 0, cheating_reason = NULL
            WHERE submission_id = ?
        ''', (submission_id,))
    
    cursor.execute('''
        UPDATE cheating_records 
        SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE submission_id = ? AND status = 'pending'
    ''', (review_status, review_notes, reviewed_by, submission_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})


@app.route('/api/judge-machines', methods=['GET'])
def get_judge_machines():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM judge_machines')
    rows = cursor.fetchall()
    
    machines = []
    for row in rows:
        machines.append({
            'id': row['id'],
            'machine_id': row['machine_id'],
            'name': row['name'],
            'status': row['status'],
            'current_task': row['current_task'],
            'last_heartbeat': row['last_heartbeat'],
            'cpu_usage': row['cpu_usage'],
            'memory_usage': row['memory_usage'],
            'total_tasks': row['total_tasks'],
            'failed_tasks': row['failed_tasks'],
        })
    
    conn.close()
    return jsonify(machines)


@app.route('/api/rejudge-tasks', methods=['GET'])
def get_rejudge_tasks():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM rejudge_tasks ORDER BY created_at DESC')
    rows = cursor.fetchall()
    
    tasks = []
    for row in rows:
        tasks.append({
            'id': row['id'],
            'task_id': row['task_id'],
            'problem_id': row['problem_id'],
            'problem_version': row['problem_version'],
            'submission_ids': row['submission_ids'].split(',') if row['submission_ids'] else [],
            'status': row['status'],
            'created_by': row['created_by'],
            'created_at': row['created_at'],
            'started_at': row['started_at'],
            'completed_at': row['completed_at'],
            'reason': row['reason'],
            'error_message': row['error_message'],
            'fix_path': row['fix_path'],
            'total_submissions': row['total_submissions'],
            'processed_submissions': row['processed_submissions'],
            'success_count': row['success_count'],
            'failed_count': row['failed_count'],
        })
    
    conn.close()
    return jsonify(tasks)


@app.route('/api/rejudge-tasks/<task_id>', methods=['GET'])
def get_rejudge_task_detail(task_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM rejudge_tasks WHERE task_id = ?', (task_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({'error': 'Task not found'}), 404
    
    task = {
        'id': row['id'],
        'task_id': row['task_id'],
        'problem_id': row['problem_id'],
        'problem_version': row['problem_version'],
        'submission_ids': row['submission_ids'].split(',') if row['submission_ids'] else [],
        'status': row['status'],
        'created_by': row['created_by'],
        'created_at': row['created_at'],
        'started_at': row['started_at'],
        'completed_at': row['completed_at'],
        'reason': row['reason'],
        'error_message': row['error_message'],
        'fix_path': row['fix_path'],
        'total_submissions': row['total_submissions'],
        'processed_submissions': row['processed_submissions'],
        'success_count': row['success_count'],
        'failed_count': row['failed_count'],
    }
    
    conn.close()
    return jsonify(task)


@app.route('/api/problem-versions', methods=['GET'])
def get_problem_versions():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM problem_versions ORDER BY problem_id, version')
    rows = cursor.fetchall()
    
    versions = []
    for row in rows:
        versions.append({
            'id': row['id'],
            'problem_id': row['problem_id'],
            'version': row['version'],
            'title': row['title'],
            'original_input': row['original_input'],
            'processed_result': row['processed_result'],
            'created_at': row['created_at'],
        })
    
    conn.close()
    return jsonify(versions)


@app.route('/api/ranking/export', methods=['GET'])
def export_ranking():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT user_id, username, 
               COUNT(*) as total_submissions,
               SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) as accepted_count,
               SUM(score) as total_score,
               MAX(submit_time) as last_submit_time
        FROM submissions
        WHERE is_cheating = 0
        GROUP BY user_id, username
        ORDER BY total_score DESC, accepted_count DESC, last_submit_time ASC
    ''')
    rows = cursor.fetchall()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['排名', '用户ID', '用户名', '提交次数', '通过次数', '总分', '最后提交时间'])
    
    for idx, row in enumerate(rows, 1):
        writer.writerow([
            idx,
            row['user_id'],
            row['username'],
            row['total_submissions'],
            row['accepted_count'],
            row['total_score'],
            row['last_submit_time']
        ])
    
    conn.close()
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name='ranking.csv'
    )


@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as count FROM submissions')
    total_submissions = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM submissions WHERE status = "Accepted"')
    accepted = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM submissions WHERE is_cheating = 1')
    cheating = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM judge_machines WHERE status = "online"')
    online_machines = cursor.fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'total_submissions': total_submissions,
        'accepted': accepted,
        'cheating': cheating,
        'online_machines': online_machines,
    })


if __name__ == '__main__':
    init_db()
    init_dirty_data()
    app.run(debug=True, port=5000)
