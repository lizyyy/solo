import pytest
from datetime import datetime, timedelta


@pytest.mark.asyncio
async def test_full_appeal_workflow(client):
    """测试完整申诉工作流"""

    race_response = await client.post(
        "/api/v1/races/",
        json={
            "name": "2026春季马拉松",
            "description": "年度重要赛事",
            "race_date": "2026-05-10T07:00:00",
            "is_published": True,
        },
    )
    assert race_response.status_code == 201
    race_id = race_response.json()["id"]

    start_time = datetime(2026, 5, 10, 7, 0, 0)
    version_response = await client.post(
        "/api/v1/results/versions",
        json={
            "race_id": race_id,
            "notes": "初始成绩版本",
            "created_by": "timing_system",
            "records": [
                {
                    "athlete_id": "A001",
                    "athlete_name": "张三",
                    "bib_number": "1001",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=2, minutes=30)).isoformat(),
                    "duration_seconds": 9000.0,
                    "rank": 1,
                    "category": "MALE",
                    "status": "FINISHED",
                    "source": "REFEREE",
                },
                {
                    "athlete_id": "A002",
                    "athlete_name": "李四",
                    "bib_number": "1002",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=2, minutes=35)).isoformat(),
                    "duration_seconds": 9300.0,
                    "rank": 2,
                    "category": "MALE",
                    "status": "FINISHED",
                    "source": "REFEREE",
                },
                {
                    "athlete_id": "A003",
                    "athlete_name": "王五",
                    "bib_number": "1003",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=2, minutes=40)).isoformat(),
                    "duration_seconds": 9600.0,
                    "rank": 3,
                    "category": "MALE",
                    "status": "FINISHED",
                    "source": "REFEREE",
                },
            ],
        },
    )
    assert version_response.status_code == 201
    version_id = version_response.json()["id"]

    appeal_response = await client.post(
        "/api/v1/appeals/",
        json={
            "race_id": race_id,
            "athlete_id": "A003",
            "athlete_name": "王五",
            "bib_number": "1003",
            "appeal_type": "TIME_DISCREPANCY",
            "description": "申诉：我的实际成绩应为第2名，计时系统显示有误",
            "supporting_documents": "手机计时截图、现场照片",
            "submitted_by": "王五",
            "submitted_at": datetime.utcnow().isoformat(),
            "priority": "HIGH",
        },
    )
    assert appeal_response.status_code == 201
    appeal_id = appeal_response.json()["id"]
    appeal_number = appeal_response.json()["appeal_number"]
    assert appeal_number.startswith("APL-")

    assign_response = await client.post(
        f"/api/v1/appeals/{appeal_id}/assign?assigned_to=裁判_01"
    )
    assert assign_response.status_code == 200
    assert assign_response.json()["assigned_to"] == "裁判_01"
    assert assign_response.json()["status"] == "PROCESSING"

    review_response = await client.post(
        "/api/v1/reviews/",
        json={
            "appeal_id": appeal_id,
            "result_version_id": version_id,
            "reviewer_id": "REF_01",
            "reviewer_name": "裁判_01",
            "review_type": "APPEAL_REVIEW",
            "findings": "经核查芯片数据，王五的实际冲线时间确实早于李四，申诉成立",
            "recommended_action": "调整王五和李四的名次，王五为第2名，李四为第3名",
            "evidence_sources": "芯片数据、视频回放",
        },
    )
    assert review_response.status_code == 201
    review_id = review_response.json()["id"]

    submit_response = await client.post(f"/api/v1/reviews/{review_id}/submit")
    assert submit_response.status_code == 200
    assert submit_response.json()["status"] == "SUBMITTED"

    approve_response = await client.post(
        f"/api/v1/reviews/{review_id}/approve?approved_by=主裁判长"
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "APPROVED"
    assert approve_response.json()["approved_by"] == "主裁判长"

    status_response = await client.post(
        f"/api/v1/appeals/{appeal_id}/status",
        json={
            "status": "APPROVED",
            "resolution_notes": "申诉已批准，将基于审核结果调整成绩",
            "resolved_by": "主裁判长",
        },
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "APPROVED"

    stats_response = await client.get(f"/api/v1/appeals/races/{race_id}/stats")
    assert stats_response.status_code == 200
    stats = stats_response.json()["status_counts"]
    assert stats["APPROVED"] == 1


@pytest.mark.asyncio
async def test_chip_data_import_and_reconciliation(client):
    """测试芯片数据导入和数据核对"""

    race_response = await client.post(
        "/api/v1/races/",
        json={
            "name": "芯片测试赛",
            "race_date": "2026-05-10T08:00:00",
        },
    )
    race_id = race_response.json()["id"]

    start_time = datetime(2026, 5, 10, 8, 0, 0)
    version_response = await client.post(
        "/api/v1/results/versions",
        json={
            "race_id": race_id,
            "records": [
                {
                    "athlete_id": "CHIP01",
                    "athlete_name": "芯片选手1",
                    "bib_number": "CHIP01",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=1)).isoformat(),
                    "duration_seconds": 3600.0,
                    "rank": 1,
                    "status": "FINISHED",
                },
                {
                    "athlete_id": "CHIP02",
                    "athlete_name": "芯片选手2",
                    "bib_number": "CHIP02",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=1, minutes=5)).isoformat(),
                    "duration_seconds": 3900.0,
                    "rank": 2,
                    "status": "FINISHED",
                },
                {
                    "athlete_id": "ONLY_RESULT",
                    "athlete_name": "仅成绩选手",
                    "bib_number": "ONLY01",
                    "start_time": start_time.isoformat(),
                    "end_time": (start_time + timedelta(hours=1, minutes=10)).isoformat(),
                    "duration_seconds": 4200.0,
                    "rank": 3,
                    "status": "FINISHED",
                },
            ],
        },
    )
    version_id = version_response.json()["id"]

    import_response = await client.post(
        "/api/v1/chips/import",
        json={
            "batch_name": "芯片数据批次_01",
            "race_id": race_id,
            "imported_by": "chip_system",
            "chip_data": [
                {
                    "chip_id": "C001",
                    "bib_number": "CHIP01",
                    "athlete_id": "CHIP01",
                    "timing_point": "START",
                    "timestamp": start_time.isoformat(),
                },
                {
                    "chip_id": "C001",
                    "bib_number": "CHIP01",
                    "athlete_id": "CHIP01",
                    "timing_point": "END",
                    "timestamp": (start_time + timedelta(hours=1)).isoformat(),
                },
                {
                    "chip_id": "C002",
                    "bib_number": "CHIP02",
                    "athlete_id": "CHIP02",
                    "timing_point": "START",
                    "timestamp": start_time.isoformat(),
                },
                {
                    "chip_id": "C002",
                    "bib_number": "CHIP02",
                    "athlete_id": "CHIP02",
                    "timing_point": "END",
                    "timestamp": (start_time + timedelta(hours=1, minutes=5)).isoformat(),
                },
                {
                    "chip_id": "C003",
                    "bib_number": "ONLY_CHIP",
                    "athlete_id": "ONLY_CHIP",
                    "timing_point": "START",
                    "timestamp": start_time.isoformat(),
                },
                {
                    "chip_id": "C003",
                    "bib_number": "ONLY_CHIP",
                    "athlete_id": "ONLY_CHIP",
                    "timing_point": "END",
                    "timestamp": (start_time + timedelta(hours=1, minutes=8)).isoformat(),
                },
            ],
        },
    )
    assert import_response.status_code == 201
    batch_id = import_response.json()["batch_id"]

    reconcile_response = await client.post(
        f"/api/v1/chips/batches/{batch_id}/reconcile/{version_id}"
    )
    assert reconcile_response.status_code == 200
    result = reconcile_response.json()
    assert result["has_issues"] is True
    assert len(result["missing_chip_data"]) == 1
    assert len(result["missing_result_data"]) == 1

    exceptions_response = await client.get("/api/v1/exceptions/?status=OPEN")
    assert exceptions_response.status_code == 200
    exceptions = exceptions_response.json()
    assert len(exceptions) >= 2


