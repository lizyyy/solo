import pytest
import os
import tempfile


def test_generate_report_with_issues(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "问题清单测试",
            "description": "包含多个问题的测试清单",
            "owner": "tester",
            "artifacts": [
                {"name": "存在的制品", "path": "/nonexistent/path1.jar"},
                {"name": "不存在的制品", "path": "/nonexistent/path2.jar"},
            ],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    assert report_response.status_code == 201
    report = report_response.json()

    assert report["total_issues"] > 0
    assert report["critical_count"] >= 2
    assert len(report["items"]) > 0


def test_generate_report_with_existing_file(client):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jar") as f:
        f.write(b"test content")
        temp_path = f.name

    try:
        create_response = client.post(
            "/api/v1/checklists/",
            json={
                "version": "v1.0.0",
                "title": "测试发布",
                "owner": "tester",
                "artifacts": [{"name": "存在的制品", "path": temp_path}],
                "migration_scripts": [
                    {
                        "name": "测试迁移",
                        "path": temp_path,
                        "rollback_available": True,
                    }
                ],
                "rollback_steps": [{"step_order": 1, "description": "步骤1", "owner": "tester"}],
            },
        )
        checklist_id = create_response.json()["id"]

        report_response = client.post(
            f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
        )
        assert report_response.status_code == 201
        report = report_response.json()
        assert report["total_issues"] >= 0
    finally:
        os.unlink(temp_path)


def test_get_report(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    report_id = report_response.json()["id"]

    get_response = client.get(f"/api/v1/reports/{report_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == report_id


def test_get_report_not_found(client):
    response = client.get("/api/v1/reports/9999")
    assert response.status_code == 404


def test_list_reports_by_checklist(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    client.post(f"/api/v1/checklists/{checklist_id}/reports?generated_by=test1")
    client.post(f"/api/v1/checklists/{checklist_id}/reports?generated_by=test2")

    list_response = client.get(f"/api/v1/checklists/{checklist_id}/reports")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 2


def test_fix_report_item(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [{"name": "测试制品", "path": "/nonexistent/file.jar"}],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    report_id = report_response.json()["id"]
    item_id = report_response.json()["items"][0]["id"]

    fix_response = client.patch(
        f"/api/v1/reports/{report_id}/items/fix",
        json={
            "item_id": item_id,
            "fixed": True,
            "fixed_by": "operator",
            "fix_note": "已补充制品",
        },
    )
    assert fix_response.status_code == 200
    updated_item = next(i for i in fix_response.json()["items"] if i["id"] == item_id)
    assert updated_item["fixed"] == True
    assert updated_item["fixed_by"] == "operator"


def test_fix_nonexistent_report_item(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [{"name": "测试制品", "path": "/nonexistent/file.jar"}],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    report_id = report_response.json()["id"]

    fix_response = client.patch(
        f"/api/v1/reports/{report_id}/items/fix",
        json={
            "item_id": 9999,
            "fixed": True,
            "fixed_by": "operator",
        },
    )
    assert fix_response.status_code == 404


def test_summary_by_owner(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    report_id = report_response.json()["id"]

    summary_response = client.get(f"/api/v1/reports/{report_id}/summary-by-owner")
    assert summary_response.status_code == 200
    assert isinstance(summary_response.json(), list)


def test_export_report(client):
    create_response = client.post(
        "/api/v1/checklists/",
        json={
            "version": "v1.0.0",
            "title": "测试发布",
            "owner": "tester",
            "artifacts": [],
            "migration_scripts": [],
            "rollback_steps": [],
        },
    )
    checklist_id = create_response.json()["id"]

    report_response = client.post(
        f"/api/v1/checklists/{checklist_id}/reports?generated_by=test_system"
    )
    report_id = report_response.json()["id"]

    export_response = client.get(f"/api/v1/reports/{report_id}/export")
    assert export_response.status_code == 200
    assert export_response.headers["content-type"] == "text/plain; charset=utf-8"
    assert "发布核对报告" in export_response.text
