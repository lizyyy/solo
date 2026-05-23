#!/usr/bin/env python3
"""
简单的 API 验证脚本，使用内存数据库快速测试核心功能
"""

import sys
import os


def test_imports():
    """测试模块导入"""
    print("测试模块导入...")
    try:
        import fastapi
        import sqlalchemy
        import pydantic
        print(f"  FastAPI: {fastapi.__version__}")
        print(f"  SQLAlchemy: {sqlalchemy.__version__}")
        print(f"  Pydantic: {pydantic.__version__}")
        return True
    except Exception as e:
        print(f"  失败: {e}")
        return False


def test_schemas():
    """测试 schemas 模块"""
    print("测试 schemas 模块...")
    try:
        from schemas import Cabinet, APIResponse
        print("  schemas 导入成功")
        return True
    except Exception as e:
        print(f"  失败: {e}")
        return False


def test_models():
    """测试 models 模块"""
    print("测试 models 模块...")
    try:
        from models import Cabinet
        print("  models 导入成功")
        return True
    except Exception as e:
        print(f"  失败: {e}")
        return False


def test_crud():
    """测试 crud 模块"""
    print("测试 crud 模块...")
    try:
        import crud
        print("  crud 导入成功")
        return True
    except Exception as e:
        print(f"  失败: {e}")
        return False


def test_memory_database():
    """使用内存数据库测试核心功能"""
    print("使用内存数据库测试核心功能...")
    
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from database import Base
    from schemas import CabinetCreate
    import crud
    
    try:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("  数据库创建成功")
        
        cabinet_data = CabinetCreate(cabinet_no="TEST001", location="测试位置")
        result = crud.create_cabinet(db, cabinet_data)
        print(f"  创建货柜成功: {result.cabinet_no}")
        
        cabinets = crud.get_cabinets(db)
        print(f"  查询货柜列表成功: {len(cabinets)} 条记录")
        
        db.close()
        return True
    except Exception as e:
        print(f"  失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_pydantic_conversion():
    """测试 Pydantic 2 model_validate"""
    print("测试 Pydantic 2 model_validate...")
    
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from database import Base
    from schemas import Cabinet as CabinetSchema
    import crud
    from schemas import CabinetCreate
    
    try:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        cabinet_data = CabinetCreate(cabinet_no="TEST002", location="测试位置2")
        db_cabinet = crud.create_cabinet(db, cabinet_data)
        
        schema_cabinet = CabinetSchema.model_validate(db_cabinet)
        cabinet_dict = schema_cabinet.model_dump()
        
        print(f"  model_validate 成功: {cabinet_dict['cabinet_no']}")
        print(f"  model_dump 成功: 包含 {len(cabinet_dict)} 个字段")
        
        db.close()
        return True
    except Exception as e:
        print(f"  失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("=" * 60)
    print("  无人货柜补货结算 API - 快速验证")
    print("=" * 60)
    
    tests = [
        ("模块导入", test_imports),
        ("schemas 模块", test_schemas),
        ("models 模块", test_models),
        ("crud 模块", test_crud),
        ("内存数据库", test_memory_database),
        ("Pydantic 转换", test_pydantic_conversion),
    ]
    
    results = []
    for name, test_func in tests:
        result = test_func()
        results.append((name, result))
    
    print("\n" + "=" * 60)
    print("  验证结果汇总")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    print(f"\n  总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n  🎉 所有验证通过！API 可以正常运行。")
        print("\n  启动服务命令:")
        print("    uvicorn main:app --host 0.0.0.0 --port 8000")
        print("\n  运行完整测试命令:")
        print("    python test_api.py")
        return 0
    else:
        print("\n  ⚠️  部分验证失败，请检查问题。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
