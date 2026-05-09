from flask import Blueprint, request, jsonify
from backend.services.rules_service import RulesService

rules_bp = Blueprint('rules', __name__)


@rules_bp.route('/', methods=['GET'])
def list_rules():
    try:
        is_active = request.args.get('is_active', type=lambda v: v.lower() == 'true')
        rules = RulesService.list_rules(is_active=is_active)
        return jsonify({
            'success': True,
            'data': rules
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rules_bp.route('/', methods=['POST'])
def create_rule():
    try:
        data = request.get_json()
        rule = RulesService.create_rule(data)
        return jsonify({
            'success': True,
            'data': rule
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rules_bp.route('/<int:rule_id>', methods=['GET'])
def get_rule(rule_id):
    try:
        rule = RulesService.get_rule(rule_id)
        if not rule:
            return jsonify({'error': 'Rule not found'}), 404
        return jsonify({
            'success': True,
            'data': rule
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rules_bp.route('/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id):
    try:
        data = request.get_json()
        rule = RulesService.update_rule(rule_id, data)
        if not rule:
            return jsonify({'error': 'Rule not found'}), 404
        return jsonify({
            'success': True,
            'data': rule
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rules_bp.route('/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    try:
        success = RulesService.delete_rule(rule_id)
        if not success:
            return jsonify({'error': 'Rule not found'}), 404
        return jsonify({
            'success': True,
            'message': 'Rule deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rules_bp.route('/<int:rule_id>/toggle', methods=['POST'])
def toggle_rule(rule_id):
    try:
        rule = RulesService.toggle_rule(rule_id)
        if not rule:
            return jsonify({'error': 'Rule not found'}), 404
        return jsonify({
            'success': True,
            'data': rule
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400
