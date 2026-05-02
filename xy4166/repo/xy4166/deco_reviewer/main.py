from pathlib import Path
from typing import Optional

from .models import DiveAnalysis
from .parser import CSVParser
from .buhlmann import BuhlmannModel
from .validator import DiveValidator
from .storage import DiveStorage
from .report import ReportGenerator


def analyze_dive(
    csv_file: Path,
    gf_low: float = 0.30,
    gf_high: float = 0.85,
    save_to_storage: bool = True,
) -> DiveAnalysis:
    """分析潜水日志的核心函数
    
    Args:
        csv_file: CSV文件路径
        gf_low: 低梯度因子
        gf_high: 高梯度因子
        save_to_storage: 是否保存到档案库
    
    Returns:
        DiveAnalysis: 完整的分析结果
    """
    parser = CSVParser()
    dive_log = parser.parse(csv_file)
    
    model = BuhlmannModel(gradient_factor_low=gf_low, gradient_factor_high=gf_high)
    calc_result = model.calculate(dive_log)
    
    validator = DiveValidator()
    violations = validator.validate(dive_log, calc_result)
    
    analysis = DiveAnalysis(
        dive_log=dive_log,
        calculation_result=calc_result,
        violations=violations,
        summary={},
    )
    
    reporter = ReportGenerator()
    reporter.generate_summary(analysis)
    
    if save_to_storage:
        storage = DiveStorage()
        storage.save_dive(dive_log)
        storage.save_analysis(analysis)
    
    return analysis
