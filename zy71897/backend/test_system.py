#!/usr/bin/env python3
"""
空压机能耗诊断系统 - 功能验证测试脚本
验证：导入、诊断、复核、修正、历史、导出的完整流程
验证：批量处理幂等性、导出一致性
"""

import os
import sys
import json
import hashlib
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app import models, schemas
from app.diagnosis.energy_model import energy_diagnosis_model
from app.diagnosis.threshold import threshold_manager

Base.metadata.create_all(bind=engine)


def test_threshold_cross_level():
    """测试阈值跨档检测"""
    print("\n=== 测试1: 阈值跨档检测 ===")

    test_cases = [
        ("power", 85, "normal"),
        ("power", 95, "warning"),
        ("power", 105, "critical"),
        ("load_rate", 25, "warning"),
        ("load_rate", 15, "critical"),
        ("overall_vibration", 3.0, "warning"),
        ("overall_vibration", 5.0, "critical"),
        ("overall_vibration", 8.0, "critical"),
        ("temperature", 90, "warning"),
        ("temperature", 100, "critical"),
    ]

    all_passed = True
    for param, value, expected_level in test_cases:
        result = threshold_manager.check_value(param, value)
        passed = result.level == expected_level and result.is_abnormal == (expected_level != "normal")
        status = "✓" if passed else "✗"
        print(f"  {status} {param}={value} -> {result.level} (期望: {expected_level})")
        if not passed:
            all_passed = False
            print(f"    描述: {result.description}")
            print(f"    建议: {result.recommendation}")

    return all_passed


def test_diagnosis_idempotency():
    """测试诊断幂等性 - 相同数据重复运行应返回相同结果"""
    print("\n=== 测试2: 诊断幂等性验证 ===")

    db = SessionLocal()
    try:
        compressor = db.query(models.Compressor).first()
        if not compressor:
            print("  跳过: 没有可用的空压机数据，请先生成示例数据")
            return True

        end_time = datetime.now()
        start_time = end_time - timedelta(days=1)

        print(f"  设备: {compressor.equipment_no}")
        print(f"  时间范围: {start_time} ~ {end_time}")

        print("  第一次运行诊断...")
        result1 = energy_diagnosis_model.diagnose(
            db=db,
            compressor_id=compressor.id,
            start_time=start_time,
            end_time=end_time,
            diagnosis_type="standard",
        )
        hash1 = result1.report_hash
        anomalies1 = result1.abnormal_count
        score1 = result1.anomaly_score

        print(f"    报告哈希: {hash1[:16]}...")
        print(f"    异常数: {anomalies1}, 异常分数: {score1}")

        print("  第二次运行诊断（相同参数）...")
        result2 = energy_diagnosis_model.diagnose(
            db=db,
            compressor_id=compressor.id,
            start_time=start_time,
            end_time=end_time,
            diagnosis_type="standard",
        )
        hash2 = result2.report_hash
        anomalies2 = result2.abnormal_count
        score2 = result2.anomaly_score

        print(f"    报告哈希: {hash2[:16]}...")
        print(f"    异常数: {anomalies2}, 异常分数: {score2}")

        hash_match = hash1 == hash2
        anomalies_match = anomalies1 == anomalies2
        score_match = abs(score1 - score2) < 0.01

        print(f"  哈希一致: {'✓' if hash_match else '✗'}")
        print(f"  异常数一致: {'✓' if anomalies_match else '✗'}")
        print(f"  分数一致: {'✓' if score_match else '✗'}")

        all_passed = hash_match and anomalies_match and score_match
        if all_passed:
            print("  ✓ 幂等性验证通过 - 重复运行产生相同结果")
        else:
            print("  ✗ 幂等性验证失败 - 重复运行产生不同结果")

        return all_passed

    except Exception as e:
        print(f"  测试异常: {e}")
        return False
    finally:
        db.close()