@pytest.mark.asyncio
async def test_task_retry_mechanism(client):
    """测试任务重试机制"""

    task_response = await client.post(
        "/api/v1/tasks/",
        json={
            "task_type": "BULK_IMPORT",
            "parameters": {"source": "chip_data"},
            "max_retries": 3,
        },
    )
    assert task_response.status_code == 201
    task_id = task_response.json()["id"]

    from app.services.task_service import TaskService
    from tests.conftest import TEST_DATABASE_URL
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        service = TaskService(session)
        await service.start_task(task_id)
        await session.commit()

    check_response = await client.get(f"/api/v1/tasks/{task_id}")
    assert check_response.json()["status"] == "RUNNING"
    assert check_response.json()["retry_count"] == 0

    async with async_session() as session:
        service = TaskService(session)
        await service.fail_task(task_id, "网络超时", can_retry=True)
        await session.commit()

    failed_response = await client.get(f"/api/v1/tasks/{task_id}")
    task_data = failed_response.json()
    assert task_data["status"] == "PENDING"
    assert task_data["retry_count"] == 1
    assert task_data["next_retry_at"] is not None

    async with async_session() as session:
        service = TaskService(session)
        await service.fail_task(task_id, "网络超时", can_retry=True)
        await session.commit()
        await service.fail_task(task_id, "网络超时", can_retry=True)
        await session.commit()
        await service.fail_task(task_id, "网络超时", can_retry=True)
        await session.commit()

    final_response = await client.get(f"/api/v1/tasks/{task_id}")
    final_data = final_response.json()
    assert final_data["status"] == "FAILED"
    assert final_data["retry_count"] >= 3
    assert final_data["max_retries"] == 3

    await engine.dispose()


