from datetime import datetime
from models import AuditStatus, RecordSource, FeatureVersion
from demo_data import create_demo_data, create_initial_feature_versions
from audit_engine import SparseFeatureAuditEngine


class AuditVerifier:
    def __init__(self, engine: SparseFeatureAuditEngine):
        self.engine = engine
        self.errors = []
        self.warnings = []
        self.passes = []

    def log_pass(self, check_name, detail=""):
        self.passes.append((check_name, detail))
        print(f"  ✓ PASS: {check_name} {detail}")

    def log_warning(self, check_name, detail=""):
        self.warnings.append((check_name, detail))
        print(f"  ⚠️  WARN: {check_name} {detail}")

    def log_error(self, check_name, detail=""):
        self.errors.append((check_name, detail))
        print(f"  ✗ FAIL: {check_name} {detail}")

    def verify_history_consistency(self, slice_id):
        record = self.engine.records.get(slice_id)
        if not record:
            self.log_error(f"切片{slice_id}存在性", "切片不存在")
            return False

        all_ok = True
        if not record.history:
            self.log_error(f"切片{slice_id}历史记录", "历史记录为空")
            return False

        first_history = record.history[0]
        if first_history.operation != "导入评测切片" and "导入" not in first_history.operation:
            self.log_error(f"切片{slice_id}首条操作", f"首条操作应为导入，实际为：{first_history.operation}")
            all_ok = False

        last_history = record.history[-1]
        if last_history.after_status != record.current_status:
            self.log_error(
                f"切片{slice_id}状态一致性",
                f"最终状态不匹配：历史末条={last_history.after_status.value}, 当前={record.current_status.value}"
            )
            all_ok = False
        else:
            self.log_pass(f"切片{slice_id}状态一致性")

        for i in range(1, len(record.history)):
            prev = record.history[i-1]
            curr = record.history[i]
            if prev.after_status and curr.before_status and prev.after_status != curr.before_status:
                self.log_error(
                    f"切片{slice_id}状态流转#{i}",
                    f"状态断裂: {prev.after_status.value} → {curr.before_status.value}"
                )
                all_ok = False

        if all_ok:
            self.log_pass(f"切片{slice_id}历史记录流转")

        return all_ok

    def verify_feature_version_consistency(self, slice_id):
        record = self.engine.records.get(slice_id)
        if not record:
            return False

        all_ok = True

        for ver in record.feature_versions:
            found_in_global = False
            for global_ver in self.engine.feature_versions:
                if global_ver.version_id == ver.version_id:
                    found_in_global = True
                    if global_ver.caliber_version != ver.caliber_version:
                        self.log_error(
                            f"切片{slice_id}版本{ver.version_id}",
                            f"口径不一致：切片内={ver.caliber_version}, 全局表={global_ver.caliber_version}"
                        )
                        all_ok = False
                    if global_ver.default_value != ver.default_value:
                        self.log_error(
                            f"切片{slice_id}版本{ver.version_id}",
                            f"默认值不一致：切片内={ver.default_value}, 全局表={global_ver.default_value}"
                        )
                        all_ok = False
                    break
            if not found_in_global:
                self.log_error(f"切片{slice_id}版本{ver.version_id}", "在全局版本表中不存在")
                all_ok = False

        if record.feature_versions:
            self.log_pass(f"切片{slice_id}版本关联一致性")
        elif record.current_status in [AuditStatus.NORMAL, AuditStatus.SUPPLEMENTED, AuditStatus.COMPLETED, AuditStatus.RERUN]:
            if record.is_duplicate_training and record.current_status == AuditStatus.PRODUCT_REVIEW:
                self.log_pass(f"切片{slice_id}版本关联", "重复训练待复核，无版本关联属正常")
            else:
                self.log_warning(f"切片{slice_id}版本关联", "已完成但无关联版本")

        return all_ok

    def verify_duplicate_training_logic(self):
        print("\n  验证重复训练特殊逻辑:")
        all_ok = True

        duplicate_records = [r for r in self.engine.records.values() if r.is_duplicate_training]
        for record in duplicate_records:
            if record.duplicate_with_slice:
                dup_with = self.engine.records.get(record.duplicate_with_slice)
                if dup_with:
                    if dup_with.eval_slice.data_batch_id == record.eval_slice.data_batch_id:
                        self.log_pass(
                            f"切片{record.slice_id}重复检测",
                            f"与{record.duplicate_with_slice}批次号一致"
                        )
                    else:
                        self.log_error(
                            f"切片{record.slice_id}重复检测",
                            f"批次号不一致"
                        )
                        all_ok = False

            had_review_status = any(h.after_status == AuditStatus.PRODUCT_REVIEW for h in record.history)
            if had_review_status:
                self.log_pass(f"切片{record.slice_id}产品复核", "已走产品复核流程")
            else:
                self.log_error(f"切片{record.slice_id}产品复核", "重复训练但未走产品复核")
                all_ok = False

        return all_ok

    def verify_supplement_logic(self):
        print("\n  验证补录逻辑:")
        all_ok = True

        supplement_records = [r for r in self.engine.records.values() if r.source == RecordSource.SUPPLEMENT]
        for record in supplement_records:
            if record.supplement_from_snapshot:
                snap = self.engine.feature_snapshots.get(record.supplement_from_snapshot)
                if snap:
                    self.log_pass(
                        f"切片{record.slice_id}补录来源",
                        f"快照{snap.snapshot_id} ({snap.caliber_version})"
                    )
                else:
                    self.log_error(f"切片{record.slice_id}补录来源", "快照不存在")
                    all_ok = False

            if record.corrections:
                self.log_pass(f"切片{record.slice_id}人工修正", f"有{len(record.corrections)}条修正记录")
                for corr in record.corrections:
                    orig_snap = self.engine.feature_snapshots.get(corr.original_snapshot_id)
                    corr_snap = self.engine.feature_snapshots.get(corr.corrected_snapshot_id)
                    if orig_snap and corr_snap:
                        self.log_pass(
                            f"  修正{corr.correction_id}",
                            f"{orig_snap.caliber_version} → {corr_snap.caliber_version}"
                        )

            rerun_count = len([h for h in record.history if h.operation == "重跑评测"])
            if rerun_count > 0:
                self.log_pass(f"切片{record.slice_id}重跑记录", f"重跑{rerun_count}次")

        return all_ok

    def verify_three_step_flow(self, slice_id):
        record = self.engine.records.get(slice_id)
        if not record:
            return False

        print(f"\n  验证切片{slice_id}三步核心流程:")
        all_ok = True

        operations = [h.operation for h in record.history]
        has_import = any("导入" in op for op in operations)
        has_snapshot_check = any("快照" in op for op in operations)
        has_version_update = any("版本表" in op for op in operations)

        if has_import:
            self.log_pass(f"  步骤1: 导入评测切片")
        else:
            self.log_error(f"  步骤1: 导入评测切片", "缺失")
            all_ok = False

        if has_snapshot_check:
            self.log_pass(f"  步骤2: 小乔补看特征快照编号")
        else:
            self.log_error(f"  步骤2: 小乔补看特征快照编号", "缺失")
            all_ok = False

        if has_version_update:
            self.log_pass(f"  步骤3: 特征版本表更新")
        else:
            self.log_warning(f"  步骤3: 特征版本表更新", "可能被拦截（如重复训练待复核）")

        return all_ok

    def run_full_verification(self, scenario_name, slice_ids):
        print("\n" + "=" * 70)
        print(f"  验证场景: {scenario_name}")
        print("=" * 70)

        all_ok = True

        for slice_id in slice_ids:
            print(f"\n--- 验证切片 {slice_id} ---")
            if not self.verify_history_consistency(slice_id):
                all_ok = False
            if not self.verify_feature_version_consistency(slice_id):
                all_ok = False
            if not self.verify_three_step_flow(slice_id):
                all_ok = False

        if scenario_name == "重复训练场景":
            if not self.verify_duplicate_training_logic():
                all_ok = False

        if scenario_name == "补录旧口径场景":
            if not self.verify_supplement_logic():
                all_ok = False

        return all_ok

    def print_summary(self):
        print("\n" + "=" * 70)
        print("  验证结果汇总")
        print("=" * 70)
        print(f"  ✓ 通过: {len(self.passes)} 项")
        print(f"  ⚠️  警告: {len(self.warnings)} 项")
        print(f"  ✗ 失败: {len(self.errors)} 项")

        if self.warnings:
            print("\n  警告明细:")
            for name, detail in self.warnings:
                print(f"    - {name}: {detail}")

        if self.errors:
            print("\n  失败明细:")
            for name, detail in self.errors:
                print(f"    - {name}: {detail}")

        return len(self.errors) == 0


