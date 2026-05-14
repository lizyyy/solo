from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return get_initial_data()

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_initial_data():
    return {
        "departments": [
            {"id": "d1", "name": "总公司", "parentId": None, "level": 1},
            {"id": "d2", "name": "技术部", "parentId": "d1", "level": 2},
            {"id": "d3", "name": "市场部", "parentId": "d1", "level": 2},
            {"id": "d4", "name": "前端组", "parentId": "d2", "level": 3},
            {"id": "d5", "name": "后端组", "parentId": "d2", "level": 3},
            {"id": "d6", "name": "销售组", "parentId": "d3", "level": 3}
        ],
        "roles": [
            {"id": "r1", "name": "系统管理员", "permissions": ["user:read", "user:write", "dept:read", "dept:write", "role:read", "role:write"]},
            {"id": "r2", "name": "部门经理", "permissions": ["user:read", "dept:read"]},
            {"id": "r3", "name": "普通员工", "permissions": ["user:read"]},
            {"id": "r4", "name": "临时访客", "permissions": ["user:read"]}
        ],
        "bindings": [
            {"id": "b1", "deptId": "d1", "roleId": "r1", "userId": "u1", "userName": "张三", "isInherited": True, "createdAt": "2024-01-01T00:00:00"},
            {"id": "b2", "deptId": "d2", "roleId": "r2", "userId": "u2", "userName": "李四", "isInherited": True, "createdAt": "2024-01-02T00:00:00"},
            {"id": "b3", "deptId": "d4", "roleId": "r3", "userId": "u3", "userName": "王五", "isInherited": True, "createdAt": "2024-01-03T00:00:00"},
            {"id": "b4", "deptId": "d4", "roleId": "r4", "userId": "u4", "userName": "赵六", "isInherited": False, "createdAt": "2024-01-04T00:00:00", "expiresAt": "2024-01-10T00:00:00"}
        ],
        "timeline": [],
        "snapshots": []
    }

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/departments', methods=['GET'])
def get_departments():
    data = load_data()
    return jsonify(data['departments'])

@app.route('/api/roles', methods=['GET'])
def get_roles():
    data = load_data()
    return jsonify(data['roles'])

@app.route('/api/bindings', methods=['GET'])
def get_bindings():
    data = load_data()
    return jsonify(data['bindings'])

@app.route('/api/bindings', methods=['POST'])
def add_binding():
    data = load_data()
    binding = request.json
    binding['id'] = f"b{len(data['bindings']) + 1}"
    binding['createdAt'] = datetime.now().isoformat()
    data['bindings'].append(binding)
    save_data(data)
    return jsonify(binding), 201

@app.route('/api/bindings/<binding_id>', methods=['DELETE'])
def delete_binding(binding_id):
    data = load_data()
    data['bindings'] = [b for b in data['bindings'] if b['id'] != binding_id]
    save_data(data)
    return jsonify({"success": True})

@app.route('/api/inheritance', methods=['GET'])
def get_inheritance():
    data = load_data()
    result = calculate_inheritance(data)
    return jsonify(result)

def calculate_inheritance(data):
    dept_map = {d['id']: d for d in data['departments']}
    role_map = {r['id']: r for r in data['roles']}
    
    inheritance_result = []
    conflicts = []
    
    for dept in data['departments']:
        dept_permissions = set()
        inherited_from = []
        
        current_dept = dept
        while current_dept:
            bindings = [b for b in data['bindings'] if b['deptId'] == current_dept['id']]
            for binding in bindings:
                role = role_map.get(binding['roleId'])
                if role:
                    for perm in role['permissions']:
                        if perm in dept_permissions and binding['isInherited']:
                            conflicts.append({
                                "deptId": dept['id'],
                                "deptName": dept['name'],
                                "permission": perm,
                                "fromDept": current_dept['name'],
                                "bindingId": binding['id'],
                                "userName": binding['userName']
                            })
                        dept_permissions.add(perm)
                    if binding['isInherited'] and current_dept['id'] != dept['id']:
                        inherited_from.append({
                            "fromDept": current_dept['name'],
                            "roleName": role['name'],
                            "userName": binding['userName']
                        })
            
            current_dept = dept_map.get(current_dept['parentId']) if current_dept['parentId'] else None
        
        inheritance_result.append({
            "deptId": dept['id'],
            "deptName": dept['name'],
            "permissions": list(dept_permissions),
            "inheritedFrom": inherited_from
        })
    
    return {"inheritance": inheritance_result, "conflicts": conflicts}

