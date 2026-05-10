from flask import Blueprint, request, jsonify
from app.models import load_sample_inventory, BlendingCalculator, Inventory, TeaRawMaterial, TeaGrade
import json
import os
from datetime import datetime

main_bp = Blueprint('main', __name__)

_inventory = None
_saved_plans = []
_exported_reports = []

def get_inventory():
    global _inventory
    if _inventory is None:
        _inventory = load_sample_inventory()
    return _inventory

def plan_to_dict(plan):
    return {
        "batch_name": plan.batch_name,
        "target_weight_kg": plan.target_weight_kg,
        "target_aroma_score": plan.target_aroma_score,
        "max_cost_per_kg": plan.max_cost_per_kg,
        "components": [
            {
                "material_id": c.material_id,
                "material_name": c.material_name,
                "grade": c.grade.value,
                "proportion": c.proportion,
                "quantity_kg": c.quantity_kg,
                "cost": c.cost
            }
            for c in plan.components
        ],
        "total_cost": plan.total_cost,
        "avg_cost_per_kg": plan.total_cost / plan.target_weight_kg if plan.target_weight_kg > 0 else 0,
        "avg_aroma_score": plan.avg_aroma_score,
        "is_feasible": plan.is_feasible,
        "feasibility_reasons": plan.feasibility_reasons,
        "violations": plan.violations,
        "timestamp": datetime.now().isoformat()
    }

@main_bp.route('/api/inventory', methods=['GET'])
def get_inventory_api():
    inventory = get_inventory()
    return jsonify(inventory.to_dict())

@main_bp.route('/api/inventory/<material_id>', methods=['PUT'])
def update_inventory(material_id):
    inventory = get_inventory()
    data = request.json
    
    material = inventory.get_material(material_id)
    if not material:
        return jsonify({"error": "原料不存在", "material_id": material_id}), 404
    
    if 'stock_kg' in data:
        inventory.update_stock(material_id, float(data['stock_kg']))
    
    return jsonify({
        "message": "库存更新成功",
        "material": {
            "id": material.id,
            "name": material.name,
            "stock_kg": material.stock_kg
        }
    })

@main_bp.route('/api/materials', methods=['POST'])
def add_material():
    inventory = get_inventory()
    data = request.json
    
    required_fields = ['id', 'name', 'grade', 'aroma_score', 'cost_per_kg', 'stock_kg']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"缺少必填字段: {field}"}), 400
    
    if inventory.get_material(data['id']):
        return jsonify({"error": "原料ID已存在"}), 400
    
    try:
        material = TeaRawMaterial(
            id=data['id'],
            name=data['name'],
            grade=TeaGrade(data['grade']),
            aroma_score=float(data['aroma_score']),
            cost_per_kg=float(data['cost_per_kg']),
            stock_kg=float(data['stock_kg']),
            description=data.get('description', '')
        )
    except ValueError as e:
        return jsonify({"error": f"参数错误: {str(e)}"}), 400
    
    inventory.add_material(material)
    return jsonify({
        "message": "原料添加成功",
        "material": {
            "id": material.id,
            "name": material.name,
            "grade": material.grade.value
        }
    }), 201

@main_bp.route('/api/calculate', methods=['POST'])
def calculate_plan():
    inventory = get_inventory()
    data = request.json
    
    required_fields = ['batch_name', 'target_weight_kg', 'target_aroma_score', 'max_cost_per_kg', 'components']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"缺少必填字段: {field}"}), 400
    
    try:
        calculator = BlendingCalculator(inventory)
        plan = calculator.calculate_plan(
            batch_name=data['batch_name'],
            target_weight_kg=float(data['target_weight_kg']),
            target_aroma_score=float(data['target_aroma_score']),
            max_cost_per_kg=float(data['max_cost_per_kg']),
            components=data['components']
        )
    except Exception as e:
        return jsonify({"error": f"计算失败: {str(e)}"}), 400
    
    plan_dict = plan_to_dict(plan)
    plan_dict['key_assumptions'] = [
        "评分计算采用加权平均法，权重为各原料的拼配比例",
        "成本计算基于原料单价和实际使用量，不含加工费用",
        "库存约束检查基于当前库存量，不考虑在途或预购原料",
        "可行性判定需同时满足：香气评分达标、成本不超标、库存充足"
    ]
    
    return jsonify(plan_dict)

