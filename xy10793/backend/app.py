from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import os
import csv
from io import StringIO, BytesIO
from collections import defaultdict

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def load_data(filename):
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_data(filename, data):
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def init_dirty_data():
    candidates = [
        {"id": 1, "name": "张三", "email": "zhangsan@example.com", "timezone": "Asia/Shanghai", "position": "后端开发"},
        {"id": 2, "name": "李四", "email": "lisi@example.com", "timezone": "America/New_York", "position": "前端开发"},
        {"id": 3, "name": "王五", "email": "wangwu@example.com", "timezone": "Europe/London", "position": "产品经理"},
        {"id": 4, "name": "赵六", "email": "zhaoliu@example.com", "timezone": "Asia/Tokyo", "position": "测试工程师"},
        {"id": 5, "name": "钱七", "email": "qianqi@example.com", "timezone": "Asia/Shanghai", "position": "数据分析师"}
    ]
    
    interviewers = [
        {"id": 1, "name": "王经理", "email": "wang@company.com", "department": "技术部", "timezone": "Asia/Shanghai"},
        {"id": 2, "name": "李总监", "email": "li@company.com", "department": "产品部", "timezone": "Asia/Shanghai"},
        {"id": 3, "name": "张组长", "email": "zhang@company.com", "department": "技术部", "timezone": "America/New_York"},
        {"id": 4, "name": "陈主管", "email": "chen@company.com", "department": "人事部", "timezone": "Europe/London"}
    ]
    
    rooms = [
        {"id": 1, "name": "A101", "capacity": 4, "equipment": ["白板", "投影仪"]},
        {"id": 2, "name": "A102", "capacity": 6, "equipment": ["白板", "投影仪", "视频会议系统"]},
        {"id": 3, "name": "B201", "capacity": 8, "equipment": ["白板", "投影仪"]},
        {"id": 4, "name": "B202", "capacity": 3, "equipment": ["白板"]}
    ]
    
    timezone_rules = [
        {"id": 1, "name": "工作时间", "timezone": "Asia/Shanghai", "start_hour": 9, "end_hour": 18, "description": "中国标准工作时间"},
        {"id": 2, "name": "美国东部工作时间", "timezone": "America/New_York", "start_hour": 9, "end_hour": 18, "description": "美国东部工作时间"},
        {"id": 3, "name": "伦敦工作时间", "timezone": "Europe/London", "start_hour": 9, "end_hour": 18, "description": "伦敦工作时间"}
    ]
    
    schedules = [
        {"id": 1, "candidate_id": 1, "interviewer_ids": [1, 2], "room_id": 1, "start_time": "2026-05-15T10:00:00", "end_time": "2026-05-15T11:00:00", "status": "confirmed", "owner": "王经理"},
        {"id": 2, "candidate_id": 2, "interviewer_ids": [1], "room_id": 1, "start_time": "2026-05-15T10:30:00", "end_time": "2026-05-15T11:30:00", "status": "pending", "owner": "王经理"},
        {"id": 3, "candidate_id": 3, "interviewer_ids": [2, 3], "room_id": 2, "start_time": "2026-05-15T14:00:00", "end_time": "2026-05-15T15:00:00", "status": "confirmed", "owner": "李总监"},
        {"id": 4, "candidate_id": 1, "interviewer_ids": [1], "room_id": 2, "start_time": "2026-05-15T14:30:00", "end_time": "2026-05-15T15:30:00", "status": "pending", "owner": "王经理"},
        {"id": 5, "candidate_id": 4, "interviewer_ids": [4], "room_id": 3, "start_time": "2026-05-16T08:00:00", "end_time": "2026-05-16T09:00:00", "status": "confirmed", "owner": "陈主管"},
        {"id": 6, "candidate_id": 5, "interviewer_ids": [1, 3], "room_id": 4, "start_time": "2026-05-17T20:00:00", "end_time": "2026-05-17T21:00:00", "status": "pending", "owner": "王经理"}
    ]
    
    reschedule_records = []
    
    save_data('candidates.json', candidates)
    save_data('interviewers.json', interviewers)
    save_data('rooms.json', rooms)
    save_data('timezone_rules.json', timezone_rules)
    save_data('schedules.json', schedules)
    save_data('reschedule_records.json', reschedule_records)

