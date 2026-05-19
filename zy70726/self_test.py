#!/usr/bin/env python3
"""
构建缓存驱逐影响分析API自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
import tempfile
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import pandas as pd

    from app import models, schemas, crud
    from app.database import Base

    print("✅ 导入测试通过 - 所有模块导入成功")
except ImportError as e:
    print(f"❌ 导入测试失败: {e}")
    sys.exit(1)


def setup_test_db():
    """设置测试数据库"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def create_test_data(db):
    """创建测试数据"""
    projects = [
        schemas.ProjectCreate(id="proj-1", name="Frontend App", description="React frontend application"),
        schemas.ProjectCreate(id="proj-2", name="Backend Service", description="Python backend service"),
        schemas.ProjectCreate(id="proj-3", name="Mobile App", description="React Native mobile app"),
    ]

    for p in projects:
        crud.create_project(db, p)

    old_date = datetime.utcnow() - timedelta(days=30)
    medium_date = datetime.utcnow() - timedelta(days=10)
    recent_date = datetime.utcnow() - timedelta(days=1)

    cache_entries = [
        {"id": "cache-1", "cache_key": "node_modules_v1", "project_id": "proj-1", "size_bytes": 500 * 1024 * 1024, "hit_count": 150, "last_accessed_at": recent_date, "is_protected": False},
        {"id": "cache-2", "cache_key": "python_packages_v2", "project_id": "proj-2", "size_bytes": 200 * 1024 * 1024, "hit_count": 80, "last_accessed_at": medium_date, "is_protected": False},
        {"id": "cache-3", "cache_key": "build_artifacts_v3", "project_id": "proj-1", "size_bytes": 1000 * 1024 * 1024, "hit_count": 200, "last_accessed_at": old_date, "is_protected": False},
        {"id": "cache-4", "cache_key": "gradle_deps_v1", "project_id": "proj-3", "size_bytes": 300 * 1024 * 1024, "hit_count": 50, "last_accessed_at": old_date, "is_protected": True},
        {"id": "cache-5", "cache_key": "test_results_v2", "project_id": "proj-2", "size_bytes": 50 * 1024 * 1024, "hit_count": 10, "last_accessed_at": old_date, "is_protected": False},
    ]

    for entry in cache_entries:
        db_entry = models.CacheEntry(**entry)
        db.add(db_entry)
    db.commit()

    print("✅ 测试数据创建成功 - 3个项目, 5个缓存条目")
    return cache_entries


def test_filtering(db):
    """测试筛选功能"""
    print("\n=== 筛选功能测试 ===")

    all_entries = crud.get_cache_entries(db, limit=100)
    print(f"  总缓存条目: {len(all_entries)}")

    large_entries = crud.get_cache_entries(db, min_size=400 * 1024 * 1024)
    print(f"  大于400MB的缓存: {len(large_entries)}")
    assert len(large_entries) == 2, f"预期2个, 实际{len(large_entries)}"

    proj1_entries = crud.get_cache_entries(db, project_id="proj-1")
    print(f"  proj-1项目缓存: {len(proj1_entries)}")
    assert len(proj1_entries) == 2, f"预期2个, 实际{len(proj1_entries)}"

    old_entries = crud.get_cache_entries(db, days_since_access=20)
    print(f"  20天未访问的缓存: {len(old_entries)}")
    assert len(old_entries) == 3, f"预期3个, 实际{len(old_entries)}"

    protected_entries = crud.get_cache_entries(db, is_protected=True)
    print(f"  受保护的缓存: {len(protected_entries)}")
    assert len(protected_entries) == 1, f"预期1个, 实际{len(protected_entries)}"

    high_hit_entries = crud.get_cache_entries(db, min_hits=100)
    print(f"  命中数>=100的缓存: {len(high_hit_entries)}")
    assert len(high_hit_entries) == 2, f"预期2个, 实际{len(high_hit_entries)}"

    sorted_by_size = crud.get_cache_entries(db, sort_by="size", sort_order="desc")
    print(f"  按大小排序: 第一个={sorted_by_size[0].cache_key}, 大小={sorted_by_size[0].size_bytes/1024/1024:.0f}MB")
    assert sorted_by_size[0].size_bytes >= sorted_by_size[1].size_bytes, "排序错误"

    print("✅ 筛选功能测试通过")


