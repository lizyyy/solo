from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from database import db, RouteStatus, AuthStrategy
import json

app = Flask(__name__)
CORS(app)

def serialize_route(route):
    return {
        "id": route.id,
        "name": route.name,
        "path": route.path,
        "upstream_url": route.upstream_url,
        "methods": route.methods,
        "auth_strategy": route.auth_strategy.value,
        "gray_scale_percent": route.gray_scale_percent,
        "status": route.status.value,
        "raw_input": route.raw_input,
        "processed_result": route.processed_result,
        "version": route.version,
        "created_at": route.created_at.isoformat(),
        "updated_at": route.updated_at.isoformat(),
        "created_by": route.created_by,
        "error_message": route.error_message,
        "previous_version_id": route.previous_version_id
    }

def serialize_log(log):
    return {
        "id": log.id,
        "route_id": log.route_id,
        "timestamp": log.timestamp.isoformat(),
        "level": log.level,
        "message": log.message,
        "details": log.details,
        "request_id": log.request_id
    }

@app.route('/api/routes', methods=['GET'])
def get_routes():
    routes = list(db.routes.values())
    return jsonify([serialize_route(r) for r in routes])

@app.route('/api/routes/<route_id>', methods=['GET'])
def get_route(route_id):
    if route_id not in db.routes:
        return jsonify({"error": "路由不存在"}), 404
    return jsonify(serialize_route(db.routes[route_id]))

@app.route('/api/routes', methods=['POST'])
def create_route():
    data = request.get_json()
    raw_input = data.copy()
    
    if not data.get('name') or not data.get('path') or not data.get('upstream_url'):
        return jsonify({"error": "缺少必填字段: name, path, upstream_url"}), 400
    
    route = db.create_route(data, raw_input, "admin")
    return jsonify(serialize_route(route)), 201

@app.route('/api/routes/<route_id>', methods=['PUT'])
def update_route(route_id):
    if route_id not in db.routes:
        return jsonify({"error": "路由不存在"}), 404
    
    data = request.get_json()
    raw_input = data.copy()
    
    route = db.update_route(route_id, data, raw_input)
    return jsonify(serialize_route(route))

@app.route('/api/routes/<route_id>/publish', methods=['POST'])
def publish_route(route_id):
    idempotency_key = request.headers.get('X-Idempotency-Key')
    if not idempotency_key:
        return jsonify({"error": "缺少 X-Idempotency-Key 头"}), 400
    
    if route_id not in db.routes:
        return jsonify({"error": "路由不存在"}), 404
    
    try:
        route = db.publish_route(route_id, idempotency_key)
        return jsonify(serialize_route(route))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/routes/<route_id>/rollback', methods=['POST'])
def rollback_route(route_id):
    idempotency_key = request.headers.get('X-Idempotency-Key')
    if not idempotency_key:
        return jsonify({"error": "缺少 X-Idempotency-Key 头"}), 400
    
    if route_id not in db.routes:
        return jsonify({"error": "路由不存在"}), 404
    
    try:
        route = db.rollback_route(route_id, idempotency_key)
        return jsonify(serialize_route(route))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/routes/<route_id>/logs', methods=['GET'])
def get_route_logs(route_id):
    logs = db.get_logs_by_route(route_id)
    return jsonify([serialize_log(log) for log in logs])

@app.route('/api/logs', methods=['GET'])
def get_all_logs():
    logs = db.get_all_logs()
    return jsonify([serialize_log(log) for log in logs])

@app.route('/api/routes/batch-import', methods=['POST'])
def batch_import_routes():
    data = request.get_json()
    routes_data = data.get('routes', [])
    results = []
    
    for route_data in routes_data:
        raw_input = route_data.copy()
        try:
            route = db.create_route(route_data, raw_input, "admin")
            results.append({
                "success": True,
                "route": serialize_route(route)
            })
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e),
                "raw_input": raw_input
            })
    
    return jsonify({
        "total": len(routes_data),
        "success_count": sum(1 for r in results if r["success"]),
        "failed_count": sum(1 for r in results if not r["success"]),
        "results": results
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

def load_sample_data():
    sample_routes = [
        {
            "name": "用户服务 API",
            "path": "/api/users",
            "upstream_url": "http://user-service:8080",
            "methods": ["GET", "POST", "PUT", "DELETE"],
            "auth_strategy": "jwt",
            "gray_scale_percent": 50
        },
        {
            "name": "订单服务 API",
            "path": "/api/orders",
            "upstream_url": "http://order-service:8080",
            "methods": ["GET", "POST"],
            "auth_strategy": "api_key",
            "gray_scale_percent": 100
        },
        {
            "name": "脏数据测试 - 无效URL",
            "path": "api/bad-url",
            "upstream_url": "invalid-url",
            "methods": ["GET"],
            "auth_strategy": "none",
            "gray_scale_percent": 150
        },
        {
            "name": "灰度流量拦截测试",
            "path": "/api/gray-test",
            "upstream_url": "http://gray-service:8080",
            "methods": ["GET"],
            "auth_strategy": "none",
            "gray_scale_percent": 30
        }
    ]
    
    for i, route_data in enumerate(sample_routes):
        route = db.create_route(route_data, route_data.copy(), "admin")
        if i == 0:
            db.publish_route(route.id, f"sample-publish-{i}")
        elif i == 2:
            try:
                db.publish_route(route.id, f"sample-publish-{i}")
            except:
                pass
    
    db.add_log("sample-gray-test", "WARN", "灰度流量被拦截 - 超过流量阈值", {
        "route_id": "gray-route-1",
        "action": "gray_scale_block",
        "blocked_requests": 150,
        "threshold": 100,
        "timestamp": datetime.now().isoformat()
    })
    
    db.add_log("sample-gray-test", "INFO", "回滚版本介入 - 流量恢复正常", {
        "route_id": "gray-route-1",
        "action": "rollback_intervention",
        "restored_requests": 150,
        "previous_version": 1,
        "current_version": 2,
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    load_sample_data()
    app.run(debug=True, host='0.0.0.0', port=5000)