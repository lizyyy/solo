#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, SessionLocal
from app.models import Base, Package, SourceFile, ImportPath, BoundaryRule, Violation

if os.path.exists("./monorepo_boundary.db"):
    os.remove("./monorepo_boundary.db")

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    pkg1 = Package(name='pkg-common', path='./packages/common', description='公共包', layer='foundation')
    pkg2 = Package(name='pkg-app', path='./packages/app', description='应用包', layer='application')
    db.add(pkg1)
    db.add(pkg2)
    db.commit()
    db.refresh(pkg1)
    db.refresh(pkg2)

    f1 = SourceFile(package_id=pkg1.id, file_path='./common/src/utils.py')
    f2 = SourceFile(package_id=pkg2.id, file_path='./app/src/main.py')
    db.add(f1)
    db.add(f2)
    db.commit()
    db.refresh(f1)
    db.refresh(f2)

    imp = ImportPath(
        from_file_id=f1.id,
        to_file_id=f2.id,
        import_statement='from app.src.main import something',
        line_number=10
    )
    db.add(imp)
    db.commit()

    rule = BoundaryRule(
        rule_type='forbid_import',
        from_package_id=pkg1.id,
        to_package_id=pkg2.id,
        description='common 不能依赖 app'
    )
    db.add(rule)
    db.commit()

    print("✅ 测试数据创建成功！")
    print(f"📦 包: {[p.name for p in db.query(Package).all()]}")
    print(f"📄 源文件: {[f.file_path for f in db.query(SourceFile).all()]}")
    print(f"🔗 导入关系: {db.query(ImportPath).count()} 条")
    print(f"📏 边界规则: {[r.description for r in db.query(BoundaryRule).all()]}")

finally:
    db.close()