@app.route('/api/timeline', methods=['GET'])
def get_timeline():
    data = load_data()
    return jsonify(data['timeline'])

@app.route('/api/timeline', methods=['POST'])
def add_timeline():
    data = load_data()
    event = request.json
    event['id'] = f"t{len(data['timeline']) + 1}"
    event['createdAt'] = datetime.now().isoformat()
    data['timeline'].append(event)
    save_data(data)
    return jsonify(event), 201

@app.route('/api/snapshots', methods=['GET'])
def get_snapshots():
    data = load_data()
    return jsonify(data['snapshots'])

@app.route('/api/snapshots', methods=['POST'])
def create_snapshot():
    data = load_data()
    snapshot = {
        "id": f"s{len(data['snapshots']) + 1}",
        "createdAt": datetime.now().isoformat(),
        "inheritance": calculate_inheritance(data),
        "bindings": data['bindings'].copy()
    }
    data['snapshots'].append(snapshot)
    save_data(data)
    return jsonify(snapshot), 201

@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    inheritance_data = calculate_inheritance(data)
    
    total_permissions = sum(len(r['permissions']) for r in data['roles'])
    total_bindings = len(data['bindings'])
    total_conflicts = len(inheritance_data['conflicts'])
    total_inherited = sum(1 for b in data['bindings'] if b['isInherited'])
    
    return jsonify({
        "totalPermissions": total_permissions,
        "totalBindings": total_bindings,
        "totalConflicts": total_conflicts,
        "totalInherited": total_inherited
    })

@app.route('/api/reset', methods=['POST'])
def reset_data():
    data = get_initial_data()
    save_data(data)
    return jsonify({"success": True})

@app.route('/api/prepare-dirty-data', methods=['POST'])
def prepare_dirty_data():
    data = get_initial_data()
    
    data['bindings'].extend([
        {"id": "b5", "deptId": "d5", "roleId": "r2", "userId": "u5", "userName": "孙七", "isInherited": True, "createdAt": "2024-01-05T00:00:00"},
        {"id": "b6", "deptId": "d5", "roleId": "r3", "userId": "u3", "userName": "王五", "isInherited": False, "createdAt": "2024-01-06T00:00:00", "note": "临时授权-冲突"},
        {"id": "b7", "deptId": "d6", "roleId": "r4", "userId": "u6", "userName": "周八", "isInherited": False, "createdAt": "2024-01-07T00:00:00", "expiresAt": "2024-01-08T00:00:00", "note": "已过期-临时授权失败"}
    ])
    
    data['timeline'].extend([
        {"id": "t1", "type": "binding_add", "message": "为孙七添加后端组部门经理角色", "createdAt": "2024-01-05T00:00:00"},
        {"id": "t2", "type": "conflict", "message": "王五在后端组存在权限冲突：user:read重复", "createdAt": "2024-01-06T00:00:00", "resolution": None},
        {"id": "t3", "type": "expired", "message": "周八的临时授权已过期，授权失败", "createdAt": "2024-01-08T00:00:00", "resolution": None}
    ])
    
    save_data(data)
    return jsonify({"success": True})

@app.route('/api/fix-temp-auth', methods=['POST'])
def fix_temp_auth():
    data = load_data()
    
    for event in data['timeline']:
        if event['type'] == 'expired' and not event.get('resolution'):
            event['resolution'] = "已重新授权，延长有效期至2024-02-08"
    
    for binding in data['bindings']:
        if binding.get('note') and '已过期' in binding['note']:
            binding['expiresAt'] = "2024-02-08T00:00:00"
            binding['note'] = "修正后的临时授权"
    
    data['timeline'].append({
        "id": f"t{len(data['timeline']) + 1}",
        "type": "fix",
        "message": "修正周八的临时授权失败问题，重新授权并延长有效期",
        "createdAt": datetime.now().isoformat(),
        "reason": "业务需要，临时授权延期一个月",
        "conflictReason": "原授权时间设置过短，未考虑实际使用周期"
    })
    
    save_data(data)
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