@main_bp.route('/api/optimize', methods=['POST'])
def optimize_plans():
    inventory = get_inventory()
    data = request.json
    
    required_fields = ['target_weight_kg', 'target_aroma_score', 'max_cost_per_kg']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"缺少必填字段: {field}"}), 400
    
    try:
        calculator = BlendingCalculator(inventory)
        plans = calculator.generate_optimized_plans(
            target_weight_kg=float(data['target_weight_kg']),
            target_aroma_score=float(data['target_aroma_score']),
            max_cost_per_kg=float(data['max_cost_per_kg']),
            exclude_material_ids=data.get('exclude_material_ids', [])
        )
    except Exception as e:
        return jsonify({"error": f"优化失败: {str(e)}"}), 400
    
    feasible_plans = [plan_to_dict(p) for p in plans if p.is_feasible]
    infeasible_plans = [plan_to_dict(p) for p in plans if not p.is_feasible]
    
    return jsonify({
        "feasible_plans": feasible_plans,
        "infeasible_plans": infeasible_plans,
        "optimization_summary": {
            "total_feasible": len(feasible_plans),
            "total_infeasible": len(infeasible_plans),
            "key_assumptions": [
                "优化算法优先考虑成本最低的可行方案",
                "默认采用两种原料组合进行试算",
                "高香气原料优先与低成本原料组合",
                "仅展示满足所有约束条件的方案"
            ]
        }
    })

@main_bp.route('/api/plans/save', methods=['POST'])
def save_plan():
    data = request.json
    _saved_plans.append(data)
    return jsonify({
        "message": "方案保存成功",
        "plan_index": len(_saved_plans) - 1,
        "total_saved": len(_saved_plans)
    })

@main_bp.route('/api/plans', methods=['GET'])
def list_plans():
    return jsonify({
        "plans": _saved_plans,
        "count": len(_saved_plans)
    })

@main_bp.route('/api/plans/compare', methods=['POST'])
def compare_plans():
    data = request.json
    plan_indices = data.get('plan_indices', [])
    
    if len(plan_indices) < 2:
        return jsonify({"error": "至少需要选择两个方案进行比较"}), 400
    
    plans_to_compare = []
    for idx in plan_indices:
        if 0 <= idx < len(_saved_plans):
            plans_to_compare.append(_saved_plans[idx])
    
    if len(plans_to_compare) < 2:
        return jsonify({"error": "有效的方案数量不足"}), 400
    
    comparison = {
        "plans": plans_to_compare,
        "comparison_metrics": [],
        "recommendation": None
    }
    
    metrics = ['total_cost', 'avg_cost_per_kg', 'avg_aroma_score', 'target_weight_kg']
    for metric in metrics:
        values = [p.get(metric, 0) for p in plans_to_compare]
        min_val = min(values)
        max_val = max(values)
        
        comparison['comparison_metrics'].append({
            "metric": metric,
            "values": values,
            "min": min_val,
            "max": max_val,
            "range": max_val - min_val
        })
    
    feasible_plans = [p for p in plans_to_compare if p.get('is_feasible', False)]
    if feasible_plans:
        cheapest = min(feasible_plans, key=lambda p: p.get('total_cost', float('inf')))
        highest_score = max(feasible_plans, key=lambda p: p.get('avg_aroma_score', 0))
        
        comparison['recommendation'] = {
            "cheapest_plan": cheapest['batch_name'],
            "highest_score_plan": highest_score['batch_name'],
            "reasoning": [
                f"推荐成本最低方案：{cheapest['batch_name']}，总成本 {cheapest['total_cost']:.2f} 元",
                f"推荐评分最高方案：{highest_score['batch_name']}，平均香气评分 {highest_score['avg_aroma_score']:.2f} 分"
            ]
        }
    
    return jsonify(comparison)

@main_bp.route('/api/export', methods=['POST'])
def export_report():
    data = request.json
    plan = data.get('plan')
    
    if not plan:
        return jsonify({"error": "缺少方案数据"}), 400
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    report = {
        "report_id": f"RPT_{timestamp}",
        "generated_at": datetime.now().isoformat(),
        "plan": plan,
        "export_summary": {
            "batch_name": plan['batch_name'],
            "feasibility": "可行" if plan['is_feasible'] else "不可行",
            "total_cost": plan['total_cost'],
            "avg_aroma_score": plan['avg_aroma_score']
        },
        "disclaimers": [
            "本报告基于当前库存数据生成，实际生产前请再次确认库存",
            "香气评分为加权平均值，实际成品可能受加工工艺影响",
            "成本计算不含人工、能耗等加工费用",
            "建议在小批量试生产验证后再进行大规模生产"
        ]
    }
    
    _exported_reports.append(report)
    
    return jsonify({
        "message": "报告导出成功",
        "report": report
    })

@main_bp.route('/api/health', methods=['GET'])
def health_check():
    inventory = get_inventory()
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "inventory_count": len(inventory.get_all_materials()),
        "saved_plans_count": len(_saved_plans),
        "exported_reports_count": len(_exported_reports)
    })