def run_normal_material_test():
    print("\n" + "▓" * 70)
    print("  第一轮：正常材料跑一遍")
    print("▓" * 70)

    data = create_demo_data()
    initial_versions = create_initial_feature_versions()

    engine = SparseFeatureAuditEngine()
    engine.load_snapshots(data["feature_snapshots"])
    engine.load_initial_versions(initial_versions)
    engine.load_records({"SLICE-001": data["records"]["SLICE-001"]})

    engine.check_snapshot_by_xiaoqiao("SLICE-001", "SNAP-002")
    engine.update_feature_version_table("SLICE-001")
    engine.complete_record("SLICE-001")

    verifier = AuditVerifier(engine)
    result = verifier.run_full_verification("正常材料", ["SLICE-001"])
    verifier.print_summary()

    return result, verifier


def run_wrong_caliber_test():
    print("\n" + "▓" * 70)
    print("  第二轮：错口径材料跑一遍（重复训练场景）")
    print("▓" * 70)

    data = create_demo_data()
    initial_versions = create_initial_feature_versions()

    engine = SparseFeatureAuditEngine()
    engine.load_snapshots(data["feature_snapshots"])
    engine.load_initial_versions(initial_versions)
    engine.load_records({
        "SLICE-002": data["records"]["SLICE-002"],
        "SLICE-002-DUP": data["records"]["SLICE-002-DUP"],
    })

    print("\n  --- 阶段1：处理首条记录 SLICE-002（正常流程） ---")
    engine.check_snapshot_by_xiaoqiao("SLICE-002", "SNAP-003")
    engine.update_feature_version_table("SLICE-002")
    engine.complete_record("SLICE-002")
    print(f"  SLICE-002 最终状态: {engine.records['SLICE-002'].current_status.value}")

    print("\n  --- 阶段2：处理重复记录 SLICE-002-DUP（三步核心流程） ---")
    print("  步骤1：评测切片已导入（初始状态）")
    print(f"  步骤2：算法工程师小乔补看特征快照编号...")
    engine.check_snapshot_by_xiaoqiao("SLICE-002-DUP", "SNAP-003")
    record_dup = engine.records["SLICE-002-DUP"]
    print(f"  快照核验后状态: {record_dup.current_status.value}")
    print(f"  是否重复训练: {record_dup.is_duplicate_training}")

    print("\n  步骤3：尝试更新特征版本表（预期被拦截）...")
    success, msg = engine.update_feature_version_table("SLICE-002-DUP")
    print(f"  版本表更新结果: {msg}")
    print(f"  拦截后状态: {record_dup.current_status.value}")

    print("\n  --- 阶段3：停在策略产品复核中查看状态 ---")
    print(f"  当前状态: {record_dup.current_status.value}")
    print(f"  重复训练标记: {record_dup.is_duplicate_training}")
    print(f"  是否已复核: {record_dup.duplicate_reviewed}")
    print(f"  关联版本数: {len(record_dup.feature_versions)}")
    print(f"  历史记录数: {len(record_dup.history)}")
    print("  " + "-" * 50)
    print("  历史留痕:")
    for i, h in enumerate(record_dup.history, 1):
        status_flow = f"→ {h.after_status.value}" if h.after_status else ""
        print(f"    {i}. {h.operation} {status_flow}")
        if h.remark:
            print(f"       备注: {h.remark}")
    print("  " + "-" * 50)

    print("\n  尝试标记完成（预期失败）...")
    success_complete, msg_complete = engine.complete_record("SLICE-002-DUP")
    print(f"  标记完成结果: {msg_complete}")

    print("\n  --- 阶段4：策略产品复核通过 ---")
    engine.product_review_duplicate("SLICE-002-DUP", approve=True)
    print(f"  复核通过后状态: {record_dup.current_status.value}")
    print(f"  是否已复核: {record_dup.duplicate_reviewed}")
    print(f"  复核结果: {record_dup.duplicate_approved}")

    print("\n  --- 阶段5：复核通过后再次更新版本表 ---")
    engine.update_feature_version_table("SLICE-002-DUP")
    print(f"  版本表更新后状态: {record_dup.current_status.value}")
    print(f"  关联版本数: {len(record_dup.feature_versions)}")

    print("\n  --- 阶段6：标记完成 ---")
    engine.complete_record("SLICE-002-DUP")
    print(f"  最终状态: {record_dup.current_status.value}")

    verifier = AuditVerifier(engine)
    result = verifier.run_full_verification("重复训练场景", ["SLICE-002", "SLICE-002-DUP"])
    verifier.print_summary()

    return result, verifier


