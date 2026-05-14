import os
import json
from flask import Blueprint, request, jsonify, send_file
from app import db
from app.models import SparePart, Reservation, StockAlarm
from app.services.common import check_idempotent, save_idempotent
from app.services.reservation_service import (
    reserve_spare_part, use_spare_part, release_reservation,
    use_substitute_part, find_substitute_parts, get_or_create_work_order
)
from app.services.alarm_service import (
    check_and_create_alarm, resolve_alarm, check_global_stock_alarms,
    get_pending_alarms, get_reservation_impacted_orders
)
from app.services.part_service import (
    get_part_by_code, get_all_parts, create_or_update_part,
    add_stock, get_part_substitutions, add_substitution,
    get_part_pool_overview
)
from app.services.export_service import (
    export_stock_alarm_review, export_operation_logs, get_export_list
)

api_bp = Blueprint('api', __name__)


@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'spare-parts-inventory'
    })


@api_bp.route('/parts/pool', methods=['GET'])
def get_part_pool():
    overview = get_part_pool_overview()
    return jsonify({
        'success': True,
        'data': overview
    })


@api_bp.route('/parts', methods=['GET'])
def list_parts():
    parts = get_all_parts()
    return jsonify({
        'success': True,
        'data': [p.to_dict() for p in parts]
    })


@api_bp.route('/parts/<part_code>', methods=['GET'])
def get_part(part_code):
    part = get_part_by_code(part_code)
    if not part:
        return jsonify({'success': False, 'message': '备件不存在'}), 404
    
    substitutions = get_part_substitutions(part_code)
    impacted_orders = get_reservation_impacted_orders(part_code)
    
    return jsonify({
        'success': True,
        'data': {
            'part': part.to_dict(),
            'substitutions': substitutions,
            'impacted_orders': impacted_orders
        }
    })


