"""主分析器类。"""

import pandas as pd
from pathlib import Path
from typing import Dict, Optional, Any
from .config import AnalysisConfig
from .logger import AnalysisLogger
from .data_reader import DataReader
from .preprocessor import DataPreprocessor
from .quality_control import QualityControl
from .consistency_analyzer import ConsistencyAnalyzer
from .report_generator import ReportGenerator
from .exporter import Exporter


class BatteryConsistencyAnalyzer:
    """电池批次一致性分析器主类。"""
    
    def __init__(self, config: Optional[AnalysisConfig] = None):
        self.config = config or AnalysisConfig()
        self.logger = AnalysisLogger(
            log_to_file=self.config.log_to_file,
            log_file=self.config.log_file,
            log_level=self.config.log_level
        )
        
        self.reader = DataReader(self.config, self.logger)
        self.preprocessor = DataPreprocessor(self.config, self.logger)
        self.quality_control = QualityControl(self.config, self.logger)
        self.analyzer = ConsistencyAnalyzer(self.config, self.logger)
        self.report_generator = ReportGenerator(self.config, self.logger)
        self.exporter = Exporter(self.config, self.logger)
        
        self._raw_data = None
        self._processed_data = None
        self._qc_data = None
        self._analysis_result = None
        self._qc_report = None
    
    def load_data(self, input_path: str) -> pd.DataFrame:
        """
        加载数据。
        
        Args:
            input_path: 文件路径或目录路径
        """
        path = Path(input_path)
        
        self.logger.info("主流程", f"开始加载数据: {input_path}")
        
        if path.is_file():
            df = self.reader.read_file(str(path))
        elif path.is_dir():
            df = self.reader.read_directory(str(path))
        else:
            self.logger.error("主流程", f"路径不存在: {input_path}")
            return pd.DataFrame()
        
        if df is None or len(df) == 0:
            self.logger.error("主流程", "无法加载有效数据")
            return pd.DataFrame()
        
        self._raw_data = df.copy()
        
        column_mapping = self.reader.detect_columns(df)
        self.logger.info("主流程", f"检测到的列: {column_mapping}")
        
        self._processed_data = self.preprocessor.preprocess(df, column_mapping)
        
        self.logger.info("主流程", f"数据加载完成，有效数据: {len(self._processed_data)} 行")
        
        return self._processed_data
    
    def run_quality_control(self) -> tuple:
        """
        运行质量控制。
        """
        if self._processed_data is None or len(self._processed_data) == 0:
            self.logger.error("主流程", "没有有效数据可进行质控")
            return None, None
        
        self._qc_data, self._qc_report = self.quality_control.run_qc(self._processed_data)
        
        return self._qc_data, self._qc_report
    
    def run_analysis(self) -> Any:
        """
        运行一致性分析。
        """
        if self._qc_data is None:
            self.logger.error("主流程", "请先运行质量控制")
            return None
        
        if len(self._qc_data) == 0:
            self.logger.error("主流程", "质控后没有有效数据")
            return None
        
        self._analysis_result = self.analyzer.analyze(self._qc_data)
        
        return self._analysis_result
    
    def run_full_analysis(self, input_path: str, output_dir: str) -> Dict[str, Any]:
        """
        运行完整的分析流程。
        
        Args:
            input_path: 输入数据路径
            output_dir: 输出目录路径
        
        Returns:
            包含所有结果的字典
        """
        self.logger.info("主流程", "=" * 50)
        self.logger.info("主流程", "开始电池批次一致性分析")
        self.logger.info("主流程", "=" * 50)
        
        self.load_data(input_path)
        
        if self._processed_data is None or len(self._processed_data) == 0:
            self.logger.error("主流程", "数据加载失败，分析终止")
            return {"status": "failed", "error": "数据加载失败"}
        
        self.run_quality_control()
        
        if self._qc_data is None or len(self._qc_data) == 0:
            self.logger.error("主流程", "质控后无有效数据，分析终止")
            return {"status": "failed", "error": "质控后无有效数据"}
        
        self.run_analysis()
        
        if self._analysis_result is None:
            self.logger.error("主流程", "分析失败")
            return {"status": "failed", "error": "分析失败"}
        
        export_files = self.exporter.export_all(
            self._qc_data,
            self._analysis_result,
            self._qc_report,
            self.report_generator,
            output_dir
        )
        
        result_summary = {
            "status": "success",
            "input_path": input_path,
            "output_dir": output_dir,
            "raw_data_count": len(self._raw_data) if self._raw_data is not None else 0,
            "processed_data_count": len(self._processed_data) if self._processed_data is not None else 0,
            "qc_data_count": len(self._qc_data) if self._qc_data is not None else 0,
            "battery_count": len(self._analysis_result.battery_metrics) if self._analysis_result else 0,
            "consistency_level": self._analysis_result.consistency_metrics.consistency_level 
                if self._analysis_result and self._analysis_result.consistency_metrics else "未知",
            "qc_summary": self.quality_control.get_qc_summary(self._qc_report) if self._qc_report else {},
            "exported_files": export_files,
            "failed_samples": self.logger.get_failed_samples_summary()
        }
        
        self.logger.info("主流程", "=" * 50)
        self.logger.info("主流程", "分析完成")
        self.logger.info("主流程", f"  - 分析电池数: {result_summary['battery_count']}")
        self.logger.info("主流程", f"  - 一致性等级: {result_summary['consistency_level']}")
        self.logger.info("主流程", f"  - 失败样本数: {result_summary['failed_samples']['count']}")
        self.logger.info("主流程", f"  - 输出目录: {output_dir}")
        self.logger.info("主流程", "=" * 50)
        
        return result_summary
    
    def get_results(self) -> Dict[str, Any]:
        """获取分析结果。"""
        return {
            "raw_data": self._raw_data,
            "processed_data": self._processed_data,
            "qc_data": self._qc_data,
            "qc_report": self._qc_report,
            "analysis_result": self._analysis_result,
            "failed_samples": self.logger.get_failed_samples_summary()
        }
    
    def get_battery_metrics_df(self) -> pd.DataFrame:
        """获取电池指标 DataFrame。"""
        if self._analysis_result is None:
            return pd.DataFrame()
        return self.analyzer.get_battery_metrics_df(self._analysis_result.battery_metrics)
    
    def get_summary_table(self) -> pd.DataFrame:
        """获取汇总表格。"""
        if self._analysis_result is None or self._qc_report is None:
            return pd.DataFrame()
        return self.report_generator.generate_summary_table(
            self._analysis_result,
            self._qc_report
        )
