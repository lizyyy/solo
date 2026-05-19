import sys
import json
from datetime import datetime
from database import init_database, execute_query
from workflow import (
    create_prescription, submit_prescription, review_prescription,
    dispense_prescription, trace_prescription, get_prescription_history,
    cancel_prescription
)
from business_rules import validate_prescription, calculate_dose
from export_data import export_prescriptions_to_excel, export_dispensing_summary


ROLES = ['DOCTOR', 'PHARMACIST', 'ADMIN']


def init_sample_data():
    medicines = [
        ('阿莫西林', 'Amoxicillin', '硕腾', '片剂', 5.0, 20.0, 'mg'),
        ('头孢氨苄', 'Cefalexin', '默沙东', '片剂', 10.0, 30.0, 'mg'),
        ('泼尼松龙', 'Prednisolone', '辉瑞', '片剂', 0.5, 2.0, 'mg'),
        ('恩诺沙星', 'Enrofloxacin', '拜耳', '注射液', 2.5, 10.0, 'mg'),
        ('美洛昔康', 'Meloxicam', '勃林格', '片剂', 0.05, 0.2, 'mg'),
    ]
    
    medicine_ids = []
    for med in medicines:
        existing = execute_query('''
            SELECT id FROM medicines WHERE name = ?
        ''', (med[0],), fetch=True)
        
        if existing:
            medicine_ids.append(existing[0]['id'])
        else:
            mid = execute_query('''
                INSERT INTO medicines 
                (name, generic_name, manufacturer, dosage_form, 
                 min_dose_per_kg, max_dose_per_kg, dose_unit)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', med)
            medicine_ids.append(mid)
    
    batches = [
        (medicine_ids[0], 'AMX2024001', 100, '片', '2024-01-15', '2027-01-15'),
        (medicine_ids[0], 'AMX2024002', 200, '片', '2024-06-01', '2027-06-01'),
        (medicine_ids[1], 'CEF2024001', 150, '片', '2024-02-20', '2027-02-20'),
        (medicine_ids[2], 'PRE2024001', 80, '片', '2024-03-10', '2027-03-10'),
        (medicine_ids[3], 'ENR2024001', 50, '支', '2024-04-05', '2027-04-05'),
        (medicine_ids[4], 'MEL2024001', 120, '片', '2024-05-12', '2027-05-12'),
    ]
    
    for batch in batches:
        existing = execute_query('''
            SELECT id FROM medicine_batches WHERE batch_number = ?
        ''', (batch[1],), fetch=True)
        
        if not existing:
            execute_query('''
                INSERT INTO medicine_batches 
                (medicine_id, batch_number, quantity, unit, manufacture_date, expiry_date)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', batch)
    
    if len(medicine_ids) >= 3:
        existing = execute_query('''
            SELECT id FROM contraindications 
            WHERE medicine_a_id = ? AND medicine_b_id = ?
        ''', (medicine_ids[2], medicine_ids[3]), fetch=True)
        
        if not existing:
            execute_query('''
                INSERT INTO contraindications (medicine_a_id, medicine_b_id, reason)
                VALUES (?, ?, ?)
            ''', (medicine_ids[2], medicine_ids[3], '泼尼松龙与恩诺沙星联用可能增加神经系统副作用风险'))
    
    return medicine_ids


def print_help():
    print("\n=== 宠物医院药房管理系统 ===")
    print("\n命令列表:")
    print("  init           - 初始化数据库和示例数据")
    print("  create         - 创建处方")
    print("  submit <id>    - 提交处方审核")
    print("  review <id> <approve|block> [reason] - 审核处方")
    print("  dispense <id>  - 发药")
    print("  trace <id>     - 追溯处方完整流程")
    print("  list           - 列出所有处方")
    print("  cancel <id> <reason> - 取消处方")
    print("  export         - 导出数据到Excel")
    print("  export-month   - 导出月度发药汇总")
    print("  calc-dose <mid> <weight> - 计算剂量范围")
    print("  validate <id>  - 验证处方")
    print("  help           - 显示帮助")
    print("\n示例:")
    print("  python cli.py init")
    print("  python cli.py create")
    print("  python cli.py submit 1")
    print("  python cli.py review 1 approve 剂量在范围内")
    print("  python cli.py dispense 1")
    print("  python cli.py trace 1")
    print("  python cli.py export")


def interactive_create_prescription(medicine_ids):
    print("\n=== 创建处方 ===")
    pet_name = input("宠物名称: ").strip()
    pet_weight = float(input("体重(kg): ").strip())
    species = input("物种(猫/狗/其他): ").strip()
    doctor_name = input("医生姓名: ").strip()
    created_by = input("操作人: ").strip()
    
    print("\n可用药品ID:")
    meds = execute_query('SELECT id, name, min_dose_per_kg, max_dose_per_kg FROM medicines', fetch=True)
    for med in meds:
        print(f"  {med['id']}: {med['name']} ({med['min_dose_per_kg']}-{med['max_dose_per_kg']} mg/kg)")
    
    items = []
    while True:
        mid_input = input("\n添加药品ID(直接回车结束): ").strip()
        if not mid_input:
            break
        
        try:
            mid = int(mid_input)
        except ValueError:
            print("请输入有效数字")
            continue
        
        min_d, rec, max_d = calculate_dose(mid, pet_weight)
        print(f"  剂量范围: {min_d:.2f} - {max_d:.2f} mg, 推荐: {rec:.2f} mg")
        
        dose = float(input(f"  处方剂量(mg): ").strip())
        qty = int(input(f"  数量(默认1): ").strip() or "1")
        notes = input(f"  备注(可选): ").strip()
        
        items.append({
            'medicine_id': mid,
            'prescribed_dose': dose,
            'quantity': qty,
            'notes': notes
        })
    
    if not items:
        print("至少需要添加一种药品")
        return
    
    result = create_prescription(pet_name, pet_weight, species, doctor_name, created_by, items)
    print("\n" + json.dumps(result, ensure_ascii=False, indent=2))


def main():
    if len(sys.argv) < 2:
        print_help()
        return
    
    cmd = sys.argv[1].lower()
    
    if cmd == 'init':
        init_database()
        medicine_ids = init_sample_data()
        print("数据库初始化完成!")
        print(f"已加载 {len(medicine_ids)} 种药品")
        return
    
    if cmd == 'help':
        print_help()
        return
    
    if cmd == 'create':
        init_database()
        medicine_ids = init_sample_data()
        interactive_create_prescription(medicine_ids)
        return
    
    if cmd == 'submit' and len(sys.argv) >= 3:
        rx_id = int(sys.argv[2])
        operator = input("操作人: ").strip()
        result = submit_prescription(rx_id, operator)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    if cmd == 'review' and len(sys.argv) >= 4:
        rx_id = int(sys.argv[2])
        approve = sys.argv[3].lower() == 'approve'
        reason = sys.argv[4] if len(sys.argv) >= 5 else ""
        operator = input("操作人: ").strip()
        result = review_prescription(rx_id, operator, approve, reason)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    if cmd == 'dispense' and len(sys.argv) >= 3:
        rx_id = int(sys.argv[2])
        operator = input("操作人: ").strip()
        result = dispense_prescription(rx_id, operator)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    if cmd == 'trace' and len(sys.argv) >= 3:
        rx_id = int(sys.argv[2])
        result = trace_prescription(rx_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    if cmd == 'list':
        prescriptions = get_prescription_history()
        for rx in prescriptions:
            print(f"\n{rx['prescription_no']} - {rx['pet_name']}({rx['pet_weight_kg']}kg) - {rx['status']}")
            print(f"  医生: {rx['doctor_name']}, 创建人: {rx['created_by']}")
            for item in rx['items']:
                print(f"    - {item['medicine_name']}: {item['prescribed_dose']}mg x{item['quantity']}")
        return
    
    if cmd == 'cancel' and len(sys.argv) >= 4:
        rx_id = int(sys.argv[2])
        reason = sys.argv[3]
        operator = input("操作人: ").strip()
        result = cancel_prescription(rx_id, operator, reason)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    if cmd == 'export':
        output = export_prescriptions_to_excel()
        print(f"导出完成: {output}")
        return
    
    if cmd == 'export-month':
        month = input("月份(YYYY-MM, 默认本月): ").strip()
        if not month:
            month = datetime.now().strftime('%Y-%m')
        output = export_dispensing_summary(month)
        print(f"导出完成: {output}")
        return
    
    if cmd == 'calc-dose' and len(sys.argv) >= 4:
        mid = int(sys.argv[2])
        weight = float(sys.argv[3])
        min_d, rec, max_d = calculate_dose(mid, weight)
        print(f"体重 {weight}kg:")
        print(f"  最小剂量: {min_d:.4f} mg")
        print(f"  推荐剂量: {rec:.4f} mg")
        print(f"  最大剂量: {max_d:.4f} mg")
        return
    
    if cmd == 'validate' and len(sys.argv) >= 3:
        rx_id = int(sys.argv[2])
        result = validate_prescription(rx_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    print_help()


if __name__ == '__main__':
    main()
