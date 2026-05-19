from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
import uuid
import json
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app)

sessions: Dict[str, dict] = {}
collaboration_logs: List[dict] = []
lock_states: Dict[str, dict] = {}

def generate_id():
    return str(uuid.uuid4())[:8]

def get_timestamp():
    return datetime.now().isoformat()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": get_timestamp()})

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    return jsonify(list(sessions.values()))

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json
    session_id = generate_id()
    session = {
        "id": session_id,
        "title": data.get("title", "Untitled Document"),
        "content": data.get("content", ""),
        "original_content": data.get("content", ""),
        "created_at": get_timestamp(),
        "updated_at": get_timestamp(),
        "version": 1,
        "status": "active",
        "collaborators": data.get("collaborators", []),
        "conflicts": [],
        "merge_history": []
    }
    sessions[session_id] = session
    add_collaboration_log(session_id, "session_created", f"文档会话创建: {session['title']}")
    return jsonify(session), 201

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(sessions[session_id])

@app.route('/api/sessions/<session_id>/lock', methods=['POST'])
def acquire_lock(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    user_id = data.get("user_id")
    segment = data.get("segment", "full")
    
    current_lock = lock_states.get(session_id, {})
    
    if current_lock and current_lock.get("user_id") != user_id:
        add_collaboration_log(session_id, "lock_conflict", 
            f"用户 {user_id} 尝试获取锁失败，被用户 {current_lock.get('user_id')} 持有")
        return jsonify({
            "acquired": False,
            "lock_holder": current_lock.get("user_id"),
            "locked_at": current_lock.get("locked_at")
        }), 409
    
    lock_states[session_id] = {
        "user_id": user_id,
        "segment": segment,
        "locked_at": get_timestamp()
    }
    
    sessions[session_id]["updated_at"] = get_timestamp()
    add_collaboration_log(session_id, "lock_acquired", f"用户 {user_id} 获取编辑锁")
    return jsonify({"acquired": True, "lock": lock_states[session_id]})

@app.route('/api/sessions/<session_id>/lock', methods=['DELETE'])
def release_lock(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    user_id = data.get("user_id")
    
    current_lock = lock_states.get(session_id)
    if not current_lock:
        return jsonify({"released": True, "message": "No lock held"})
    
    if current_lock.get("user_id") != user_id:
        return jsonify({"error": "Not the lock holder"}), 403
    
    del lock_states[session_id]
    sessions[session_id]["updated_at"] = get_timestamp()
    add_collaboration_log(session_id, "lock_released", f"用户 {user_id} 释放编辑锁")
    return jsonify({"released": True})

@app.route('/api/sessions/<session_id>/lock-status', methods=['GET'])
def get_lock_status(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(lock_states.get(session_id, {"locked": False}))

@app.route('/api/sessions/<session_id>/update', methods=['POST'])
def update_content(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    user_id = data.get("user_id")
    new_content = data.get("content")
    client_version = data.get("version")
    
    current_lock = lock_states.get(session_id)
    if not current_lock or current_lock.get("user_id") != user_id:
        add_collaboration_log(session_id, "update_rejected", 
            f"用户 {user_id} 无锁更新被拒绝")
        return jsonify({"error": "Lock required"}), 403
    
    session = sessions[session_id]
    
    if client_version != session["version"]:
        conflict = {
            "id": generate_id(),
            "type": "version_conflict",
            "client_version": client_version,
            "server_version": session["version"],
            "client_content": new_content,
            "server_content": session["content"],
            "detected_at": get_timestamp(),
            "resolved": False
        }
        session["conflicts"].append(conflict)
        add_collaboration_log(session_id, "conflict_detected", 
            f"版本冲突: 客户端 v{client_version} vs 服务器 v{session['version']}")
        return jsonify({
            "error": "Version conflict",
            "conflict": conflict
        }), 409
    
    session["content"] = new_content
    session["version"] += 1
    session["updated_at"] = get_timestamp()
    
    add_collaboration_log(session_id, "content_updated", 
        f"用户 {user_id} 更新内容，版本 v{session['version']}")
    
    return jsonify({
        "success": True,
        "new_version": session["version"],
        "content": session["content"]
    })

def add_collaboration_log(session_id: str, action: str, message: str, metadata: dict = None):
    log_entry = {
        "id": generate_id(),
        "session_id": session_id,
        "action": action,
        "message": message,
        "timestamp": get_timestamp(),
        "metadata": metadata or {}
    }
    collaboration_logs.append(log_entry)
    return log_entry

@app.route('/api/collaboration-logs', methods=['GET'])
def get_collaboration_logs():
    session_id = request.args.get('session_id')
    if session_id:
        filtered = [log for log in collaboration_logs if log["session_id"] == session_id]
        return jsonify(filtered)
    return jsonify(collaboration_logs)

@app.route('/api/sessions/<session_id>/offline-merge', methods=['POST'])
def offline_merge(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    user_id = data.get("user_id")
    offline_content = data.get("offline_content")
    offline_duration = data.get("offline_duration", 0)
    is_dirty = data.get("is_dirty", False)
    
    session = sessions[session_id]
    
    if is_dirty:
        add_collaboration_log(session_id, "offline_merge_blocked", 
            f"用户 {user_id} 的脏数据离线合并被拦截", 
            {"offline_duration": offline_duration})
        return jsonify({
            "merged": False,
            "reason": "dirty_data",
            "message": "检测到脏数据，合并被拦截。请使用版本回放功能解决冲突。",
            "original_input": offline_content,
            "current_server_content": session["content"]
        }), 422
    
    if offline_duration > 3600:
        conflict = {
            "id": generate_id(),
            "type": "long_offline_conflict",
            "offline_duration": offline_duration,
            "offline_content": offline_content,
            "server_content": session["content"],
            "detected_at": get_timestamp(),
            "resolved": False
        }
        session["conflicts"].append(conflict)
        add_collaboration_log(session_id, "long_offline_conflict", 
            f"用户 {user_id} 长时间离线（{offline_duration}秒）合并产生冲突")
        return jsonify({
            "merged": False,
            "reason": "long_offline",
            "conflict": conflict,
            "message": "离线时间过长，需要手动合并"
        }), 409
    
    session["merge_history"].append({
        "user_id": user_id,
        "offline_duration": offline_duration,
        "merged_at": get_timestamp()
    })
    session["content"] = offline_content
    session["version"] += 1
    session["updated_at"] = get_timestamp()
    
    add_collaboration_log(session_id, "offline_merge_success", 
        f"用户 {user_id} 离线内容合并成功", 
        {"offline_duration": offline_duration})
    
    return jsonify({
        "merged": True,
        "new_version": session["version"],
        "content": session["content"]
    })

@app.route('/api/sessions/<session_id>/resolve-conflict', methods=['POST'])
def resolve_conflict(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    conflict_id = data.get("conflict_id")
    resolution = data.get("resolution")
    resolved_content = data.get("resolved_content")
    
    session = sessions[session_id]
    
    for conflict in session["conflicts"]:
        if conflict["id"] == conflict_id:
            conflict["resolved"] = True
            conflict["resolution"] = resolution
            conflict["resolved_at"] = get_timestamp()
            
            if resolution == "use_server":
                final_content = conflict.get("server_content") or conflict.get("server_content_at_time") or session["original_content"]
            elif resolution == "use_client":
                final_content = conflict.get("client_content") or conflict.get("original_dirty_input") or session["content"]
            else:
                final_content = resolved_content or session["content"]
            
            session["content"] = final_content
            session["version"] += 1
            session["updated_at"] = get_timestamp()
            
            add_collaboration_log(session_id, "conflict_resolved", 
                f"冲突 {conflict_id} 已解决，方式: {resolution}",
                {"final_content": final_content})
            
            return jsonify({"success": True, "session": session})
    
    return jsonify({"error": "Conflict not found"}), 404

@app.route('/api/sessions/<session_id>/version-replay', methods=['POST'])
def version_replay(session_id):
    if session_id not in sessions:
        return jsonify({"error": "Session not found"}), 404
    
    data = request.json
    target_version = data.get("target_version")
    replay_content = data.get("replay_content")
    
    session = sessions[session_id]
    
    old_version = session["version"]
    old_content = session["content"]
    
    if target_version is None:
        target_version = max(1, old_version - 1)
    else:
        target_version = max(1, int(target_version))
    
    if replay_content is None:
        replay_content = session["original_content"]
    
    for conflict in session["conflicts"]:
        if not conflict["resolved"]:
            conflict["resolved"] = True
            conflict["resolution"] = "version_replay"
            conflict["resolved_at"] = get_timestamp()
    
    session["content"] = replay_content
    session["version"] = target_version
    session["updated_at"] = get_timestamp()
    
    add_collaboration_log(session_id, "version_replay", 
        f"版本回放: 从 v{old_version} 回放到 v{target_version}", 
        {"old_content": old_content, "new_content": replay_content, "conflicts_resolved": True})
    
    return jsonify({
        "success": True,
        "old_version": old_version,
        "new_version": target_version,
        "diff": {
            "old": old_content,
            "new": replay_content
        },
        "conflicts_resolved": True
    })

@app.route('/api/init-sample-data', methods=['POST'])
def init_sample_data():
    sessions.clear()
    collaboration_logs.clear()
    lock_states.clear()
    
    sample_sessions = [
        {
            "title": "项目需求文档",
            "content": "这是一份正常的项目需求文档。\n包含功能列表、技术栈、时间表等内容。",
            "collaborators": ["alice", "bob"]
        },
        {
            "title": "技术架构设计",
            "content": "系统架构设计文档\n- 前端: React\n- 后端: Python Flask\n- 数据库: SQLite",
            "collaborators": ["charlie"]
        },
        {
            "title": "脏数据测试文档",
            "content": "【服务器版本】\n\n第一章 引言\n这是一份经过审核的正式文档。\n\n第二章 架构设计\n采用微服务架构，包含三个核心模块。\n\n第三章 数据规范\n所有字段必须经过校验，禁止非法字符。",
            "original_content": "【原始版本】\n\n文档初稿，待审核。",
            "collaborators": ["dave", "eve"]
        }
    ]
    
    created_sessions = []
    for sess_data in sample_sessions:
        session_id = generate_id()
        session = {
            "id": session_id,
            "title": sess_data["title"],
            "content": sess_data["content"],
            "original_content": sess_data.get("original_content", sess_data["content"]),
            "created_at": get_timestamp(),
            "updated_at": get_timestamp(),
            "version": 2,
            "status": "active",
            "collaborators": sess_data["collaborators"],
            "conflicts": [],
            "merge_history": []
        }
        sessions[session_id] = session
        created_sessions.append(session)
        add_collaboration_log(session_id, "session_created", f"初始化会话: {session['title']}")
    
    dirty_session_id = created_sessions[2]["id"]
    server_content = sessions[dirty_session_id]["content"]
    client_dirty_content = """【客户端离线脏数据版本】

第一章 引言
这是一份包含非法字符的离线文档。

第二章 恶意内容
这里包含未授权的修改内容\x00以及控制字符。

第三章 数据污染
用户试图绕过校验，直接合并脏数据。"""
    
    sessions[dirty_session_id]["conflicts"].append({
        "id": generate_id(),
        "type": "dirty_data_conflict",
        "description": "脏数据离线合并被拦截的演示冲突 - 用户试图提交包含非法字符的离线内容",
        "detected_at": get_timestamp(),
        "resolved": False,
        "server_content": server_content,
        "client_content": client_dirty_content,
        "server_content_at_time": server_content,
        "original_dirty_input": client_dirty_content,
        "offline_duration": 7200,
        "user_id": "hacker_user"
    })
    
    add_collaboration_log(dirty_session_id, "offline_merge_blocked", 
        "初始化的脏数据合并拦截演示 - 用户离线2小时后提交脏数据",
        {"is_dirty": True, "offline_duration": 7200, "user_id": "hacker_user"})
    
    return jsonify({
        "message": "Sample data initialized",
        "sessions_created": len(created_sessions),
        "sessions": created_sessions
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