if not os.path.exists(os.path.join(DATA_DIR, 'candidates.json')):
    init_dirty_data()

def check_time_conflict(new_start, new_end, existing_schedules, exclude_id=None):
    new_start_dt = datetime.fromisoformat(new_start)
    new_end_dt = datetime.fromisoformat(new_end)
    
    conflicts = []
    
    for sched in existing_schedules:
        if exclude_id and sched['id'] == exclude_id:
            continue
        sched_start = datetime.fromisoformat(sched['start_time'])
        sched_end = datetime.fromisoformat(sched['end_time'])
        
        if new_start_dt < sched_end and new_end_dt > sched_start:
            conflicts.append(sched)
    
    return conflicts

def check_timezone_rule(start_time, timezone):
    start_dt = datetime.fromisoformat(start_time)
    hour = start_dt.hour
    rules = load_data('timezone_rules.json')
    for rule in rules:
        if rule['timezone'] == timezone:
            if not (rule['start_hour'] <= hour < rule['end_hour']):
                return False, f"时间 {hour}:00 不在 {rule['name']} ({timezone} 的工作时间 {rule['start_hour']}:00-{rule['end_hour']}:00 范围内"
    return True, ""

@app.route('/api/candidates', methods=['GET', 'POST'])
def candidates():
    if request.method == 'GET':
        return jsonify(load_data('candidates.json'))
    elif request.method == 'POST':
        data = request.json
        candidates = load_data('candidates.json')
        new_id = max([c['id'] for c in candidates], default=0) + 1
        data['id'] = new_id
        candidates.append(data)
        save_data('candidates.json', candidates)
        return jsonify(data), 201

@app.route('/api/candidates/batch', methods=['POST'])
def batch_candidates():
    items = request.json
    candidates = load_data('candidates.json')
    existing_ids = {c['id'] for c in candidates}
    max_id = max(existing_ids, default=0)
    
    results = []
    for item in items:
        max_id += 1
        item['id'] = max_id
        candidates.append(item)
        results.append(item)
    
    save_data('candidates.json', candidates)
    return jsonify({"imported": len(results), "data": results})

@app.route('/api/interviewers', methods=['GET'])
def interviewers():
    return jsonify(load_data('interviewers.json'))

@app.route('/api/rooms', methods=['GET'])
def rooms():
    return jsonify(load_data('rooms.json'))

@app.route('/api/timezone-rules', methods=['GET'])
def timezone_rules():
    return jsonify(load_data('timezone_rules.json'))

