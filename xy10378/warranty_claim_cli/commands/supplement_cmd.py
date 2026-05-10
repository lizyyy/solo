import argparse
import uuid
from datetime import datetime

from warranty_claim_cli.utils.storage import (
    load_materials,
    save_materials,
    load_inspections,
    save_inspections,
)
from warranty_claim_cli.models.claim_engine import evaluate_claim, ClaimStatus

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "supplement",
        help="补充索赔材料或维修鉴定"
    )
    parser.add_argument(
        "--failure-id",
        required=True,
        help="故障 ID"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--material",
        nargs=2,
        metavar=("TYPE", "FILE/INFO"),
        help="补充材料: 材料类型 和 文件路径/信息"
    )
    group.add_argument(
        "--inspection",
        nargs="+",
        metavar=("IS_HUMAN_DAMAGE", "INSPECTOR", "REASON"),
        help="补充维修鉴定: 是否人为损坏(true/false), 鉴定人, 鉴定意见"
    )
    return parser

def execute(args):
    if args.material:
        material_type, material_info = args.material
        
        materials = load_materials()
        new_material = {
            "material_id": str(uuid.uuid4())[:8],
            "failure_id": args.failure_id,
            "material_type": material_type,
            "material_info": material_info,
            "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        materials.append(new_material)
        save_materials(materials)
        
        print(f"✓ 已补充材料: {material_type}")
        print(f"  材料信息: {material_info}")
        
    elif args.inspection:
        if len(args.inspection) < 2:
            print("错误: 维修鉴定需要至少两个参数: 是否人为损坏 和 鉴定人")
            return 1
        
        is_human_str = args.inspection[0].lower()
        is_human_damage = is_human_str in ['true', '1', 'yes', '是']
        inspector = args.inspection[1]
        reason = args.inspection[2] if len(args.inspection) > 2 else "无详细说明"
        
        inspections = load_inspections()
        existing_idx = None
        for idx, i in enumerate(inspections):
            if i.get("failure_id") == args.failure_id:
                existing_idx = idx
                break
        
        new_inspection = {
            "inspection_id": str(uuid.uuid4())[:8],
            "failure_id": args.failure_id,
            "is_human_damage": is_human_damage,
            "inspector": inspector,
            "inspection_reason": reason,
            "inspection_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        if existing_idx is not None:
            old_id = inspections[existing_idx].get("inspection_id")
            new_inspection["inspection_id"] = old_id
            inspections[existing_idx] = new_inspection
            print(f"✓ 已更新维修鉴定")
        else:
            inspections.append(new_inspection)
            print(f"✓ 已添加维修鉴定")
        
        save_inspections(inspections)
        
        print(f"  鉴定人: {inspector}")
        print(f"  是否人为损坏: {'是' if is_human_damage else '否'}")
        print(f"  鉴定意见: {reason}")
    
    print(f"\n重新检查故障 {args.failure_id} 的索赔状态...")
    result = evaluate_claim(args.failure_id)
    
    if result['status'] == ClaimStatus.ELIGIBLE.value:
        print(f"\n✓ 状态变为: 可索赔")
        print("  现在可以使用 'submit' 命令提交索赔")
    elif result['status'] == ClaimStatus.PENDING.value:
        print(f"\n⚠ 状态仍为: 待补充材料")
        if result['material_info'] and result['material_info'].get('missing'):
            print(f"  仍缺少: {', '.join(result['material_info']['missing'])}")
    else:
        print(f"\n✗ 状态: {result['status']}")
        if result['reasons']:
            print(f"  原因: {', '.join(result['reasons'])}")
    
    return 0
