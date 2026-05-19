import json
import csv
from io import StringIO
from datetime import datetime
from flask import request, jsonify, Response
from decimal import Decimal
from app.models import db, UnifiedOrder, PlatformOrder, CallbackPayload, ExceptionReceipt, MergeRule, SearchIndex
from app.services import OrderMergeService

def order_to_dict(order):
    return {
        'id': order.id,
        'unified_order_no': order.unified_order_no,
        'status': order.status,
        'amount': float(order.amount) if order.amount else None,
        'currency': order.currency,
        'customer_info': order.customer_info,
        'items': order.items,
        'merged_data': order.merged_data,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
        'platform_orders': [{
            'id': po.id,
            'platform': po.platform,
            'platform_order_id': po.platform_order_id,
            'created_at': po.created_at.isoformat() if po.created_at else None
        } for po in order.platform_orders]
    }

def register_routes(app):

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

    @app.route('/api/callbacks', methods=['POST'])
    def create_callback():
        data = request.get_json()
        required_fields = ['platform', 'platform_order_id', 'event_type', 'event_id', 'payload']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        try:
            result = OrderMergeService.process_callback(
                platform=data['platform'],
                platform_order_id=data['platform_order_id'],
                event_type=data['event_type'],
                event_id=data['event_id'],
                payload=data['payload']
            )
            return jsonify(result), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/orders', methods=['GET'])
    def list_orders():
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        platform = request.args.get('platform')
        search = request.args.get('search')
        
        query = UnifiedOrder.query
        
        if status:
            query = query.filter_by(status=status)
        
        if platform:
            query = query.join(PlatformOrder).filter(PlatformOrder.platform == platform)
        
        if search:
            search = f'%{search}%'
            subquery = db.session.query(SearchIndex.unified_order_id).filter(
                SearchIndex.search_value.like(search)
            ).distinct()
            query = query.filter(UnifiedOrder.id.in_(subquery))
        
        query = query.order_by(UnifiedOrder.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'orders': [order_to_dict(o) for o in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })

    @app.route('/api/orders/<int:order_id>', methods=['GET'])
    def get_order(order_id):
        order = UnifiedOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        result = order_to_dict(order)
        
        callbacks = CallbackPayload.query.join(PlatformOrder).filter(
            PlatformOrder.unified_order_id == order_id
        ).order_by(CallbackPayload.received_at.desc()).all()
        
        result['callbacks'] = [{
            'id': c.id,
            'event_type': c.event_type,
            'event_id': c.event_id,
            'payload': c.payload,
            'normalized_data': c.normalized_data,
            'received_at': c.received_at.isoformat() if c.received_at else None,
            'is_duplicate': c.is_duplicate
        } for c in callbacks]
        
        result['exceptions'] = [{
            'id': e.id,
            'exception_type': e.exception_type,
            'severity': e.severity,
            'message': e.message,
            'status': e.status,
            'created_at': e.created_at.isoformat() if e.created_at else None
        } for e in order.exceptions]
        
        return jsonify(result)

    @app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
    def update_order_status(order_id):
        data = request.get_json()
        new_status = data.get('status')
        operator = data.get('operator', 'system')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
        
        order = OrderMergeService.advance_status(order_id, new_status, operator)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        return jsonify(order_to_dict(order))

    @app.route('/api/orders/export', methods=['GET'])
    def export_orders():
        format_type = request.args.get('format', 'json')
        status = request.args.get('status')
        platform = request.args.get('platform')
        
        query = UnifiedOrder.query
        
        if status:
            query = query.filter_by(status=status)
        
        if platform:
            query = query.join(PlatformOrder).filter(PlatformOrder.platform == platform)
        
        orders = query.order_by(UnifiedOrder.created_at.desc()).all()
        order_dicts = [order_to_dict(o) for o in orders]
        
        if format_type == 'csv':
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow(['统一订单号', '状态', '金额', '客户', '创建时间', '更新时间'])
            
            for o in order_dicts:
                customer = o['customer_info'].get('name', '') if o['customer_info'] else ''
                writer.writerow([
                    o['unified_order_no'],
                    o['status'],
                    o['amount'] or '',
                    customer,
                    o['created_at'],
                    o['updated_at']
                ])
            
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=orders.csv'}
            )
        
        return jsonify(order_dicts)

    @app.route('/api/exceptions', methods=['GET'])
    def list_exceptions():
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', 'open')
        
        query = ExceptionReceipt.query
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(ExceptionReceipt.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'exceptions': [{
                'id': e.id,
                'unified_order_id': e.unified_order_id,
                'unified_order_no': e.unified_order.unified_order_no if e.unified_order else None,
                'exception_type': e.exception_type,
                'severity': e.severity,
                'message': e.message,
                'status': e.status,
                'resolved_by': e.resolved_by,
                'resolved_at': e.resolved_at.isoformat() if e.resolved_at else None,
                'created_at': e.created_at.isoformat() if e.created_at else None
            } for e in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })

    @app.route('/api/exceptions/<int:exception_id>/resolve', methods=['POST'])
    def resolve_exception(exception_id):
        data = request.get_json()
        resolved_by = data.get('resolved_by', 'operator')
        resolution_note = data.get('resolution_note', '')
        
        exception = OrderMergeService.resolve_exception(
            exception_id, resolved_by, resolution_note
        )
        
        if not exception:
            return jsonify({'error': 'Exception not found'}), 404
        
        return jsonify({'success': True, 'exception_id': exception.id})

    @app.route('/api/exceptions', methods=['POST'])
    def create_exception():
        data = request.get_json()
        
        exception = OrderMergeService.record_exception(
            unified_order_id=data['unified_order_id'],
            exception_type=data['exception_type'],
            message=data['message'],
            severity=data.get('severity', 'warning'),
            callback_id=data.get('callback_id'),
            raw_data=data.get('raw_data')
        )
        
        return jsonify({
            'success': True,
            'exception_id': exception.id
        }), 201

    @app.route('/api/rules', methods=['GET'])
    def list_rules():
        rules = MergeRule.query.order_by(MergeRule.rule_type, MergeRule.priority.desc()).all()
        return jsonify([{
            'id': r.id,
            'name': r.name,
            'rule_type': r.rule_type,
            'platform': r.platform,
            'config': r.config,
            'is_active': r.is_active,
            'priority': r.priority
        } for r in rules])

    @app.route('/api/dashboard/stats', methods=['GET'])
    def dashboard_stats():
        total_orders = UnifiedOrder.query.count()
        exception_orders = UnifiedOrder.query.filter_by(status='exception').count()
        
        status_stats = db.session.query(
            UnifiedOrder.status,
            db.func.count(UnifiedOrder.id)
        ).group_by(UnifiedOrder.status).all()
        
        platform_stats = db.session.query(
            PlatformOrder.platform,
            db.func.count(PlatformOrder.id)
        ).group_by(PlatformOrder.platform).all()
        
        open_exceptions = ExceptionReceipt.query.filter_by(status='open').count()
        
        return jsonify({
            'total_orders': total_orders,
            'exception_orders': exception_orders,
            'open_exceptions': open_exceptions,
            'status_stats': {s: c for s, c in status_stats},
            'platform_stats': {p: c for p, c in platform_stats}
        })