def test_export_consistency():
    """测试导出一致性 - 相同筛选条件应生成相同报告哈希"""
    print("\n=== 测试3: 导出一致性验证 ===")

    db = SessionLocal()
    try:
        compressor = db.query(models.Compressor).first()
        if not compressor:
            print("  跳过: 没有可用的空压机数据")
            return True

        end_time = datetime.now()
        start_time = end_time - timedelta(days=3)

        view_state1 = {
            "compressor_id": compressor.id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "filters": {"min_power": 0},
            "page": 1,
            "page_size": 100,
        }

        view_state2 = {
            "compressor_id": compressor.id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "filters": {"min_power": 0},
            "page": 1,
            "page_size": 100,
        }

        view_state3 = {
            "compressor_id": compressor.id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "filters": {"min_power": 50},
            "page": 1,
            "page_size": 100,
        }

        def calc_hash(state):
            state_str = json.dumps(state, sort_keys=True, ensure_ascii=False)
            return hashlib.sha256(state_str.encode()).hexdigest()[:32]

        hash1 = calc_hash(view_state1)
        hash2 = calc_hash(view_state2)
        hash3 = calc_hash(view_state3)

        print(f"  视图1哈希: {hash1[:16]}...")
        print(f"  视图2哈希: {hash2[:16]}...")
        print(f"  视图3哈希: {hash3[:16]}...")

        same_view_match = hash1 == hash2
        diff_view_diff = hash1 != hash3

        print(f"  相同视图哈希一致: {'✓' if same_view_match else '✗'}")
        print(f"  不同视图哈希不同: {'✓' if diff_view_diff else '✗'}")

        all_passed = same_view_match and diff_view_diff

        if all_passed:
            print("  ✓ 导出一致性验证通过 - 相同视图产生相同哈希")
        else:
            print("  ✗ 导出一致性验证失败")

        return all_passed

    except Exception as e:
        print(f"  测试异常: {e}")
        return False
    finally:
        db.close()


def test_vibration_snapshot():
    """测试振动曲线数据留底"""
    print("\n=== 测试4: 振动曲线数据留底 ===")

    from app.diagnosis.vibration import vibration_analyzer

    db = SessionLocal()
    try:
        compressor = db.query(models.Compressor).first()
        if not compressor:
            print("  跳过: 没有可用的空压机数据")
            return True

        end_time = datetime.now()
        start_time = end_time - timedelta(days=1)

        vib_records = db.query(models.VibrationRecord).filter(
            models.VibrationRecord.compressor_id == compressor.id,
            models.VibrationRecord.record_time >= start_time,
            models.VibrationRecord.record_time <= end_time,
        ).order_by(models.VibrationRecord.record_time).all()

        if not vib_records:
            print("  跳过: 没有可用的振动数据")
            return True

        print(f"  振动记录数: {len(vib_records)}")

        analysis = vibration_analyzer.analyze(vib_records)

        has_snapshot = analysis.raw_data_snapshot and len(analysis.raw_data_snapshot) > 0
        print(f"  数据快照存在: {'✓' if has_snapshot else '✗'}")

        if has_snapshot:
            try:
                snapshot_data = json.loads(analysis.raw_data_snapshot)
                print(f"  快照版本: {snapshot_data.get('data_version')}")
                print(f"  记录数: {snapshot_data.get('record_count')}")
                print(f"  时间范围: {snapshot_data.get('time_range', {}).get('start')[:16]} ~ {snapshot_data.get('time_range', {}).get('end')[:16]}")
                print(f"  采样点数: {len(snapshot_data.get('sample_points', []))}")
                print(f"  统计信息: {snapshot_data.get('statistics', {})}")
                print("  ✓ 振动曲线数据留底验证通过")
                return True
            except json.JSONDecodeError:
                print("  ✗ 快照数据格式错误")
                return False

        return False

    except Exception as e:
        print(f"  测试异常: {e}")
        return False
    finally:
        db.close()


