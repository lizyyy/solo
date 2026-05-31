from typing import List, Optional, Dict, Any
from datetime import datetime

from models import MeasurementMethod, Status
from storage import (
    create_batch, add_sensor_log, add_calibration_record,
    get_batch, get_latest_log, get_log_by_version,
    list_all_batches, batch_exists
)
from data_import import import_sensor_data, generate_sample_data
from calibration import run_full_calibration
from version_diff import compare_log_versions, format_diff_report
from grading_sheet import (
    generate_grading_sheet, format_grading_sheet,
    save_grading_sheet, generate_full_report
)


class SoundVelocityCalibrator:
    def __init__(self):
        pass

    def create_experiment(
        self,
        batch_id: str,
        material_name: str,
        student_name: str,
        student_id: str,
        experiment_date: str
    ):
        return create_batch(
            batch_id=batch_id,
            material_name=material_name,
            student_name=student_name,
            student_id=student_id,
            experiment_date=experiment_date
        )

    def import_data(
        self,
        file_path: str,
        batch_id: str,
        material_name: str = "空气",
        student_name: str = "",
        student_id: str = "",
        experiment_date: str = ""
    ) -> tuple[str, int, bool]:
        return import_sensor_data(
            file_path=file_path,
            batch_id=batch_id,
            material_name=material_name,
            student_name=student_name,
            student_id=student_id,
            experiment_date=experiment_date
        )

    def generate_test_data(
        self,
        batch_id: str,
        has_unit_error: bool = False,
        has_sampling_gap: bool = False,
        has_zero_drift: bool = False
    ) -> str:
        return generate_sample_data(
            batch_id=batch_id,
            has_unit_error=has_unit_error,
            has_sampling_gap=has_sampling_gap,
            has_zero_drift=has_zero_drift
        )

    def calibrate(
        self,
        batch_id: str,
        frequency: float = 40000.0,
        temperature: float = 20.0,
        position_unit: str = "mm",
        log_version: Optional[int] = None,
        methods: Optional[List[str]] = None
    ):
        if not batch_exists(batch_id):
            raise ValueError(f"批次 {batch_id} 不存在，请先导入数据。")

        if log_version is None:
            log = get_latest_log(batch_id)
        else:
            log = get_log_by_version(batch_id, log_version)

        if not log:
            raise ValueError(f"批次 {batch_id} 暂无传感器数据，请先导入。")

        if methods:
            method_enums = [MeasurementMethod(m) for m in methods]
        else:
            method_enums = None

        results = run_full_calibration(
            data=log.raw_data,
            frequency=frequency,
            temperature=temperature,
            position_unit=position_unit,
            methods=method_enums
        )

        for result in results:
            add_calibration_record(batch_id, result)

        return results

    def get_version_diff(
        self,
        batch_id: str,
        old_version: int,
        new_version: int,
        formatted: bool = True
    ):
        diff = compare_log_versions(batch_id, old_version, new_version)
        if formatted:
            return format_diff_report(diff)
        return diff

    def get_grading_sheet(
        self,
        batch_id: str,
        format_type: str = "text",
        save_to_file: bool = False
    ):
        sheet = generate_grading_sheet(batch_id)
        content = format_grading_sheet(sheet, format_type)

        if save_to_file:
            save_grading_sheet(sheet, format_type=format_type)

        return content

    def get_full_report(self, batch_id: str) -> str:
        return generate_full_report(batch_id)

    def list_experiments(self) -> List[dict]:
        return list_all_batches()

    def get_experiment(self, batch_id: str):
        return get_batch(batch_id)

    def run_full_workflow(
        self,
        file_path: str,
        batch_id: str,
        material_name: str = "空气",
        student_name: str = "",
        student_id: str = "",
        experiment_date: str = "",
        frequency: float = 40000.0,
        temperature: float = 20.0,
        position_unit: str = "mm"
    ) -> str:
        print(f"📥 正在导入数据: {file_path}")
        filename, version, is_new = self.import_data(
            file_path=file_path,
            batch_id=batch_id,
            material_name=material_name,
            student_name=student_name,
            student_id=student_id,
            experiment_date=experiment_date
        )

        if is_new:
            print(f"✅ 数据导入成功，版本号: {version}")
        else:
            print(f"ℹ️  数据已存在，使用现有版本: {version}")

        if version > 1:
            print("\n📊 检测到多个版本，正在对比差异...")
            diff_report = self.get_version_diff(batch_id, version - 1, version)
            print(diff_report)

        print(f"\n🔬 正在进行声速校准...")
        results = self.calibrate(
            batch_id=batch_id,
            frequency=frequency,
            temperature=temperature,
            position_unit=position_unit
        )

        for r in results:
            status_icon = "🟢" if r.status == Status.NORMAL else "🟡"
            print(f"  {status_icon} {r.method.value}: v={r.measured_velocity:.2f}m/s, "
                  f"误差={r.relative_error:.2f}%, 状态={r.status.value}")

        print(f"\n📋 正在生成批改表...")
        report = self.get_full_report(batch_id)

        return report


def quick_start():
    calibrator = SoundVelocityCalibrator()

    print("=" * 60)
    print("声速测量校准系统 - 快速演示")
    print("=" * 60)

    batch_id = "DEMO20260531001"
    print(f"\n1️⃣  生成测试数据 (批次: {batch_id})")
    data_file = calibrator.generate_test_data(
        batch_id=batch_id,
        has_unit_error=True,
        has_sampling_gap=True,
        has_zero_drift=False
    )
    print(f"   测试数据已生成: {data_file}")

    print(f"\n2️⃣  运行完整工作流")
    report = calibrator.run_full_workflow(
        file_path=data_file,
        batch_id=batch_id,
        student_name="张三",
        student_id="2023001001",
        experiment_date="2026-05-31",
        frequency=40000.0,
        temperature=25.0,
        position_unit="mm"
    )

    print("\n" + "=" * 60)
    print("最终报告")
    print("=" * 60)
    print(report)

    print("\n3️⃣  演示版本差异检测 (模拟补传修正后的数据)")
    batch_id_v2 = "DEMO20260531001"
    data_file_v2 = calibrator.generate_test_data(
        batch_id=batch_id_v2 + "_v2",
        has_unit_error=False,
        has_sampling_gap=False,
        has_zero_drift=False
    )

    import os
    import shutil
    fixed_file = os.path.join("sample_data", f"{batch_id}_v2_fixed.csv")
    shutil.copy(data_file_v2, fixed_file)

    print(f"\n   导入修正后的数据: {fixed_file}")
    filename, version, is_new = calibrator.import_data(
        file_path=fixed_file,
        batch_id=batch_id,
        student_name="张三",
        student_id="2023001001",
        experiment_date="2026-05-31"
    )

    print(f"   新版本号: {version}, 是否新数据: {is_new}")

    print(f"\n4️⃣  对修正后的数据重新校准")
    results = calibrator.calibrate(
        batch_id=batch_id,
        frequency=40000.0,
        temperature=25.0,
        position_unit="mm"
    )

    print(f"\n5️⃣  查看版本差异")
    diff = calibrator.get_version_diff(batch_id, 1, 2)
    print(diff)

    print(f"\n6️⃣  生成最终批改表")
    final_report = calibrator.get_full_report(batch_id)
    print(final_report)

    return calibrator


if __name__ == "__main__":
    quick_start()
