#!/usr/bin/env python3
import sys
import json
from services import AuditTrailService
from output_formats import OutputFormatter


def main():
    print("=" * 60)
    print("数据修订留痕系统 - 命令行测试工具")
    print("=" * 60)
    print()
    
    audit_service = AuditTrailService()
    report = audit_service.generate_report()
    
    print(f"报告编号: {report.report_id}")
    print(f"生成时间: {report.generated_at}")
    print()
    
    print("统计概览:")
    print(f"  - 报修单总数: {report.total_orders}")
    print(f"  - 跨天报修单: {report.cross_day_orders}")
    print(f"  - 含错误记录: {report.orders_with_errors}")
    print(f"  - 含修订记录: {report.orders_with_revisions}")
    print(f"  - 含字段截断: {report.orders_with_truncated_fields}")
    print()
    
    print("-" * 60)
    print("样例1: 字段截断记录 (WYBX-2026-0515-002)")
    print("-" * 60)
    order2 = audit_service.get_order_by_id("WYBX-2026-0515-002")
    print(f"字段截断标记: {order2.has_truncated_fields}")
    print(f"被截断字段: {order2.truncated_fields}")
    print()
    if order2.revisions:
        rev = order2.revisions[0]
        print(f"修订字段路径: {rev.field_path}")
        print(f"原始值长度: {len(str(rev.original_value))} 字符")
        print(f"修订后长度: {len(str(rev.revised_value))} 字符")
        print(f"修订原因: {rev.revision_reason}")
    print()
    print("原始输入保留在 raw_input 中，可回溯")
    print()
    
    print("-" * 60)
    print("样例2: 边界错误记录 (WYBX-2026-0515-003)")
    print("-" * 60)
    order3 = audit_service.get_order_by_id("WYBX-2026-0515-003")
    print(f"状态: {order3.status}")
    print()
    if order3.processing_errors:
        for err in order3.processing_errors:
            print(f"错误代码: {err.error_code}")
            print(f"错误信息: {err.error_message}")
            print(f"字段路径: {err.field_path}")
            if err.error_details:
                print(f"详细信息: {json.dumps(err.error_details, ensure_ascii=False, indent=2)}")
            print()
    
    print("-" * 60)
    print("样例3: 灰度发布人工修正记录 (WYBX-2026-0515-004)")
    print("-" * 60)
    order4 = audit_service.get_order_by_id("WYBX-2026-0515-004")
    if order4.revisions:
        rev = order4.revisions[0]
        print(f"字段路径: {rev.field_path}")
        print(f"原始值: ¥{rev.original_value}")
        print(f"修订后: ¥{rev.revised_value}")
        print(f"来源: {rev.source}")
        print(f"处理依据: {rev.handling_basis}")
    print()
    
    print("=" * 60)
    print("测试完成! 启动服务请运行: python app.py")
    print("=" * 60)
    print()
    
    print("服务启动后可访问以下接口 (http://localhost:8080):")
    print("  GET /api/health           - 健康检查")
    print("  GET /api/report           - 获取完整报告(JSON)")
    print("  GET /api/report/json      - 格式化JSON输出")
    print("  GET /api/report/markdown  - Markdown格式报告")
    print("  GET /api/report/download  - 下载报告")
    print("  GET /api/orders           - 所有报修单")
    print("  GET /api/orders/<id>      - 单个报修单")
    print("  GET /api/orders/with-errors    - 含错误的报修单")
    print("  GET /api/orders/with-revisions - 含修订的报修单")
    print("  GET /api/orders/with-truncated - 含截断字段的报修单")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
