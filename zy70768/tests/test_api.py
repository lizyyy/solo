from app.models import Package, SourceFile, ImportPath, BoundaryRule, RuleType


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_package(client):
    response = client.post(
        "/packages/",
        json={
            "name": "test-pkg",
            "path": "./packages/test",
            "description": "测试包",
            "status": "active"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-pkg"
    assert data["path"] == "./packages/test"


def test_list_packages(client, db):
    pkg1 = Package(name="pkg1", path="./pkg1", status="active")
    pkg2 = Package(name="pkg2", path="./pkg2", status="active")
    db.add(pkg1)
    db.add(pkg2)
    db.commit()

    response = client.get("/packages/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_get_package(client, db):
    pkg = Package(name="test-get", path="./test-get", status="active")
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    response = client.get(f"/packages/{pkg.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-get"


def test_create_source_file(client, db):
    pkg = Package(name="pkg-for-file", path="./pkg-for-file", status="active")
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    response = client.post(
        "/source-files/",
        json={
            "package_id": pkg.id,
            "file_path": "./pkg-for-file/src/test.py",
            "language": "python"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["file_path"] == "./pkg-for-file/src/test.py"


def test_create_rule(client, db):
    pkg1 = Package(name="pkg-rule-1", path="./pkg-rule-1", status="active")
    pkg2 = Package(name="pkg-rule-2", path="./pkg-rule-2", status="active")
    db.add(pkg1)
    db.add(pkg2)
    db.commit()
    db.refresh(pkg1)
    db.refresh(pkg2)

    response = client.post(
        "/rules/",
        json={
            "rule_type": "forbid_import",
            "from_package_id": pkg1.id,
            "to_package_id": pkg2.id,
            "description": "测试规则",
            "is_active": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["rule_type"] == "forbid_import"


def test_boundary_check(client, db):
    pkg_common = Package(name="common", path="./common", status="active")
    pkg_app = Package(name="app", path="./app", status="active")
    db.add(pkg_common)
    db.add(pkg_app)
    db.commit()
    db.refresh(pkg_common)
    db.refresh(pkg_app)

    file_common = SourceFile(package_id=pkg_common.id, file_path="./common/src/utils.py")
    file_app = SourceFile(package_id=pkg_app.id, file_path="./app/src/main.py")
    db.add(file_common)
    db.add(file_app)
    db.commit()
    db.refresh(file_common)
    db.refresh(file_app)

    imp = ImportPath(
        from_file_id=file_common.id,
        to_file_id=file_app.id,
        import_statement="from app.src.main import something",
        line_number=1
    )
    db.add(imp)
    db.commit()

    rule = BoundaryRule(
        rule_type=RuleType.FORBID_IMPORT,
        from_package_id=pkg_common.id,
        to_package_id=pkg_app.id,
        is_active=True
    )
    db.add(rule)
    db.commit()

    response = client.post("/check-boundaries")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["violation_type"] == "cross_boundary"


def test_violation_status_update(client, db):
    pkg = Package(name="test-violation", path="./test-violation", status="active")
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    file = SourceFile(package_id=pkg.id, file_path="./test-violation/src/test.py")
    db.add(file)
    db.commit()
    db.refresh(file)

    from app.core.services import ViolationService
    from app.schemas import ViolationCreate

    violation = ViolationService.create_violation(
        db=db,
        violation=ViolationCreate(
            violation_type="cross_boundary",
            source_file_id=file.id,
            description="测试违规",
            status="open",
            assignee="张三"
        )
    )

    response = client.patch(
        f"/violations/{violation.id}/status",
        json={
            "to_status": "in_progress",
            "handler": "李四",
            "conclusion": "开始处理此违规",
            "original_input": "用户反馈的输入内容"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"


def test_get_violation_report(client, db):
    pkg = Package(name="report-pkg", path="./report-pkg", status="active")
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    file = SourceFile(package_id=pkg.id, file_path="./report-pkg/src/test.py")
    db.add(file)
    db.commit()
    db.refresh(file)

    from app.core.services import ViolationService
    from app.schemas import ViolationCreate

    ViolationService.create_violation(
        db=db,
        violation=ViolationCreate(
            violation_type="cross_boundary",
            source_file_id=file.id,
            description="报告测试违规",
            status="open"
        )
    )

    response = client.get("/report")
    assert response.status_code == 200
    data = response.json()
    assert "total_count" in data
    assert "by_type" in data
    assert "by_status" in data
    assert data["total_count"] >= 1


def test_dependency_graph(client, db):
    pkg1 = Package(name="graph-pkg1", path="./graph-pkg1", status="active")
    pkg2 = Package(name="graph-pkg2", path="./graph-pkg2", status="active")
    db.add(pkg1)
    db.add(pkg2)
    db.commit()
    db.refresh(pkg1)
    db.refresh(pkg2)

    file1 = SourceFile(package_id=pkg1.id, file_path="./graph-pkg1/src/a.py")
    file2 = SourceFile(package_id=pkg2.id, file_path="./graph-pkg2/src/b.py")
    db.add(file1)
    db.add(file2)
    db.commit()
    db.refresh(file1)
    db.refresh(file2)

    imp = ImportPath(
        from_file_id=file1.id,
        to_file_id=file2.id,
        import_statement="from b import something"
    )
    db.add(imp)
    db.commit()

    response = client.get("/dependency-graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 2
