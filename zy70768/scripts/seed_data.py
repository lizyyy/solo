import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import Package, SourceFile, ImportPath, BoundaryRule, RuleType


def seed_data():
    db: Session = SessionLocal()

    try:
        print("开始创建测试数据...")

        packages_data = [
            {"name": "pkg-common", "path": "./packages/common", "description": "公共基础包", "layer": "foundation"},
            {"name": "pkg-infra", "path": "./packages/infra", "description": "基础设施包", "layer": "infrastructure"},
            {"name": "pkg-domain", "path": "./packages/domain", "description": "领域模型包", "layer": "domain"},
            {"name": "pkg-app", "path": "./packages/app", "description": "应用服务包", "layer": "application"},
            {"name": "pkg-api", "path": "./packages/api", "description": "API 接口包", "layer": "interface"},
        ]

        packages = []
        for pkg_data in packages_data:
            pkg = Package(**pkg_data)
            db.add(pkg)
            packages.append(pkg)

        db.flush()
        print(f"创建了 {len(packages)} 个包")

        package_map = {p.name: p.id for p in packages}

        source_files_data = [
            {"package_name": "pkg-common", "file_path": "./packages/common/src/utils.py"},
            {"package_name": "pkg-common", "file_path": "./packages/common/src/config.py"},
            {"package_name": "pkg-infra", "file_path": "./packages/infra/src/database.py"},
            {"package_name": "pkg-infra", "file_path": "./packages/infra/src/cache.py"},
            {"package_name": "pkg-domain", "file_path": "./packages/domain/src/models.py"},
            {"package_name": "pkg-domain", "file_path": "./packages/domain/src/services.py"},
            {"package_name": "pkg-app", "file_path": "./packages/app/src/usecases.py"},
            {"package_name": "pkg-app", "file_path": "./packages/app/src/handlers.py"},
            {"package_name": "pkg-api", "file_path": "./packages/api/src/routes.py"},
        ]

        source_files = []
        for sf_data in source_files_data:
            package_name = sf_data.pop("package_name")
            sf = SourceFile(package_id=package_map[package_name], **sf_data)
            db.add(sf)
            source_files.append(sf)

        db.flush()
        print(f"创建了 {len(source_files)} 个源文件")

        file_map = {sf.file_path: sf.id for sf in source_files}

        imports_data = [
            {
                "from_file": "./packages/domain/src/models.py",
                "to_file": "./packages/common/src/utils.py",
                "import_statement": "from pkg_common.src.utils import helper",
                "line_number": 5
            },
            {
                "from_file": "./packages/infra/src/database.py",
                "to_file": "./packages/common/src/config.py",
                "import_statement": "from pkg_common.src.config import db_config",
                "line_number": 3
            },
            {
                "from_file": "./packages/app/src/usecases.py",
                "to_file": "./packages/domain/src/models.py",
                "import_statement": "from pkg_domain.src.models import User",
                "line_number": 7
            },
            {
                "from_file": "./packages/app/src/usecases.py",
                "to_file": "./packages/infra/src/database.py",
                "import_statement": "from pkg_infra.src.database import db",
                "line_number": 8
            },
            {
                "from_file": "./packages/api/src/routes.py",
                "to_file": "./packages/app/src/usecases.py",
                "import_statement": "from pkg_app.src.usecases import UserUseCase",
                "line_number": 2
            },
            {
                "from_file": "./packages/api/src/routes.py",
                "to_file": "./packages/infra/src/cache.py",
                "import_statement": "from pkg_infra.src.cache import redis",
                "line_number": 3
            },
            {
                "from_file": "./packages/common/src/utils.py",
                "to_file": "./packages/app/src/usecases.py",
                "import_statement": "from pkg_app.src.usecases import UserUseCase",
                "line_number": 10
            },
            {
                "from_file": "./packages/domain/src/services.py",
                "to_file": "./packages/api/src/routes.py",
                "import_statement": "from pkg_api.src.routes import router",
                "line_number": 15
            },
        ]

        imports = []
        for imp_data in imports_data:
            from_file = imp_data.pop("from_file")
            to_file = imp_data.pop("to_file")
            imp = ImportPath(
                from_file_id=file_map[from_file],
                to_file_id=file_map[to_file],
                **imp_data
            )
            db.add(imp)
            imports.append(imp)

        db.flush()
        print(f"创建了 {len(imports)} 个导入关系")

        rules_data = [
            {
                "rule_type": RuleType.FORBID_IMPORT,
                "from_package_name": "pkg-common",
                "to_package_name": "pkg-app",
                "description": "common 包不能依赖 app 包"
            },
            {
                "rule_type": RuleType.FORBID_IMPORT,
                "from_package_name": "pkg-domain",
                "to_package_name": "pkg-api",
                "description": "domain 包不能直接依赖 api 包"
            },
        ]

        rules = []
        for rule_data in rules_data:
            from_package_name = rule_data.pop("from_package_name")
            to_package_name = rule_data.pop("to_package_name")
            rule = BoundaryRule(
                from_package_id=package_map[from_package_name],
                to_package_id=package_map[to_package_name],
                **rule_data
            )
            db.add(rule)
            rules.append(rule)

        db.commit()
        print(f"创建了 {len(rules)} 条边界规则")
        print("测试数据创建完成!")

    except Exception as e:
        db.rollback()
        print(f"创建数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
