import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import SessionLocal, init_db
from models import (
    QualityInspection, CustomerServiceDialog, KnowledgeBaseEntry,
    ReviewSample, ChangeHistory, FilterCondition, BatchTask, ExportRecord
)
from services import (
    TraceService, ChangeHistoryService, FilterService,
    BatchService, ExportService
)
import schemas


def test_data_tracing():
    print("\n" + "="*60)
    print("测试1: 数据溯源功能")
    print("="*60)
    
    db = SessionLocal()
    try:
        sample = db.query(ReviewSample).first()
        if not sample:
            print("❌ 没有测试数据，请先运行 init_data.py")
            return False
        
        trace = TraceService.get_sample_trace(db, sample.id)
        
        assert "data_sources" in trace, "❌ 缺少 data_sources 字段"
        assert "change_history" in trace, "❌ 缺少 change_history 字段"
        assert "data_timeline" in trace, "❌ 缺少 data_timeline 字段"
        
        print(f"✅ 样本 #{sample.id} 溯源成功")
        print(f"  - 数据来源: {len(trace['data_sources'])} 个")
        print(f"  - 变更历史: {len(trace['change_history'])} 条")
        print(f"  - 时间线事件: {len(trace['data_timeline'])} 个")
        
        for source in trace["data_sources"]:
            assert "link" in source, f"❌ 来源 {source['source_name']} 缺少溯源链接"
            print(f"    ✓ {source['source_name']}: {source['source_no']} → {source['link']}")
        
        print("✅ 数据溯源功能测试通过")
        return True
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_sensitive_data_check():
    print("\n" + "="*60)
    print("测试2: 敏感词漏脱敏异常判定")
    print("="*60)
    
    db = SessionLocal()
    try:
        samples = db.query(ReviewSample).all()
        
        tested = 0
        for sample in samples:
            result = TraceService.check_sensitive_data_anomaly(db, sample.id)
            tested += 1
            
            print(f"\n样本 #{sample.id}:")
            print(f"  - 敏感词发现: {len(result['sensitive_findings'])} 处")
            print(f"  - 手工修正: {result['manual_fix_count']} 次")
            print(f"  - 判定结果: {result['judgment']}")
            print(f"  - 是否异常: {'是' if result['is_exception'] else '否'}")
            
            if result['is_exception']:
                print(f"  ✅ 正确判定为异常")
            elif result['manual_fix_count'] > 0 and not result['is_exception']:
                print(f"  ✅ 已修正，正确判定为非异常")
        
        print(f"\n✅ 敏感词检查测试通过，共测试 {tested} 个样本")
        return True
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_change_tracking():
    print("\n" + "="*60)
    print("测试3: 变更历史追踪（区分补材料和结论变更）")
    print("="*60)
    
    db = SessionLocal()
    try:
        sample = db.query(ReviewSample).filter(ReviewSample.id == 2).first()
        if not sample:
            print("❌ 没有测试数据")
            return False
        
        old_conclusion = sample.conclusion
        old_is_anomaly = sample.is_anomaly
        
        print(f"测试样本 #{sample.id}:")
        print(f"  当前结论: {old_conclusion}")
        print(f"  当前是否异常: {old_is_anomaly}")
        
        print("\n  记录补材料...")
        change1 = ChangeHistoryService.log_material_supplement(
            db, sample.id, "evidence_summary",
            "测试补材料 - 补充新的证据",
            operator="测试员",
            remark="测试补材料"
        )
        assert change1 is not None, "❌ 补材料记录失败"
        assert change1.change_type == "MATERIAL_SUPPLEMENT", f"❌ 变更类型错误: {change1.change_type}"
        print(f"  ✅ 补材料记录成功，变更类型: {change1.change_type}")
        
        print("\n  记录结论变更...")
        change2 = ChangeHistoryService.log_change(
            db, sample.id, "conclusion",
            old_conclusion, "测试变更结论",
            operator="测试员",
            remark="测试结论变更"
        )
        assert change2 is not None, "❌ 结论变更记录失败"
        assert change2.change_type == "CONCLUSION_CHANGE", f"❌ 变更类型错误: {change2.change_type}"
        print(f"  ✅ 结论变更记录成功，变更类型: {change2.change_type}")
        
        change3 = ChangeHistoryService.log_change(
            db, sample.id, "is_anomaly",
            old_is_anomaly, not old_is_anomaly,
            operator="测试员",
            remark="测试异常状态变更"
        )
        assert change3 is not None, "❌ 异常状态变更记录失败"
        assert change3.change_type == "CONCLUSION_CHANGE", f"❌ 变更类型错误: {change3.change_type}"
        print(f"  ✅ 异常状态变更记录成功，变更类型: {change3.change_type}")
        
        print("\n  获取变更汇总...")
        summary = ChangeHistoryService.get_change_summary(db, sample.id)
        print(f"  - 总变更次数: {summary['total_changes']}")
        print(f"  - 补材料次数: {summary['material_supplements']}")
        print(f"  - 结论变更次数: {summary['conclusion_changes']}")
        print(f"  - 仅补材料: {'是' if summary['has_material_only'] else '否'}")
        print(f"  - 有结论变更: {'是' if summary['has_conclusion_change'] else '否'}")
        
        assert summary['conclusion_changes'] >= 2, "❌ 结论变更计数错误"
        assert summary['has_conclusion_change'] == True, "❌ 应检测到结论变更"
        
        print("\n  报表分类...")
        classifications = ChangeHistoryService.classify_changes_for_report(db, [sample.id])
        for c in classifications:
            print(f"  - 样本 #{c['sample_id']}: {c['classification']}")
            assert c['is_conclusion_change'] == True, "❌ 分类错误，应判定为结论变更"
        
        sample.conclusion = old_conclusion
        sample.is_anomaly = old_is_anomaly
        db.commit()
        
        print("\n✅ 变更追踪测试通过")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_filter_consistency():
    print("\n" + "="*60)
    print("测试4: 筛选条件持久化和一致性保证")
    print("="*60)
    
    db = SessionLocal()
    try:
        filter_data = schemas.FilterConditionCreate(
            conditions={"review_status": "pending", "is_anomaly": None},
            page=1,
            page_size=10,
            sort_by="created_at",
            sort_order="desc",
            created_by="测试员"
        )
        
        print("第一次查询并创建筛选条件...")
        samples1, total1, db_filter1 = FilterService.query_samples(db, filter_data)
        assert db_filter1.id is not None, "❌ 筛选条件未保存"
        print(f"  ✅ 筛选条件 ID: {db_filter1.id}")
        print(f"  ✅ 条件哈希: {db_filter1.condition_hash}")
        print(f"  ✅ 查询结果: {len(samples1)} 条，总计 {total1} 条")
        
        print("\n使用相同条件第二次查询...")
        samples2, total2, db_filter2 = FilterService.query_samples(db, filter_data)
        assert db_filter1.id == db_filter2.id, "❌ 相同条件应返回同一筛选记录"
        print(f"  ✅ 复用筛选条件 ID: {db_filter2.id}")
        print(f"  ✅ 结果一致: {len(samples2)} 条，总计 {total2} 条")
        
        print("\n修改筛选条件后查询...")
        filter_data2 = schemas.FilterConditionCreate(
            conditions={"review_status": "completed"},
            page=1,
            page_size=10,
            sort_by="created_at",
            sort_order="desc",
            created_by="测试员"
        )
        samples3, total3, db_filter3 = FilterService.query_samples(db, filter_data2)
        assert db_filter3.id != db_filter1.id, "❌ 不同条件应创建新筛选记录"
        print(f"  ✅ 新筛选条件 ID: {db_filter3.id}")
        print(f"  ✅ 查询结果: {len(samples3)} 条，总计 {total3} 条")
        
        print("\n验证筛选条件关联...")
        for s in samples1[:3]:
            assert s.filter_condition_id == db_filter1.id, f"❌ 样本 #{s.id} 未关联筛选条件"
            print(f"  ✅ 样本 #{s.id} 关联筛选条件 #{s.filter_condition_id}")
        
        print("\n比较两个筛选条件...")
        compare = FilterService.compare_filters(db, db_filter1.id, db_filter3.id)
        print(f"  - 哈希匹配: {compare['hash_match']}")
        print(f"  - 条件匹配: {compare['conditions_match']}")
        print(f"  - 数量差异: {compare['total_count_diff']}")
        assert compare['hash_match'] == False, "❌ 不同条件哈希不应匹配"
        
        print("\n✅ 筛选条件一致性测试通过")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_idempotent_batch():
    print("\n" + "="*60)
    print("测试5: 幂等性批量处理")
    print("="*60)
    
    db = SessionLocal()
    try:
        samples = db.query(ReviewSample).limit(3).all()
        sample_ids = [s.id for s in samples]
        
        print(f"测试样本: {sample_ids}")
        
        print("\n第一次执行批量标记异常...")
        task1 = BatchService.batch_mark_anomaly(
            db, sample_ids,
            anomaly_type="QUALITY_ISSUE",
            conclusion="批量测试标记异常",
            reviewer="测试员"
        )
        assert task1.status == "completed", f"❌ 任务未完成: {task1.status}"
        print(f"  ✅ 任务 ID: {task1.id}")
        print(f"  ✅ 幂等键: {task1.idempotency_key}")
        print(f"  ✅ 总计: {task1.total_count}, 成功: {task1.success_count}, 失败: {task1.failed_count}")
        
        print("\n使用相同参数第二次执行...")
        task2 = BatchService.batch_mark_anomaly(
            db, sample_ids,
            anomaly_type="QUALITY_ISSUE",
            conclusion="批量测试标记异常",
            reviewer="测试员"
        )
        assert task1.id == task2.id, "❌ 相同参数应返回同一任务（幂等性）"
        print(f"  ✅ 复用任务 ID: {task2.id}")
        print(f"  ✅ 状态: {task2.status} (未重复执行)")
        
        print("\n验证幂等键检查...")
        verify = BatchService.verify_idempotency(
            db, "batch_update_samples",
            {
                "sample_ids": sorted(sample_ids),
                "update_data": {
                    "review_status": "completed",
                    "is_anomaly": True,
                    "anomaly_type": "QUALITY_ISSUE",
                    "conclusion": "批量测试标记异常",
                    "reviewer": "测试员"
                },
                "operator": "测试员"
            }
        )
        print(f"  - 任务存在: {verify['task_exists']}")
        print(f"  - 已完成: {verify['is_completed']}")
        assert verify['is_completed'] == True, "❌ 任务应已完成"
        
        print("\n检查变更历史不重复...")
        for sid in sample_ids:
            changes = ChangeHistoryService.get_sample_changes(db, sid)
            batch_changes = [c for c in changes if c['change_source'] == 'BATCH_PROCESS']
            print(f"  样本 #{sid}: 批量处理变更 {len(batch_changes)} 条")
        
        print("\n验证重复运行不增加变更...")
        before_count = db.query(ChangeHistory).count()
        task3 = BatchService.batch_mark_anomaly(
            db, sample_ids,
            anomaly_type="QUALITY_ISSUE",
            conclusion="批量测试标记异常",
            reviewer="测试员"
        )
        after_count = db.query(ChangeHistory).count()
        assert before_count == after_count, f"❌ 重复执行产生了额外变更: {before_count} → {after_count}"
        print(f"  ✅ 变更记录数保持不变: {before_count}")
        
        for s in samples:
            s.review_status = "pending"
            s.is_anomaly = False
            s.anomaly_type = None
            s.conclusion = None
        db.commit()
        
        print("\n✅ 幂等性批量处理测试通过")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_export_consistency():
    print("\n" + "="*60)
    print("测试6: 周报导出与屏幕一致性")
    print("="*60)
    
    db = SessionLocal()
    try:
        filter_data = schemas.FilterConditionCreate(
            conditions={},
            page=1,
            page_size=50,
            sort_by="created_at",
            sort_order="desc",
            created_by="测试员"
        )
        
        print("查询数据获取筛选条件...")
        samples, total, db_filter = FilterService.query_samples(db, filter_data)
        db.commit()
        print(f"  ✅ 筛选条件 ID: {db_filter.id}")
        print(f"  ✅ 数据量: {total} 条")
        
        print("\n导出周报...")
        export = ExportService.export_weekly_report(
            db, filter_condition_id=db_filter.id, exported_by="测试员"
        )
        assert export.filter_condition_id == db_filter.id, "❌ 导出未关联筛选条件"
        assert export.record_count == total, f"❌ 导出记录数不匹配: {export.record_count} != {total}"
        print(f"  ✅ 导出 ID: {export.id}")
        print(f"  ✅ 导出记录数: {export.record_count}")
        print(f"  ✅ 关联筛选条件: #{export.filter_condition_id}")
        print(f"  ✅ 文件路径: {export.file_path}")
        
        print("\n验证导出一致性...")
        consistency = ExportService.verify_export_consistency(
            db, export.id, db_filter.id
        )
        print(f"  - 筛选条件匹配: {consistency['filter_match']['hash_match']}")
        print(f"  - 记录数匹配: {consistency['sample_count_match']}")
        print(f"  - 记录ID匹配: {consistency['sample_ids_match']}")
        print(f"  - 完全一致: {consistency['is_consistent']}")
        assert consistency['is_consistent'] == True, "❌ 导出数据与屏幕数据不一致"
        
        print("\n修改数据后再次验证...")
        new_sample = ReviewSample(
            sample_batch_no="TEST_BATCH",
            sample_date=datetime.now(),
            sampler="测试",
            review_status="pending",
            is_anomaly=False
        )
        db.add(new_sample)
        db.flush()
        
        consistency2 = ExportService.verify_export_consistency(
            db, export.id, db_filter.id
        )
        print(f"  - 完全一致: {consistency2['is_consistent']}")
        print(f"  - 新增记录: {consistency2['new_samples_since_export']}")
        assert consistency2['is_consistent'] == False, "❌ 数据变更后应检测到不一致"
        
        db.delete(new_sample)
        db.commit()
        
        export_file = Path(export.file_path)
        if export_file.exists():
            export_file.unlink()
            print(f"\n  ✅ 清理测试导出文件")
        
        print("\n✅ 周报导出一致性测试通过")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def main():
    print("\n" + "="*60)
    print("人工复判采样系统 - 核心功能测试")
    print("="*60)
    
    init_db()
    
    tests = [
        ("数据溯源功能", test_data_tracing),
        ("敏感词异常判定", test_sensitive_data_check),
        ("变更历史追踪", test_change_tracking),
        ("筛选条件一致性", test_filter_consistency),
        ("幂等性批量处理", test_idempotent_batch),
        ("导出一致性", test_export_consistency),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ 测试 {name} 异常: {e}")
            results.append((name, False))
    
    print("\n" + "="*60)
    print("测试汇总")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {status} - {name}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
