import argparse
import json
from datetime import datetime
from pathlib import Path

from warranty_claim_cli.utils.storage import (
    load_devices,
    load_failures,
    load_inspections,
    load_warranties,
    load_materials,
    load_claims,
    get_claim_by_id,
    DATA_DIR,
)
from warranty_claim_cli.models.claim_engine import (
    evaluate_all_claims,
    ClaimStatus,
)

def setup_parser(subparsers):
    parser = subparsers.add_parser(
        "export",
        help="导出索赔报告"
    )
    parser.add_argument(
        "--claim-id",
        help="指定索赔单号导出单个报告"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="导出所有索赔状态汇总报告"
    )
    parser.add_argument(
        "--output",
        default="claim_report",
        help="输出文件名（不含扩展名）"
    )
    parser.add_argument(
        "--format",
        choices=["json", "txt"],
        default="txt",
        help="输出格式"
    )
    return parser

def generate_text_report(results, claims):
    report = []
    report.append("=" * 80)
    report.append("设备保修期索赔报告")
    report.append("=" * 80)
    report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("")
    
    eligible = [r for r in results if r['status'] == ClaimStatus.ELIGIBLE.value]
    pending = [r for r in results if r['status'] == ClaimStatus.PENDING.value]
    rejected = [r for r in results if r['status'] == ClaimStatus.REJECTED.value]
    submitted_claims = claims
    
    report.append("一、统计汇总")
    report.append("-" * 80)
    report.append(f"  总故障记录: {len(results)} 条")
    report.append(f"  可索赔: {len(eligible)} 条")
    report.append(f"  待补充材料: {len(pending)} 条")
    report.append(f"  已拒绝: {len(rejected)} 条")
    report.append(f"  已提交: {len(submitted_claims)} 条")
    report.append("")
    
    if eligible:
        report.append("二、可索赔的故障（可提交）")
        report.append("-" * 80)
        for r in eligible:
            device = r.get('device_info', {}) or {}
            failure = r.get('failure_info', {}) or {}
            report.append(f"")
            report.append(f"  故障 ID: {r['failure_id']}")
            report.append(f"  设备: {device.get('device_name', '未知')} ({device.get('device_id', '')})")
            report.append(f"  序列号: {device.get('serial_number', '未知')}")
            report.append(f"  采购日期: {device.get('purchase_date', '未知')}")
            report.append(f"  故障日期: {failure.get('failure_date', '未知')}")
            report.append(f"  故障描述: {failure.get('description', '无')}")
            if r.get('details', {}).get('summary'):
                report.append(f"  说明: {r['details']['summary']}")
            report.append(f"  建议: 使用 submit --failure-id {r['failure_id']} 提交")
        report.append("")
    
    if pending:
        report.append("三、待补充材料的故障")
        report.append("-" * 80)
        for r in pending:
            device = r.get('device_info', {}) or {}
            failure = r.get('failure_info', {}) or {}
            report.append(f"")
            report.append(f"  故障 ID: {r['failure_id']}")
            report.append(f"  设备: {device.get('device_name', '未知')}")
            report.append(f"  故障日期: {failure.get('failure_date', '未知')}")
            report.append(f"  原因: {', '.join(r['reasons'])}")
            for key, value in r.get('details', {}).items():
                report.append(f"  - {value}")
        report.append("")
    
    if rejected:
        report.append("四、已拒绝的故障（不可索赔）")
        report.append("-" * 80)
        for r in rejected:
            device = r.get('device_info', {}) or {}
            failure = r.get('failure_info', {}) or {}
            report.append(f"")
            report.append(f"  故障 ID: {r['failure_id']}")
            report.append(f"  设备: {device.get('device_name', '未知')} ({device.get('device_id', '')})")
            report.append(f"  故障日期: {failure.get('failure_date', '未知')}")
            report.append(f"  拒绝原因: {', '.join(r['reasons'])}")
            for key, value in r.get('details', {}).items():
                report.append(f"  - {value}")
        report.append("")
    
    if submitted_claims:
        report.append("五、已提交的索赔")
        report.append("-" * 80)
        for c in submitted_claims:
            device = c.get('device', {})
            report.append(f"")
            report.append(f"  索赔单号: {c.get('claim_id', '未知')}")
            report.append(f"  故障 ID: {c.get('failure_id', '未知')}")
            report.append(f"  提交时间: {c.get('submit_date', '未知')}")
            report.append(f"  设备: {device.get('device_name', '未知')} ({device.get('serial_number', '未知')})")
        report.append("")
    
    report.append("=" * 80)
    report.append("报告结束")
    report.append("=" * 80)
    
    return "\n".join(report)