def test_impact_analysis(db):
    """测试影响分析功能"""
    print("\n=== 影响分析测试 ===")

    cache_entry = crud.get_cache_entry(db, "cache-3")

    impact_result = crud.calculate_impact_score(db, cache_entry)

    print(f"  缓存键: {cache_entry.cache_key}")
    print(f"  影响分数: {impact_result.impact_score:.2f}")
    print(f"  风险因素: {impact_result.risk_factors}")
    print(f"  分析结果: {impact_result.impact_analysis}")
    print(f"  需要人工审核: {impact_result.requires_manual_review}")

    assert 0 <= impact_result.impact_score <= 1, "影响分数应在0-1范围内"

    print("✅ 影响分析测试通过")


def test_eviction_workflow(db):
    """测试驱逐工作流"""
    print("\n=== 驱逐工作流测试 ===")

    eviction_req = schemas.EvictionRequestCreate(
        cache_entry_id="cache-5",
        requester="test_user",
        reason="Low hit rate and old"
    )
    db_eviction, error = crud.create_eviction_request(db, eviction_req)
    assert error is None, f"创建驱逐请求失败: {error}"
    print(f"  创建驱逐请求: ID={db_eviction.id}, 状态={db_eviction.status}")
    print(f"  影响分数: {db_eviction.impact_score:.2f}")

    eviction_id = db_eviction.id

    has_active = crud.has_active_eviction_request(db, "cache-5")
    assert has_active, "应该存在活跃驱逐请求"
    print("  ✅ 驱逐互斥检查通过 - 检测到活跃请求")

    db_eviction2, error = crud.create_eviction_request(db, eviction_req)
    assert error == "ACTIVE_EVICTION_EXISTS", "应该拒绝重复请求"
    print("  ✅ 驱逐互斥检查通过 - 拒绝重复请求")

    reviewed, error = crud.review_eviction_request(
        db,
        eviction_id,
        schemas.EvictionRequestReview(
            review_comment="Looks safe to evict",
            reviewed_by="admin",
            approved=True
        )
    )
    assert error is None, f"审核失败: {error}"
    print(f"  审核通过: 状态={reviewed.status}")

    executed, error = crud.execute_eviction(db, eviction_id, executed_by="admin")
    assert error is None, f"执行失败: {error}"
    assert executed.status == schemas.EvictionStatus.EXECUTED, "状态应为已执行"
    print(f"  执行驱逐: 状态={executed.status}")

    deleted_entry = crud.get_cache_entry(db, "cache-5")
    assert deleted_entry is None, "缓存条目应已被删除"
    print("  ✅ 缓存条目已成功删除")

    executed2, error = crud.execute_eviction(db, eviction_id)
    assert error == "ALREADY_EXECUTED", "应该拒绝重复执行"
    print("  ✅ 重复执行检查通过")

    print("✅ 驱逐工作流测试通过")
    return eviction_id


def test_eviction_candidates(db):
    """测试驱逐候选筛选"""
    print("\n=== 驱逐候选筛选测试 ===")

    candidates = crud.get_eviction_candidates(
        db,
        min_days_since_access=5,
        max_impact_score=0.8,
        limit=10
    )

    print(f"  找到 {len(candidates)} 个驱逐候选")
    for i, candidate in enumerate(candidates[:3]):
        print(f"    {i+1}. {candidate.cache_key} - {candidate.size_bytes/1024/1024:.0f}MB - 影响分数:{candidate.impact_score:.2f}")

    target_mb = 600
    target_candidates = crud.get_eviction_candidates(
        db,
        target_free_bytes=target_mb * 1024 * 1024,
        min_days_since_access=5
    )
    total_freed = sum(c.size_bytes for c in target_candidates) / 1024 / 1024
    print(f"  目标释放 {target_mb}MB, 实际释放 {total_freed:.0f}MB, 候选数量: {len(target_candidates)}")

    print("✅ 驱逐候选筛选测试通过")


def test_export_functionality(db):
    """测试导出功能"""
    print("\n=== 导出功能测试 ===")

    entries = crud.get_cache_entries(db, limit=100)

    data = []
    for entry in entries:
        data.append({
            "id": entry.id,
            "cache_key": entry.cache_key,
            "project_id": entry.project_id,
            "project_name": entry.project.name if entry.project else "",
            "size_bytes": entry.size_bytes,
            "size_mb": entry.size_bytes / (1024 * 1024),
            "hit_count": entry.hit_count,
            "is_protected": entry.is_protected
        })

    df = pd.DataFrame(data)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        csv_path = f.name
        df.to_csv(csv_path, index=False, encoding="utf-8")

    csv_size = os.path.getsize(csv_path)
    print(f"  CSV导出成功: {csv_path}, 大小={csv_size}字节")

    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
        xlsx_path = f.name
        with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Cache Entries")

    xlsx_size = os.path.getsize(xlsx_path)
    print(f"  Excel导出成功: {xlsx_path}, 大小={xlsx_size}字节")

    os.unlink(csv_path)
    os.unlink(xlsx_path)

    print("✅ 导出功能测试通过")