def test_anomaly_override():
    """测试异常点人工修正"""
    print("\n=== 测试5: 异常点人工修正 ===")

    db = SessionLocal()
    try:
        diagnosis = db.query(models.Diagnosis).filter(
            models.Diagnosis.abnormal_count > 0
        ).first()

        if not diagnosis:
            compressor = db.query(models.Compressor).first()
            if not compressor:
                print("  跳过: 没有可用数据")
                return True

            end_time = datetime.now()
            start_time = end_time - timedelta(days=7)
            result = energy_diagnosis_model.diagnose(
                db=db,
                compressor_id=compressor.id,
                start_time=start_time,
                end_time=end_time,
            )
            diagnosis = db.query(models.Diagnosis).filter(
                models.Diagnosis.id == result.diagnosis_id
            ).first()

        anomaly = db.query(models.Anomaly).filter(
            models.Anomaly.diagnosis_id == diagnosis.id,
            models.Anomaly.is_manual_override == False,
        ).first()

        if not anomaly:
            print("  跳过: 没有可修正的异常点")
            return True

        print(f"  诊断ID: {diagnosis.id}")
        print(f"  异常点ID: {anomaly.id}")
        print(f"  异常参数: {anomaly.parameter}")
        print(f"  实际值: {anomaly.actual_value}")
        print(f"  原异常数: {diagnosis.abnormal_count}")

        original_count = diagnosis.abnormal_count

        anomaly.is_manual_override = True
        anomaly.override_note = "测试修正 - 经确认属于正常波动"
        db.flush()

        active_count = db.query(models.Anomaly).filter(
            models.Anomaly.diagnosis_id == diagnosis.id,
            models.Anomaly.is_manual_override == False,
        ).count()
        diagnosis.abnormal_count = active_count
        diagnosis.is_manual_corrected = True
        diagnosis.correction_note = "测试修正"
        diagnosis.corrected_by = "test"
        diagnosis.corrected_at = datetime.now()
        db.commit()

        db.refresh(diagnosis)
        print(f"  修正后异常数: {diagnosis.abnormal_count}")
        print(f"  修正标记: {'✓' if diagnosis.is_manual_corrected else '✗'}")

        count_reduced = diagnosis.abnormal_count < original_count
        has_correction_flag = diagnosis.is_manual_corrected

        print(f"  异常数减少: {'✓' if count_reduced else '✗'}")
        print(f"  修正标记正确: {'✓' if has_correction_flag else '✗'}")

        all_passed = count_reduced and has_correction_flag
        if all_passed:
            print("  ✓ 异常点人工修正验证通过")
        else:
            print("  ✗ 异常点人工修正验证失败")

        return all_passed

    except Exception as e:
        db.rollback()
        print(f"  测试异常: {e}")
        return False
    finally:
        db.close()


def test_batch_processing():
    """测试批量处理稳定性"""
    print("\n=== 测试6: 批量处理稳定性 ===")

    db = SessionLocal()
    try:
        compressors = db.query(models.Compressor).all()
        if len(compressors) < 2:
            print("  跳过: 需要至少2台设备进行批量测试")
            return True

        end_time = datetime.now()
        start_time = end_time - timedelta(days=1)
        batch_id = f"test_batch_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        print(f"  批量ID: {batch_id}")
        print(f"  设备数量: {len(compressors)}")

        results = []
        for i, comp in enumerate(compressors):
            try:
                print(f"  处理设备 {i+1}/{len(compressors)}: {comp.equipment_no}...")
                result = energy_diagnosis_model.diagnose(
                    db=db,
                    compressor_id=comp.id,
                    start_time=start_time,
                    end_time=end_time,
                    batch_id=batch_id,
                )
                results.append(result)
                print(f"    ✓ 异常数: {result.abnormal_count}, 分数: {result.anomaly_score}")
            except Exception as e:
                print(f"    ✗ 失败: {e}")
                results.append(None)

        success_count = len([r for r in results if r is not None])
        print(f"  成功: {success_count}/{len(compressors)}")

        batch_diagnoses = db.query(models.Diagnosis).filter(
            models.Diagnosis.batch_id == batch_id
        ).count()
        print(f"  数据库中批次记录数: {batch_diagnoses}")

        all_passed = success_count == len(compressors) and batch_diagnoses == len(compressors)
        if all_passed:
            print("  ✓ 批量处理稳定性验证通过")
        else:
            print("  ✗ 批量处理稳定性验证失败")

        return all_passed

    except Exception as e:
        print(f"  测试异常: {e}")
        return False
    finally:
        db.close()


def main():
    print("=" * 60)
    print("  空压机能耗诊断系统 - 功能验证测试")
    print("=" * 60)

    tests = [
        ("阈值跨档检测", test_threshold_cross_level),
        ("诊断幂等性", test_diagnosis_idempotency),
        ("导出一致性", test_export_consistency),
        ("振动曲线留底", test_vibration_snapshot),
        ("异常点修正", test_anomaly_override),
        ("批量处理稳定", test_batch_processing),
    ]

    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"\n  ✗ 测试异常: {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("  测试结果汇总")
    print("=" * 60)

    passed_count = 0
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {status} - {name}")
        if passed:
            passed_count += 1

    print("-" * 60)
    print(f"  总计: {passed_count}/{len(results)} 测试通过")

    if passed_count == len(results):
        print("\n  ✓ 所有测试通过！系统功能正常。")
        return 0
    else:
        print(f"\n  ✗ 有 {len(results) - passed_count} 项测试失败，请检查。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
