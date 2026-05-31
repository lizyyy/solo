import os
import shutil
import unittest
from datetime import datetime

from models import (
    MaterialBatch, FaultRecord, OrbitElements, VerificationStatus,
    FaultSeverity
)
from storage import PersistentStorage
from verifier import AntennaPointingVerifier


class TestAntennaPointingVerification(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.storage = PersistentStorage(base_dir=self.test_dir)
        self.verifier = AntennaPointingVerifier(self.storage, expected_accuracy=0.5)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def _create_normal_orbit(self, orbit_id="ORB_001"):
        return OrbitElements(
            orbit_id=orbit_id,
            semi_major_axis=7000.0,
            eccentricity=0.001,
            inclination=98.7,
            raan=120.5,
            argument_of_perigee=90.0,
            true_anomaly=45.0,
            epoch="2026-05-31T00:00:00Z",
            source="TLE_PUBLISHED"
        )

    def _create_passing_fault(self, fault_id="FLT_001", orbit_id="ORB_001", telemetry_seg="TEL_001"):
        return FaultRecord(
            fault_id=fault_id,
            fault_type="POINTING_DEVIATION",
            description="X频段天线指向偏差在正常范围内",
            severity=FaultSeverity.INFO,
            telemetry_segment_id=telemetry_seg,
            orbit_id=orbit_id,
            antenna_pointing_error=0.3,
            detected_at="2026-05-30T10:30:00Z",
            reported_by="AUTO_DETECT"
        )

    def _create_failing_fault(self, fault_id="FLT_002", orbit_id="ORB_001", telemetry_seg="TEL_002"):
        return FaultRecord(
            fault_id=fault_id,
            fault_type="POINTING_DEVIATION",
            description="X频段天线指向偏差超出阈值",
            severity=FaultSeverity.CRITICAL,
            telemetry_segment_id=telemetry_seg,
            orbit_id=orbit_id,
            antenna_pointing_error=0.8,
            detected_at="2026-05-30T11:45:00Z",
            reported_by="AUTO_DETECT"
        )

    def _create_missing_orbit_fault(self, fault_id="FLT_003"):
        return FaultRecord(
            fault_id=fault_id,
            fault_type="POINTING_DEVIATION",
            description="Ka频段天线指向偏差，轨道数据未同步",
            severity=FaultSeverity.WARNING,
            telemetry_segment_id="TEL_003",
            orbit_id="ORB_MISSING",
            antenna_pointing_error=0.4,
            detected_at="2026-05-30T12:00:00Z",
            reported_by="AUTO_DETECT"
        )

    def _create_boundary_fault(self, fault_id="FLT_004", orbit_id="ORB_001", error=0.5, telemetry_seg="TEL_004"):
        return FaultRecord(
            fault_id=fault_id,
            fault_type="POINTING_DEVIATION",
            description="边界情况测试",
            severity=FaultSeverity.WARNING,
            telemetry_segment_id=telemetry_seg,
            orbit_id=orbit_id,
            antenna_pointing_error=error,
            detected_at="2026-05-30T13:00:00Z",
            reported_by="AUTO_DETECT"
        )

    def test_01_normal_scenario_all_passed(self):
        print("\n" + "=" * 60)
        print("测试1: 正常场景 - 所有故障校验通过")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        fault1 = self._create_passing_fault("FLT_001", "ORB_001", "TEL_001")
        fault2 = self._create_passing_fault("FLT_002", "ORB_001", "TEL_002")
        fault2.antenna_pointing_error = 0.2

        batch = MaterialBatch(
            batch_id="BATCH_001",
            faults=[fault1, fault2],
            orbits=[orbit]
        )

        verification, is_re_run = self.verifier.verify(batch, "OPERATOR_ALICE")

        print(f"校验ID: {verification.verification_id}")
        print(f"状态: {verification.status.value}")
        print(f"是否重跑: {is_re_run}")
        print(f"摘要: {verification.summary}")
        print(f"\n详细结果:")
        for item in verification.items:
            print(f"  {item.fault_id}: {item.status.value} | "
                  f"指向精度: {item.pointing_accuracy:.3f}° | "
                  f"证据链条数: {len(item.evidence)}")

        self.assertEqual(verification.status, VerificationStatus.PASSED)
        self.assertFalse(is_re_run)
        self.assertEqual(len(verification.items), 2)
        for item in verification.items:
            self.assertEqual(item.status, VerificationStatus.PASSED)

        print("\n✓ 正常场景测试通过")

    def test_02_missing_orbit_scenario(self):
        print("\n" + "=" * 60)
        print("测试2: 缺轨道根数场景")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        fault_normal = self._create_passing_fault("FLT_001", "ORB_001", "TEL_001")
        fault_missing = self._create_missing_orbit_fault("FLT_002")

        batch = MaterialBatch(
            batch_id="BATCH_002",
            faults=[fault_normal, fault_missing],
            orbits=[orbit]
        )

        verification, is_re_run = self.verifier.verify(batch, "OPERATOR_BOB")

        print(f"校验ID: {verification.verification_id}")
        print(f"状态: {verification.status.value}")
        print(f"摘要: {verification.summary}")
        print(f"\n详细结果:")
        for item in verification.items:
            status_detail = f" | 错误详情: {item.error_details}" if item.error_details else ""
            print(f"  {item.fault_id}: {item.status.value} | "
                  f"指向精度: {item.pointing_accuracy}{status_detail}")

        self.assertEqual(verification.status, VerificationStatus.PENDING)
        self.assertEqual(len(verification.items), 2)

        normal_item = next(i for i in verification.items if i.fault_id == "FLT_001")
        self.assertEqual(normal_item.status, VerificationStatus.PASSED)

        missing_item = next(i for i in verification.items if i.fault_id == "FLT_002")
        self.assertEqual(missing_item.status, VerificationStatus.PENDING)
        self.assertIn("轨道根数 ORB_MISSING 不存在", missing_item.error_details)

        print("\n✓ 缺轨道根数场景测试通过")

    def test_03_duplicate_telemetry_scenario(self):
        print("\n" + "=" * 60)
        print("测试3: 重复遥测片段场景")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        fault1 = self._create_passing_fault("FLT_001", "ORB_001", "TEL_DUP_001")
        fault2 = self._create_passing_fault("FLT_002", "ORB_001", "TEL_DUP_001")
        fault3 = self._create_passing_fault("FLT_003", "ORB_001", "TEL_NORMAL")

        batch = MaterialBatch(
            batch_id="BATCH_003",
            faults=[fault1, fault2, fault3],
            orbits=[orbit]
        )

        verification, is_re_run = self.verifier.verify(batch, "OPERATOR_CHARLIE")

        print(f"校验ID: {verification.verification_id}")
        print(f"状态: {verification.status.value}")
        print(f"摘要: {verification.summary}")
        print(f"\n详细结果:")
        for item in verification.items:
            status_detail = f" | 详情: {item.error_details}" if item.error_details else ""
            print(f"  {item.fault_id}: {item.status.value} | "
                  f"遥测片段: {next(f.telemetry_segment_id for f in batch.faults if f.fault_id == item.fault_id)}"
                  f"{status_detail}")

        self.assertEqual(verification.status, VerificationStatus.PARTIAL)

        dup_items = [i for i in verification.items if i.status == VerificationStatus.PARTIAL]
        self.assertEqual(len(dup_items), 2)
        for item in dup_items:
            self.assertIn("存在重复记录", item.error_details)

        normal_item = next(i for i in verification.items if i.fault_id == "FLT_003")
        self.assertEqual(normal_item.status, VerificationStatus.PASSED)

        print("\n✓ 重复遥测片段场景测试通过")

    def test_04_boundary_scenario(self):
        print("\n" + "=" * 60)
        print("测试4: 边界情况场景")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        correction_factor = 1.0 + (orbit.eccentricity * 0.1) + (abs(orbit.inclination - 90) * 0.001)
        print(f"轨道修正系数: {correction_factor:.4f}")

        threshold = self.verifier.expected_accuracy
        error_at = threshold / correction_factor
        error_below = (threshold - 0.001) / correction_factor
        error_above = (threshold + 0.001) / correction_factor

        fault_at_threshold = self._create_boundary_fault("FLT_001", "ORB_001", error=error_at, telemetry_seg="TEL_BDY_001")
        fault_just_below = self._create_boundary_fault("FLT_002", "ORB_001", error=error_below, telemetry_seg="TEL_BDY_002")
        fault_just_above = self._create_boundary_fault("FLT_003", "ORB_001", error=error_above, telemetry_seg="TEL_BDY_003")
        fault_zero_error = self._create_boundary_fault("FLT_004", "ORB_001", error=0.0, telemetry_seg="TEL_BDY_004")

        batch = MaterialBatch(
            batch_id="BATCH_004",
            faults=[fault_at_threshold, fault_just_below, fault_just_above, fault_zero_error],
            orbits=[orbit]
        )

        verification, is_re_run = self.verifier.verify(batch, "OPERATOR_DAVE")

        print(f"阈值: {self.verifier.expected_accuracy}°")
        print(f"校验ID: {verification.verification_id}")
        print(f"状态: {verification.status.value}")
        print(f"\n详细结果:")
        for item in verification.items:
            fault = next(f for f in batch.faults if f.fault_id == item.fault_id)
            print(f"  {item.fault_id}: {item.status.value} | "
                  f"原始误差: {fault.antenna_pointing_error:.4f}° | "
                  f"修正后精度: {item.pointing_accuracy:.3f}°")

        item_at = next(i for i in verification.items if i.fault_id == "FLT_001")
        self.assertEqual(item_at.status, VerificationStatus.PASSED)

        item_below = next(i for i in verification.items if i.fault_id == "FLT_002")
        self.assertEqual(item_below.status, VerificationStatus.PASSED)

        item_above = next(i for i in verification.items if i.fault_id == "FLT_003")
        self.assertEqual(item_above.status, VerificationStatus.FAILED)

        item_zero = next(i for i in verification.items if i.fault_id == "FLT_004")
        self.assertEqual(item_zero.status, VerificationStatus.PASSED)

        print("\n✓ 边界情况场景测试通过")

    def test_05_idempotency_scenario(self):
        print("\n" + "=" * 60)
        print("测试5: 幂等性校验 - 同一批材料第二次进来")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        fault1 = self._create_passing_fault("FLT_001", "ORB_001", "TEL_001")
        fault2 = self._create_failing_fault("FLT_002", "ORB_001", "TEL_002")

        batch1 = MaterialBatch(
            batch_id="BATCH_005",
            faults=[fault1, fault2],
            orbits=[orbit]
        )

        print("第一次校验...")
        verification1, is_re_run1 = self.verifier.verify(batch1, "OPERATOR_EVE")
        print(f"第一次校验ID: {verification1.verification_id}")
        print(f"是否重跑: {is_re_run1}")
        print(f"状态: {verification1.status.value}")

        print("\n用完全相同的材料进行第二次校验...")
        batch2 = MaterialBatch(
            batch_id="BATCH_005",
            faults=[fault1, fault2],
            orbits=[orbit]
        )

        verification2, is_re_run2 = self.verifier.verify(batch2, "OPERATOR_FRANK")
        print(f"第二次校验ID: {verification2.verification_id}")
        print(f"是否重跑: {is_re_run2}")
        print(f"上一次校验ID: {verification2.previous_verification_id}")
        print(f"状态: {verification2.status.value}")
        print(f"摘要: {verification2.summary}")

        self.assertFalse(is_re_run1)
        self.assertTrue(is_re_run2)
        self.assertEqual(verification2.previous_verification_id, verification1.verification_id)
        self.assertIn("[重跑]", verification2.summary)
        self.assertNotEqual(verification1.verification_id, verification2.verification_id)

        print("\n验证内容哈希一致...")
        self.assertEqual(verification1.material_content_hash, verification2.material_content_hash)
        print(f"内容哈希: {verification1.material_content_hash[:16]}...")

        print("\n✓ 幂等性校验测试通过")

    def test_06_version_tracking_and_manual_confirmation(self):
        print("\n" + "=" * 60)
        print("测试6: 版本追踪和人工确认")
        print("=" * 60)

        orbit = self._create_normal_orbit()
        fault = self._create_failing_fault("FLT_001", "ORB_001", "TEL_001")

        batch = MaterialBatch(
            batch_id="BATCH_006",
            faults=[fault],
            orbits=[orbit]
        )

        verification1, _ = self.verifier.verify(batch, "OPERATOR_GRACE")
        print(f"初始校验ID: {verification1.verification_id}")
        print(f"初始状态: {verification1.status.value}")

        print("\n修改故障记录 - 修正指向误差...")
        fault_loaded = self.storage.load_fault("FLT_001")
        print(f"修改前版本: v{fault_loaded.current_version}")
        print(f"修改前误差: {fault_loaded.antenna_pointing_error}")

        fault_loaded.update(
            {"antenna_pointing_error": 0.4, "description": "重新校准后天线指向偏差修正"},
            "OPERATOR_GRACE",
            "根据最新遥测数据修正指向误差值"
        )
        self.storage.save_fault(fault_loaded)

        print(f"修改后版本: v{fault_loaded.current_version}")
        print(f"修改后误差: {fault_loaded.antenna_pointing_error}")

        print("\n人工确认故障记录...")
        fault_loaded.confirm("OPERATOR_HEIDI")
        self.storage.save_fault(fault_loaded)
        print(f"确认后版本: v{fault_loaded.current_version}")
        print(f"确认人: {fault_loaded.confirmed_by}")
        print(f"确认状态: {fault_loaded.confirmed}")

        print("\n查看版本历史...")
        for v in fault_loaded.versions:
            print(f"  v{v.version}: {v.modified_by} at {v.modified_at.strftime('%H:%M:%S')} | "
                  f"{v.change_summary}")
            if "diff" in v.to_dict():
                print(f"    变更: {v.to_dict()['diff']}")

        batch_updated = MaterialBatch(
            batch_id="BATCH_006_UPDATED",
            faults=[fault_loaded],
            orbits=[orbit]
        )
        verification2, _ = self.verifier.verify(batch_updated, "OPERATOR_HEIDI")
        print(f"\n重新校验ID: {verification2.verification_id}")
        print(f"重新校验状态: {verification2.status.value}")

        item = verification2.items[0]
        self.assertEqual(item.status, VerificationStatus.PASSED)
        self.assertEqual(fault_loaded.current_version, 3)
        self.assertTrue(fault_loaded.confirmed)

        print("\n✓ 版本追踪和人工确认测试通过")

    def test_07_evidence_chain_traversal(self):
        print("\n" + "=" * 60)
        print("测试7: 证据链路追溯 - 从结论点回故障纪要和轨道根数")
        print("=" * 60)

        orbit = self._create_normal_orbit("ORB_007")
        fault = self._create_failing_fault("FLT_007", "ORB_007", "TEL_007")
        fault.confirm("OPERATOR_IVY")

        batch = MaterialBatch(
            batch_id="BATCH_007",
            faults=[fault],
            orbits=[orbit]
        )

        verification, _ = self.verifier.verify(batch, "OPERATOR_IVY")

        print(f"校验ID: {verification.verification_id}")
        print(f"从结论追溯证据链...")

        traversal = self.verifier.get_evidence_traversal(verification.verification_id, "FLT_007")

        print(f"\n结论:")
        print(f"  故障ID: {traversal['conclusion']['fault_id']}")
        print(f"  状态: {traversal['conclusion']['status']}")
        print(f"  指向精度: {traversal['conclusion']['pointing_accuracy']:.3f}°")
        print(f"  阈值: {traversal['conclusion']['expected_accuracy']}°")

        print(f"\n关联的故障纪要:")
        print(f"  故障类型: {traversal['fault_record']['fault_type']}")
        print(f"  描述: {traversal['fault_record']['description']}")
        print(f"  严重程度: {traversal['fault_record']['severity']}")
        print(f"  人工确认: {traversal['fault_record']['confirmed']}")
        print(f"  确认人: {traversal['fault_record']['confirmed_by']}")

        print(f"\n关联的轨道根数:")
        print(f"  轨道ID: {traversal['orbit_elements']['orbit_id']}")
        print(f"  倾角: {traversal['orbit_elements']['inclination']}°")
        print(f"  偏心率: {traversal['orbit_elements']['eccentricity']}")
        print(f"  数据来源: {traversal['orbit_elements']['source']}")

        print(f"\n版本历史 ({len(traversal['version_history'])} 条):")
        for v in traversal['version_history']:
            print(f"  v{v['version']}: {v['modified_by']} | {v['change_summary']}")

        print(f"\n完整证据链 ({len(traversal['evidence_chain'])} 条):")
        for e in traversal['evidence_chain']:
            print(f"  {e['from_type']}:{e['from_id']} → {e['relationship']} → {e['to_type']}:{e['to_id']}")
            print(f"    {e['description']}")

        self.assertIn("conclusion", traversal)
        self.assertIn("fault_record", traversal)
        self.assertIn("orbit_elements", traversal)
        self.assertIn("version_history", traversal)
        self.assertIn("evidence_chain", traversal)
        self.assertGreater(len(traversal['evidence_chain']), 0)

        has_verifies_link = any(e['relationship'] == 'VERIFIES' for e in traversal['evidence_chain'])
        has_orbit_link = any(e['relationship'] == 'USES_ORBIT_DATA' for e in traversal['evidence_chain'])
        has_confirm_link = any(e['relationship'] == 'CONFIRMED_BY' for e in traversal['evidence_chain'])

        self.assertTrue(has_verifies_link, "缺少校验结论到故障记录的证据链路")
        self.assertTrue(has_orbit_link, "缺少故障记录到轨道根数的证据链路")
        self.assertTrue(has_confirm_link, "缺少人工确认的证据链路")

        print("\n✓ 证据链路追溯测试通过")

    def test_08_task_briefing_generation(self):
        print("\n" + "=" * 60)
        print("测试8: 任务简报生成 - 核心证据持久化")
        print("=" * 60)

        orbit = self._create_normal_orbit("ORB_008")
        fault_pass = self._create_passing_fault("FLT_008_PASS", "ORB_008", "TEL_008_1")
        fault_fail = self._create_failing_fault("FLT_008_FAIL", "ORB_008", "TEL_008_2")
        fault_missing = self._create_missing_orbit_fault("FLT_008_MISS")

        batch = MaterialBatch(
            batch_id="BATCH_008",
            faults=[fault_pass, fault_fail, fault_missing],
            orbits=[orbit]
        )

        verification, _ = self.verifier.verify(batch, "OPERATOR_JACK")

        briefings_dir = os.path.join(self.test_dir, "briefings")
        briefing_files = [f for f in os.listdir(briefings_dir) if f.endswith(".json")]
        self.assertEqual(len(briefing_files), 1)

        briefing = self.storage.load_briefing(briefing_files[0].replace(".json", ""))

        print(f"简报ID: {briefing.briefing_id}")
        print(f"关联校验: {briefing.verification_id}")
        print(f"生成人: {briefing.generated_by}")
        print(f"总体状态: {briefing.overall_status.value}")
        print(f"\n统计:")
        print(f"  总故障数: {briefing.total_faults}")
        print(f"  通过: {briefing.passed_count}")
        print(f"  失败: {briefing.failed_count}")
        print(f"  待处理: {briefing.pending_count}")

        print(f"\n严重问题 ({len(briefing.critical_issues)}):")
        for issue in briefing.critical_issues:
            print(f"  ! {issue}")

        print(f"\n警告 ({len(briefing.warnings)}):")
        for warning in briefing.warnings:
            print(f"  ⚠ {warning}")

        print(f"\n建议 ({len(briefing.recommendations)}):")
        for rec in briefing.recommendations:
            print(f"  → {rec}")

        print(f"\n证据摘要持久化验证...")
        for ev_summary in briefing.evidence_summary:
            print(f"  故障 {ev_summary['fault_id']}: {ev_summary['status']} | "
                  f"证据链 {len(ev_summary['evidence_links'])} 条")
            for link in ev_summary['evidence_links']:
                print(f"    {link['relationship']}: {link['target']}")

        self.assertEqual(briefing.overall_status, VerificationStatus.FAILED)
        self.assertEqual(briefing.total_faults, 3)
        self.assertEqual(briefing.passed_count, 1)
        self.assertEqual(briefing.failed_count, 1)
        self.assertEqual(briefing.pending_count, 1)
        self.assertGreater(len(briefing.critical_issues), 0)
        self.assertGreater(len(briefing.recommendations), 0)

        print("\n✓ 任务简报生成测试通过")

    def test_09_combined_mixed_scenario(self):
        print("\n" + "=" * 60)
        print("测试9: 综合混合场景 - 所有情况混在一起")
        print("=" * 60)

        orbits = [
            self._create_normal_orbit("ORB_009_1"),
            self._create_normal_orbit("ORB_009_2")
        ]
        orbits[1].inclination = 45.0
        orbits[1].eccentricity = 0.05

        faults = [
            self._create_passing_fault("FLT_009_1", "ORB_009_1", "TEL_009_1"),
            self._create_failing_fault("FLT_009_2", "ORB_009_1", "TEL_009_2"),
            self._create_passing_fault("FLT_009_3", "ORB_009_1", "TEL_009_DUP"),
            self._create_failing_fault("FLT_009_4", "ORB_009_2", "TEL_009_DUP"),
            self._create_missing_orbit_fault("FLT_009_5"),
            self._create_boundary_fault("FLT_009_6", "ORB_009_2", error=0.5, telemetry_seg="TEL_009_6"),
            self._create_boundary_fault("FLT_009_7", "ORB_009_2", error=0.0, telemetry_seg="TEL_009_7"),
        ]

        faults[0].confirm("OPERATOR_KATE")

        batch = MaterialBatch(
            batch_id="BATCH_009_MIXED",
            faults=faults,
            orbits=orbits
        )

        print(f"材料批次包含:")
        print(f"  轨道根数: {len(orbits)} 条")
        print(f"  故障记录: {len(faults)} 条")
        print(f"    - 正常通过: 2条")
        print(f"    - 指向失败: 2条")
        print(f"    - 缺轨道: 1条")
        print(f"    - 边界情况: 2条")
        print(f"    - 重复遥测: 2条 (TEL_009_DUP)")
        print(f"    - 已人工确认: 1条")

        verification, is_re_run = self.verifier.verify(batch, "OPERATOR_KATE")

        print(f"\n校验ID: {verification.verification_id}")
        print(f"状态: {verification.status.value}")
        print(f"摘要: {verification.summary}")

        print(f"\n详细校验结果:")
        status_counts = {}
        for item in verification.items:
            status = item.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            fault = next(f for f in faults if f.fault_id == item.fault_id)
            orbit_info = f"ORB:{item.orbit_id}" if item.orbit_id else "ORB:MISSING"
            accuracy = f"{item.pointing_accuracy:.3f}°" if item.pointing_accuracy else "N/A"
            extra = ""
            if fault.confirmed:
                extra += " [已确认]"
            if "TEL_009_DUP" in fault.telemetry_segment_id:
                extra += " [重复遥测]"
            print(f"  {item.fault_id}: {status:8s} | {orbit_info} | "
                  f"精度: {accuracy} | 阈值: {item.expected_accuracy}°{extra}")

        print(f"\n状态统计: {status_counts}")

        self.assertEqual(verification.status, VerificationStatus.FAILED)
        self.assertFalse(is_re_run)
        self.assertEqual(len(verification.items), 7)
        self.assertEqual(status_counts.get("PASSED", 0), 2)
        self.assertEqual(status_counts.get("FAILED", 0), 2)
        self.assertEqual(status_counts.get("PENDING", 0), 1)
        self.assertEqual(status_counts.get("PARTIAL", 0), 2)

        print("\n检查证据链完整性...")
        for item in verification.items:
            self.assertGreater(len(item.evidence), 0, f"{item.fault_id} 缺少证据链")

            has_verifies = any(e.relationship == "VERIFIES" for e in item.evidence)
            self.assertTrue(has_verifies, f"{item.fault_id} 缺少VERIFIES证据链路")

            if item.orbit_id and item.orbit_id in [o.orbit_id for o in orbits]:
                has_orbit = any(e.relationship == "USES_ORBIT_DATA" for e in item.evidence)
                self.assertTrue(has_orbit, f"{item.fault_id} 缺少轨道数据证据链路")

        print("\n检查任务简报...")
        briefings_dir = os.path.join(self.test_dir, "briefings")
        briefing_files = [f for f in os.listdir(briefings_dir) if f.endswith(".json")]
        self.assertGreater(len(briefing_files), 0)

        latest_briefing = sorted(briefing_files)[-1]
        briefing = self.storage.load_briefing(latest_briefing.replace(".json", ""))

        self.assertIn("重复遥测片段 TEL_009_DUP", str(briefing.critical_issues))
        self.assertIn("ORB_MISSING", str(briefing.recommendations))

        print("\n✓ 综合混合场景测试通过")

    def test_10_reverification_after_fix(self):
        print("\n" + "=" * 60)
        print("测试10: 修复故障后重新校验")
        print("=" * 60)

        orbit = self._create_normal_orbit("ORB_010")
        fault = self._create_failing_fault("FLT_010", "ORB_010", "TEL_010")

        batch = MaterialBatch(
            batch_id="BATCH_010",
            faults=[fault],
            orbits=[orbit]
        )

        verification1, _ = self.verifier.verify(batch, "OPERATOR_LUCY")
        print(f"第一次校验ID: {verification1.verification_id}")
        print(f"状态: {verification1.status.value}")
        item1 = verification1.items[0]
        print(f"指向精度: {item1.pointing_accuracy:.3f}° > 阈值 {item1.expected_accuracy}°")

        print("\n修复故障，修正指向误差...")
        verification2 = self.verifier.update_fault_and_reverify(
            verification1.verification_id,
            "FLT_010",
            {"antenna_pointing_error": 0.3},
            "OPERATOR_MIKE",
            "修复天线指向控制参数，偏差从0.8°修正为0.3°"
        )

        print(f"重新校验ID: {verification2.verification_id}")
        print(f"状态: {verification2.status.value}")
        item2 = verification2.items[0]
        print(f"指向精度: {item2.pointing_accuracy:.3f}° ≤ 阈值 {item2.expected_accuracy}°")

        self.assertEqual(verification1.status, VerificationStatus.FAILED)
        self.assertEqual(verification2.status, VerificationStatus.PASSED)
        self.assertNotEqual(verification1.verification_id, verification2.verification_id)

        fault_updated = self.storage.load_fault("FLT_010")
        print(f"\n版本历史:")
        for v in fault_updated.versions:
            print(f"  v{v.version}: {v.modified_by} | {v.change_summary}")
        self.assertEqual(fault_updated.current_version, 2)

        print("\n✓ 修复后重新校验测试通过")


if __name__ == "__main__":
    unittest.main(verbosity=2)
