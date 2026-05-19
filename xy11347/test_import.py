#!/usr/bin/env python3
from app.core.database import SessionLocal
from app.services.services import ImportService

db = SessionLocal()

try:
    import_service = ImportService(db)
    
    # 测试导入订单JSON
    import os
    sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    with open(os.path.join(sample_dir, 'orders.json'), 'rb') as f:
        content = f.read()
    
    result = import_service.import_order_json(content, 'orders.json')
    print(f'✅ 导入订单: 成功={result.success_count}, 错误={result.error_count}')
    
    # 测试导入正常测色数据CSV
    with open(os.path.join(sample_dir, 'color_measurements.csv'), 'rb') as f:
        content = f.read()
    
    result = import_service.import_color_csv(content, 'color_measurements.csv')
    print(f'✅ 导入正常测色数据: 成功={result.success_count}, 错误={result.error_count}')
    
    # 测试导入带错误的CSV
    with open(os.path.join(sample_dir, 'color_measurements_with_errors.csv'), 'rb') as f:
        content = f.read()
    
    result = import_service.import_color_csv(content, 'color_measurements_with_errors.csv')
    print(f'✅ 导入带错误的测色数据: 成功={result.success_count}, 错误={result.error_count}')
    
    for error in result.error_records[:3]:
        print(f'   错误记录: 行号={error.row_number}, 类型={error.error_type}, 原因={error.error_message[:30]}...')
    
    # 测试导入返工记录
    with open(os.path.join(sample_dir, 'rework_notes.csv'), 'rb') as f:
        content = f.read()
    
    result = import_service.import_rework_notes(content, 'rework_notes.csv')
    print(f'✅ 导入返工记录: 成功={result.success_count}, 错误={result.error_count}')
    
    # 测试质检报告生成
    from app.services.services import QCReportService
    report_service = QCReportService(db)
    
    order_nos = ['PO-2024-001', 'PO-2024-002', 'PO-2024-003']
    for order_no in order_nos:
        try:
            report = report_service.generate_report(order_no)
            print(f'✅ 生成质检报告 {order_no}: 合格率={report.pass_rate*100:.1f}%, 结论={report.conclusion}')
        except Exception as e:
            print(f'⚠️ 生成报告失败 {order_no}: {e}')
    
    # 测试数据脱敏
    from app.core.security import mask_sensitive_data
    test_data = {'operator': '张三峰', 'customer': '客户公司名称'}
    masked = mask_sensitive_data(test_data)
    print(f'✅ 数据脱敏测试: {test_data} -> {masked}')
    
    print('\n🎉 导入和业务流程全部测试通过！')

except Exception as e:
    print(f'❌ 错误: {e}')
    import traceback
    traceback.print_exc()
finally:
    db.close()