def generate_single_claim_text(claim):
    report = []
    report.append("=" * 80)
    report.append("设备保修期索赔报告（单个）")
    report.append("=" * 80)
    report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("")
    
    report.append("一、索赔基本信息")
    report.append("-" * 80)
    report.append(f"  索赔单号: {claim.get('claim_id', '未知')}")
    report.append(f"  故障 ID: {claim.get('failure_id', '未知')}")
    report.append(f"  提交时间: {claim.get('submit_date', '未知')}")
    report.append(f"  状态: {claim.get('status', '未知')}")
    report.append("")
    
    device = claim.get('device', {})
    report.append("二、设备信息")
    report.append("-" * 80)
    report.append(f"  设备 ID: {device.get('device_id', '未知')}")
    report.append(f"  设备名称: {device.get('device_name', '未知')}")
    report.append(f"  序列号: {device.get('serial_number', '未知')}")
    report.append(f"  品牌: {device.get('brand', '未知')}")
    report.append(f"  型号: {device.get('model', '未知')}")
    report.append(f"  采购日期: {device.get('purchase_date', '未知')}")
    report.append("")
    
    failure = claim.get('failure', {})
    report.append("三、故障信息")
    report.append("-" * 80)
    report.append(f"  故障日期: {failure.get('failure_date', '未知')}")
    report.append(f"  故障描述: {failure.get('description', '无')}")
    report.append("")
    
    inspection = claim.get('inspection', {})
    report.append("四、维修鉴定信息")
    report.append("-" * 80)
    report.append(f"  鉴定人: {inspection.get('inspector', '未知')}")
    report.append(f"  是否人为损坏: {'是' if inspection.get('is_human_damage') else '否'}")
    report.append(f"  鉴定意见: {inspection.get('inspection_reason', '无')}")
    report.append("")
    
    warranty = claim.get('warranty', {})
    report.append("五、保修条款信息")
    report.append("-" * 80)
    report.append(f"  设备类型: {warranty.get('device_type', '未知')}")
    report.append(f"  品牌: {warranty.get('brand', '未知')}")
    report.append(f"  保修期限: {warranty.get('warranty_months', '未知')} 个月")
    report.append("")
    
    materials = claim.get('materials', {})
    report.append("六、索赔材料清单")
    report.append("-" * 80)
    report.append(f"  已提供材料: {', '.join(materials.get('provided', [])) or '无'}")
    report.append(f"  缺失材料: {', '.join(materials.get('missing', [])) or '无'}")
    report.append("")
    
    evaluation = claim.get('evaluation', {})
    report.append("七、索赔评估结果")
    report.append("-" * 80)
    report.append(f"  提交前状态: {evaluation.get('status_before_submit', '未知')}")
    report.append(f"  评估原因: {', '.join(evaluation.get('reasons', [])) or '无'}")
    if evaluation.get('details'):
        report.append(f"  详细说明:")
        for key, value in evaluation['details'].items():
            report.append(f"    - {value}")
    report.append("")
    
    report.append("=" * 80)
    report.append("报告结束")
    report.append("=" * 80)
    
    return "\n".join(report)

def execute(args):
    output_dir = Path(DATA_DIR).parent.parent
    output_base = args.output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if args.claim_id:
        claim = get_claim_by_id(args.claim_id)
        if not claim:
            print(f"错误: 未找到索赔记录: {args.claim_id}")
            return 1
        
        if args.format == "json":
            output_file = output_dir / f"{output_base}_{args.claim_id}_{timestamp}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(claim, f, ensure_ascii=False, indent=2)
        else:
            output_file = output_dir / f"{output_base}_{args.claim_id}_{timestamp}.txt"
            content = generate_single_claim_text(claim)
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(content)
        
        print(f"✓ 索赔报告已导出: {output_file}")
        
    elif args.all:
        results = evaluate_all_claims()
        claims = load_claims()
        
        if args.format == "json":
            report_data = {
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "summary": {
                    "total": len(results),
                    "eligible": len([r for r in results if r['status'] == ClaimStatus.ELIGIBLE.value]),
                    "pending": len([r for r in results if r['status'] == ClaimStatus.PENDING.value]),
                    "rejected": len([r for r in results if r['status'] == ClaimStatus.REJECTED.value]),
                    "submitted": len(claims),
                },
                "evaluations": results,
                "submitted_claims": claims,
            }
            output_file = output_dir / f"{output_base}_{timestamp}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2)
        else:
            content = generate_text_report(results, claims)
            output_file = output_dir / f"{output_base}_{timestamp}.txt"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(content)
        
        print(f"✓ 汇总报告已导出: {output_file}")
        
    else:
        print("错误: 请指定 --claim-id 或 --all 参数")
        return 1
    
    return 0
