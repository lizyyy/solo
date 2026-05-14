from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import json
import threading
import uuid
import csv
import io
from collections import defaultdict

app = Flask(__name__)
CORS(app)

lock = threading.Lock()

DATA_FILE = 'data.json'

def load_data():
    try:
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "reservations": [],
            "inventory_flow": [],
            "conflict_records": []
        }

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def init_dirty_data():
    data = load_data()
    if data["reservations"]:
        return
    
    now = datetime.now()
    
    reservations = [
        {
            "id": "RES-001",
            "order_id": "ORD-1001",
            "sku": "SKU-A001",
            "quantity": 50,
            "owner": "张三",
            "status": "reserved",
            "created_at": (now - timedelta(hours=3)).isoformat(),
            "expire_at": (now - timedelta(hours=1)).isoformat(),
            "version": 1
        },
        {
            "id": "RES-002",
            "order_id": "ORD-1002",
            "sku": "SKU-A001",
            "quantity": 30,
            "owner": "李四",
            "status": "reserved",
            "created_at": (now - timedelta(minutes=30)).isoformat(),
            "expire_at": (now + timedelta(hours=1)).isoformat(),
            "version": 1
        },
        {
            "id": "RES-003",
            "order_id": "ORD-1003",
            "sku": "SKU-B002",
            "quantity": 100,
            "owner": "张三",
            "status": "reserved",
            "created_at": (now - timedelta(hours=5)).isoformat(),
            "expire_at": (now - timedelta(hours=2)).isoformat(),
            "version": 1
        },
        {
            "id": "RES-004",
            "order_id": "ORD-1004",
            "sku": "SKU-C003",
            "quantity": 20,
            "owner": "王五",
            "status": "releasing",
            "created_at": (now - timedelta(hours=4)).isoformat(),
            "expire_at": (now - timedelta(hours=1, minutes=30)).isoformat(),
            "version": 2
        },
        {
            "id": "RES-005",
            "order_id": "ORD-1005",
            "sku": "SKU-A001",
            "quantity": 25,
            "owner": "李四",
            "status": "reserved",
            "created_at": (now - timedelta(hours=6)).isoformat(),
            "expire_at": (now - timedelta(hours=3)).isoformat(),
            "version": 1
        }
    ]
    
    inventory_flow = [
        {
            "id": "FLOW-001",
            "reservation_id": "RES-001",
            "type": "reserve",
            "quantity": 50,
            "owner": "张三",
            "created_at": (now - timedelta(hours=3)).isoformat(),
            "remark": "订单预留"
        },
        {
            "id": "FLOW-002",
            "reservation_id": "RES-002",
            "type": "reserve",
            "quantity": 30,
            "owner": "李四",
            "created_at": (now - timedelta(minutes=30)).isoformat(),
            "remark": "订单预留"
        },
        {
            "id": "FLOW-003",
            "reservation_id": "RES-003",
            "type": "reserve",
            "quantity": 100,
            "owner": "张三",
            "created_at": (now - timedelta(hours=5)).isoformat(),
            "remark": "订单预留"
        }
    ]
    
    conflict_records = [
        {
            "id": "CONF-001",
            "reservation_id": "RES-004",
            "operation": "release",
            "expected_version": 1,
            "actual_version": 2,
            "operator": "系统",
            "created_at": (now - timedelta(minutes=45)).isoformat(),
            "remark": "并发冲突：版本号不匹配"
        }
    ]
    
    data["reservations"] = reservations
    data["inventory_flow"] = inventory_flow
    data["conflict_records"] = conflict_records
    save_data(data)

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    search = request.args.get('search', '').lower()
    data = load_data()
    reservations = data["reservations"]
    
    if search:
        reservations = [
            r for r in reservations
            if search in r["id"].lower()
            or search in r["order_id"].lower()
            or search in r["sku"].lower()
            or search in r["owner"].lower()
        ]
    
    return jsonify(reservations)

@app.route('/api/reservations/<res_id>/validate', methods=['POST'])
def validate_reservation(res_id):
    with lock:
        data = load_data()
        reservation = next((r for r in data["reservations"] if r["id"] == res_id), None)
        
        if not reservation:
            return jsonify({"error": "预留单不存在"}), 404
        
        now = datetime.now().isoformat()
        is_expired = reservation["expire_at"] < now
        
        return jsonify({
            "valid": not is_expired,
            "is_expired": is_expired,
            "reservation": reservation
        })

