#!/usr/bin/env python3
"""
验证模块导入脚本 - 用于检查所有模块是否可以正确导入
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_imports():
    print("=" * 60)
    print("模块导入验证")
    print("=" * 60)
    print()
    
    errors = []
    
    # 测试配置模块
    try:
        from app.config import settings
        print("✓ app.config 导入成功")
        print(f"  - 项目名称: {settings.PROJECT_NAME}")
    except Exception as e:
        print("✗ app.config 导入失败")
        print(f"  错误: {e}")
        errors.append(("app.config", str(e)))
    
    # 测试数据库模块
    try:
        from app.database import Base, get_db, get_db_session
        print("✓ app.database 导入成功")
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
        print(f"  - 所有模型类: {[cls.__name__ for cls in [LoanAccount, RepaymentPlan, RepaymentPlanHistory, RepaymentInstallment, ExtensionApplication, PenaltySnapshot, CreditLimitRecord, ApprovalHistory, RuleCheckSnapshot, AuditLog, TaskRecord]]}")
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
        print(f"  - 所有服务类: {[cls.__name__ for cls in [RuleEngine, AuditService, RepaymentCalculator, ExtensionService, LimitService, TaskService, ReconciliationService, LoanAccountService]]}")
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
    except Exception as e:
        print("✗ app.main 导入失败")
        print(f"  错误: {e}")
        import traceback
        traceback.print_exc()
        errors.append(("app.main", str(e)))
    
    print()
    print("=" * 60)
    if errors:
        print(f"发现 {len(errors)} 个导入错误:")
        for module, error in errors:
            print(f"  - {module}: {error}")
        print("=" * 60)
        return False
    else:
        print("所有模块导入成功! ✓")
        print("=" * 60)
        return True


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
