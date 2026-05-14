#!/usr/bin/env python3
"""
验证模块导入脚本 - 用于检查所有模块是否可以正确导入
使用内存 SQLite 数据库，无需外部服务
"""
import sys
import os

# 先设置环境变量为内存 SQLite，避免外部依赖
os.environ['DATABASE_TYPE'] = 'sqlite'
os.environ['SQLITE_IN_MEMORY'] = 'true'

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_imports():
    print("=" * 60)
    print("模块导入验证")
    print("=" * 60)
    print()
    print("使用内存 SQLite 数据库验证 (无需外部服务)")
    print()
    
    errors = []
    
    # 测试配置模块
    try:
        from app.config import settings
        print("✓ app.config 导入成功")
        print(f"  - 项目名称: {settings.PROJECT_NAME}")
        print(f"  - 数据库类型: {settings.DATABASE_TYPE}")
        print(f"  - 数据库URL: {settings.DATABASE_URL}")
    except Exception as e:
        print("✗ app.config 导入失败")
        print(f"  错误: {e}")
        errors.append(("app.config", str(e)))
    
    # 测试数据库模块
    try:
        from app.database import Base, get_db, get_db_session, init_database, get_engine
        print("✓ app.database 导入成功")
        print("  - 延迟初始化模式 (不会立即连接数据库)")
    except Exception as e:
        print("✗ app.database 导入失败")
        print(f"  错误: {e}")
        errors.append(("app.database", str(e)))
    
    # 测试模型模块
    try:
        from app.models import (
            LoanAccount,
            RepaymentPlan,
            RepaymentPlanHistory,
            RepaymentInstallment,
            ExtensionApplication,
            PenaltySnapshot,
            CreditLimitRecord,
            ApprovalHistory,
            RuleCheckSnapshot,
            AuditLog,
            TaskRecord
        )
        print("✓ app.models 导入成功")
        model_names = [
            'LoanAccount', 'RepaymentPlan', 'RepaymentPlanHistory', 'RepaymentInstallment',
            'ExtensionApplication', 'PenaltySnapshot', 'CreditLimitRecord',
            'ApprovalHistory', 'RuleCheckSnapshot', 'AuditLog', 'TaskRecord'
        ]
        print(f"  - 模型类数量: {len(model_names)}")
    except Exception as e:
        print("✗ app.models 导入失败")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        errors.append(("app.models", str(e)))
    
    # 测试工具模块
    try:
        from app.utils import (
            AccountStatus,
            ApplicationStatus,
            RepaymentPlanStatus,
            InstallmentStatus,
            ApprovalStage,
            OperationType,
            BusinessType,
            SourceType,
            TaskStatus,
            TaskType,
            OperationResult,
            IdGenerator,
            DateTimeUtils
        )
        print("✓ app.utils 导入成功")
    except Exception as e:
        print("✗ app.utils 导入失败")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        errors.append(("app.utils", str(e)))
    
    # 测试服务模块
    try:
        from app.services import (
            RuleEngine,
            AuditService,
            RepaymentCalculator,
            ExtensionService,
            LimitService,
            TaskService,
            ReconciliationService,
            LoanAccountService
        )
        print("✓ app.services 导入成功")
        service_names = [
            'RuleEngine', 'AuditService', 'RepaymentCalculator', 'ExtensionService',
            'LimitService', 'TaskService', 'ReconciliationService', 'LoanAccountService'
        ]
        print(f"  - 服务类数量: {len(service_names)}")
    except Exception as e:
        print("✗ app.services 导入失败")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        errors.append(("app.services", str(e)))
    
    # 测试主应用模块
    try:
        from app.main import app
        print("✓ app.main 导入成功")
        print(f"  - FastAPI 应用: {app.title}")
        print(f"  - 版本: {app.version}")
        print(f"  - 不会立即连接数据库 (数据库初始化移至 startup 事件)")
    except Exception as e:
        print("✗ app.main 导入失败")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        errors.append(("app.main", str(e)))
    
    # 测试数据库初始化和基础功能
    if not errors:
        print()
        print("测试数据库初始化...")
        try:
            from app.database import init_database, get_db_session
            init_database()
            print("✓ 数据库初始化成功 (内存 SQLite)")
            
            # 测试创建会话
            session = get_db_session()
            print("✓ 数据库会话创建成功")
            
            # 测试规则引擎
            from app.utils import IdGenerator
            test_id = IdGenerator.generate_application_no()
            print(f"✓ ID生成器测试: {test_id}")
            
            session.close()
            print("✓ 数据库会话关闭成功")
        except Exception as e:
            print(f"✗ 数据库测试失败")
            print(f"  错误: {e}")
            import traceback
            traceback.print_exc()
            errors.append(("database_test", str(e)))
    
    print()
    print("=" * 60)
    if errors:
        print(f"发现 {len(errors)} 个导入错误:")
        for module, error in errors:
            print(f"  - {module}: {error}")
        print("=" * 60)
        return False
    else:
        print("所有模块导入和基础功能测试成功! ✓")
        print("=" * 60)
        print()
        print("下一步:")
        print("  1. 安装依赖: pip install -r requirements.txt")
        print("  2. 启动服务: uvicorn app.main:app --host 0.0.0.0 --port 8000")
        print("  3. 访问文档: http://localhost:8000/docs")
        print("=" * 60)
        return True


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
