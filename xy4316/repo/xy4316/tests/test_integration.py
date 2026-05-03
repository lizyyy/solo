import sys
import os
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from data_parser import DataParser, FlowmeterData, ConcentrationRecord, TitrationResult, CalibrationDataset
from units import unit_converter, dosage_calculator
from fitting import curve_fitter
from anomaly_detection import anomaly_detector
from report import report_exporter


class TestEndToEndFlow:
    def test_complete_calibration_workflow(self, tmp_path):
        np.random.seed(42)
        
        pump_speeds = np.array([10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0])
        true_slope = 0.12
        true_intercept = 0.5
        noise = np.random.normal(0, 0.15, size=len(pump_speeds))
        flow_rates = true_slope * pump_speeds + true_intercept + noise
        flow_rates[3] += 0.8
        
        flowmeter_data = FlowmeterData(
            pump_speed=pump_speeds,
            flow_rate=flow_rates
        )
        
        validation_errors = flowmeter_data.validate()
        assert len(validation_errors) == 0
        
        concentration_record = ConcentrationRecord(
            stock_concentration=10000.0,
            stock_concentration_unit='mg/L',
            target_concentration=5.0,
            target_concentration_unit='mg/L'
        )
        
        titration_results = [
            TitrationResult(pump_speed=20.0, measured_concentration=4.8),
            TitrationResult(pump_speed=30.0, measured_concentration=7.2),
            TitrationResult(pump_speed=40.0, measured_concentration=9.5),
        ]
        
        dataset = CalibrationDataset(
            flowmeter_data=flowmeter_data,
            concentration_record=concentration_record,
            titration_results=titration_results
        )
        
        dataset_errors = dataset.validate()
        assert "缺少流量计数据" not in dataset_errors
        assert "缺少浓度记录" not in dataset_errors
        
        fitting_result = curve_fitter.fit(
            flowmeter_data.pump_speed,
            flowmeter_data.flow_rate,
            model_type='linear'
        )
        
        assert fitting_result.model_type == 'linear'
        assert fitting_result.r_squared > 0.8
        
        anomaly_report = anomaly_detector.detect(
            flowmeter_data.pump_speed,
            flowmeter_data.flow_rate,
            fitting_result.residuals
        )
        
        assert anomaly_report.total_points == len(pump_speeds)
        
        target_flow, unit = dosage_calculator.calculate_required_flow(
            target_concentration=5.0,
            target_concentration_unit='mg/L',
            stock_concentration=10000.0,
            stock_concentration_unit='mg/L',
            process_flow_rate=1.0,
            process_flow_unit='m3/h'
        )
        
        assert unit == 'l/h'
        assert target_flow > 0
        
        y_min, y_max = fitting_result.flow_rate_range
        if y_min <= target_flow <= y_max:
            recommendation = curve_fitter.calculate_recommended_pump_speed(
                fitting_result,
                target_flow_rate=target_flow
            )
            
            assert recommendation.target_flow_rate == target_flow
            assert recommendation.recommended_pump_speed > 0
        
        calibration_summary = report_exporter.generate_calibration_summary(
            dataset=dataset,
            fitting_result=fitting_result,
            anomaly_report=anomaly_report,
            pump_id='PUMP-001',
            pump_name='加药泵A'
        )
        
        assert calibration_summary.pump_id == 'PUMP-001'
        assert calibration_summary.pump_name == '加药泵A'
        
        report_content = report_exporter.generate_markdown_report(
            dataset=dataset,
            fitting_result=fitting_result,
            anomaly_report=anomaly_report,
            calibration_summary=calibration_summary
        )
        
        assert '# 加药泵周校准报告' in report_content
        assert '拟合结果' in report_content
        assert '异常检测' in report_content
        
        report_path = os.path.join(tmp_path, 'test_report.md')
        export_path = report_exporter.export_markdown(
            filepath=report_path,
            dataset=dataset,
            fitting_result=fitting_result,
            anomaly_report=anomaly_report,
            calibration_summary=calibration_summary
        )
        
        assert os.path.exists(export_path)
        
        with open(export_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        assert '# 加药泵周校准报告' in content
        
        params_path = os.path.join(tmp_path, 'test_params.csv')
        report_exporter.export_parameters_csv(
            filepath=params_path,
            fitting_result=fitting_result,
            concentration_record=concentration_record
        )
        
        assert os.path.exists(params_path)
        
        if anomaly_report.anomaly_count > 0:
            anomaly_path = os.path.join(tmp_path, 'test_anomalies.csv')
            report_exporter.export_anomaly_csv(
                filepath=anomaly_path,
                anomaly_report=anomaly_report
            )
            
            assert os.path.exists(anomaly_path)


class TestUnitConversionIntegration:
    def test_flow_conversion_chain(self):
        flow_lh = 60.0
        
        flow_mlmin = unit_converter.convert_flow(flow_lh, 'L/h', 'ml/min')
        flow_back = unit_converter.convert_flow(flow_mlmin, 'ml/min', 'L/h')
        
        assert abs(flow_back - flow_lh) < 0.01
    
    def test_concentration_conversion_chain(self):
        conc_mgl = 100.0
        
        conc_percent = unit_converter.convert_concentration(conc_mgl, 'mg/L', '%')
        conc_back = unit_converter.convert_concentration(conc_percent, '%', 'mg/L')
        
        assert abs(conc_back - conc_mgl) < 0.001


class TestDataParserIntegration:
    def test_parse_from_csv_files(self, tmp_path):
        flowmeter_csv = tmp_path / "flowmeter.csv"
        flowmeter_csv.write_text("""泵速(Hz),流量(L/h)
10.0,1.72
15.0,2.28
20.0,2.91
25.0,4.30
30.0,4.12
35.0,4.67
40.0,5.29
45.0,5.94
50.0,6.45
""", encoding='utf-8')
        
        conc_txt = tmp_path / "concentration.txt"
        conc_txt.write_text("""母液浓度: 10000 mg/L
目标浓度: 5.0 mg/L
""", encoding='utf-8')
        
        titration_csv = tmp_path / "titration.csv"
        titration_csv.write_text("""泵速(Hz),实测浓度(mg/L)
20.0,4.8
30.0,7.2
40.0,9.5
""", encoding='utf-8')
        
        parser = DataParser()
        
        flowmeter_data = parser.parse_flowmeter_csv(str(flowmeter_csv))
        assert flowmeter_data.n_points == 9
        
        concentration_record = parser.parse_concentration_record(str(conc_txt))
        assert concentration_record.stock_concentration == 10000.0
        
        titration_results = parser.parse_titration_results(str(titration_csv))
        assert len(titration_results) == 3
        
        fitting_result = curve_fitter.fit(
            flowmeter_data.pump_speed,
            flowmeter_data.flow_rate,
            model_type='linear'
        )
        
        assert fitting_result.r_squared > 0.7
        
        anomaly_report = anomaly_detector.detect(
            flowmeter_data.pump_speed,
            flowmeter_data.flow_rate,
            fitting_result.residuals
        )
        
        assert anomaly_report.total_points == 9


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
