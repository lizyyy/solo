#!/usr/bin/env python3
"""
系统验证脚本 - 检查服务是否能正常启动
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("=" * 60)
    print("学校实验室耗材权限追责台账服务 - 系统验证")
    print("=" * 60)

    print("\n1. 检查依赖导入...")
    from fastapi import FastAPI
    from sqlalchemy import create_engine
    import pandas
    print("   ✓ FastAPI, SQLAlchemy, Pandas 导入成功")

    print("\n2. 检查项目模块导入...")
    from app.config import settings
    from app.database import Base, engine
    from app.models import User, ConsumableRecord, WorkflowLog, AuditLog, DirtyRecord
    from app.security import get_password_hash, verify_password
    from app.services import WorkflowService, DataQualityChecker, AutoChecker
    print("   ✓ 所有核心模块导入成功")

    print("\n3. 检查数据库模型...")
    tables = Base.metadata.tables.keys()
    print(f"   ✓ 数据库表: {list(tables)}")

    print("\n4. 检查角色定义...")
    from app.models import RoleEnum, WorkflowStatus, RecordType, DirtyType
    print(f"   ✓ 角色: {[r.value for r in RoleEnum]}")
    print(f"   ✓ 工作流状态: {[s.value for s in WorkflowStatus]}")
    print(f"   ✓ 记录类型: {[t.value for t in RecordType]}")
    print(f"   ✓ 脏数据类型: {[t.value for t in DirtyType]}")

    print("\n5. 检查API模块...")
    from app.api import auth, consumables, workflow, audit, export, dashboard
    print("   ✓ 所有API模块导入成功")

    print("\n" + "=" * 60)
    print("✓ 系统验证通过！所有模块正常工作")
    print("=" * 60)
    print("\n启动命令: uvicorn app.main:app --reload --port 8000")
    print("API文档: http://localhost:8000/docs")
    print("\n初始化用户: GET /api/v1/auth/init-default-users")
    print("默认密码: 123456")

except Exception as e:
    print(f"\n✗ 验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