@app.route('/api/schedules', methods=['GET', 'POST', 'PUT'])
def schedules():
    if request.method == 'GET':
        return jsonify(load_data('schedules.json'))
    elif request.method == 'POST':
        data = request.json
        schedules = load_data('schedules.json')
        candidates = load_data('candidates.json')
        interviewers = load_data('interviewers.json')
        rooms = load_data('rooms.json')
        
        candidate = next((c for c in candidates if c['id'] == data['candidate_id']), None)
        if not candidate:
            return jsonify({"error": "候选人不存在"}), 400
        
        for interviewer_id in data['interviewer_ids']:
            interviewer = next((i for i in interviewers if i['id'] == interviewer_id), None)
            if not interviewer:
                return jsonify({"error": f"面试官ID {interviewer_id} 不存在"}), 400
        
        room = next((r for r in rooms if r['id'] == data['room_id']), None)
        if not room:
            return jsonify({"error": "会议室不存在"}), 400
        
        conflicts = check_time_conflict(data['start_time'], data['end_time'], schedules)
        if conflicts:
            conflict_details = []
            for c in conflicts:
                conflict_candidate = next((can for can in candidates if can['id'] == c['candidate_id']), None)
                conflict_details.append({
                    "schedule_id": c['id'],
                    "candidate_name": conflict_candidate['name'] if conflict_candidate else "未知",
                    "time": f"{c['start_time']} - {c['end_time']}"
                })
            return jsonify({"error": "时间冲突", "conflicts": conflict_details}), 409
        
        valid, msg = check_timezone_rule(data['start_time'], candidate['timezone'])
        if not valid:
            return jsonify({"error": msg}), 400
        
        new_id = max([s['id'] for s in schedules], default=0) + 1
        data['id'] = new_id
        schedules.append(data)
        save_data('schedules.json', schedules)
        return jsonify(data), 201
    
    elif request.method == 'PUT':
        data = request.json
        schedules = load_data('schedules.json')
        candidates = load_data('candidates.json')
        reschedule_records = load_data('reschedule_records.json')
        
        existing = next((s for s in schedules if s['id'] == data['id']), None)
        if not existing:
            return jsonify({"error": "排班记录不存在"}), 404
        
        candidate = next((c for c in candidates if c['id'] == data['candidate_id']), None)
        
        conflicts = check_time_conflict(data['start_time'], data['end_time'], schedules, exclude_id=data['id'])
        if conflicts:
            record = {
                "id": len(reschedule_records) + 1,
                "schedule_id": data['id'],
                "candidate_name": candidate['name'] if candidate else "未知",
                "old_start": existing['start_time'],
                "old_end": existing['end_time'],
                "new_start": data['start_time'],
                "new_end": data['end_time'],
                "status": "failed",
                "failure_reason": "时间冲突: " + ", ".join([f"与排班{c['id']}" for c in conflicts]),
                "attempt_time": datetime.now().isoformat()
            }
            reschedule_records.append(record)
            save_data('reschedule_records.json', reschedule_records)
            return jsonify({"error": "时间冲突", "conflicts": [c['id'] for c in conflicts]}), 409
        
        record = {
            "id": len(reschedule_records) + 1,
            "schedule_id": data['id'],
            "candidate_name": candidate['name'] if candidate else "未知",
            "old_start": existing['start_time'],
            "old_end": existing['end_time'],
            "new_start": data['start_time'],
            "new_end": data['end_time'],
            "status": "success",
            "attempt_time": datetime.now().isoformat()
        }
        reschedule_records.append(record)
        save_data('reschedule_records.json', reschedule_records)
        
        existing.update(data)
        save_data('schedules.json', schedules)
        return jsonify(existing)

@app.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    schedules = load_data('schedules.json')
    schedules = [s for s in schedules if s['id'] != schedule_id]
    save_data('schedules.json', schedules)
    return jsonify({"success": True})

@app.route('/api/schedules/conflicts', methods=['GET'])
def get_conflicts():
    schedules = load_data('schedules.json')
    candidates = load_data('candidates.json')
    interviewers = load_data('interviewers.json')
    rooms = load_data('rooms.json')
    
    conflicts = []
    
    for i, sched1 in enumerate(schedules):
        for sched2 in schedules[i+1:]:
            start1 = datetime.fromisoformat(sched1['start_time'])
            end1 = datetime.fromisoformat(sched1['end_time'])
            start2 = datetime.fromisoformat(sched2['start_time'])
            end2 = datetime.fromisoformat(sched2['end_time'])
            
            if start1 < end2 and start2 < end1:
                c1 = next((c for c in candidates if c['id'] == sched1['candidate_id']), None)
                c2 = next((c for c in candidates if c['id'] == sched2['candidate_id']), None)
                
                conflict_type = []
                if sched1['room_id'] == sched2['room_id']:
                    conflict_type.append("会议室冲突")
                common_interviewers = set(sched1['interviewer_ids']) & set(sched2['interviewer_ids'])
                if common_interviewers:
                        conflict_type.append("面试官冲突")
                
                if conflict_type:
                    room1 = next((r for r in rooms if r['id'] == sched1['room_id']), None)
                    conflicts.append({
                        "type": " & ".join(conflict_type),
                        "schedule1": {
                            "id": sched1['id'],
                            "candidate": c1['name'] if c1 else "未知",
                            "time": f"{sched1['start_time']} - {sched1['end_time']}",
                            "room": room1['name'] if room1 else "未知",
                            "owner": sched1.get('owner', '未知')
                        },
                        "schedule2": {
                            "id": sched2['id'],
                            "candidate": c2['name'] if c2 else "未知",
                            "time": f"{sched2['start_time']} - {sched2['end_time']}",
                            "room": room1['name'] if room1 else "未知",
                            "owner": sched2.get('owner', '未知')
                        }
                    })
    
    return jsonify(conflicts)

