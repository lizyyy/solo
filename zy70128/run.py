#!/usr/bin/env python3
"""赛事成绩申诉系统 - 启动脚本"""

import uvicorn
import asyncio
import argparse
import sys
from datetime import datetime, timedelta


def run_server(host: str = "0.0.0.0", port: int = 8000, reload: bool = False):
    """启动 Web 服务器"""
    print(f"🚀 启动赛事成绩申诉系统服务器...")
    print(f"📡 监听地址: http://{host}:{port}")
    print(f"📚 API 文档: http://{host}:{port}/docs")
    print()

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
    )


async def run_tests():
    """运行测试套件"""
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
        capture_output=False,
    )
    return result.returncode


async def demo_workflow():
    """演示完整工作流"""
    import httpx
    from httpx import ASGITransport
    from app.main import app

    print("\n" + "=" * 60)
    print("🎬 演示：赛事成绩申诉系统完整工作流")
    print("=" * 60 + "\n")

    async with httpx.AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:

        print("1️⃣  创建赛事...")
        race_resp = await client.post(
            "/api/v1/races/",
            json={
                "name": "2026春季城市马拉松",
                "description": "年度重点赛事",
                "race_date": "2026-05-10T07:00:00",
                "is_published": True,
            },
        )
        race = race_resp.json()
        race_id = race["id"]
        print(f"    ✅ 赛事创建成功: ID={race_id}")

        print("\n2️⃣  导入初始成绩版本...")
        start_time = datetime(2026, 5, 10, 7, 0, 0)
        version_resp = await client.post(
            "/api/v1/results/versions",
            json={
                "race_id": race_id,
                "notes": "初始成绩 - 裁判手动记录",
                "created_by": "裁判系统",
                "records": [
                    {
                        "athlete_id": "ATH001",
                        "athlete_name": "张明",
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
                        "athlete_id": "ATH002",
                        "athlete_name": "李强",
                        "bib_number": "1002",
                        "start_time": start_time.isoformat(),
                        "end_time": (start_time + timedelta(hours=2, minutes=32)).isoformat(),
                        "duration_seconds": 9120.0,
                        "rank": 2,
                        "category": "MALE",
                        "status": "FINISHED",
                        "source": "REFEREE",
                    },
                    {
                        "athlete_id": "ATH003",
                        "athlete_name": "王芳",
                        "bib_number": "1003",
                        "start_time": start_time.isoformat(),
                        "end_time": (start_time + timedelta(hours=2, minutes=45)).isoformat(),
                        "duration_seconds": 9900.0,
                        "rank": 3,
                        "category": "FEMALE",
                        "status": "FINISHED",
                        "source": "REFEREE",
                    },
                ],
            },
        )
        version = version_resp.json()
        version_id = version["id"]
        print(f"    ✅ 成绩版本创建成功: ID={version_id}, 版本号={version['version_number']}")

        print("\n3️⃣  导入芯片数据...")
        chip_resp = await client.post(
            "/api/v1/chips/import",
            json={
                "batch_name": "官方计时芯片数据",
                "race_id": race_id,
                "imported_by": "chip_system",
                "chip_data": [
                    {
                        "chip_id": "CHIP001",
                        "bib_number": "1001",
                        "athlete_id": "ATH001",
                        "timing_point": "START",
                        "timestamp": start_time.isoformat(),
                    },
                    {
                        "chip_id": "CHIP001",
                        "bib_number": "1001",
                        "athlete_id": "ATH001",
                        "timing_point": "END",
                        "timestamp": (start_time + timedelta(hours=2, minutes=30)).isoformat(),
                    },
                    {
                        "chip_id": "CHIP002",
                        "bib_number": "1002",
                        "athlete_id": "ATH002",
                        "timing_point": "START",
                        "timestamp": start_time.isoformat(),
                    },
                    {
                        "chip_id": "CHIP002",
                        "bib_number": "1002",
                        "athlete_id": "ATH002",
                        "timing_point": "END",
                        "timestamp": (start_time + timedelta(hours=2, minutes=31, seconds=30)).isoformat(),
                    },
                    {
                        "chip_id": "CHIP003",
                        "bib_number": "1003",
                        "athlete_id": "ATH003",
                        "timing_point": "START",
                        "timestamp": start_time.isoformat(),
                    },
                    {
                        "chip_id": "CHIP003",
                        "bib_number": "1003",
                        "athlete_id": "ATH003",
                        "timing_point": "END",
                        "timestamp": (start_time + timedelta(hours=2, minutes=45)).isoformat(),
                    },
                ],
            },
        )
        batch = chip_resp.json()
        batch_id = batch["batch_id"]
        print(f"    ✅ 芯片数据导入成功: 批次ID={batch_id}, 记录数={batch['total_records']}, 错误数={batch['error_count']}")

        print("\n4️⃣  对比芯片数据与裁判记录（发现不一致）...")
        reconcile_resp = await client.post(
            f"/api/v1/chips/batches/{batch_id}/reconcile/{version_id}"
        )
        reconcile = reconcile_resp.json()
        if reconcile["has_issues"]:
            print(f"    ⚠️  发现 {len(reconcile['inconsistencies'])} 处时间戳不一致")
            for inc in reconcile["inconsistencies"]:
                print(f"       - {inc['bib_number']} ({inc['athlete_name']}): 相差 {inc['difference_seconds']:.1f}秒")
        else:
            print("    ✅ 数据一致")

        print("\n5️⃣  检查异常记录...")
        exc_resp = await client.get("/api/v1/exceptions/?status=OPEN")
        exceptions = exc_resp.json()
        print(f"    📋 未处理异常数量: {len(exceptions)}")
        for exc in exceptions[:3]:
            print(f"       - [{exc['exception_type']}] {exc['title']}")

        print("\n6️⃣  运动员提交申诉...")
        appeal_resp = await client.post(
            "/api/v1/appeals/",
            json={
                "race_id": race_id,
                "athlete_id": "ATH002",
                "athlete_name": "李强",
                "bib_number": "1002",
                "appeal_type": "TIME_DISCREPANCY",
                "description": "申诉：根据芯片数据，我的实际成绩应为2小时31分30秒，而不是2小时32分。请求核对并调整名次。",
                "supporting_documents": "芯片数据截图、GPS轨迹",
                "submitted_by": "李强",
                "submitted_at": datetime.utcnow().isoformat(),
                "priority": "HIGH",
            },
        )
        appeal = appeal_resp.json()
        appeal_id = appeal["id"]
        print(f"    ✅ 申诉创建成功: 编号={appeal['appeal_number']}, 状态={appeal['status']}")

        print("\n7️⃣  分配申诉给裁判...")
        assign_resp = await client.post(
            f"/api/v1/appeals/{appeal_id}/assign?assigned_to=裁判_李刚"
        )
        print(f"    ✅ 申诉已分配给: {assign_resp.json()['assigned_to']}, 状态={assign_resp.json()['status']}")

        print("\n8️⃣  裁判创建复核记录...")
        review_resp = await client.post(
            "/api/v1/reviews/",
            json={
                "appeal_id": appeal_id,
                "result_version_id": version_id,
                "reviewer_id": "REF001",
                "reviewer_name": "裁判_李刚",
                "review_type": "APPEAL_REVIEW",
                "findings": (
                    "经核查芯片数据，运动员李强（号码布1002）的实际冲线时间为"
                    "2小时31分30秒，比裁判记录的2小时32分早30秒。根据芯片数据，"
                    "他的名次应调整为第2名。"
                ),
                "recommended_action": "调整李强的成绩时间和名次",
                "evidence_sources": "官方芯片计时系统、起点/终点视频录像",
            },
        )
        review = review_resp.json()
        review_id = review["id"]
        print(f"    ✅ 复核记录创建成功: ID={review_id}")

        print("\n9️⃣  提交复核并批准...")
        await client.post(f"/api/v1/reviews/{review_id}/submit")
        approve_resp = await client.post(
            f"/api/v1/reviews/{review_id}/approve?approved_by=主裁判长_王主任"
        )
        print(f"    ✅ 复核已批准: 状态={approve_resp.json()['status']}")

        print("\n🔟  基于芯片数据重算成绩...")
        recalc_resp = await client.post(
            f"/api/v1/recalculation/from-chip/{version_id}/{batch_id}"
        )
        recalc = recalc_resp.json()
        print(f"    ✅ 成绩重算完成: 更新 {recalc['updated_records']} 条记录")

        print("\n1️⃣1️⃣ 重排名次...")
        rank_resp = await client.post(
            f"/api/v1/recalculation/ranks/{version_id}?method=DURATION"
        )
        rank = rank_resp.json()
        print(f"    ✅ 名次重排完成: {rank['changes_count']} 条记录名次变化")

        print("\n1️⃣2️⃣ 验证修正后的成绩...")
        version_resp = await client.get(f"/api/v1/results/versions/{version_id}")
        records = version_resp.json()["records"]
        print(f"    📊 修正后的成绩排名:")
        sorted_records = sorted(records, key=lambda x: x["rank"] if x["rank"] else 999)
        for rec in sorted_records:
            if rec["status"] == "FINISHED":
                hours = int(rec["duration_seconds"] // 3600)
                mins = int((rec["duration_seconds"] % 3600) // 60)
                secs = int(rec["duration_seconds"] % 60)
                print(f"       第{rec['rank']}名: {rec['athlete_name']} ({rec['bib_number']}) - {hours}:{mins:02d}:{secs:02d}")

        print("\n1️⃣3️⃣ 完成申诉处理...")
        await client.post(
            f"/api/v1/appeals/{appeal_id}/status",
            json={
                "status": "RESOLVED",
                "resolution_notes": "成绩已根据芯片数据修正，名次已调整",
                "resolved_by": "主裁判长_王主任",
            },
        )
        print(f"    ✅ 申诉已解决")

        print("\n1️⃣4️⃣ 处理异常记录...")
        exc_list_resp = await client.get("/api/v1/exceptions/?status=OPEN")
        exceptions = exc_list_resp.json()
        for exc in exceptions:
            await client.post(
                f"/api/v1/exceptions/{exc['id']}/handle",
                params={
                    "handled_by": "系统管理员",
                    "resolution_notes": "申诉处理完成，已基于芯片数据修正成绩",
                    "new_status": "RESOLVED",
                },
            )
        print(f"    ✅ 已处理 {len(exceptions)} 条异常记录")

        print("\n" + "=" * 60)
        print("✅ 演示完成！")
        print("=" * 60)
        print("\n📈 系统状态:")
        stats_resp = await client.get(f"/api/v1/appeals/races/{race_id}/stats")
        print(f"   申诉状态统计: {stats_resp.json()['status_counts']}")

        exc_stats_resp = await client.get("/api/v1/exceptions/stats?status=OPEN")
        print(f"   未处理异常: {exc_stats_resp.json()['count']}")


def main():
    parser = argparse.ArgumentParser(
        description="赛事成绩申诉系统 - 一个完整的赛事成绩管理后端系统"
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    server_parser = subparsers.add_parser("server", help="启动 Web 服务器")
    server_parser.add_argument("--host", default="0.0.0.0", help="监听地址")
    server_parser.add_argument("--port", type=int, default=8000, help="监听端口")
    server_parser.add_argument("--reload", action="store_true", help="热重载模式")

    subparsers.add_parser("test", help="运行测试套件")
    subparsers.add_parser("demo", help="运行完整演示工作流")

    args = parser.parse_args()

    if args.command == "server":
        run_server(host=args.host, port=args.port, reload=args.reload)
    elif args.command == "test":
        exit_code = asyncio.run(run_tests())
        sys.exit(exit_code)
    elif args.command == "demo":
        asyncio.run(demo_workflow())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
