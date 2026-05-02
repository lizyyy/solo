from app import create_app, db
from app.models import (
    ReagentLedger, Batch, Bottle, Cabinet, WasteBucket, WasteRecord,
    DispenseRecord, TemperatureRecord, AuditLog, HazardClass, WasteStatus
)
import os

app = create_app()

with app.app_context():
    instance_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    
    db.create_all()
    print("数据库初始化完成")


@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'ReagentLedger': ReagentLedger,
        'Batch': Batch,
        'Bottle': Bottle,
        'Cabinet': Cabinet,
        'WasteBucket': WasteBucket,
        'WasteRecord': WasteRecord,
        'DispenseRecord': DispenseRecord,
        'TemperatureRecord': TemperatureRecord,
        'AuditLog': AuditLog,
        'HazardClass': HazardClass,
        'WasteStatus': WasteStatus
    }


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    print("=" * 60)
    print("危化品小瓶分装台 API 服务")
    print("=" * 60)
    print(f"服务地址: http://localhost:5000")
    print(f"健康检查: http://localhost:5000/health")
    print("=" * 60)
    print("API 路由:")
    print("  - 试剂台账: /api/reagent/ledger")
    print("  - 批次管理: /api/reagent/batch")
    print("  - 瓶码管理: /api/reagent/bottle")
    print("  - 柜位管理: /api/reagent/cabinet")
    print("  - 分装记录: /api/dispense/")
    print("  - 温度记录: /api/temperature/")
    print("  - 废液桶: /api/waste/bucket")
    print("  - 废液记录: /api/waste/record")
    print("  - 复核管理: /api/review/")
    print("  - 审计日志: /api/audit/")
    print("  - 数据导入: /api/import/*")
    print("  - 数据导出: /api/export/*")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
