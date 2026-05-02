import pytest
import pandas as pd
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser import DataParser
from src.analyzer import RiskAnalyzer
import config


class TestRiskAnalyzer:
    def setup_method(self):
        self.parser = DataParser()
        self.parser.load_sample_data()
        self.analyzer = RiskAnalyzer(
            cleaning_records=self.parser.cleaning_records,
            work_orders=self.parser.work_orders,
            volume_records=self.parser.volume_records
        )
    
    def test_analyze_late_cleaning(self):
        risks = self.analyzer.analyze_late_cleaning()
        
        assert isinstance(risks, list)
        for risk in risks:
            assert "risk_id" in risk
            assert "risk_type" in risk
            assert risk["risk_type"] == "late_cleaning"
            assert "store_name" in risk
            assert "machine_id" in risk
            assert "interval_hours" in risk
            assert risk["interval_hours"] > config.LATE_CLEANING_THRESHOLD_HOURS
    
    def test_analyze_unclosed_workorders(self):
        risks = self.analyzer.analyze_unclosed_workorders()
        
        assert isinstance(risks, list)
        for risk in risks:
            assert "risk_id" in risk
            assert "risk_type" in risk
            assert risk["risk_type"] == "unclosed_workorder"
            assert "workorder_id" in risk
            assert "status" in risk
            assert risk["status"] in [config.WORKORDER_STATUS_OPEN, config.WORKORDER_STATUS_IN_PROGRESS]
    
    def test_analyze_abnormal_volume(self):
        risks = self.analyzer.analyze_abnormal_volume()
        
        assert isinstance(risks, list)
        for risk in risks:
            assert "risk_id" in risk
            assert "risk_type" in risk
            assert risk["risk_type"] == "abnormal_volume"
            assert "cup_count" in risk
            assert "avg_cup_count" in risk
    
    def test_analyze_backfill_suspect(self):
        risks = self.analyzer.analyze_backfill_suspect()
        
        assert isinstance(risks, list)
        for risk in risks:
            assert "risk_id" in risk
            assert "risk_type" in risk
            assert risk["risk_type"] == "backfill_suspect"
    
    def test_analyze_all(self):
        risks = self.analyzer.analyze_all()
        
        assert isinstance(risks, list)
        assert len(risks) > 0
        
        risk_types = set([r.get("risk_type") for r in risks])
        assert len(risk_types) >= 1
    
    def test_get_risk_statistics(self):
        self.analyzer.analyze_all()
        stats = self.analyzer.get_risk_statistics()
        
        assert isinstance(stats, dict)
        assert "total_risks" in stats
        assert "by_type" in stats
        assert "by_level" in stats
        assert "by_store" in stats
    
    def test_get_risks_by_type(self):
        self.analyzer.analyze_all()
        
        all_risks = self.analyzer.get_risks_by_type()
        assert len(all_risks) == len(self.analyzer.risks)
        
        late_cleaning = self.analyzer.get_risks_by_type("late_cleaning")
        for risk in late_cleaning:
            assert risk["risk_type"] == "late_cleaning"
    
    def test_risks_to_dataframe(self):
        self.analyzer.analyze_all()
        df = self.analyzer.risks_to_dataframe()
        
        assert isinstance(df, pd.DataFrame)
        if len(self.analyzer.risks) > 0:
            assert len(df) > 0
            assert "risk_id" in df.columns
            assert "risk_type" in df.columns