@pytest.mark.asyncio
async def test_recalculation_workflow(client):
    """测试名次重算流程"""

    race_response = await client.post(
        "/api/v1/races/",
        json={
            "name": "重算测试赛",
            "race_date": "2026-05-10T09:00:00",
        },
    )
    race_id = race_response.json()["id"]

    start_time = datetime(2026, 5, 10, 9, 0, 0)
    version_response = await client.post(
        "/api/v1/results/versions",
        json={
            "race_id": race_id,
            "records": [
                {
                    "athlete_id": "R1",
                    "athlete_name": "选手1",
                    "duration_seconds": 3600.0,
                    "rank": 3,
                    "status": "FINISHED",
                },
                {
                    "athlete_id": "R2",
                    "athlete_name": "选手2",
                    "duration_seconds": 3500.0,
                    "rank": 2,
                    "status": "FINISHED",
                },
                {
                    "athlete_id": "R3",
                    "athlete_name": "选手3",
                    "duration_seconds": 3400.0,
                    "rank": 1,
                    "status": "FINISHED",
                },
            ],
        },
    )
    version_id = version_response.json()["id"]

    recalc_response = await client.post(
        f"/api/v1/recalculation/ranks/{version_id}?method=DURATION"
    )
    assert recalc_response.status_code == 200
    recalc_result = recalc_response.json()
    assert recalc_result["success"] is True

    verify_response = await client.get(f"/api/v1/results/versions/{version_id}")
    records = verify_response.json()["records"]

    for record in records:
        if record["athlete_id"] == "R3":
            assert record["rank"] == 1
        elif record["athlete_id"] == "R2":
            assert record["rank"] == 2
        elif record["athlete_id"] == "R1":
            assert record["rank"] == 3
