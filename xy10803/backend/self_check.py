import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.services.batch_service import BatchService
from app.services.template_service import TemplateService
from app.services.sandbox_service import SandboxService
from app.schemas.seed_batch import SeedBatchCreate
from app.schemas.data_template import DataTemplateCreate
from app.schemas.tenant_sandbox import TenantSandboxCreate

def run_check():
    print("=" * 60)
    print("🛢️ 沙箱数据种子 API - 系统自检")
    print("=" * 60)
    
    db = SessionLocal()
    passed = 0
    failed = 0
    
    try:
        print("\n📋 检查 1/5: 数据库连接...")
        try:
            db.execute(text("SELECT 1"))
            print("   ✅ 数据库连接正常")
            passed += 1
        except Exception as e:
            print(f"   ❌ 数据库连接失败: {e}")
            failed += 1
            return
        
        print("\n📋 检查 2/5: 创建测试模板...")
        try:
            template_create = DataTemplateCreate(
                name="自检测试模板",
                description="系统自检用",
                template_type="self_check",
                sql_template="SELECT '{{param1}}', '{{param2}}';",
                parameters=[{"name": "param1", "required": True}, {"name": "param2", "required": False}]
            )
            template = TemplateService.create_template(db, template_create)
            print(f"   ✅ 模板创建成功 (ID: {template.id})")
            passed += 1
        except Exception as e:
            print(f"   ❌ 模板创建失败: {e}")
            failed += 1
        
        print("\n📋 检查 3/5: 创建测试沙箱...")
        try:
            sandbox_create = TenantSandboxCreate(
                tenant_id="SELF_CHECK_001",
                name="自检沙箱",
                environment="self_check"
            )
            sandbox = SandboxService.create_sandbox(db, sandbox_create)
            print(f"   ✅ 沙箱创建成功 (ID: {sandbox.id})")
            passed += 1
        except Exception as e:
            print(f"   ❌ 沙箱创建失败: {e}")
            failed += 1
        
        print("\n📋 检查 4/5: 执行种子批次...")
        try:
            batch_create = SeedBatchCreate(
                sandbox_id=sandbox.id,
                template_id=template.id,
                parameters={"param1": "test_value", "param2": "optional_value"},
                created_by="self_check"
            )
            batch = BatchService.create_batch(db, batch_create)
            print(f"   ✅ 批次创建成功 (No: {batch.batch_no})")
            
            success, message = BatchService.execute_batch(db, batch.id)
            if success:
                print(f"   ✅ 批次执行成功: {message}")
                passed += 1
            else:
                print(f"   ❌ 批次执行失败: {message}")
                failed += 1
        except Exception as e:
            print(f"   ❌ 批次执行异常: {e}")
            failed += 1
        
        print("\n📋 检查 5/5: 测试幂等性...")
        try:
            batch_create2 = SeedBatchCreate(
                sandbox_id=sandbox.id,
                template_id=template.id,
                parameters={"param1": "test_value", "param2": "optional_value"},
                created_by="self_check"
            )
            batch2 = BatchService.create_batch(db, batch_create2)
            success, message = BatchService.execute_batch(db, batch2.id)
            
            if success and "idempotent" in message.lower():
                print(f"   ✅ 幂等性检查通过")
                passed += 1
            else:
                print(f"   ⚠️ 幂等性检查结果: {message}")
                failed += 1
        except Exception as e:
            print(f"   ❌ 幂等性检查异常: {e}")
            failed += 1
        
        print("\n" + "=" * 60)
        print(f"📊 自检结果: 通过 {passed} 项, 失败 {failed} 项")
        
        if failed == 0:
            print("🎉 所有检查通过！系统运行正常！")
        else:
            print("⚠️ 部分检查失败，请检查系统配置！")
        print("=" * 60)
        
    finally:
        db.close()

if __name__ == "__main__":
    run_check()
