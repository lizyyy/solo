#!/usr/bin/env python3
import argparse
import sys
import json
from pathlib import Path
from datetime import datetime
from mask_engine import MaskEngine
from report_exporter import ReportExporter
from database import Database
from config import INPUT_DIR, SOURCE_TYPES


def cmd_process(args):
    engine = MaskEngine()
    
    file_path = Path(args.file)
    if not file_path.is_absolute():
        file_path = INPUT_DIR / args.file
    
    print(f"处理文件: {file_path}")
    print(f"来源类型: {args.source_type}")
    print("-" * 50)
    
    try:
        result = engine.process_file(str(file_path), args.source_type)
        
        if result["is_duplicate"]:
            print(f"⚠️  检测到重复批次，跳过处理")
            print(f"批次ID: {result['batch_id']}")
            print(f"状态: {result['status']}")
            print(f"提示: {result['message']}")
        else:
            print(f"✅ 处理完成")
            print(f"批次ID: {result['batch_id']}")
            print(f"总记录数: {result['total_records']}")
            print(f"脱敏记录数: {result['masked_count']}")
            print(f"状态: {result['status']}")
            
            if args.export_masked:
                exporter = ReportExporter()
                masked_path = exporter.export_masked_data(result['batch_id'])
                print(f"脱敏数据已导出: {masked_path}")
            
            if args.show_detail:
                print("\n处理结果明细:")
                for i, r in enumerate(result['results'][:5], 1):
                    print(f"\n记录 {i}:")
                    types = r.get('sensitive_types', [])
                    if types:
                        print(f"  敏感类型: {', '.join(types)}")
                    masked = r.get('masked_content', '') or r.get('masked_answer', '')
                    if masked:
                        print(f"  脱敏内容: {masked[:100]}...")
                
                if len(result['results']) > 5:
                    print(f"\n... 还有 {len(result['results']) - 5} 条记录")
        
        return 0
        
    except Exception as e:
        print(f"❌ 处理失败: {str(e)}")
        return 1


def cmd_status(args):
    engine = MaskEngine()
    db = Database()
    
    if args.batch_id:
        status = engine.get_batch_status(args.batch_id)
        if not status:
            print(f"❌ 批次不存在: {args.batch_id}")
            return 1
        
        batch = status["batch_info"]
        print(f"批次ID: {batch['batch_id']}")
        print(f"批次名称: {batch['batch_name']}")
        print(f"来源类型: {batch['source_type']}")
        print(f"状态: {batch['status']}")
        print(f"总记录数: {batch['total_records']}")
        print(f"脱敏数: {batch['masked_count']}")
        print(f"创建时间: {batch['created_at']}")
        print(f"更新时间: {batch['updated_at']}")
        
        if status["warning_count"] > 0:
            print(f"\n⚠️  异常变更记录: {status['warning_count']} 条")
            for w in status["warning_records"]:
                print(f"  - 记录ID: {w['record_id']}, 版本: V{w['version']}")
                changes = engine.get_record_history(w["record_id"])
                for c in changes["changes"]:
                    print(f"    * V{c['old_version']}→V{c['new_version']}: {c['change_type']}")
        else:
            print("\n✅ 无异常变更记录")
    else:
        batches = db.get_all_batches()
        print(f"共 {len(batches)} 个批次\n")
        print(f"{'批次ID':<20} {'名称':<15} {'类型':<15} {'状态':<10} {'记录数':<8} {'脱敏数':<8}")
        print("-" * 80)
        for batch in batches[:args.limit]:
            print(f"{batch['batch_id']:<20} {batch['batch_name']:<15} {batch['source_type']:<15} "
                  f"{batch['status']:<10} {batch['total_records'] or 0:<8} {batch['masked_count'] or 0:<8}")
        
        if len(batches) > args.limit:
            print(f"\n... 还有 {len(batches) - args.limit} 个批次")
    
    return 0


def cmd_report(args):
    exporter = ReportExporter()
    
    print(f"生成周报...")
    print(f"格式: {args.format}")
    print("-" * 50)
    
    try:
        output_path = exporter.export_weekly_report(output_format=args.format)
        print(f"✅ 周报已生成: {output_path}")
        return 0
    except Exception as e:
        print(f"❌ 生成失败: {str(e)}")
        return 1


def cmd_export(args):
    exporter = ReportExporter()
    
    print(f"导出批次详情: {args.batch_id}")
    print(f"格式: {args.format}")
    print("-" * 50)
    
    try:
        output_path = exporter.export_batch_detail(args.batch_id, args.format)
        print(f"✅ 导出完成: {output_path}")
        
        if args.masked:
            masked_path = exporter.export_masked_data(args.batch_id)
            print(f"✅ 脱敏数据已导出: {masked_path}")
        
        return 0
    except Exception as e:
        print(f"❌ 导出失败: {str(e)}")
        return 1


def cmd_history(args):
    engine = MaskEngine()
    
    history = engine.get_record_history(args.record_id)
    
    print(f"记录ID: {args.record_id}")
    print(f"变更次数: {history['change_count']}")
    print("-" * 50)
    
    if history["changes"]:
        for i, change in enumerate(history["changes"], 1):
            print(f"\n变更 #{i}:")
            print(f"  版本: V{change['old_version']} → V{change['new_version']}")
            print(f"  类型: {change['change_type']}")
            print(f"  时间: {change['changed_at']}")
            if args.show_diff:
                print(f"  旧值: {change['old_value'][:100]}...")
                print(f"  新值: {change['new_value'][:100]}...")
    else:
        print("无变更记录")
    
    return 0