def test_error_cases(db):
    """测试错误处理"""
    print("\n=== 错误处理测试 ===")

    eviction_req = schemas.EvictionRequestCreate(
        cache_entry_id="non_existent_cache",
        requester="test_user"
    )
    db_eviction, error = crud.create_eviction_request(db, eviction_req)
    assert error == "CACHE_ENTRY_NOT_FOUND", "应返回缓存未找到错误"
    print(f"  ✅ 不存在的缓存处理正确: {error}")

    protected_req = schemas.EvictionRequestCreate(
        cache_entry_id="cache-4",
        requester="test_user"
    )
    db_eviction, error = crud.create_eviction_request(db, protected_req)
    assert db_eviction is not None, "受保护的缓存也可以申请驱逐"
    assert db_eviction.requires_manual_review == True, "受保护的缓存需要人工审核"
    print(f"  ✅ 受保护缓存处理正确: 需要人工审核={db_eviction.requires_manual_review}")

    result, error = crud.review_eviction_request(
        db,
        "non_existent_eviction",
        schemas.EvictionRequestReview(
            review_comment="test",
            reviewed_by="admin",
            approved=True
        )
    )
    assert error == "EVICTION_NOT_FOUND", "应返回驱逐请求未找到错误"
    print(f"  ✅ 不存在的驱逐请求处理正确: {error}")

    print("✅ 错误处理测试通过")


def test_statistics(db):
    """测试统计功能"""
    print("\n=== 统计功能测试 ===")

    stats = crud.get_cache_statistics(db)

    print(f"  总缓存条目: {stats['total_entries']}")
    print(f"  总大小: {stats['total_size_mb']:.0f}MB")
    print(f"  总命中数: {stats['total_hits']}")
    print(f"  受保护条目: {stats['protected_count']}")

    assert stats['total_entries'] > 0, "应该有缓存条目"
    assert stats['total_size_bytes'] > 0, "应该有缓存大小"

    print("✅ 统计功能测试通过")


def test_report_generation(db, executed_eviction_id):
    """测试报告生成功能"""
    print("\n=== 报告生成测试 ===")

    report = crud.create_eviction_report(
        db,
        eviction_ids=[executed_eviction_id],
        generated_by="self_test"
    )

    print(f"  报告ID: {report.id}")
    print(f"  驱逐总数: {report.total_evicted}")
    print(f"  释放空间: {report.total_space_freed_bytes / 1024 / 1024:.0f}MB")
    print(f"  总影响分数: {report.total_impact_score:.2f}")

    assert report.total_evicted == 1, "应该有1个驱逐记录"
    assert report.total_space_freed_bytes > 0, "应该释放了空间"

    import json
    report_data = json.loads(report.report_data)
    cache_key_in_report = report_data["evictions"][0]["cache_key"]
    print(f"  报告中的缓存键: {cache_key_in_report}")
    assert cache_key_in_report is not None, "缓存键不应该为null"
    assert cache_key_in_report == "test_results_v2", f"缓存键应该为test_results_v2, 实际是{cache_key_in_report}"
    print("  ✅ 缓存键快照保存正确")

    print("✅ 报告生成测试通过")


def main():
    """主测试函数"""
    print("=" * 60)
    print("构建缓存驱逐影响分析API - 自检脚本")
    print("=" * 60)

    db = setup_test_db()

    try:
        create_test_data(db)

        test_filtering(db)

        test_impact_analysis(db)

        executed_eviction_id = test_eviction_workflow(db)

        test_eviction_candidates(db)

        test_export_functionality(db)

        test_error_cases(db)

        test_statistics(db)

        test_report_generation(db, executed_eviction_id)

        print("\n" + "=" * 60)
        print("✅ 所有测试通过!")
        print("=" * 60)
        return 0

    except AssertionError as e:
        print(f"\n❌ 断言失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
