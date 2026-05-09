import pytest
from datetime import date
from task_compensation.core.missed_task_detector import CronParser


class TestCronParser:
    def setup_method(self):
        self.parser = CronParser()
    
    def test_every_day(self):
        d = date(2024, 1, 15)
        assert self.parser.should_run_on_date("0 2 * * *", d) == True
    
    def test_every_hour(self):
        d = date(2024, 1, 15)
        assert self.parser.should_run_on_date("0 * * * *", d) == True
    
    def test_specific_hour(self):
        d = date(2024, 1, 15)
        assert self.parser.should_run_on_date("0 2 * * *", d) == True
    
    def test_specific_day_of_month(self):
        d1 = date(2024, 1, 15)
        d2 = date(2024, 1, 20)
        
        assert self.parser.should_run_on_date("0 2 15 * *", d1) == True
        assert self.parser.should_run_on_date("0 2 15 * *", d2) == False
    
    def test_day_range(self):
        d1 = date(2024, 1, 10)
        d2 = date(2024, 1, 15)
        d3 = date(2024, 1, 25)
        
        assert self.parser.should_run_on_date("0 2 10-20 * *", d1) == True
        assert self.parser.should_run_on_date("0 2 10-20 * *", d2) == True
        assert self.parser.should_run_on_date("0 2 10-20 * *", d3) == False
    
    def test_specific_month(self):
        d1 = date(2024, 1, 15)
        d2 = date(2024, 2, 15)
        
        assert self.parser.should_run_on_date("0 2 * 1 *", d1) == True
        assert self.parser.should_run_on_date("0 2 * 1 *", d2) == False
    
    def test_multiple_months(self):
        d1 = date(2024, 1, 15)
        d2 = date(2024, 6, 15)
        d3 = date(2024, 12, 15)
        
        assert self.parser.should_run_on_date("0 2 * 1,6,12 *", d1) == True
        assert self.parser.should_run_on_date("0 2 * 1,6,12 *", d2) == True
        assert self.parser.should_run_on_date("0 2 * 1,6,12 *", d3) == True
    
    def test_weekday(self):
        monday = date(2024, 1, 15)
        sunday = date(2024, 1, 14)
        
        assert monday.weekday() == 0
        assert sunday.weekday() == 6
        
        assert self.parser.should_run_on_date("0 2 * * 1", monday) == True
        assert self.parser.should_run_on_date("0 2 * * 1", sunday) == False
    
    def test_weekday_name(self):
        monday = date(2024, 1, 15)
        
        assert self.parser.should_run_on_date("0 2 * * MON", monday) == True
        assert self.parser.should_run_on_date("0 2 * * mon", monday) == True
    
    def test_step_expression(self):
        d1 = date(2024, 1, 1)
        d2 = date(2024, 1, 2)
        d3 = date(2024, 1, 3)
        d4 = date(2024, 1, 4)
        
        assert self.parser.should_run_on_date("0 2 */2 * *", d1) == True
        assert self.parser.should_run_on_date("0 2 */2 * *", d2) == False
        assert self.parser.should_run_on_date("0 2 */2 * *", d3) == True
        assert self.parser.should_run_on_date("0 2 */2 * *", d4) == False
    
    def test_complex_expression(self):
        monday_15th = date(2024, 1, 15)
        saturday_15th = date(2024, 6, 15)
        
        assert monday_15th.weekday() == 0
        assert saturday_15th.weekday() == 5
        
        expr = "0 2 1-15 1,6 1-5"
        
        assert self.parser.should_run_on_date(expr, monday_15th) == True
        assert self.parser.should_run_on_date(expr, saturday_15th) == False
    
    def test_invalid_cron_expression(self):
        with pytest.raises(ValueError):
            self.parser.should_run_on_date("0 2 * *", date(2024, 1, 15))
        
        with pytest.raises(ValueError):
            self.parser.should_run_on_date("0 2 * * * *", date(2024, 1, 15))
