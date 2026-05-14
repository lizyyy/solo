#!/usr/bin/env python3
import sys
import os
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import init_db, db_session
from app.seeds import seed_all, get_seed_summary
from app.services import SubstitutionService
from app.export_service import export_substitution_detail, export_formula_history, export_requests_summary


def print_header(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def print_result(result):
    if result.get("success"):
        print(f"✅ 成功：{result.get('message', '操作成功')}")
        for key, value in result.items():
            if key not in ["success", "message"]:
                print(f"   {key}: {value}")
    else:
        print(f"❌ 失败：{result.get('message', '未知错误')}")


def cmd_init(args):
    print_header("初始化数据库和种子数据")
    init_db()
    result = seed_all()
    print(f"✅ {result}")
    print("\n📊 数据概览：")
    for key, value in get_seed_summary().items():
        print(f"   {key}: {value}")


def cmd_create(args):
    print_header("创建替代申请")
    with db_session() as db:
        result = SubstitutionService.create_draft(
            db=db,
            original_code=args.original,
            substitute_code=args.substitute,
            reason=args.reason,
            created_by=args.creator,
            substitute_ratio=args.ratio,
            is_temporary=not args.permanent
        )
        print_result(result)
        if result["success"]:
            print(f"\n📝 申请单号：{result['request_no']}")
            print(f"📊 受影响配方数：{result['affected_formula_count']}")
            for f in result["affected_formulas"]:
                print(f"   - {f['code']}: {f['name']} (用量: {f['usage']}kg)")
            print(f"\n⚠️  警告信息：")
            for msg in result.get("warnings", []):
                print(f"   {msg}")
            return result["request_no"]
    return None


def cmd_submit(args):
    print_header("提交审批")
    with db_session() as db:
        result = SubstitutionService.submit_for_approval(
            db=db,
            request_no=args.request_no,
            submitter=args.submitter
        )
        print_result(result)
        if result["success"]:
            print(f"📌 当前状态：{result['current_status']}")
            print(f"👤 下一审批人：{result['next_approver']}")


def cmd_approve(args):
    print_header(f"执行审批 ({args.level})")
    level_map = {"qc": "QC", "cost": "COST", "final": "FINAL"}
    result_map = {"pass": "APPROVE", "reject": "REJECT", "defer": "DEFER"}
    
    with db_session() as db:
        result = SubstitutionService.approve(
            db=db,
            request_no=args.request_no,
            approver=args.approver,
            level=level_map[args.level],
            result=result_map[args.result],
            comment=args.comment or ""
        )
        print_result(result)


def cmd_freeze(args):
    print_header("冻结申请")
    with db_session() as db:
        result = SubstitutionService.freeze_request(
            db=db,
            request_no=args.request_no,
            operator=args.operator,
            reason=args.reason
        )
        print_result(result)


def cmd_unfreeze(args):
    print_header("解冻申请")
    with db_session() as db:
        result = SubstitutionService.unfreeze_request(
            db=db,
            request_no=args.request_no,
            operator=args.operator
        )
        print_result(result)


def cmd_execute(args):
    print_header("执行配方更新")
    with db_session() as db:
        result = SubstitutionService.execute_substitution(
            db=db,
            request_no=args.request_no,
            operator=args.operator,
            simulate_failure=args.simulate_failure
        )
        print_result(result)
        if "details" in result:
            print("\n📋 执行详情：")
            for detail in result["details"]:
                icon = "✅" if detail["status"] == "成功" else "❌"
                msg = f"{icon} {detail['formula_code']} - {detail['formula_name']}: {detail['status']}"
                if detail.get("new_version"):
                    msg += f" (新版本: {detail['new_version']})"
                if detail.get("error"):
                    msg += f" - {detail['error']}"
                print(f"   {msg}")


def cmd_retry(args):
    print_header("重试失败的执行")
    with db_session() as db:
        result = SubstitutionService.retry_failed(
            db=db,
            request_no=args.request_no,
            operator=args.operator
        )
        print_result(result)


def cmd_list(args):
    print_header(f"申请列表 (状态: {args.status or '全部'})")
    with db_session() as db:
        requests = SubstitutionService.list_requests(db, args.status, args.limit)
        if not requests:
            print("  (暂无数据)")
            return
        
        print(f"{'申请单号':<25} {'状态':<10} {'原原料':<12} → {'替代原料':<12} {'配方数':<6} {'差异率':<8}")
        print("-" * 85)
        for r in requests:
            print(f"{r['request_no']:<25} {r['status']:<10} {r['original']:<12} → {r['substitute']:<12} {r['affected_count']:<6} {r['cost_diff']:<8}")


def cmd_detail(args):
    print_header(f"申请详情: {args.request_no}")
    with db_session() as db:
        detail = SubstitutionService.get_request_detail(db, args.request_no)
        if not detail:
            print("  ❌ 申请不存在")
            return
        
        print(f"📋 基本信息")
        print(f"   申请单号: {detail['request_no']}")
        print(f"   当前状态: {detail['status']}")
        print(f"   创建人: {detail['created_by']}")
        print(f"   创建时间: {detail['created_at']}")
        print(f"   完成时间: {detail['completed_at'] or '未完成'}")
        
        print(f"\n🔄 替代信息")
        print(f"   原原料: {detail['original_material']}")
        print(f"   替代原料: {detail['substitute_material']}")
        print(f"   替代比例: {detail['substitute_ratio'] * 100}%")
        print(f"   临时替代: {'是' if detail['is_temporary'] else '否'}")
        print(f"   替代原因: {detail['reason']}")
        
        print(f"\n💰 成本核算")
        for key, value in detail['cost_summary'].items():
            print(f"   {key}: {value}")
        
        print(f"\n📦 受影响配方 ({len(detail['affected_formulas'])} 个)")
        for f in detail['affected_formulas']:
            status_display = {
                "pending": "⏳ 待处理",
                "success": "✅ 已更新",
                "failed": "❌ 更新失败"
            }.get(f['processing_status'], f['processing_status'])
            print(f"   {f['code']} - {f['name']}: 用量 {f['original_usage']}kg, {status_display}")
        
        if detail['approvals']:
            print(f"\n📝 审批记录")
            for a in detail['approvals']:
                print(f"   [{a['time']}] {a['level']} - {a['approver']}: {a['result']}")
                if a['comment']:
                    print(f"      意见: {a['comment']}")
        
        if detail['execution_traces']:
            print(f"\n📊 执行追溯")
            for t in detail['execution_traces']:
                icon = "✅" if t['status'] == "成功" else "❌"
                print(f"   [{t['time']}] {icon} {t['step']}")
                if t['error']:
                    print(f"      错误: {t['error']}")


def cmd_export(args):
    print_header("导出数据")
    with db_session() as db:
        if args.type == "substitution":
            if not args.request_no:
                print("  ❌ 请提供申请单号 (--request-no)")
                return
            filepath = export_substitution_detail(db, args.request_no)
        elif args.type == "formula":
            if not args.formula_code:
                print("  ❌ 请提供配方编码 (--formula-code)")
                return
            filepath = export_formula_history(db, args.formula_code)
        else:
            filepath = export_requests_summary(db, args.limit)
        
        if filepath:
            print(f"✅ 导出成功: {filepath}")
            print("💡 提示: 此文件可直接用 Excel 打开查看")
        else:
            print("❌ 导出失败")


def cmd_demo_normal(args):
    print_header("【演示】正常流程：大豆油A → 大豆油B")
    init_db()
    seed_all()
    
    with db_session() as db:
        print("\n" + "-"*60)
        print("步骤 1: 创建替代申请 (原因: 供应商断货)")
        print("-"*60)
        result = SubstitutionService.create_draft(
            db, "RM-001", "RM-002",
            "供应商突发断货，需临时用大豆油B替代",
            "采购员-张三"
        )
        print_result(result)
        request_no = result["request_no"]
        
        print("\n" + "-"*60)
        print("步骤 2: 提交审批")
        print("-"*60)
        result = SubstitutionService.submit_for_approval(db, request_no, "采购员-张三")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 3: 质检审批通过 (差异率 10.4%，刚好需要质检)")
        print("-"*60)
        result = SubstitutionService.approve(db, request_no, "质检-李四", "QC", "APPROVE", "质检规格符合要求")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 4: 成本审批通过")
        print("-"*60)
        result = SubstitutionService.approve(db, request_no, "成本-王五", "COST", "APPROVE", "成本在可接受范围内")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 5: 最终审批通过")
        print("-"*60)
        result = SubstitutionService.approve(db, request_no, "经理-赵六", "FINAL", "APPROVE", "同意执行")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 6: 执行配方更新")
        print("-"*60)
        result = SubstitutionService.execute_substitution(db, request_no, "工程师-钱七")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 7: 查看申请详情")
        print("-"*60)
        detail = SubstitutionService.get_request_detail(db, request_no)
        print(f"📋 申请单号: {detail['request_no']}")
        print(f"📌 最终状态: {detail['status']}")
        print(f"📦 受影响配方: {len(detail['affected_formulas'])} 个")
        for f in detail['affected_formulas']:
            print(f"   - {f['code']}: {f['name']} (v{f.get('new_version_id', '?')})")
        
        print("\n" + "-"*60)
        print("步骤 8: 导出复核单")
        print("-"*60)
        filepath = export_substitution_detail(db, request_no)
        print(f"✅ 复核单已导出: {filepath}")
        
        print("\n" + "="*60)
        print("🎉 演示完成！")
        print("="*60)


def cmd_demo_fail_retry(args):
    print_header("【演示】失败补偿流程：模拟执行失败后重试")
    init_db()
    seed_all()
    
    with db_session() as db:
        print("\n" + "-"*60)
        print("步骤 1: 创建替代申请 (黄油 → 人造黄油)")
        print("-"*60)
        result = SubstitutionService.create_draft(
            db, "RM-008", "RM-009",
            "黄油库存为0，紧急替代",
            "采购员-张三"
        )
        print_result(result)
        request_no = result["request_no"]
        
        print("\n" + "-"*60)
        print("步骤 2: 提交并完成三级审批 (成本差异大)")
        print("-"*60)
        SubstitutionService.submit_for_approval(db, request_no, "采购员-张三")
        SubstitutionService.approve(db, request_no, "质检-李四", "QC", "APPROVE", "质检通过")
        SubstitutionService.approve(db, request_no, "成本-王五", "COST", "APPROVE", "成本下降，同意")
        SubstitutionService.approve(db, request_no, "经理-赵六", "FINAL", "APPROVE", "同意执行")
        print("✅ 已完成：质检审批 → 成本审批 → 最终审批")
        
        print("\n" + "-"*60)
        print("步骤 3: 执行配方更新，模拟第1个配方失败 (索引=0)")
        print("-"*60)
        result = SubstitutionService.execute_substitution(
            db, request_no, "工程师-钱七",
            simulate_failure=0
        )
        print_result(result)
        for d in result["details"]:
            icon = "✅" if d["status"] == "成功" else "❌"
            print(f"   {icon} {d['formula_code']}: {d['status']}")
        
        print("\n" + "-"*60)
        print("步骤 4: 再次执行，自动重试失败的配方 (无需清库!)")
        print("-"*60)
        result = SubstitutionService.retry_failed(db, request_no, "工程师-钱七")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 5: 查看最终状态")
        print("-"*60)
        detail = SubstitutionService.get_request_detail(db, request_no)
        print(f"📌 最终状态: {detail['status']}")
        print(f"📊 执行追溯 ({len(detail['execution_traces'])} 条记录):")
        for t in detail['execution_traces']:
            icon = "✅" if t['status'] == "成功" else "❌"
            print(f"   [{t['time']}] {icon} {t['step']}")
        
        print("\n" + "="*60)
        print("🎉 补偿机制演示完成！失败的配方已成功重试")
        print("="*60)


def cmd_demo_freeze(args):
    print_header("【演示】审批冻结流程")
    init_db()
    seed_all()
    
    with db_session() as db:
        print("\n" + "-"*60)
        print("步骤 1: 创建申请并审批到可执行状态")
        print("-"*60)
        result = SubstitutionService.create_draft(
            db, "RM-001", "RM-002",
            "测试冻结流程",
            "测试员"
        )
        request_no = result["request_no"]
        SubstitutionService.submit_for_approval(db, request_no, "测试员")
        SubstitutionService.approve(db, request_no, "质检", "QC", "APPROVE")
        SubstitutionService.approve(db, request_no, "成本", "COST", "APPROVE")
        SubstitutionService.approve(db, request_no, "经理", "FINAL", "APPROVE")
        detail = SubstitutionService.get_request_detail(db, request_no)
        print(f"📌 状态: {detail['status']} (准备执行)")
        
        print("\n" + "-"*60)
        print("步骤 2: 执行前发现问题，紧急冻结")
        print("-"*60)
        result = SubstitutionService.freeze_request(
            db, request_no, "风控专员",
            "供应商资质重新审核中，暂停执行"
        )
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 3: 尝试执行冻结的申请，会被拒绝")
        print("-"*60)
        result = SubstitutionService.execute_substitution(db, request_no, "工程师")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 4: 问题解决，解冻申请")
        print("-"*60)
        result = SubstitutionService.unfreeze_request(db, request_no, "风控专员")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 5: 正常执行")
        print("-"*60)
        result = SubstitutionService.execute_substitution(db, request_no, "工程师")
        print_result(result)
        
        print("\n" + "="*60)
        print("🎉 冻结流程演示完成！")
        print("="*60)


def cmd_demo_low_cost(args):
    print_header("【演示】低成本差异流程（只需成本审批）")
    print("💡 场景：面粉X缺货，用面粉Y替代")
    print("💡 成本差异率 = (3.5-3.2)/3.2 = 9.375%，在阈值 10% 内")
    print("💡 只需成本审批，无需质检和最终审批")
    init_db()
    seed_all()
    
    with db_session() as db:
        print("\n" + "-"*60)
        print("步骤 1: 创建替代申请 (面粉X → 面粉Y)")
        print("-"*60)
        result = SubstitutionService.create_draft(
            db, "RM-003", "RM-004",
            "面粉X库存为0，临时用面粉Y替代",
            "采购员-张三"
        )
        print_result(result)
        request_no = result["request_no"]
        
        print("\n" + "-"*60)
        print("步骤 2: 提交审批")
        print("-"*60)
        result = SubstitutionService.submit_for_approval(db, request_no, "采购员-张三")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 3: 成本审批通过（只有一级审批！）")
        print("-"*60)
        result = SubstitutionService.approve(
            db, request_no, "成本-王五", 
            "COST", "APPROVE", 
            "成本差异率 9.375%，在阈值内，同意"
        )
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 4: 执行配方更新")
        print("-"*60)
        result = SubstitutionService.execute_substitution(db, request_no, "工程师-钱七")
        print_result(result)
        
        print("\n" + "-"*60)
        print("步骤 5: 查看申请详情")
        print("-"*60)
        detail = SubstitutionService.get_request_detail(db, request_no)
        print(f"📋 申请单号: {detail['request_no']}")
        print(f"📌 最终状态: {detail['status']}")
        print(f"💰 成本核算:")
        for key, value in detail['cost_summary'].items():
            print(f"   {key}: {value}")
        print(f"📦 受影响配方: {len(detail['affected_formulas'])} 个")
        for f in detail['affected_formulas']:
            print(f"   - {f['code']}: {f['name']}")
        print(f"📝 审批记录数: {len(detail['approvals'])} 条")
        
        print("\n" + "-"*60)
        print("步骤 6: 导出复核单")
        print("-"*60)
        filepath = export_substitution_detail(db, request_no)
        print(f"✅ 复核单已导出: {filepath}")
        
        print("\n" + "="*60)
        print("🎉 低成本差异审批流程演示完成！")
        print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description="原料替代审批系统命令行工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 初始化数据
  python3 -m cli.main init
  
  # 创建替代申请
  python3 -m cli.main create --original RM-001 --substitute RM-002 --reason "供应商断货" --creator 张三
  
  # 查看申请列表
  python3 -m cli.main list
  
  # 运行演示（推荐先看低成本差异流程）
  python3 -m cli.main demo-low-cost   # 差异率 9.375%，只需成本审批
  python3 -m cli.main demo-normal     # 差异率 10.4%，需要三级审批
  python3 -m cli.main demo-fail-retry # 失败后重试补偿
  python3 -m cli.main demo-freeze     # 审批冻结流程
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    subparsers.add_parser("init", help="初始化数据库和种子数据")
    
    create_parser = subparsers.add_parser("create", help="创建替代申请")
    create_parser.add_argument("--original", required=True, help="原原料编码 (如 RM-001)")
    create_parser.add_argument("--substitute", required=True, help="替代原料编码 (如 RM-002)")
    create_parser.add_argument("--reason", required=True, help="替代原因")
    create_parser.add_argument("--creator", required=True, help="申请人")
    create_parser.add_argument("--ratio", type=float, default=1.0, help="替代比例 (默认 1.0)")
    create_parser.add_argument("--permanent", action="store_true", help="是否为永久替代 (默认临时)")
    
    submit_parser = subparsers.add_parser("submit", help="提交审批")
    submit_parser.add_argument("--request-no", required=True, help="申请单号")
    submit_parser.add_argument("--submitter", required=True, help="提交人")
    
    approve_parser = subparsers.add_parser("approve", help="执行审批")
    approve_parser.add_argument("--request-no", required=True, help="申请单号")
    approve_parser.add_argument("--approver", required=True, help="审批人")
    approve_parser.add_argument("--level", required=True, choices=["qc", "cost", "final"], help="审批级别")
    approve_parser.add_argument("--result", required=True, choices=["pass", "reject", "defer"], help="审批结果")
    approve_parser.add_argument("--comment", help="审批意见")
    
    freeze_parser = subparsers.add_parser("freeze", help="冻结申请")
    freeze_parser.add_argument("--request-no", required=True, help="申请单号")
    freeze_parser.add_argument("--operator", required=True, help="操作人")
    freeze_parser.add_argument("--reason", required=True, help="冻结原因")
    
    unfreeze_parser = subparsers.add_parser("unfreeze", help="解冻申请")
    unfreeze_parser.add_argument("--request-no", required=True, help="申请单号")
    unfreeze_parser.add_argument("--operator", required=True, help="操作人")
    
    execute_parser = subparsers.add_parser("execute", help="执行配方更新")
    execute_parser.add_argument("--request-no", required=True, help="申请单号")
    execute_parser.add_argument("--operator", required=True, help="执行人")
    execute_parser.add_argument("--simulate-failure", type=int, default=-1, help="模拟失败的配方索引 (用于测试)")
    
    retry_parser = subparsers.add_parser("retry", help="重试失败的执行")
    retry_parser.add_argument("--request-no", required=True, help="申请单号")
    retry_parser.add_argument("--operator", required=True, help="执行人")
    
    list_parser = subparsers.add_parser("list", help="查看申请列表")
    list_parser.add_argument("--status", help="按状态过滤")
    list_parser.add_argument("--limit", type=int, default=50, help="返回数量限制")
    
    detail_parser = subparsers.add_parser("detail", help="查看申请详情")
    detail_parser.add_argument("--request-no", required=True, help="申请单号")
    
    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--type", required=True, choices=["substitution", "formula", "summary"], help="导出类型")
    export_parser.add_argument("--request-no", help="申请单号 (type=substitution 时需要)")
    export_parser.add_argument("--formula-code", help="配方编码 (type=formula 时需要)")
    export_parser.add_argument("--limit", type=int, default=100, help="汇总导出数量限制")
    
    subparsers.add_parser("demo-normal", help="【演示】高成本差异流程（三级审批）")
    subparsers.add_parser("demo-low-cost", help="【演示】低成本差异流程（只需成本审批）")
    subparsers.add_parser("demo-fail-retry", help="【演示】执行失败后重试补偿")
    subparsers.add_parser("demo-freeze", help="【演示】审批冻结流程")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    commands = {
        "init": cmd_init,
        "create": cmd_create,
        "submit": cmd_submit,
        "approve": cmd_approve,
        "freeze": cmd_freeze,
        "unfreeze": cmd_unfreeze,
        "execute": cmd_execute,
        "retry": cmd_retry,
        "list": cmd_list,
        "detail": cmd_detail,
        "export": cmd_export,
        "demo-normal": cmd_demo_normal,
        "demo-low-cost": cmd_demo_low_cost,
        "demo-fail-retry": cmd_demo_fail_retry,
        "demo-freeze": cmd_demo_freeze,
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