@api_bp.route('/parts', methods=['POST'])
def create_part():
    data = request.get_json()
    request_key = data.get('request_key') or f"create_part_{data.get('part_code')}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        part = create_or_update_part(
            data,
            operator=data.get('operator', 'system')
        )
        
        result = {
            'success': True,
            'data': part.to_dict()
        }
        
        save_idempotent(request_key, '/parts', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400


@api_bp.route('/parts/<part_code>/stock', methods=['POST'])
def update_stock(part_code):
    data = request.get_json()
    qty = data.get('qty', 0)
    
    request_key = data.get('request_key') or f"stock_{part_code}_{qty}_{data.get('operator', 'system')}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        part = add_stock(
            part_code,
            qty,
            operator=data.get('operator', 'system'),
            note=data.get('note', '')
        )
        
        result = {
            'success': True,
            'message': f'入库 {qty} 个成功',
            'data': part.to_dict()
        }
        
        save_idempotent(request_key, f'/parts/{part_code}/stock', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400


@api_bp.route('/parts/<part_code>/substitutions', methods=['GET'])
def list_substitutions(part_code):
    subs = get_part_substitutions(part_code)
    return jsonify({
        'success': True,
        'data': subs
    })


@api_bp.route('/parts/<part_code>/substitutions', methods=['POST'])
def create_substitution(part_code):
    data = request.get_json()
    substitute_code = data.get('substitute_part_code')
    priority = data.get('priority', 1)
    
    if not substitute_code:
        return jsonify({'success': False, 'message': '替代件编码不能为空'}), 400
    
    try:
        add_substitution(part_code, substitute_code, priority, data.get('operator', 'system'))
        db.session.commit()
        
        subs = get_part_substitutions(part_code)
        return jsonify({
            'success': True,
            'message': '替代件添加成功',
            'data': subs
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400


@api_bp.route('/reservations', methods=['POST'])
def create_reservation():
    data = request.get_json()
    
    order_no = data.get('order_no')
    part_code = data.get('part_code')
    requested_qty = data.get('requested_qty', 0)
    
    if not all([order_no, part_code, requested_qty]):
        return jsonify({'success': False, 'message': '工单编号、备件编码、申请数量不能为空'}), 400
    
    request_key = data.get('request_key') or f"reserve_{order_no}_{part_code}_{requested_qty}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        result = reserve_spare_part(
            order_no=order_no,
            part_code=part_code,
            requested_qty=requested_qty,
            operator=data.get('operator', 'system'),
            equipment_id=data.get('equipment_id'),
            equipment_name=data.get('equipment_name'),
            order_type=data.get('order_type'),
            priority=data.get('work_order_priority', 'NORMAL')
        )
        
        save_idempotent(request_key, '/reservations', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/reservations/substitute', methods=['POST'])
def create_substitute_reservation():
    data = request.get_json()
    
    order_no = data.get('order_no')
    original_part_code = data.get('original_part_code')
    substitute_part_code = data.get('substitute_part_code')
    requested_qty = data.get('requested_qty', 0)
    
    if not all([order_no, original_part_code, substitute_part_code, requested_qty]):
        return jsonify({'success': False, 'message': '必填参数缺失'}), 400
    
    request_key = data.get('request_key') or f"substitute_{order_no}_{original_part_code}_{substitute_part_code}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        result = use_substitute_part(
            order_no=order_no,
            original_part_code=original_part_code,
            substitute_part_code=substitute_part_code,
            requested_qty=requested_qty,
            operator=data.get('operator', 'system')
        )
        
        save_idempotent(request_key, '/reservations/substitute', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/reservations/<reservation_id>/use', methods=['POST'])
def use_reservation(reservation_id):
    data = request.get_json()
    used_qty = data.get('used_qty', 0)
    
    if used_qty <= 0:
        return jsonify({'success': False, 'message': '领用数量必须大于0'}), 400
    
    request_key = data.get('request_key') or f"use_{reservation_id}_{used_qty}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        result = use_spare_part(
            reservation_id=reservation_id,
            used_qty=used_qty,
            operator=data.get('operator', 'system')
        )
        
        save_idempotent(request_key, f'/reservations/{reservation_id}/use', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/reservations/<reservation_id>/release', methods=['POST'])
def release_reservation_api(reservation_id):
    data = request.get_json()
    
    request_key = data.get('request_key') or f"release_{reservation_id}"
    
    cached = check_idempotent(request_key)
    if cached:
        return jsonify(cached)
    
    try:
        result = release_reservation(
            reservation_id=reservation_id,
            operator=data.get('operator', 'system'),
            reason=data.get('reason', '')
        )
        
        save_idempotent(request_key, f'/reservations/{reservation_id}/release', data, result)
        
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/reservations', methods=['GET'])
def list_reservations():
    status = request.args.get('status')
    order_no = request.args.get('order_no')
    
    query = Reservation.query
    if status:
        query = query.filter(Reservation.status == status)
    if order_no:
        query = query.filter(Reservation.order_no == order_no)
    
    reservations = query.order_by(Reservation.reserved_at.desc()).all()
    
    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in reservations]
    })


@api_bp.route('/alarms', methods=['GET'])
def list_alarms():
    needs_review_only = request.args.get('needs_review') == 'true'
    alarms = get_pending_alarms(needs_review_only=needs_review_only)
    
    return jsonify({
        'success': True,
        'data': alarms
    })


@api_bp.route('/alarms/check', methods=['POST'])
def trigger_alarm_check():
    alarms = check_global_stock_alarms()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'检查完成，共 {len(alarms)} 个告警',
        'data': alarms
    })


@api_bp.route('/alarms/<alarm_id>/resolve', methods=['POST'])
def resolve_alarm_api(alarm_id):
    data = request.get_json()
    
    try:
        result = resolve_alarm(
            alarm_id=alarm_id,
            operator=data.get('operator', 'system'),
            note=data.get('note', '')
        )
        db.session.commit()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/exports/alarm-review', methods=['POST'])
