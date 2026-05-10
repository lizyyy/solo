import argparse

from warranty_claim_cli.models.claim_engine import (
    evaluate_claim,
    evaluate_all_claims,
    ClaimStatus,
)

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "check",
        help="检查索赔状态，判断设备是否可索赔"
    )
    parser.add_argument(
        "--failure-id",
        help="指定故障 ID（不指定则检查所有故障）"
    )
    return parser

def print_claim_result(result, show_details=True):
    device = result.get("device_info", {}) or {}
    failure = result.get("failure_info", {}) or {}
    
    print(f"\n{'='*60}")
    print(f"故障 ID: {result['failure_id']}")
    print(f"状态: {result['status']}")
    
    if device:
        print(f"设备: {device.get('device_name', '未知')} ({device.get('device_id', '')})")
        print(f"序列号: {device.get('serial_number', '未知')}")
        print(f"品牌型号: {device.get('brand', '')} {device.get('model', '')}")
        print(f"采购日期: {device.get('purchase_date', '未知')}")
    
    if failure:
        print(f"故障日期: {failure.get('failure_date', '未知')}")
        print(f"故障描述: {failure.get('description', '无')}")
    
    if result['reasons']:
        print(f"\n原因: {', '.join(result['reasons'])}")
    
    if show_details and result['details']:
        print("\n详细说明:")
        for key, value in result['details'].items():
            print(f"  - {value}")
    
    if result['status'] == ClaimStatus.ELIGIBLE.value:
        print(f"\n✓ 建议: 可以使用 'submit' 命令提交索赔")
    elif result['status'] == ClaimStatus.PENDING.value:
        print(f"\n⚠ 建议: 使用 'supplement' 命令补充缺失材料后再检查")
    elif result['status'] == ClaimStatus.REJECTED.value:
        print(f"\n✗ 建议: 不符合索赔条件，无法提交")

def execute(args):
    if args.failure_id:
        result = evaluate_claim(args.failure_id)
        if not result.get("failure_info"):
            print(f"错误: 未找到故障记录: {args.failure_id}")
            return 1
        print_claim_result(result)
    else:
        results = evaluate_all_claims()
        if not results:
            print("暂无故障记录，请先导入故障数据")
            return 1
        
        eligible = [r for r in results if r['status'] == ClaimStatus.ELIGIBLE.value]
        pending = [r for r in results if r['status'] == ClaimStatus.PENDING.value]
        rejected = [r for r in results if r['status'] == ClaimStatus.REJECTED.value]
        submitted = [r for r in results if r['status'] == ClaimStatus.SUBMITTED.value]
        
        print(f"\n索赔检查报告")
        print(f"{'='*60}")
        print(f"总计: {len(results)} 条")
        print(f"  可索赔: {len(eligible)} 条")
        print(f"  待补充: {len(pending)} 条")
        print(f"  已拒绝: {len(rejected)} 条")
        print(f"  已提交: {len(submitted)} 条")
        
        for r in results:
            print_claim_result(r, show_details=True)
    
    return 0
