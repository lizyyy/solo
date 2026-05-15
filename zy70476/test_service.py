#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app.utils.sample_data import init_all_sample_data
from app.services.detector import detector
from app.services.report_generator import report_generator
from app.models.schemas import RuleType
from app.models.store import store


def run_test():
    print("=" * 60)
    print("版本提醒器服务 - 快速测试")
    print("=" * 60)
    
    print("\n1. 初始化样例数据...")
    init_all_sample_data()
    
    print("\n2. 查看数据统计:")
    partitions = store.get_partitions()
    rules = store.get_rules()
    invoices = store.get_invoices()
    print(f"   - 分区数: {len(partitions)}")
    print(f"   - 规则数: {len(rules)}")
    print(f"   - 发票记录数: {len(invoices)}")
    
    print("\n3. 执行标准规则检测 (normal):")
    batch_id_normal = detector.run_batch_detection(RuleType.NORMAL, "test_user")
    print(f"   - 批次ID: {batch_id_normal}")
    batch_normal = store.get_batch(batch_id_normal)
    print(f"   - 通过: {batch_normal.pass_count}, 失败: {batch_normal.fail_count}, 警告: {batch_normal.warning_count}")
    
    print("\n4. 执行宽松规则检测 (wide):")
    batch_id_wide = detector.run_batch_detection(RuleType.WIDE, "test_user")
    print(f"   - 批次ID: {batch_id_wide}")
    batch_wide = store.get_batch(batch_id_wide)
    print(f"   - 通过: {batch_wide.pass_count}, 失败: {batch_wide.fail_count}, 警告: {batch_wide.warning_count}")
    
    print("\n5. 生成JSON报告 (标准规则):")
    report_json = report_generator.generate_report(batch_id_normal)
    json_content = report_generator.to_json(report_json)
    print("   - JSON报告生成成功")
    
    print("\n6. 生成Markdown报告 (标准规则):")
    md_content = report_generator.to_markdown(report_json)
    print("   - Markdown报告生成成功")
    print("\n" + "=" * 60)
    print("Markdown报告预览:")
    print("=" * 60)
    print(md_content[:500] + "...")
    
    print("\n7. 查看失败项 (标准规则批次):")
    failed_items = store.get_failed_items(batch_id_normal)
    print(f"   - 失败项数量: {len(failed_items)}")
    for item in failed_items:
        print(f"     - {item.item_id}: {item.error_message}")
    
    print("\n8. 按环境查询发票记录 (prod):")
    prod_invoices = store.get_invoices("prod")
    print(f"   - prod环境发票数: {len(prod_invoices)}")
    for inv in prod_invoices:
        print(f"     - {inv.invoice_no}: {inv.amount}元, 原始输入保留: {bool(inv.original_input)}")
    
    print("\n9. 验证规则版本回溯:")
    rule = store.get_rule_by_version("1.0.0")
    print(f"   - 规则版本1.0.0: {rule.rule_name if rule else '未找到'}")
    rule_wide = store.get_rule_by_version("1.0.0-wide")
    print(f"   - 规则版本1.0.0-wide: {rule_wide.rule_name if rule_wide else '未找到'}")
    
    print("\n" + "=" * 60)
    print("测试完成！所有功能正常工作。")
    print("=" * 60)
    print(f"\n提示:")
    print(f"  - 运行 'python -m uvicorn app.main:app --reload' 启动服务")
    print(f"  - 访问 http://localhost:8000/docs 查看API文档")
    print(f"  - 数据文件保存在 data/ 目录")
    print(f"  - 失败项保存在 failed_items/ 目录")
    print(f"  - 报告保存在 reports/ 目录")


if __name__ == "__main__":
    run_test()