def create_alarm_review_export():
    try:
        filepath = export_stock_alarm_review()
        filename = os.path.basename(filepath)
        return jsonify({
            'success': True,
            'message': '导出成功',
            'filename': filename,
            'download_url': f'/api/exports/download/{filename}'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/exports/operation-logs', methods=['POST'])
def create_logs_export():
    data = request.get_json() or {}
    try:
        filepath = export_operation_logs(
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            operation_type=data.get('operation_type')
        )
        filename = os.path.basename(filepath)
        return jsonify({
            'success': True,
            'message': '导出成功',
            'filename': filename,
            'download_url': f'/api/exports/download/{filename}'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@api_bp.route('/exports', methods=['GET'])
def list_exports():
    files = get_export_list()
    return jsonify({
        'success': True,
        'data': files
    })


@api_bp.route('/exports/download/<filename>', methods=['GET'])
def download_export(filename):
    from config import Config
    filepath = os.path.join(Config.EXPORT_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'message': '文件不存在'}), 404
    
    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@api_bp.route('/review-guide', methods=['GET'])
def get_review_guide():
    guide = {
        'process_overview': {
            'entry_point': '备件池 (Parts Pool)',
            'main_rules': [
                '工单预占规则',
                '最小库存规则'
            ],
            'fallback_mechanisms': [
                '替代件匹配',
                '释放补偿',
                '库存告警复查'
            ]
        },
        'success_cases': [
            {
                'code': 'RESERVED',
                'scenario': '全额预占成功',
                'condition': '可用库存 >= 申请数量 且 预占后仍 >= 安全库存',
                'action_required': '无需人工处理'
            },
            {
                'code': 'IDEMPOTENT_RESERVATION',
                'scenario': '重复请求幂等返回',
                'condition': '同一工单+备件+数量的重复请求',
                'action_required': '无需人工处理'
            },
            {
                'code': 'NO_STOCK_WITH_SUBSTITUTE',
                'scenario': '库存不足但有替代件',
                'condition': '可用库存为0 但存在可用替代件',
                'action_required': '可选择使用替代件'
            },
            {
                'code': 'USED',
                'scenario': '领用成功',
                'condition': '领用数量 <= 剩余预占数量',
                'action_required': '无需人工处理'
            },
            {
                'code': 'RELEASED',
                'scenario': '释放成功',
                'condition': '存在未领用的预占数量',
                'action_required': '释放后库存回补，自动重新计算告警'
            }
        ],
        'needs_review_cases': [
            {
                'code': 'NO_STOCK',
                'alarm_type': 'STOCK_OUT',
                'alarm_level': 'CRITICAL',
                'scenario': '库存为0且无替代件',
                'condition': '可用库存为0 且 无可用替代件',
                'review_actions': [
                    '检查工单优先级，是否紧急',
                    '启动紧急采购流程',
                    '协调其他车间调拨',
                    '确认替代件关系是否配置完整'
                ]
            },
            {
                'code': 'PARTIAL_RESERVE',
                'alarm_type': 'PARTIAL_RESERVE',
                'alarm_level': 'WARNING',
                'scenario': '部分预占',
                'condition': '可预占数量 < 申请数量',
                'review_actions': [
                    '确认工单是否可接受部分供应',
                    '检查剩余需求是否可用替代件满足',
                    '评估对工单进度的影响'
                ]
            },
            {
                'code': 'MIN_STOCK_BREACH',
                'alarm_type': 'MIN_STOCK_BREACH',
                'alarm_level': 'CRITICAL',
                'scenario': '可用库存低于最小库存',
                'condition': '可用库存 < 最小库存 (min_stock)',
                'review_actions': [
                    '立即启动紧急采购',
                    '检查当前预占工单是否可延后',
                    '确认最小库存设置是否合理'
                ]
            },
            {
                'code': 'INVALID_SUBSTITUTE',
                'scenario': '无效替代件',
                'condition': '请求使用的替代件关系不存在或已失效',
                'review_actions': [
                    '检查替代件关系配置',
                    '确认替代件兼容性',
                    '重新配置有效替代关系'
                ]
            }
        ],
        'key_concepts': {
            'available_qty': '可用库存 = 总库存 - 已预占',
            'reserved_qty': '已预占数量（被工单锁定的库存）',
            'safety_stock': '安全库存（预警线）',
            'min_stock': '最小库存（危险线）',
            'idempotency': '重复操作结果一致（通过 request_key 保证）'
        }
    }
    
    return jsonify({
        'success': True,
        'data': guide
    })
