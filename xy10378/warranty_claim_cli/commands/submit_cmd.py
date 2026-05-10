import argparse
import uuid
from datetime import datetime

from warranty_claim_cli.utils.storage import save_claim
from warranty_claim_cli.models.claim_engine import (
    evaluate_claim,
    ClaimStatus,
)

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "submit",
        help="标记提交索赔申请"
    )
    parser.add_argument(
        "--failure-id",
        required=True,
        help="故障 ID"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制提交（即使状态不是'可索赔'）"
    )
    return parser

def execute(args):
    result = evaluate_claim(args.failure_id)
    
    if not result.get("failure_info"):
        print(f"错误: 未找到故障记录: {args.failure_id}")
        return 1
    
    if result['status'] != ClaimStatus.ELIGIBLE.value and not args.force:
        print(f"错误: 故障 {args.failure_id} 状态为 '{result['status']}'，无法提交")
        print()
        if result['reasons']:
            print(f"原因: {', '.join(result['reasons'])}")
        if result['details']:
            for key, value in result['details'].items():
                print(f"  - {value}")
        print()
        print("如需强制提交，请使用 --force 参数")
        return 1
    
    claim_id = f"CLAIM-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    device = result.get("device_info", {}) or {}
    failure = result.get("failure_info", {}) or {}
    inspection = result.get("inspection_info", {}) or {}
    warranty = result.get("warranty_info", {}) or {}
    material_info = result.get("material_info", {}) or {}
    
    claim_data = {
        "claim_id": claim_id,
        "failure_id": args.failure_id,
        "status": ClaimStatus.SUBMITTED.value,
        "submit_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "device": {
            "device_id": device.get("device_id"),
            "device_name": device.get("device_name"),
            "serial_number": device.get("serial_number"),
            "brand": device.get("brand"),
            "model": device.get("model"),
            "purchase_date": device.get("purchase_date"),
        },
        "failure": {
            "failure_date": failure.get("failure_date"),
            "description": failure.get("description"),
        },
        "inspection": {
            "is_human_damage": inspection.get("is_human_damage"),
            "inspector": inspection.get("inspector"),
            "inspection_reason": inspection.get("inspection_reason"),
        },
        "warranty": {
            "device_type": warranty.get("device_type"),
            "brand": warranty.get("brand"),
            "warranty_months": warranty.get("warranty_months"),
        },
        "materials": {
            "provided": material_info.get("provided", []),
            "missing": material_info.get("missing", []),
        },
        "evaluation": {
            "status_before_submit": result['status'],
            "reasons": result['reasons'],
            "details": result['details'],
        }
    }
    
    save_claim(claim_id, claim_data)
    
    print(f"\n✓ 索赔申请已提交")
    print(f"{'='*60}")
    print(f"索赔单号: {claim_id}")
    print(f"故障 ID: {args.failure_id}")
    print(f"提交时间: {claim_data['submit_date']}")
    print(f"设备: {device.get('device_name', '未知')} ({device.get('serial_number', '未知')})")
    print(f"品牌型号: {device.get('brand', '')} {device.get('model', '')}")
    
    if args.force:
        print(f"\n⚠ 警告: 使用了 --force 强制提交")
        print(f"  提交前状态: {result['status']}")
        if result['reasons']:
            print(f"  原因: {', '.join(result['reasons'])}")
    
    print(f"\n索赔数据已保存至: warranty_claim_cli/data/claims/{claim_id}.json")
    print(f"您可以使用 'export' 命令导出完整索赔报告")
    
    return 0
