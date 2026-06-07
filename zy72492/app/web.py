from flask import Flask, jsonify, request, render_template
from . import service
from .store import store
from .models import Status
from .demo_data import init_demo_data


def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')

    @app.route('/')
    def index():
        return render_template('dashboard.html')

    @app.route('/api/init-demo', methods=['POST'])
    def api_init_demo():
        init_demo_data()
        return jsonify({"success": True, "message": "演示数据初始化完成"})

    @app.route('/api/orders', methods=['GET'])
    def api_list_orders():
        orders = [o.model_dump() for o in store.orders.values()]
        return jsonify(orders)

    @app.route('/api/orders/<order_id>', methods=['GET'])
    def api_order_detail(order_id):
        detail = service.get_order_detail(order_id)
        return jsonify(detail)

    @app.route('/api/orders', methods=['POST'])
    def api_import_notice():
        data = request.json
        order, heatmap = service.import_construction_notice(
            point_id=data['point_id'],
            title=data['title'],
            description=data['description'],
            operator=data.get('operator', '系统导入')
        )
        return jsonify({
            "success": True,
            "order": order.model_dump(),
            "heatmap_version": heatmap.version
        })

    @app.route('/api/orders/<order_id>/supplement-ramp', methods=['POST'])
    def api_supplement_ramp(order_id):
        data = request.json
        order, heatmap = service.supplement_ramp_record(
            order_id=order_id,
            ramp_description=data['ramp_description'],
            operator=data.get('operator', '市政巡检员小付'),
            is_night=data.get('is_night', False)
        )
        return jsonify({
            "success": True,
            "order": order.model_dump(),
            "heatmap_version": heatmap.version
        })

    @app.route('/api/orders/<order_id>/correct', methods=['POST'])
    def api_correct(order_id):
        data = request.json
        new_status = Status(data.get('status', Status.NORMAL.value))
        order, heatmap = service.manual_correct(
            order_id=order_id,
            new_status=new_status,
            new_reason=data.get('new_reason', f"人工修正: {data.get('correction_note', '')}"),
            operator=data.get('operator', '市政巡检员小付'),
            correction_note=data.get('correction_note', '')
        )
        return jsonify({
            "success": True,
            "order": order.model_dump(),
            "heatmap_version": heatmap.version
        })

    @app.route('/api/orders/<order_id>/review', methods=['POST'])
    def api_review(order_id):
        data = request.json
        order, heatmap = service.review_order(
            order_id=order_id,
            approved=data['approved'],
            reviewer=data.get('reviewer', '街道规划员'),
            review_note=data['review_note']
        )
        return jsonify({
            "success": True,
            "order": order.model_dump(),
            "heatmap_version": heatmap.version
        })

    @app.route('/api/heatmap', methods=['GET'])
    def api_heatmap():
        latest = store.get_latest_heatmap()
        if not latest:
            return jsonify({"cells": [], "version": 0})
        result = latest.model_dump()
        for cell in result['cells']:
            point = store.points.get(cell['point_id'])
            if point:
                cell['point_name'] = point.name
                cell['lat'] = point.lat
                cell['lng'] = point.lng
                cell['district'] = point.district
        return jsonify(result)

    @app.route('/api/heatmap/rerun', methods=['POST'])
    def api_rerun_heatmap():
        data = request.json or {}
        heatmap = service.generate_heatmap(
            operator=data.get('operator', '系统'),
            reason=data.get('reason', '手动重跑')
        )
        return jsonify({
            "success": True,
            "version": heatmap.version,
            "notes": heatmap.notes
        })

    @app.route('/api/points', methods=['GET'])
    def api_list_points():
        points = [p.model_dump() for p in store.points.values()]
        return jsonify(points)

    @app.route('/api/audit-logs', methods=['GET'])
    def api_audit_logs():
        order_id = request.args.get('order_id')
        if order_id:
            logs = store.get_audit_by_order(order_id)
        else:
            logs = store.audit_logs
        return jsonify([l.model_dump() for l in sorted(logs, key=lambda x: x.timestamp, reverse=True)])

    return app