def cmd_test(args):
    print("生成测试数据...")
    test_data_dir = Path(__file__).parent / "data" / "input"
    test_data_dir.mkdir(parents=True, exist_ok=True)
    
    cs_data = [
        {
            "id": "msg001",
            "sender": "customer",
            "timestamp": "2024-01-15 10:30:00",
            "content": "您好，我是张三，我的手机号是13812345678，订单号是ORD202401150001，想查询一下物流"
        },
        {
            "id": "msg002",
            "sender": "service",
            "timestamp": "2024-01-15 10:31:00",
            "content": "您好张先生，您的订单我们正在处理，稍后会通过邮件发送到zhangsan@example.com"
        },
        {
            "id": "msg003",
            "sender": "customer",
            "timestamp": "2024-01-15 10:32:00",
            "content": "好的，我的身份证号是110101199001011234，地址是北京市朝阳区建国路88号"
        }
    ]
    
    with open(test_data_dir / "customer_service.json", 'w', encoding='utf-8') as f:
        json.dump(cs_data, f, ensure_ascii=False, indent=2)
    
    mr_data = [
        {
            "case_id": "CASE001",
            "question": "用户反映退款未到账",
            "answer": "已核实用户李四，手机号13987654321，退款已原路退回至其支付宝账号lisi@example.com",
            "reason": "系统延迟",
            "remark": "用户表示理解"
        },
        {
            "case_id": "CASE002",
            "question": "账号无法登录",
            "answer": "用户王五的账号因安全问题被临时锁定，已协助解锁，身份证号440101199203155678",
            "reason": "异地登录",
            "remark": "已提醒用户注意账号安全"
        }
    ]
    
    with open(test_data_dir / "manual_review.json", 'w', encoding='utf-8') as f:
        json.dump(mr_data, f, ensure_ascii=False, indent=2)
    
    gr_data = [
        {
            "test_id": "TEST001",
            "user_id": "U001",
            "result": "PASS",
            "detail": "用户赵六，电话13511112222，测试通过，银行卡号6222021234567890123已验证",
            "timestamp": "2024-01-15"
        },
        {
            "test_id": "TEST002",
            "user_id": "U002",
            "result": "FAIL",
            "detail": "用户钱七，验证失败，需要重新提交材料",
            "timestamp": "2024-01-15"
        }
    ]
    
    with open(test_data_dir / "gray_record.json", 'w', encoding='utf-8') as f:
        json.dump(gr_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 测试数据已生成到: {test_data_dir}")
    print("\n可用测试文件:")
    print(f"  - customer_service.json (客服对话)")
    print(f"  - manual_review.json (人工改判)")
    print(f"  - gray_record.json (灰度记录)")
    print("\n快速开始命令:")
    print(f"  python cli.py process customer_service.json -t customer_service")
    print(f"  python cli.py process manual_review.json -t manual_review")
    print(f"  python cli.py process gray_record.json -t gray_record")
    
    return 0


def main():
    parser = argparse.ArgumentParser(description="敏感信息遮罩工具 - 运营分析师周报助手")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    process_parser = subparsers.add_parser("process", help="处理文件，进行敏感信息遮罩")
    process_parser.add_argument("file", help="输入文件名（data/input目录下）")
    process_parser.add_argument("-t", "--source-type", required=True, 
                               choices=SOURCE_TYPES,
                               help="来源类型")
    process_parser.add_argument("-e", "--export-masked", action="store_true",
                               help="导出脱敏后的数据")
    process_parser.add_argument("-d", "--show-detail", action="store_true",
                               help="显示处理结果明细")
    process_parser.set_defaults(func=cmd_process)
    
    status_parser = subparsers.add_parser("status", help="查看处理状态")
    status_parser.add_argument("-b", "--batch-id", help="指定批次ID查看详情")
    status_parser.add_argument("-l", "--limit", type=int, default=10,
                              help="显示批次数量限制")
    status_parser.set_defaults(func=cmd_status)
    
    report_parser = subparsers.add_parser("report", help="生成质检周报")
    report_parser.add_argument("-f", "--format", choices=["json", "csv"], 
                              default="csv", help="导出格式")
    report_parser.set_defaults(func=cmd_report)
    
    export_parser = subparsers.add_parser("export", help="导出批次详情")
    export_parser.add_argument("batch_id", help="批次ID")
    export_parser.add_argument("-f", "--format", choices=["json", "csv"], 
                              default="csv", help="导出格式")
    export_parser.add_argument("-m", "--masked", action="store_true",
                              help="同时导出脱敏数据")
    export_parser.set_defaults(func=cmd_export)
    
    history_parser = subparsers.add_parser("history", help="查看记录变更历史")
    history_parser.add_argument("record_id", help="记录ID")
    history_parser.add_argument("-d", "--show-diff", action="store_true",
                               help="显示变更内容差异")
    history_parser.set_defaults(func=cmd_history)
    
    test_parser = subparsers.add_parser("test-data", help="生成测试数据")
    test_parser.set_defaults(func=cmd_test)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
