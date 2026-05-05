import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    KilnRun, TemperatureLog, BodyThickness, GlazeRecipe,
    KilnPosition, DefectRecord, ReviewConclusion, AnalysisResult
)

from importers import (
    TemperatureLogImporter, BodyThicknessImporter,
    GlazeRecipeImporter, KilnPositionImporter, DefectRecordImporter
)

from analysis import KilnAnalyzer
from report import MarkdownGenerator, JSONExporter
from core.data_store import DataStore


class KilnManager:
    """窑炉烧成曲线复盘管理器"""
    
    def __init__(self, storage_dir: str = './kiln_data'):
        """
        初始化管理器
        
        Args:
            storage_dir: 数据存储目录
        """
        self.data_store = DataStore(storage_dir)
        self.current_kiln_run: Optional[KilnRun] = None
        self.analysis_result: Optional[AnalysisResult] = None
        self.analyzer = KilnAnalyzer()
        
        self.temp_importer = TemperatureLogImporter()
        self.body_thickness_importer = BodyThicknessImporter()
        self.glaze_importer = GlazeRecipeImporter()
        self.position_importer = KilnPositionImporter()
        self.defect_importer = DefectRecordImporter()
        
        self.markdown_generator = MarkdownGenerator()
        self.json_exporter = JSONExporter()
    
    def create_new_kiln_run(self, name: str, start_date: Optional[datetime] = None) -> KilnRun:
        """
        创建新的窑次记录
        
        Args:
            name: 窑次名称
            start_date: 开始日期
        
        Returns:
            新创建的窑次记录
        """
        self.current_kiln_run = KilnRun(
            id=str(uuid.uuid4()),
            name=name,
            start_date=start_date or datetime.now()
        )
        
        return self.current_kiln_run
    
    def load_kiln_run(self, kiln_run_id: str) -> Optional[KilnRun]:
        """
        加载已有窑次记录
        
        Args:
            kiln_run_id: 窑次ID
        
        Returns:
            窑次记录或None
        """
        self.current_kiln_run = self.data_store.load_kiln_run(kiln_run_id)
        
        if self.current_kiln_run:
            self.analysis_result = None
        
        return self.current_kiln_run
    
    def save_kiln_run(self) -> str:
        """
        保存当前窑次记录
        
        Returns:
            窑次ID
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        return self.data_store.save_kiln_run(self.current_kiln_run)
    
    def list_kiln_runs(self) -> List[Dict[str, Any]]:
        """
        列出所有窑次
        
        Returns:
            窑次列表
        """
        return self.data_store.list_kiln_runs()
    
    def delete_kiln_run(self, kiln_run_id: str) -> bool:
        """
        删除窑次记录
        
        Args:
            kiln_run_id: 窑次ID
        
        Returns:
            是否成功删除
        """
        return self.data_store.delete_kiln_run(kiln_run_id)
    
    def import_temperature_logs(self, file_path: str, 
                                  time_column: str = 'time',
                                  temp_column: str = 'temperature',
                                  zone_column: Optional[str] = None) -> List[TemperatureLog]:
        """
        导入温度日志
        
        Args:
            file_path: 文件路径
            time_column: 时间列名
            temp_column: 温度列名
            zone_column: 区域列名
        
        Returns:
            温度日志列表
        """
        logs = self.temp_importer.import_from_file(
            file_path,
            time_column=time_column,
            temp_column=temp_column,
            zone_column=zone_column
        )
        
        if self.current_kiln_run:
            self.current_kiln_run.temperature_logs = logs
        
        return logs
    
    def import_body_thicknesses(self, file_path: str,
                                  position_id_column: str = 'position_id',
                                  thickness_column: str = 'thickness',
                                  material_column: Optional[str] = None) -> List[BodyThickness]:
        """
        导入坯体厚度
        
        Args:
            file_path: 文件路径
            position_id_column: 窑位ID列名
            thickness_column: 厚度列名
            material_column: 材料列名
        
        Returns:
            坯体厚度列表
        """
        thicknesses = self.body_thickness_importer.import_from_file(
            file_path,
            position_id_column=position_id_column,
            thickness_column=thickness_column,
            material_column=material_column
        )
        
        if self.current_kiln_run:
            self.current_kiln_run.body_thicknesses = thicknesses
        
        return thicknesses
    
    def import_glaze_recipes(self, file_path: str,
                              name_column: str = 'name',
                              components_column: Optional[str] = None,
                              melting_temp_column: Optional[str] = 'melting_temperature') -> List[GlazeRecipe]:
        """
        导入釉料配方
        
        Args:
            file_path: 文件路径
            name_column: 名称列名
            components_column: 成分列名
            melting_temp_column: 熔融温度列名
        
        Returns:
            釉料配方列表
        """
        recipes = self.glaze_importer.import_from_file(
            file_path,
            name_column=name_column,
            components_column=components_column,
            melting_temp_column=melting_temp_column
        )
        
        if self.current_kiln_run:
            self.current_kiln_run.glaze_recipes = recipes
        
        return recipes
    
    def import_kiln_positions(self, file_path: str,
                                code_column: str = 'code',
                                row_column: str = 'row',
                                column_column: str = 'column') -> List[KilnPosition]:
        """
        导入窑位摆放
        
        Args:
            file_path: 文件路径
            code_column: 窑位编码列名
            row_column: 行列名
            column_column: 列列名
        
        Returns:
            窑位列表
        """
        positions = self.position_importer.import_from_file(
            file_path,
            code_column=code_column,
            row_column=row_column,
            column_column=column_column
        )
        
        if self.current_kiln_run:
            self.current_kiln_run.kiln_positions = positions
        
        return positions
    
    def import_defect_records(self, file_path: str,
                                kiln_run_id_column: str = 'kiln_run_id',
                                position_id_column: str = 'position_id',
                                defect_type_column: str = 'defect_type',
                                severity_column: str = 'severity') -> List[DefectRecord]:
        """
        导入缺陷记录
        
        Args:
            file_path: 文件路径
            kiln_run_id_column: 窑次ID列名
            position_id_column: 窑位ID列名
            defect_type_column: 缺陷类型列名
            severity_column: 严重程度列名
        
        Returns:
            缺陷记录列表
        """
        if self.current_kiln_run:
            temp_kiln_run_id = self.current_kiln_run.id
        else:
            temp_kiln_run_id = str(uuid.uuid4())
        
        defects = self.defect_importer.import_from_file(
            file_path,
            kiln_run_id_column=kiln_run_id_column,
            position_id_column=position_id_column,
            defect_type_column=defect_type_column,
            severity_column=severity_column
        )
        
        for defect in defects:
            defect.kiln_run_id = temp_kiln_run_id
        
        if self.current_kiln_run:
            self.current_kiln_run.defect_records = defects
        
        return defects
    
    def add_defect_record(self, position_id: str, defect_type: str, 
                          severity: str = '轻微',
                          description: Optional[str] = None) -> DefectRecord:
        """
        添加缺陷记录
        
        Args:
            position_id: 窑位ID
            defect_type: 缺陷类型
            severity: 严重程度
            description: 描述
        
        Returns:
            新建的缺陷记录
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        defect = DefectRecord(
            id=str(uuid.uuid4()),
            kiln_run_id=self.current_kiln_run.id,
            position_id=position_id,
            defect_type=defect_type,
            severity=severity,
            description=description
        )
        
        self.current_kiln_run.defect_records.append(defect)
        
        return defect
    
    def add_review_conclusion(self, position_id: str, reviewer: str,
                               conclusion: str,
                               root_cause: Optional[str] = None,
                               corrective_action: Optional[str] = None,
                               notes: Optional[str] = None) -> ReviewConclusion:
        """
        添加复核结论
        
        Args:
            position_id: 窑位ID
            reviewer: 复核人
            conclusion: 结论
            root_cause: 根本原因
            corrective_action: 纠正措施
            notes: 备注
        
        Returns:
            新建的复核结论
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        for i, existing in enumerate(self.current_kiln_run.review_conclusions):
            if existing.position_id == position_id:
                existing.reviewer = reviewer
                existing.review_date = datetime.now()
                existing.conclusion = conclusion
                existing.root_cause = root_cause
                existing.corrective_action = corrective_action
                existing.notes = notes
                return existing
        
        review = ReviewConclusion(
            id=str(uuid.uuid4()),
            kiln_run_id=self.current_kiln_run.id,
            position_id=position_id,
            reviewer=reviewer,
            review_date=datetime.now(),
            conclusion=conclusion,
            root_cause=root_cause,
            corrective_action=corrective_action,
            notes=notes
        )
        
        self.current_kiln_run.review_conclusions.append(review)
        
        return review
    
    def analyze(self, target_rates: Optional[List[Dict[str, Any]]] = None,
                target_stages: Optional[List[Dict[str, Any]]] = None) -> AnalysisResult:
        """
        分析当前窑次
        
        Args:
            target_rates: 目标升温速率
            target_stages: 目标保温阶段
        
        Returns:
            分析结果
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        self.analysis_result = self.analyzer.analyze(
            self.current_kiln_run,
            target_rates=target_rates,
            target_stages=target_stages
        )
        
        self.data_store.save_analysis_result(
            self.current_kiln_run.id,
            self.analysis_result.to_dict()
        )
        
        return self.analysis_result
    
    def get_position_analysis(self, position_id: str) -> Dict[str, Any]:
        """
        获取指定窑位的分析结果
        
        Args:
            position_id: 窑位ID
        
        Returns:
            窑位分析结果
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return self.analyzer.get_position_analysis(position_id)
    
    def get_high_risk_positions(self) -> List[Dict[str, Any]]:
        """
        获取高风险窑位列表
        
        Returns:
            高风险窑位列表
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return self.analyzer.get_high_risk_positions()
    
    def generate_markdown_report(self, output_path: Optional[str] = None) -> str:
        """
        生成Markdown报告
        
        Args:
            output_path: 输出文件路径（可选）
        
        Returns:
            Markdown报告内容
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        if not self.analysis_result:
            self.analyze()
        
        report = self.markdown_generator.generate_report(
            self.current_kiln_run,
            self.analysis_result
        )
        
        if output_path:
            self.markdown_generator.save_report(report, output_path)
        
        return report
    
    def export_json(self, output_path: Optional[str] = None) -> Dict[str, Any]:
        """
        导出JSON数据
        
        Args:
            output_path: 输出文件路径（可选）
        
        Returns:
            JSON格式的数据
        """
        if not self.current_kiln_run:
            raise ValueError('没有当前窑次记录')
        
        if not self.analysis_result:
            self.analyze()
        
        data = self.json_exporter.export_full_report(
            self.current_kiln_run,
            self.analysis_result
        )
        
        if output_path:
            self.json_exporter.save_to_file(data, output_path)
        
        return data
    
    def get_analysis_summary(self) -> Dict[str, Any]:
        """
        获取分析摘要
        
        Returns:
            分析摘要
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return self.analysis_result.summary.copy()
    
    def get_import_errors(self) -> Dict[str, List[str]]:
        """
        获取导入错误
        
        Returns:
            各导入器的错误列表
        """
        return {
            'temperature_logs': self.temp_importer.get_errors(),
            'body_thicknesses': self.body_thickness_importer.get_errors(),
            'glaze_recipes': self.glaze_importer.get_errors(),
            'kiln_positions': self.position_importer.get_errors(),
            'defect_records': self.defect_importer.get_errors()
        }