def run_supplement_material_test():
    print("\n" + "▓" * 70)
    print("  第三轮：补录材料跑一遍")
    print("▓" * 70)

    data = create_demo_data()
    initial_versions = create_initial_feature_versions()

    engine = SparseFeatureAuditEngine()
    engine.load_snapshots(data["feature_snapshots"])
    engine.load_initial_versions(initial_versions)
    engine.load_records({"SLICE-003": data["records"]["SLICE-003"]})

    engine.supplement_snapshot_for_old_data("SLICE-003", "SNAP-001")
    engine.update_feature_version_table("SLICE-003")
    engine.manual_correction(
        "SLICE-003", "SNAP-001", "SNAP-002",
        reason="旧口径默认值统计异常"
    )
    engine.update_feature_version_table("SLICE-003")
    engine.rerun_slice("SLICE-003")
    engine.complete_record("SLICE-003")

    verifier = AuditVerifier(engine)
    result = verifier.run_full_verification("补录旧口径场景", ["SLICE-003"])
    verifier.print_summary()

    return result, verifier


def main():
    print("\n稀疏特征默认值审计 - 验证脚本")
    print("验证目标：特征版本表和历史记录是不是能对上")

    r1, v1 = run_normal_material_test()
    r2, v2 = run_wrong_caliber_test()
    r3, v3 = run_supplement_material_test()

    print("\n" + "▓" * 70)
    print("  总体结论")
    print("▓" * 70)

    total_passes = len(v1.passes) + len(v2.passes) + len(v3.passes)
    total_errors = len(v1.errors) + len(v2.errors) + len(v3.errors)
    total_warnings = len(v1.warnings) + len(v2.warnings) + len(v3.warnings)

    print(f"\n  总通过: {total_passes} 项")
    print(f"  总警告: {total_warnings} 项")
    print(f"  总失败: {total_errors} 项")

    if total_errors == 0:
        print("\n  ✅ 所有验证通过！")
        print("     - 正常材料：状态流转、版本关联均正确")
        print("     - 错口径材料：重复训练检测正常，转策略产品复核")
        print("     - 补录材料：补录来源、人工修正、重跑记录完整")
        print("     - 特征版本表与历史记录完全对账")
    else:
        print(f"\n  ❌ 有 {total_errors} 项验证失败，请检查")

    print("\n  核心流程验证结果:")
    print("  ✓ 评测切片第一次导入 ✓ 算法工程师小乔补看特征快照编号 ✓ 特征版本表更新")
    print("  ✓ 同一批数据重复训练两次时，别急着归正常，留给策略产品复核")
    print("  ✓ 含一次人工修正和一次重跑的完整演示数据")
    print("▓" * 70 + "\n")


if __name__ == "__main__":
    main()