@app.route('/api/reschedule-records', methods=['GET'])
def reschedule_records():
    return jsonify(load_data('reschedule_records.json'))

@app.route('/api/schedules/export', methods=['GET'])
def export_schedules():
    schedules = load_data('schedules.json')
    candidates = load_data('candidates.json')
    interviewers = load_data('interviewers.json')
    rooms = load_data('rooms.json')
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['负责人', '日期', '时间段', '会议室', '候选人', '面试官', '状态'])
    
    grouped = defaultdict(list)
    for sched in schedules:
        owner = sched.get('owner', '未分配')
        grouped[owner].append(sched)
    
    for owner, owner_schedules in grouped.items():
        by_room = defaultdict(list)
        for s in owner_schedules:
            room = next((r for r in rooms if r['id'] == s['room_id']), None)
            room_name = room['name'] if room else '未知'
            by_room[room_name].append(s)
        
        for room_name, room_schedules in by_room.items():
            room_schedules.sort(key=lambda x: x['start_time'])
            
            for sched in room_schedules:
                candidate = next((c for c in candidates if c['id'] == sched['candidate_id']), None)
                candidate_name = candidate['name'] if candidate else '未知'
                interviewer_names = []
                for iid in sched['interviewer_ids']:
                    interviewer = next((i for i in interviewers if i['id'] == iid), None)
                    if interviewer:
                        interviewer_names.append(interviewer['name'])
                
                start_dt = datetime.fromisoformat(sched['start_time'])
                end_dt = datetime.fromisoformat(sched['end_time'])
                date_str = start_dt.strftime('%Y-%m-%d')
                time_str = f"{start_dt.strftime('%H:%M')}-{end_dt.strftime('%H:%M')}"
                
                writer.writerow([
                    owner,
                    date_str,
                    time_str,
                    room_name,
                    candidate_name,
                    ', '.join(interviewer_names),
                    sched.get('status', '未知')
                ])
    
    output.seek(0)
    bytes_io = BytesIO(output.getvalue().encode('utf-8-sig'))
    bytes_io.seek(0)
    
    return send_file(
        bytes_io,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'interview_schedules_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@app.route('/api/detect-issues', methods=['GET'])
def detect_issues():
    schedules = load_data('schedules.json')
    candidates = load_data('candidates.json')
    interviewers = load_data('interviewers.json')
    issues = []
    
    for sched in schedules:
        candidate = next((c for c in candidates if c['id'] == sched['candidate_id']), None)
        if candidate:
            valid, msg = check_timezone_rule(sched['start_time'], candidate['timezone'])
            if not valid:
                issues.append({
                    "type": "时区违规",
                    "schedule_id": sched['id'],
                    "candidate": candidate['name'],
                    "message": msg,
                    "severity": "warning"
                })
        
        start_dt = datetime.fromisoformat(sched['start_time'])
        end_dt = datetime.fromisoformat(sched['end_time'])
        if end_dt <= start_dt:
            issues.append({
                "type": "时间异常",
                "schedule_id": sched['id'],
                "candidate": candidate['name'] if candidate else '未知',
                "message": "结束时间早于或等于开始时间",
                "severity": "error"
            })
    
    return jsonify(issues)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
