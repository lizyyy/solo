import sys
import os
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from data_parser import DataParser, FlowmeterData, ConcentrationRecord, TitrationResult, CalibrationDataset


class TestFlowmeterData:
    def test_validate_valid_data(self):
        data = FlowmeterData(
            pump_speed=np.array([10.0, 20.0, 30.0]),
            flow_rate=np.array([1.0, 2.0, 3.0])
        )
        errors = data.validate()
        assert len(errors) == 0
    
    def test_validate_negative_pump_speed(self):
        data = FlowmeterData(
            pump_speed=np.array([-10.0, 20.0, 30.0]),
            flow_rate=np.array([1.0, 2.0, 3.0])
        )
        errors = data.validate()
        assert len(errors) > 0
        assert any("负值" in e for e in errors)
    
    def test_validate_insufficient_points(self):
        data = FlowmeterData(
            pump_speed=np.array([10.0, 20.0]),
            flow_rate=np.array([1.0, 2.0])
        )
        errors = data.validate()
        assert len(errors) > 0
        assert any("不足" in e for e in errors)


class TestCalibrationDataset:
    def test_validate_missing_data(self):
        dataset = CalibrationDataset()
        errors = dataset.validate()
        assert len(errors) > 0
        assert "缺少流量计数据" in errors
        assert "缺少浓度记录" in errors


class TestDataParser:
    @pytest.fixture
    def parser(self):
        return DataParser()
    
    def test_parse_flowmeter_csv(self, parser, tmp_path):
        csv_content = """泵速(Hz),流量(L/h)
10.0,1.5
20.0,2.8
30.0,4.2
40.0,5.5
50.0,6.8
"""
        csv_file = tmp_path / "flowmeter.csv"
        csv_file.write_text(csv_content, encoding='utf-8')
        
        data = parser.parse_flowmeter_csv(str(csv_file))
        
        assert data.n_points == 5
        assert len(data.pump_speed) == 5
        assert len(data.flow_rate) == 5
        np.testing.assert_array_equal(data.pump_speed, [10.0, 20.0, 30.0, 40.0, 50.0])
    
    def test_parse_flowmeter_csv_with_english_columns(self, parser, tmp_path):
        csv_content = """pump_speed,flow_rate
10,1.5
20,2.8
30,4.2
"""
        csv_file = tmp_path / "flowmeter.csv"
        csv_file.write_text(csv_content, encoding='utf-8')
        
        data = parser.parse_flowmeter_csv(str(csv_file))
        
        assert data.n_points == 3
    
    def test_parse_concentration_text(self, parser, tmp_path):
        txt_content = """母液浓度: 10000 mg/L
目标浓度: 5.0 mg/L
流量单位: L/h
"""
        txt_file = tmp_path / "concentration.txt"
        txt_file.write_text(txt_content, encoding='utf-8')
        
        record = parser.parse_concentration_record(str(txt_file))
        
        assert record.stock_concentration == 10000.0
        assert record.target_concentration == 5.0
    
    def test_parse_concentration_text_equals_format(self, parser, tmp_path):
        txt_content = """母液浓度=5000 mg/L
目标浓度=2.5 mg/L
"""
        txt_file = tmp_path / "concentration.txt"
        txt_file.write_text(txt_content, encoding='utf-8')
        
        record = parser.parse_concentration_record(str(txt_file))
        
        assert record.stock_concentration == 5000.0
        assert record.target_concentration == 2.5
    
    def test_parse_titration_results(self, parser, tmp_path):
        csv_content = """泵速(Hz),实测浓度(mg/L),取样体积(mL)
20.0,4.8,100.0
30.0,7.2,100.0
40.0,9.5,100.0
"""
        csv_file = tmp_path / "titration.csv"
        csv_file.write_text(csv_content, encoding='utf-8')
        
        results = parser.parse_titration_results(str(csv_file))
        
        assert len(results) == 3
        assert results[0].pump_speed == 20.0
        assert results[0].measured_concentration == 4.8
        assert results[1].pump_speed == 30.0
        assert results[2].measured_volume == 100.0
    
    def test_match_column(self, parser):
        assert parser._match_column('泵速', 'pump_speed') == True
        assert parser._match_column('pump_speed', 'pump_speed') == True
        assert parser._match_column('Frequency', 'pump_speed') == True
        assert parser._match_column('流量', 'flow_rate') == True
        assert parser._match_column('flow rate', 'flow_rate') == True
        assert parser._match_column('浓度', 'concentration') == True
        assert parser._match_column('unknown', 'pump_speed') == False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
