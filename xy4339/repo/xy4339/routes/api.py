from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, date
from extensions import db
from models import (
    Order, OrderItem, OrderStatus, PaperStock, PaperSpec,
    CuttingPlan, CuttingLayout, StockTransaction, TransactionType
)
from services import CuttingCalculator, QuotationCalculator
from io import StringIO
import csv
import json

api = Blueprint('api', __name__)

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return None

def layout_to_dict(layout):
    if not layout:
        return None
    return {
        'cols': layout.cols,
        'rows': layout.rows,
        'total_per_sheet': layout.total_per_sheet,
        'efficiency': layout.efficiency,
        'waste_percent': layout.waste_percent,
        'is_rotated': layout.is_rotated
    }

@api.route('/orders', methods=['GET'])
def get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify([order.to_dict() for order in orders])

@api.route('/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    result = order.to_dict()
    result['items'] = [item.to_dict() for item in order.items]
    result['cutting_plans'] = [plan.to_dict() for plan in order.cutting_plans]
    return jsonify(result)

@api.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    
    order = Order(
        order_number=data.get('order_number') or Order.generate_order_number(Order()),
        customer_name=data.get('customer_name'),
        customer_phone=data.get('customer_phone'),
        customer_company=data.get('customer_company'),
        status=OrderStatus.DRAFT.value,
        is_urgent=data.get('is_urgent', False),
        urgent_reason=data.get('urgent_reason'),
        required_date=parse_date(data.get('required_date')),
        notes=data.get('notes')
    )
    
    db.session.add(order)
    db.session.flush()
    
    items_data = data.get('items', [])
    for item_data in items_data:
        item = OrderItem(
            order_id=order.id,
            product_name=item_data.get('product_name', '未命名产品'),
            finished_width=item_data.get('finished_width', 0),
            finished_height=item_data.get('finished_height', 0),
            unit=item_data.get('unit', 'mm'),
            quantity=item_data.get('quantity', 0),
            paper_type=item_data.get('paper_type'),
            paper_weight=item_data.get('paper_weight'),
            paper_color=item_data.get('paper_color', '白色'),
            grain_direction=item_data.get('grain_direction', 'any'),
            double_sided=item_data.get('double_sided', False),
            bleed=item_data.get('bleed', 0),
            margin=item_data.get('margin', 10),
            notes=item_data.get('notes')
        )
        db.session.add(item)
    
    db.session.commit()
    
    return jsonify(order.to_dict()), 201

@api.route('/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    
    if not order.can_modify():
        return jsonify({'error': '该订单状态不允许修改'}), 400
    
    order.customer_name = data.get('customer_name', order.customer_name)
    order.customer_phone = data.get('customer_phone', order.customer_phone)
    order.customer_company = data.get('customer_company', order.customer_company)
    order.is_urgent = data.get('is_urgent', order.is_urgent)
    order.urgent_reason = data.get('urgent_reason', order.urgent_reason)
    order.required_date = parse_date(data.get('required_date')) or order.required_date
    order.notes = data.get('notes', order.notes)
    order.discount_percent = data.get('discount_percent', order.discount_percent)
    
    db.session.commit()
    
    return jsonify(order.to_dict())

@api.route('/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    new_status = data.get('status')
    
    valid_statuses = [s.value for s in OrderStatus]
    if new_status not in valid_statuses:
        return jsonify({'error': '无效的订单状态'}), 400
    
    order.status = new_status
    
    if new_status == OrderStatus.COMPLETED.value:
        order.actual_complete_date = date.today()
    
    db.session.commit()
    
    return jsonify(order.to_dict())

@api.route('/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    order = Order.query.get_or_404(order_id)
    
    if not order.can_modify() and order.status != OrderStatus.CANCELLED.value:
        return jsonify({'error': '该订单状态不允许删除'}), 400
    
    db.session.delete(order)
    db.session.commit()
    
    return jsonify({'message': '订单已删除'})

@api.route('/orders/<int:order_id>/items', methods=['POST'])
def add_order_item(order_id):
    order = Order.query.get_or_404(order_id)
    
    if not order.can_modify():
        return jsonify({'error': '该订单状态不允许修改'}), 400
    
    data = request.get_json()
    
    item = OrderItem(
        order_id=order.id,
        product_name=data.get('product_name', '未命名产品'),
        finished_width=data.get('finished_width', 0),
        finished_height=data.get('finished_height', 0),
        unit=data.get('unit', 'mm'),
        quantity=data.get('quantity', 0),
        paper_type=data.get('paper_type'),
        paper_weight=data.get('paper_weight'),
        paper_color=data.get('paper_color', '白色'),
        grain_direction=data.get('grain_direction', 'any'),
        double_sided=data.get('double_sided', False),
        bleed=data.get('bleed', 0),
        margin=data.get('margin', 10),
        notes=data.get('notes')
    )
    
    db.session.add(item)
    db.session.commit()
    
    return jsonify(item.to_dict()), 201

@api.route('/orders/<int:order_id>/items/<int:item_id>', methods=['PUT'])
def update_order_item(order_id, item_id):
    item = OrderItem.query.get_or_404(item_id)
    order = Order.query.get_or_404(order_id)
    
    if not order.can_modify():
        return jsonify({'error': '该订单状态不允许修改'}), 400
    
    data = request.get_json()
    
    item.product_name = data.get('product_name', item.product_name)
    item.finished_width = data.get('finished_width', item.finished_width)
    item.finished_height = data.get('finished_height', item.finished_height)
    item.quantity = data.get('quantity', item.quantity)
    item.paper_type = data.get('paper_type', item.paper_type)
    item.paper_weight = data.get('paper_weight', item.paper_weight)
    item.paper_color = data.get('paper_color', item.paper_color)
    item.grain_direction = data.get('grain_direction', item.grain_direction)
    item.double_sided = data.get('double_sided', item.double_sided)
    item.bleed = data.get('bleed', item.bleed)
    item.margin = data.get('margin', item.margin)
    item.notes = data.get('notes', item.notes)
    
    db.session.commit()
    
    return jsonify(item.to_dict())

@api.route('/orders/<int:order_id>/items/<int:item_id>', methods=['DELETE'])
def delete_order_item(order_id, item_id):
    item = OrderItem.query.get_or_404(item_id)
    order = Order.query.get_or_404(order_id)
    
    if not order.can_modify():
        return jsonify({'error': '该订单状态不允许修改'}), 400
    
    db.session.delete(item)
    db.session.commit()
    
    return jsonify({'message': '订单项已删除'})

@api.route('/stocks', methods=['GET'])
def get_stocks():
    stocks = PaperStock.query.all()
    return jsonify([stock.to_dict() for stock in stocks])

@api.route('/stocks/<int:stock_id>', methods=['GET'])
def get_stock(stock_id):
    stock = PaperStock.query.get_or_404(stock_id)
    return jsonify(stock.to_dict())

@api.route('/specs', methods=['GET'])
def get_specs():
    specs = PaperSpec.query.all()
    return jsonify([spec.to_dict() for spec in specs])

@api.route('/calculate/cutting', methods=['POST'])
def calculate_cutting():
    data = request.get_json()
    
    sheet_width = data.get('sheet_width')
    sheet_height = data.get('sheet_height')
    piece_width = data.get('piece_width')
    piece_height = data.get('piece_height')
    total_pieces = data.get('total_pieces', 1)
    grain_direction = data.get('grain_direction', 'any')
    margin = data.get('margin')
    cutting_loss = data.get('cutting_loss')
    wastage_rate = data.get('wastage_rate', 0.03)
    
    if not all([sheet_width, sheet_height, piece_width, piece_height]):
        return jsonify({'error': '缺少必要参数'}), 400
    
    calculator = CuttingCalculator(
        cutting_loss=cutting_loss,
        margin=margin
    )
    
    result = calculator.calculate_all(
        sheet_width=sheet_width,
        sheet_height=sheet_height,
        piece_width=piece_width,
        piece_height=piece_height,
        total_pieces=total_pieces,
        grain_direction=grain_direction,
        wastage_rate=wastage_rate
    )
    
    if not result['success']:
        return jsonify(result), 400
    
    response = {
        'success': True,
        'best_layout': {
            'cols': result['best_layout'].cols,
            'rows': result['best_layout'].rows,
            'total_per_sheet': result['best_layout'].total_per_sheet,
            'efficiency': result['best_layout'].efficiency,
            'waste_area': result['best_layout'].waste_area,
            'waste_percent': result['best_layout'].waste_percent,
            'is_rotated': result['best_layout'].is_rotated,
            'open_format': calculator.get_open_format_name(
                result['best_layout'].cols,
                result['best_layout'].rows
            )
        },
        'all_layouts': [{
            'cols': l.cols,
            'rows': l.rows,
            'total_per_sheet': l.total_per_sheet,
            'efficiency': l.efficiency,
            'is_rotated': l.is_rotated,
            'open_format': calculator.get_open_format_name(l.cols, l.rows)
        } for l in result['all_layouts']],
        'sheets_calculation': result['sheets_calculation'],
        'efficiency_formatted': calculator.format_efficiency(result['best_layout'].efficiency),
        'waste_formatted': calculator.format_waste_percent(result['best_layout'].waste_percent)
    }
    
    return jsonify(response)

@api.route('/calculate/find-best-stock', methods=['POST'])
def find_best_stock():
    data = request.get_json()
    
    piece_width = data.get('piece_width')
    piece_height = data.get('piece_height')
    total_pieces = data.get('total_pieces', 1)
    paper_type = data.get('paper_type')
    paper_weight = data.get('paper_weight')
    paper_color = data.get('paper_color', '白色')
    grain_direction = data.get('grain_direction', 'any')
    
    if not all([piece_width, piece_height]):
        return jsonify({'error': '缺少必要参数'}), 400
    
    stocks_query = PaperStock.query.filter(PaperStock.quantity > 0)
    
    if paper_type:
        stocks_query = stocks_query.filter_by(paper_type=paper_type)
    if paper_weight:
        stocks_query = stocks_query.filter_by(paper_weight=paper_weight)
    if paper_color:
        stocks_query = stocks_query.filter_by(paper_color=paper_color)
    
    stocks = stocks_query.all()
    
    if not stocks:
        return jsonify({'success': False, 'error': '未找到匹配的库存纸张'}), 404
    
    calculator = CuttingCalculator()
    quotation_calc = QuotationCalculator()
    
    results = []
    
    for stock in stocks:
        spec = PaperSpec.query.get(stock.spec_id)
        if not spec:
            continue
        
        result = calculator.calculate_all(
            sheet_width=spec.width,
            sheet_height=spec.height,
            piece_width=piece_width,
            piece_height=piece_height,
            total_pieces=total_pieces,
            grain_direction=grain_direction
        )
        
        if not result['success']:
            continue
        
        sheets_needed = result['sheets_calculation']['total_sheets']
        shortage = max(0, sheets_needed - stock.quantity)
        
        cost = quotation_calc.calculate_full_quotation(
            sheets_count=sheets_needed,
            unit_price=stock.unit_price,
            cols=result['best_layout'].cols,
            rows=result['best_layout'].rows
        )
        
        results.append({
            'stock': stock.to_dict(),
            'spec': spec.to_dict(),
            'layout': layout_to_dict(result['best_layout']),
            'open_format': calculator.get_open_format_name(
                result['best_layout'].cols,
                result['best_layout'].rows
            ),
            'sheets_needed': sheets_needed,
            'sheets_available': stock.quantity,
            'shortage': shortage,
            'has_shortage': shortage > 0,
            'cost': {
                'total_cost': cost.total_cost,
                'quoted_price': cost.quoted_price,
                'material_cost': cost.material_cost,
                'labor_cost': cost.labor_cost
            },
            'efficiency': result['best_layout'].efficiency
        })
    
    results.sort(key=lambda x: (
        x['has_shortage'],
        -x['efficiency'],
        x['cost']['quoted_price']
    ))
    
    return jsonify({
        'success': True,
        'results': results,
        'count': len(results)
    })

@api.route('/orders/<int:order_id>/calculate-plan', methods=['POST'])
def calculate_order_plan(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    
    item_id = data.get('item_id')
    stock_id = data.get('stock_id')
    
    if not item_id:
        return jsonify({'error': '缺少订单项ID'}), 400
    
    item = OrderItem.query.get_or_404(item_id)
    
    calculator = CuttingCalculator()
    quotation_calc = QuotationCalculator()
    
    piece_size = item.get_effective_size()
    
    if stock_id:
        stock = PaperStock.query.get_or_404(stock_id)
        spec = PaperSpec.query.get(stock.spec_id)
        
        result = calculator.calculate_all(
            sheet_width=spec.width,
            sheet_height=spec.height,
            piece_width=piece_size['width'],
            piece_height=piece_size['height'],
            total_pieces=item.quantity,
            grain_direction=item.grain_direction,
            margin=item.margin
        )
        
        if not result['success']:
            return jsonify({'error': result.get('error', '计算失败')}), 400
        
        sheets_needed = result['sheets_calculation']['total_sheets']
        shortage = max(0, sheets_needed - stock.quantity)
        
        cost = quotation_calc.calculate_full_quotation(
            sheets_count=sheets_needed,
            unit_price=stock.unit_price,
            cols=result['best_layout'].cols,
            rows=result['best_layout'].rows,
            is_urgent=order.is_urgent,
            is_double_sided=item.double_sided
        )
        
        risk_warnings = []
        if shortage > 0:
            risk_warnings.append({
                'type': 'shortage',
                'message': f'库存不足，缺少 {shortage} 张纸',
                'shortage': shortage
            })
        
        if result['best_layout'].waste_percent > 0.3:
            risk_warnings.append({
                'type': 'waste',
                'message': f'纸张利用率较低，浪费率 {calculator.format_waste_percent(result["best_layout"].waste_percent)}',
                'waste_percent': result['best_layout'].waste_percent
            })
        
        plan = CuttingPlan(
            order_id=order.id,
            order_item_id=item.id,
            stock_id=stock.id,
            sheet_width=spec.width,
            sheet_height=spec.height,
            sheet_name=spec.name,
            total_pieces_needed=item.quantity,
            sheets_needed=sheets_needed,
            sheets_available=stock.quantity,
            sheets_shortage=shortage,
            best_efficiency=result['best_layout'].efficiency,
            total_waste_area=result['best_layout'].waste_area * sheets_needed,
            total_waste_percent=result['best_layout'].waste_percent,
            material_cost=cost.material_cost,
            labor_cost=cost.labor_cost,
            urgent_surcharge=cost.urgent_surcharge,
            total_cost=cost.total_cost,
            quoted_price=cost.quoted_price
        )
        
        plan.set_risk_warnings(risk_warnings)
        
        layout = CuttingLayout(
            plan_id=plan.id,
            sheet_width=spec.width,
            sheet_height=spec.height,
            piece_width=piece_size['width'],
            piece_height=piece_size['height'],
            cols=result['best_layout'].cols,
            rows=result['best_layout'].rows,
            total_per_sheet=result['best_layout'].total_per_sheet,
            horizontal_gap=calculator.cutting_loss,
            vertical_gap=calculator.cutting_loss,
            left_margin=result['best_layout'].left_margin,
            right_margin=result['best_layout'].right_margin,
            top_margin=result['best_layout'].top_margin,
            bottom_margin=result['best_layout'].bottom_margin,
            waste_area=result['best_layout'].waste_area,
            waste_percent=result['best_layout'].waste_percent,
            is_rotated=result['best_layout'].is_rotated
        )
        
        db.session.add(plan)
        db.session.flush()
        layout.plan_id = plan.id
        db.session.add(layout)
        
        total_quoted = sum(p.quoted_price for p in order.cutting_plans)
        order.total_amount = total_quoted
        order.discount_amount = total_quoted * (order.discount_percent / 100)
        order.final_amount = total_quoted - order.discount_amount
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'plan': plan.to_dict(),
            'layout': layout.to_dict(),
            'open_format': calculator.get_open_format_name(
                result['best_layout'].cols,
                result['best_layout'].rows
            ),
            'cost_breakdown': {
                'material_cost': cost.material_cost,
                'labor_cost': cost.labor_cost,
                'urgent_surcharge': cost.urgent_surcharge,
                'total_cost': cost.total_cost,
                'profit_margin': cost.profit_margin,
                'quoted_price': cost.quoted_price
            }
        })
    
    else:
        find_result = find_best_stock()
        return find_result

@api.route('/orders/<int:order_id>/confirm', methods=['POST'])
def confirm_order(order_id):
    order = Order.query.get_or_404(order_id)
    
    if order.status != OrderStatus.DRAFT.value:
        return jsonify({'error': '只有草稿状态的订单可以确认'}), 400
    
    plans = CuttingPlan.query.filter_by(order_id=order.id).all()
    
    if not plans:
        return jsonify({'error': '请先计算裁切方案'}), 400
    
    for plan in plans:
        if plan.sheets_shortage > 0:
            return jsonify({
                'error': f'存在缺纸风险，缺少 {plan.sheets_shortage} 张 {plan.sheet_name}',
                'shortage': plan.sheets_shortage
            }), 400
    
    for plan in plans:
        if plan.stock_id:
            stock = PaperStock.query.get(plan.stock_id)
            if stock:
                transaction = StockTransaction.create_transaction(
                    stock=stock,
                    transaction_type=TransactionType.OUTBOUND.value,
                    quantity=plan.sheets_needed,
                    order_id=order.id,
                    reference_number=order.order_number,
                    notes=f'订单 {order.order_number} 出库'
                )
                db.session.add(transaction)
    
    order.status = OrderStatus.CONFIRMED.value
    
    db.session.commit()
    
    return jsonify(order.to_dict())

@api.route('/orders/<int:order_id>/export/quotation', methods=['GET'])
def export_quotation(order_id):
    order = Order.query.get_or_404(order_id)
    items = OrderItem.query.filter_by(order_id=order.id).all()
    plans = CuttingPlan.query.filter_by(order_id=order.id).all()
    
    md_lines = []
    md_lines.append(f'# 报价单 - {order.order_number}')
    md_lines.append('')
    md_lines.append('## 基本信息')
    md_lines.append('')
    md_lines.append(f'- **客户名称**: {order.customer_name or "-"}')
    md_lines.append(f'- **联系电话**: {order.customer_phone or "-"}')
    md_lines.append(f'- **公司名称**: {order.customer_company or "-"}')
    md_lines.append(f'- **订单状态**: {order.get_status_display()}')
    md_lines.append(f'- **加急订单**: {"是" if order.is_urgent else "否"}')
    if order.required_date:
        md_lines.append(f'- **要求交货日期**: {order.required_date}')
    md_lines.append(f'- **报价日期**: {datetime.now().strftime("%Y-%m-%d")}')
    md_lines.append('')
    
    if items:
        md_lines.append('## 订单项')
        md_lines.append('')
        md_lines.append('| 产品名称 | 成品尺寸 | 数量 | 纸张要求 | 纹理方向 |')
        md_lines.append('|----------|----------|------|----------|----------|')
        for item in items:
            size_str = f'{item.finished_width}x{item.finished_height}{item.unit}'
            paper_str = f'{item.paper_type or "-"} {item.paper_weight or "-"}g {item.paper_color}'
            md_lines.append(f'| {item.product_name} | {size_str} | {item.quantity} | {paper_str} | {item.get_grain_direction_display()} |')
        md_lines.append('')
    
    if plans:
        md_lines.append('## 裁切方案')
        md_lines.append('')
        for plan in plans:
            item = OrderItem.query.get(plan.order_item_id)
            md_lines.append(f'### {item.product_name if item else "订单项"}')
            md_lines.append('')
            md_lines.append(f'- **纸张规格**: {plan.sheet_name} ({plan.sheet_width}x{plan.sheet_height}mm)')
            md_lines.append(f'- **纸张利用率**: {plan.best_efficiency * 100:.1f}%')
            md_lines.append(f'- **浪费率**: {plan.total_waste_percent * 100:.1f}%')
            md_lines.append(f'- **需要纸张**: {plan.sheets_needed} 张')
            md_lines.append(f'- **库存可用**: {plan.sheets_available} 张')
            if plan.sheets_shortage > 0:
                md_lines.append(f'- **⚠️ 缺纸**: {plan.sheets_shortage} 张')
            md_lines.append('')
        
        md_lines.append('## 费用明细')
        md_lines.append('')
        md_lines.append('| 项目 | 金额 |')
        md_lines.append('|------|------|')
        
        total_material = sum(p.material_cost for p in plans)
        total_labor = sum(p.labor_cost for p in plans)
        total_urgent = sum(p.urgent_surcharge for p in plans)
        total_cost = sum(p.total_cost for p in plans)
        total_quoted = sum(p.quoted_price for p in plans)
        
        md_lines.append(f'| 材料成本 | ¥{total_material:.2f} |')
        md_lines.append(f'| 人工成本 | ¥{total_labor:.2f} |')
        if total_urgent > 0:
            md_lines.append(f'| 加急费 | ¥{total_urgent:.2f} |')
        md_lines.append(f'| **成本合计** | **¥{total_cost:.2f}** |')
        md_lines.append(f'| **报价金额** | **¥{total_quoted:.2f}** |')
        md_lines.append('')
    
    if order.notes:
        md_lines.append('## 备注')
        md_lines.append('')
        md_lines.append(order.notes)
        md_lines.append('')
    
    md_content = '\n'.join(md_lines)
    
    response = make_response(md_content)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=quotation-{order.order_number}.md'
    
    return response

@api.route('/orders/<int:order_id>/export/materials', methods=['GET'])
def export_materials(order_id):
    order = Order.query.get_or_404(order_id)
    plans = CuttingPlan.query.filter_by(order_id=order.id).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['备料单', order.order_number])
    writer.writerow(['日期', datetime.now().strftime('%Y-%m-%d %H:%M')])
    writer.writerow([])
    
    writer.writerow([
        '纸张规格', '宽(mm)', '高(mm)', '克重', '颜色', '纸质',
        '需要数量', '库存数量', '缺纸数量', '单价', '小计'
    ])
    
    for plan in plans:
        stock = PaperStock.query.get(plan.stock_id) if plan.stock_id else None
        writer.writerow([
            plan.sheet_name,
            plan.sheet_width,
            plan.sheet_height,
            stock.weight if stock else '-',
            stock.color if stock else '-',
            stock.paper_type if stock else '-',
            plan.sheets_needed,
            plan.sheets_available,
            plan.sheets_shortage,
            stock.unit_price if stock else 0,
            plan.material_cost
        ])
    
    writer.writerow([])
    writer.writerow(['总计', '', '', '', '', '', 
                     sum(p.sheets_needed for p in plans),
                     sum(p.sheets_available for p in plans),
                     sum(p.sheets_shortage for p in plans),
                     '',
                     sum(p.material_cost for p in plans)])
    
    csv_content = output.getvalue()
    output.close()
    
    response = make_response(csv_content)
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=materials-{order.order_number}.csv'
    
    return response

@api.route('/orders/import', methods=['POST'])
def import_orders():
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    if not (file.filename.endswith('.csv') or file.filename.endswith('.CSV')):
        return jsonify({'error': '只支持CSV文件'}), 400
    
    try:
        content = file.read().decode('utf-8')
        lines = content.strip().split('\n')
        
        if not lines:
            return jsonify({'error': '文件为空'}), 400
        
        reader = csv.DictReader(lines)
        
        order = Order(
            order_number=Order.generate_order_number(Order()),
            status=OrderStatus.DRAFT.value
        )
        db.session.add(order)
        db.session.flush()
        
        items_count = 0
        for row in reader:
            item = OrderItem(
                order_id=order.id,
                product_name=row.get('产品名称', row.get('product_name', '导入产品')),
                finished_width=float(row.get('成品宽度(mm)', row.get('finished_width', 0))),
                finished_height=float(row.get('成品高度(mm)', row.get('finished_height', 0))),
                quantity=int(row.get('数量', row.get('quantity', 0))),
                paper_type=row.get('纸质', row.get('paper_type')),
                paper_weight=float(row.get('克重(g)', row.get('paper_weight', 0)) or 0),
                paper_color=row.get('颜色', row.get('paper_color', '白色')),
                grain_direction=row.get('纹理方向', row.get('grain_direction', 'any')),
                notes=row.get('备注', row.get('notes'))
            )
            db.session.add(item)
            items_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'order': order.to_dict(),
            'items_imported': items_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 400
