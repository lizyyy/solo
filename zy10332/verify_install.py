#!/usr/bin/env python3
"""
验证 API 安装和核心功能的脚本
"""
import sys
import os

print("=" * 60)
print("🔍 接口数据新鲜度 API 安装验证")
print("=" * 60)

try:
    from fastapi import FastAPI
    print("✅ FastAPI 已安装")
except ImportError as e:
    print(f"❌ FastAPI 未安装: {e}")
    sys.exit(1)

try:
    from pydantic import BaseModel, Field
    print("✅ Pydantic 已安装")
except ImportError as e:
    print(f"❌ Pydantic 未安装: {e}")
    sys.exit(1)

try:
    from sqlalchemy import create_engine
    print("✅ SQLAlchemy 已安装")
except ImportError as e:
    print(f"❌ SQLAlchemy 未安装: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("📁 验证项目结构")
print("=" * 60)

required_files = [
    "app/__init__.py",
    "app/main.py",
    "app/database.py",
    "app/models.py",
    "app/schemas.py",
    "app/services.py",
    "app/exceptions.py",
    "app/api/__init__.py",
    "app/api/datasets.py",
    "app/api/freshness.py",
    "requirements.txt"
]

for file in required_files:
    if os.path.exists(file):
        print(f"✅ {file}")
    else:
        print(f"❌ {file}")

print("\n" + "=" * 60)
print("🔧 导入所有模块")
print("=" * 60)

try:
    from app import main
    print("✅ app.main 导入成功")
except Exception as e:
    print(f"❌ app.main 导入失败: {e}")
    import traceback
    traceback.print_exc()

try:
    from app import models
    print("✅ app.models 导入成功")
except Exception as e:
    print(f"❌ app.models 导入失败: {e}")

try:
    from app import schemas
    print("✅ app.schemas 导入成功")
except Exception as e:
    print(f"❌ app.schemas 导入失败: {e}")

try:
    from app import services
    print("✅ app.services 导入成功")
except Exception as e:
    print(f"❌ app.services 导入失败: {e}")

print("\n" + "=" * 60)
print("📋 验证 Pydantic v2 配置")
print("=" * 60)

from app.schemas import Dataset, FreshnessRecord

if hasattr(Dataset.model_config, 'from_attributes') or (hasattr(Dataset, 'Config') and getattr(Dataset.Config, 'from_attributes', False)):
    print("✅ Dataset 模型配置正确 (from_attributes)")
else:
    print("⚠️  Dataset 模型配置可能有问题")

if hasattr(FreshnessRecord.model_config, 'from_attributes') or (hasattr(FreshnessRecord, 'Config') and getattr(FreshnessRecord.Config, 'from_attributes', False)):
    print("✅ FreshnessRecord 模型配置正确 (from_attributes)")
else:
    print("⚠️  FreshnessRecord 模型配置可能有问题")

if hasattr(schemas, 'Subscription'):
    print("✅ Subscription 模型已定义")
if hasattr(schemas, 'Notification'):
    print("✅ Notification 模型已定义")
if hasattr(schemas, 'ExportFormat'):
    print("✅ ExportFormat 模型已定义")

print("\n" + "=" * 60)
print("🗄️ 验证 SQLAlchemy 模型")
print("=" * 60)

required_models = ['Dataset', 'FreshnessRecord', 'IdempotentRequest', 'Subscription', 'Notification']
for model in required_models:
    if hasattr(models, model):
        print(f"✅ {model} 模型已定义")
    else:
        print(f"❌ {model} 模型缺失")

print("\n" + "=" * 60)
print("🎉 验证完成！")
print("=" * 60)
print("\n启动命令:")
print("  python run.py")
print("  或")
print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
print("\n访问文档:")
print("  Swagger UI: http://localhost:8000/docs")
print("  ReDoc: http://localhost:8000/redoc")