@app.route('/api/reservations/<res_id>/release', methods=['POST'])
def release_reservation(res_id):
    with lock:
        data = load_data()
        reservation = next((r for r in data["reservations"] if r["id"] == res_id), None)
        
        if not reservation:
            return jsonify({"error": "预留单不存在"}), 404
        
        client_version = request.json.get("version") if request.is_json else None
        if client_version is not None and client_version != reservation["version"]:
            conflict = {
                "id": f"CONF-{len(data['conflict_records']) + 1:03d}",
                "reservation_id": res_id,
                "operation": "release",
                "expected_version": client_version,
                "actual_version": reservation["version"],
                "operator": request.json.get("operator", "未知") if request.is_json else "未知",
                "created_at": datetime.now().isoformat(),
                "remark": "并发冲突：版本号不匹配"
            }
            data["conflict_records"].append(conflict)
            save_data(data)
            return jsonify({
                "error": "并发冲突",
                "conflict": conflict
            }), 409
        
        if reservation["status"] not in ["reserved", "releasing"]:
            return jsonify({"error": "当前状态不允许释放"}), 400
        
        reservation["status"] = "released"
        reservation["version"] += 1
        reservation["released_at"] = datetime.now().isoformat()
        
        flow = {
            "id": f"FLOW-{len(data['inventory_flow']) + 1:03d}",
            "reservation_id": res_id,
            "type": "timeout_release",
            "quantity": reservation["quantity"],
            "owner": reservation["owner"],
            "created_at": datetime.now().isoformat(),
            "remark": "超时释放"
        }
        data["inventory_flow"].append(flow)
        save_data(data)
        
        return jsonify({
            "success": True,
            "reservation": reservation,
            "flow": flow
        })

@app.route('/api/reservations/<res_id>/cancel', methods=['POST'])
def cancel_reservation(res_id):
    with lock:
        data = load_data()
        reservation = next((r for r in data["reservations"] if r["id"] == res_id), None)
        
        if not reservation:
            return jsonify({"error": "预留单不存在"}), 404
        
        if reservation["status"] == "released":
            return jsonify({"error": "已释放的预留单无法取消回滚"}), 400
        
        reason = request.json.get("reason", "") if request.is_json else ""
        
        reservation["status"] = "cancelled"
        reservation["version"] += 1
        reservation["cancelled_at"] = datetime.now().isoformat()
        reservation["cancel_reason"] = reason
        
        flow = {
            "id": f"FLOW-{len(data['inventory_flow']) + 1:03d}",
            "reservation_id": res_id,
            "type": "cancel_rollback",
            "quantity": reservation["quantity"],
            "owner": reservation["owner"],
            "created_at": datetime.now().isoformat(),
            "remark": f"取消回滚: {reason}"
        }
        data["inventory_flow"].append(flow)
        save_data(data)
        
        return jsonify({
            "success": True,
            "reservation": reservation,
            "flow": flow
        })

@app.route('/api/inventory-flow', methods=['GET'])
def get_inventory_flow():
    data = load_data()
    return jsonify(data["inventory_flow"])

@app.route('/api/conflicts', methods=['GET'])
def get_conflicts():
    data = load_data()
    return jsonify(data["conflict_records"])

@app.route('/api/export/inventory-flow', methods=['GET'])
def export_inventory_flow():
    data = load_data()
    flow_records = data["inventory_flow"]
    
    grouped = defaultdict(lambda: defaultdict(list))
    for record in flow_records:
        owner = record["owner"]
        is_timeout = record["type"] == "timeout_release"
        grouped[owner][is_timeout].append(record)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["负责人", "释放类型", "流水ID", "预留单ID", "操作类型", "数量", "操作时间", "备注"])
    
    for owner in sorted(grouped.keys()):
        for is_timeout in [True, False]:
            records = grouped[owner][is_timeout]
            release_type = "超时释放" if is_timeout else "其他操作"
            
            for record in sorted(records, key=lambda x: x["created_at"], reverse=True):
                writer.writerow([
                    owner,
                    release_type,
                    record["id"],
                    record["reservation_id"],
                    record["type"],
                    record["quantity"],
                    record["created_at"],
                    record["remark"]
                ])
    
    output.seek(0)
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8-sig'))
    mem.seek(0)
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'库存流水_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )

@app.route('/api/stats', methods=['GET'])
def get_stats():
    data = load_data()
    reservations = data["reservations"]
    now = datetime.now().isoformat()
    
    stats = {
        "total": len(reservations),
        "reserved": len([r for r in reservations if r["status"] == "reserved"]),
        "released": len([r for r in reservations if r["status"] == "released"]),
        "cancelled": len([r for r in reservations if r["status"] == "cancelled"]),
        "expired": len([r for r in reservations if r["expire_at"] < now and r["status"] == "reserved"]),
        "conflicts": len(data["conflict_records"])
    }
    
    return jsonify(stats)

if __name__ == '__main__':
    init_dirty_data()
    app.run(debug=True, port=5000)
