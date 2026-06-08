#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
隧道通风烟气扩散分析工具
用于处理维修微信群中的传感器数据、设备参数、现场备注和人工修正
"""

import sys
import os
import json
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import (
    TunnelVentilationPhysics,
    UnitConverter,
    Thresholds,
    DataImporter,
    DataValidator,
    AnomalyDetector,
    ReportGenerator,
    CalculationResult,
)


class TunnelSmokeAnalyzer:
    def __init__(self, tunnel_params=None):
        if tunnel_params is None:
            tunnel_params = {
                'width': 10.0,
                'height': 6.0,
                'length': 1000.0
            }

        self.physics = TunnelVentilationPhysics(tunnel_params)
        self.converter = UnitConverter()
        self.importer = DataImporter()
        self.validator = DataValidator()
        self.anomaly_detector = AnomalyDetector()
        self.report_generator = ReportGenerator()
        self.imported_data = None
        self.calculation_results = []
        self.unit_conversion_log = []

    def load_data(self, file_path):
        print(f"📥 正在导入数据: {file_path}")
        self.imported_data = self.importer.import_json(file_path)
        summary = self.importer.get_import_summary()
        print(f"✅ 数据导入完成")
        print(f"   - 传感器记录: {summary['sensor_records_count']} 条")
        print(f"   - 设备参数: {summary['equipment_count']} 条")
        print(f"   - 现场备注: {summary['notes_count']} 条")
        print(f"   - 人工修正: {summary['manual_corrections_count']} 条")

        self._apply_unit_conversions()
        self._apply_equipment_status()

        return self.imported_data

    def _apply_unit_conversions(self):
        self.unit_conversion_log = []
        for record in self.imported_data.sensor_records:
            if record.wind_speed is not None and record.wind_speed > 20:
                original = record.wind_speed
                record.wind_speed = self.converter.km_h_to_m_s(record.wind_speed)
                self.unit_conversion_log.append(
                    f"  [{record.sensor_id} {record.timestamp}] 风速 {original} km/h -> {record.wind_speed:.2f} m/s"
                )

            if record.temperature is not None and record.temperature < -50:
                original = record.temperature
                record.temperature = self.converter.kelvin_to_celsius(record.temperature)
                self.unit_conversion_log.append(
                    f"  [{record.sensor_id} {record.timestamp}] 温度 {original} K -> {record.temperature:.2f} °C"
                )

        if self.unit_conversion_log:
            print(f"\n📐 单位换算:")
            for log_entry in self.unit_conversion_log:
                print(log_entry)

    def _apply_equipment_status(self):
        running_fans = [eq for eq in self.imported_data.equipment_params
                       if eq.operational_status == 'running']
        total_airflow_m3h = sum(eq.rated_airflow for eq in running_fans)
        total_airflow_m3s = self.converter.m3_h_to_m3_s(total_airflow_m3h) if total_airflow_m3h > 0 else 0.0

        self._effective_ventilation_from_fans = total_airflow_m3s
        self._running_fan_count = len(running_fans)
        self._standby_fan_count = sum(
            1 for eq in self.imported_data.equipment_params if eq.operational_status == 'standby'
        )

        if running_fans:
            print(f"\n🏭 设备状态:")
            print(f"   - 运行中风机: {self._running_fan_count} 台")
            print(f"   - 备用风机: {self._standby_fan_count} 台")
            print(f"   - 总额定风量: {total_airflow_m3h:.0f} m³/h ({total_airflow_m3s:.2f} m³/s)")

    def validate_data(self):
        print("\n🔍 正在验证数据...")
        validation_result = self.validator.validate_all(self.imported_data)
        print(self.validator.get_issues_summary())
        return validation_result

    def detect_anomalies(self):
        print("\n⚠️  正在检测异常数据...")
        anomaly_result = self.anomaly_detector.detect_all(self.imported_data)
        print(anomaly_result['summary'])
        return anomaly_result

    def run_calculations(self, distance_from_source=100.0):
        print("\n🧮 正在进行烟气扩散计算...")
        self.calculation_results = []

        fan_vent_velocity = 0.0
        if hasattr(self, '_effective_ventilation_from_fans') and self._effective_ventilation_from_fans > 0:
            tunnel_area = self.physics.tunnel_area
            fan_vent_velocity = self._effective_ventilation_from_fans / tunnel_area
            print(f"   风机提供基准通风速度: {fan_vent_velocity:.2f} m/s")

        for i, record in enumerate(self.imported_data.sensor_records):
            hrr = record.heat_release_rate if record.heat_release_rate is not None else 1000.0
            wind_speed = record.wind_speed if record.wind_speed is not None else 2.0
            time_point = i * 60.0

            effective_velocity = wind_speed
            if fan_vent_velocity > 0:
                if effective_velocity < fan_vent_velocity * 0.5:
                    print(f"   t={time_point:.0f}s: 传感器风速 {effective_velocity:.2f} m/s "
                          f"远低于风机能力 {fan_vent_velocity:.2f} m/s，以传感器值为准并标记注意")
                effective_velocity = min(effective_velocity, fan_vent_velocity)

            sensor_data = {
                'heat_release_rate': hrr,
                'ventilation_velocity': effective_velocity,
                'distance_from_source': distance_from_source
            }

            result = self.physics.calculate(sensor_data, time_point)

            calc_result = CalculationResult(
                time_point=time_point,
                smoke_layer_thickness=result.smoke_layer_thickness,
                smoke_temperature=result.smoke_temperature,
                smoke_velocity=result.smoke_velocity,
                visibility=result.visibility,
                co_concentration=result.co_concentration,
                risk_level=result.risk_level,
                is_safe=result.is_safe,
                warnings=result.warnings
            )

            self.calculation_results.append(calc_result)

            if result.warnings:
                print(f"  t={time_point:.0f}s: {result.risk_level} - {', '.join(result.warnings[:2])}")

        print(f"✅ 计算完成，共 {len(self.calculation_results)} 个时间点")
        return self.calculation_results

    def generate_reports(self, output_prefix=None):
        print("\n📄 正在生成报告...")

        validation_report = self.validator.get_issues_summary()
        anomaly_summary = self.anomaly_detector._get_summary()

        text_report = self.report_generator.generate_text_report(
            self.calculation_results,
            validation_report,
            anomaly_summary,
            self.imported_data,
            self.validator.conflicts
        )

        text_file = self.report_generator.save_report(text_report, output_prefix)
        print(f"   文本报告已保存: {text_file}")

        html_report = self.report_generator.generate_html_report(
            self.calculation_results,
            validation_report,
            self.imported_data
        )
        html_file = self.report_generator.save_html_report(html_report, output_prefix)
        print(f"   HTML报告已保存: {html_file}")

        return text_file, html_file

    def run_full_analysis(self, data_file, distance_from_source=100.0):
        print("=" * 70)
        print("           隧道通风烟气扩散分析工具")
        print("=" * 70)

        self.load_data(data_file)
        self.validate_data()
        self.detect_anomalies()
        self.run_calculations(distance_from_source)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_prefix = f"tunnel_smoke_analysis_{timestamp}"
        text_file, html_file = self.generate_reports(output_prefix)

        print("\n" + "=" * 70)
        print("                    🎉 分析完成!")
        print("=" * 70)
        print(f"  报告文件:")
        print(f"    - 文本: {text_file}")
        print(f"    - HTML: {html_file}")
        print("=" * 70)

        return {
            'calculation_results': self.calculation_results,
            'text_report': text_file,
            'html_report': html_file
        }


def main():
    parser = argparse.ArgumentParser(
        description='隧道通风烟气扩散分析工具 - 处理维修微信群数据',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python tunnel_smoke_analyzer.py sample_data.json
  python tunnel_smoke_analyzer.py data.json --distance 200
        """
    )
    parser.add_argument('data_file', nargs='?', default='sample_data.json',
                       help='数据文件路径 (JSON格式)')
    parser.add_argument('--distance', type=float, default=100.0,
                       help='距火源距离 (米), 默认: 100')
    parser.add_argument('--no-report', action='store_true',
                       help='不生成报告文件')

    args = parser.parse_args()

    if not os.path.exists(args.data_file):
        print(f"❌ 错误: 文件不存在 - {args.data_file}")
        print(f"   请确保数据文件存在，或使用默认的 sample_data.json")
        sys.exit(1)

    analyzer = TunnelSmokeAnalyzer()
    analyzer.run_full_analysis(args.data_file, args.distance)


if __name__ == '__main__':
    main()
