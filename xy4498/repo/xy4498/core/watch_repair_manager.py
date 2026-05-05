import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    WorkOrder, TimingLog, TimingMeasurement,
    ServiceStep, PartReplacement, WaterproofTest,
    WatchReviewConclusion, WatchAnalysisResult, WatchAnalyzer
)

from importers import (
    TimingLogImporter, ServiceStepImporter,
    PartReplacementImporter, WaterproofTestImporter
)

from exporters import WatchReportExporter
from core.watch_data_store import WatchDataStore


class WatchRepairManager:
    """钟表维修走时复盘管理器"""
    
    def __init__(self, storage_dir: str = './watch_data'):
        """
        初始化管理器
        
        Args:
            storage_dir: 数据存储目录
        """
        self.data_store = WatchDataStore(storage_dir)
        self.current_work_order: Optional[WorkOrder] = None
        self.analysis_result: Optional[WatchAnalysisResult] = None
        self.analyzer = WatchAnalyzer()
        
        self.timing_importer = TimingLogImporter()
        self.service_step_importer = ServiceStepImporter()
        self.part_importer = PartReplacementImporter()
        self.waterproof_importer = WaterproofTestImporter()
        
        self.report_exporter = WatchReportExporter()
    
    def create_new_work_order(self, work_order_number: Optional[str] = None,
                              customer_name: str = '',
                              watch_brand: str = '',
                              watch_model: str = '',
                              movement_type: str = 'mechanical',
                              movement_model: Optional[str] = None,
                              received_date: Optional[datetime] = None,
                              due_date: Optional[datetime] = None,
                              service_type: Optional[str] = None,
                              initial_complaints: Optional[List[str]] = None) -> WorkOrder:
        """
        创建新的工单记录
        
        Args:
            work_order_number: 工单号（自动生成）
            customer_name: 客户姓名
            watch_brand: 手表品牌
            watch_model: 手表型号
            movement_type: 机芯类型
            movement_model: 机芯型号
            received_date: 收表日期
            due_date: 取表期限
            service_type: 服务类型
            initial_complaints: 客户初始投诉
        
        Returns:
            新创建的工单记录
        """
        if not work_order_number:
            work_order_number = f"WO-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
        
        self.current_work_order = WorkOrder(
            id=str(uuid.uuid4()),
            work_order_number=work_order_number,
            customer_name=customer_name,
            watch_brand=watch_brand,
            watch_model=watch_model,
            movement_type=movement_type,
            movement_model=movement_model,
            received_date=received_date or datetime.now(),
            due_date=due_date,
            status='received',
            service_type=service_type,
            initial_complaints=initial_complaints or []
        )
        
        return self.current_work_order
    
    def load_work_order(self, work_order_id: str) -> Optional[WorkOrder]:
        """
        加载已有工单记录
        
        Args:
            work_order_id: 工单ID
        
        Returns:
            工单记录或None
        """
        self.current_work_order = self.data_store.load_work_order(work_order_id)
        
        if self.current_work_order:
            self.analysis_result = None
        
        return self.current_work_order
    
    def save_work_order(self) -> str:
        """
        保存当前工单记录
        
        Returns:
            工单ID
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        return self.data_store.save_work_order(self.current_work_order)
    
    def list_work_orders(self) -> List[Dict[str, Any]]:
        """
        列出所有工单
        
        Returns:
            工单列表
        """
        return self.data_store.list_work_orders()
    
    def list_work_orders_by_movement(self, movement_model: str) -> List[Dict[str, Any]]:
        """
        按机芯型号列出工单
        
        Args:
            movement_model: 机芯型号
        
        Returns:
            匹配的工单列表
        """
        return self.data_store.list_work_orders_by_movement(movement_model)
    
    def list_overdue_work_orders(self) -> List[Dict[str, Any]]:
        """
        列出逾期工单
        
        Returns:
            逾期工单列表
        """
        return self.data_store.list_overdue_work_orders()
    
    def delete_work_order(self, work_order_id: str) -> bool:
        """
        删除工单记录
        
        Args:
            work_order_id: 工单ID
        
        Returns:
            是否成功删除
        """
        if self.current_work_order and self.current_work_order.id == work_order_id:
            self.current_work_order = None
            self.analysis_result = None
        
        return self.data_store.delete_work_order(work_order_id)
    
    def import_timing_logs(self, file_path: str,
                           position_column: str = 'position',
                           rate_column: str = 'rate',
                           amplitude_column: str = 'amplitude',
                           beat_error_column: str = 'beat_error',
                           temperature_column: Optional[str] = None,
                           test_date: Optional[datetime] = None,
                           instrument_model: Optional[str] = None) -> List[TimingLog]:
        """
        导入校表仪日志
        
        Args:
            file_path: 文件路径
            position_column: 方位列名
            rate_column: 日差列名
            amplitude_column: 摆幅列名
            beat_error_column: 偏振列名
            temperature_column: 温度列名
            test_date: 测试日期
            instrument_model: 校表仪型号
        
        Returns:
            校表仪日志列表
        """
        work_order_id = self.current_work_order.id if self.current_work_order else ""
        
        logs = self.timing_importer.import_from_file(
            file_path,
            work_order_id=work_order_id,
            position_column=position_column,
            rate_column=rate_column,
            amplitude_column=amplitude_column,
            beat_error_column=beat_error_column,
            temperature_column=temperature_column,
            test_date=test_date,
            instrument_model=instrument_model
        )
        
        if self.current_work_order:
            self.current_work_order.timing_logs.extend(logs)
        
        return logs
    
    def import_service_steps(self, file_path: str,
                             step_number_column: str = 'step_number',
                             step_name_column: str = 'step_name',
                             technician_column: str = 'technician',
                             status_column: Optional[str] = None) -> List[ServiceStep]:
        """
        导入拆洗步骤记录
        
        Args:
            file_path: 文件路径
            step_number_column: 步骤序号列名
            step_name_column: 步骤名称列名
            technician_column: 操作师傅列名
            status_column: 状态列名
        
        Returns:
            拆洗步骤列表
        """
        work_order_id = self.current_work_order.id if self.current_work_order else ""
        
        steps = self.service_step_importer.import_from_file(
            file_path,
            work_order_id=work_order_id,
            step_number_column=step_number_column,
            step_name_column=step_name_column,
            technician_column=technician_column,
            status_column=status_column
        )
        
        if self.current_work_order:
            if not self.current_work_order.service_steps:
                self.current_work_order.service_steps = steps
            else:
                max_step = max(s.step_number for s in self.current_work_order.service_steps)
                for step in steps:
                    step.step_number += max_step
                    self.current_work_order.service_steps.append(step)
        
        return steps
    
    def create_default_service_steps(self, technician: Optional[str] = None) -> List[ServiceStep]:
        """
        创建默认拆洗步骤
        
        Args:
            technician: 操作师傅
        
        Returns:
            默认步骤列表
        """
        work_order_id = self.current_work_order.id if self.current_work_order else ""
        
        steps = self.service_step_importer.create_default_steps(
            work_order_id=work_order_id,
            technician=technician
        )
        
        if self.current_work_order:
            self.current_work_order.service_steps = steps
        
        return steps
    
    def import_part_replacements(self, file_path: str,
                                  part_number_column: str = 'part_number',
                                  part_name_column: str = 'part_name',
                                  quantity_column: str = 'quantity',
                                  reason_column: str = 'reason',
                                  cost_column: Optional[str] = None) -> List[PartReplacement]:
        """
        导入零件更换记录
        
        Args:
            file_path: 文件路径
            part_number_column: 零件编号列名
            part_name_column: 零件名称列名
            quantity_column: 数量列名
            reason_column: 更换原因列名
            cost_column: 成本列名
        
        Returns:
            零件更换记录列表
        """
        work_order_id = self.current_work_order.id if self.current_work_order else ""
        
        parts = self.part_importer.import_from_file(
            file_path,
            work_order_id=work_order_id,
            part_number_column=part_number_column,
            part_name_column=part_name_column,
            quantity_column=quantity_column,
            reason_column=reason_column,
            cost_column=cost_column
        )
        
        if self.current_work_order:
            self.current_work_order.part_replacements.extend(parts)
        
        return parts
    
    def import_waterproof_tests(self, file_path: str,
                                 test_date_column: str = 'test_date',
                                 test_type_column: str = 'test_type',
                                 pressure_column: Optional[str] = None,
                                 result_column: str = 'result',
                                 leak_detected_column: Optional[str] = None) -> List[WaterproofTest]:
        """
        导入防水测试记录
        
        Args:
            file_path: 文件路径
            test_date_column: 测试日期列名
            test_type_column: 测试类型列名
            pressure_column: 测试压力列名
            result_column: 测试结果列名
            leak_detected_column: 泄漏检测列名
        
        Returns:
            防水测试记录列表
        """
        work_order_id = self.current_work_order.id if self.current_work_order else ""
        
        tests = self.waterproof_importer.import_from_file(
            file_path,
            work_order_id=work_order_id,
            test_date_column=test_date_column,
            test_type_column=test_type_column,
            pressure_column=pressure_column,
            result_column=result_column,
            leak_detected_column=leak_detected_column
        )
        
        if self.current_work_order:
            self.current_work_order.waterproof_tests.extend(tests)
        
        return tests
    
    def add_timing_measurement(self, position: str,
                                rate: float,
                                amplitude: float,
                                beat_error: float,
                                temperature: Optional[float] = None,
                                measurement_time: Optional[datetime] = None,
                                instrument_model: Optional[str] = None) -> TimingLog:
        """
        添加单次校表仪测量记录
        
        Args:
            position: 方位
            rate: 日差
            amplitude: 摆幅
            beat_error: 偏振
            temperature: 温度
            measurement_time: 测量时间
            instrument_model: 校表仪型号
        
        Returns:
            新建的校表仪日志
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        measurement = TimingMeasurement(
            id=str(uuid.uuid4()),
            position=position,
            rate=rate,
            amplitude=amplitude,
            beat_error=beat_error,
            temperature=temperature,
            measurement_time=measurement_time
        )
        
        log = TimingLog(
            id=str(uuid.uuid4()),
            work_order_id=self.current_work_order.id,
            test_date=measurement_time or datetime.now(),
            instrument_model=instrument_model,
            measurements=[measurement]
        )
        
        self.current_work_order.timing_logs.append(log)
        
        return log
    
    def add_part_replacement(self, part_number: str,
                             part_name: str,
                             reason: str,
                             quantity: int = 1,
                             old_part_condition: Optional[str] = None,
                             new_part_serial: Optional[str] = None,
                             technician: Optional[str] = None,
                             cost: Optional[float] = None) -> PartReplacement:
        """
        添加零件更换记录
        
        Args:
            part_number: 零件编号
            part_name: 零件名称
            reason: 更换原因
            quantity: 数量
            old_part_condition: 旧零件状态
            new_part_serial: 新零件序列号
            technician: 操作师傅
            cost: 成本
        
        Returns:
            新建的零件更换记录
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        replacement = PartReplacement(
            id=str(uuid.uuid4()),
            work_order_id=self.current_work_order.id,
            part_number=part_number,
            part_name=part_name,
            quantity=quantity,
            reason=reason,
            old_part_condition=old_part_condition,
            new_part_serial=new_part_serial,
            replacement_date=datetime.now(),
            technician=technician,
            cost=cost
        )
        
        self.current_work_order.part_replacements.append(replacement)
        
        return replacement
    
    def add_waterproof_test(self, test_type: str = 'pressure',
                            pressure_bar: Optional[float] = None,
                            duration_minutes: Optional[int] = None,
                            result: str = 'fail',
                            leak_detected: bool = False,
                            leak_location: Optional[str] = None,
                            technician: Optional[str] = None,
                            equipment_model: Optional[str] = None) -> WaterproofTest:
        """
        添加防水测试记录
        
        Args:
            test_type: 测试类型
            pressure_bar: 测试压力
            duration_minutes: 测试时长
            result: 测试结果
            leak_detected: 是否检测到泄漏
            leak_location: 泄漏位置
            technician: 操作师傅
            equipment_model: 设备型号
        
        Returns:
            新建的防水测试记录
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        test = WaterproofTest(
            id=str(uuid.uuid4()),
            work_order_id=self.current_work_order.id,
            test_date=datetime.now(),
            test_type=test_type,
            pressure_bar=pressure_bar,
            duration_minutes=duration_minutes,
            result=result,
            leak_detected=leak_detected,
            leak_location=leak_location,
            technician=technician,
            equipment_model=equipment_model
        )
        
        self.current_work_order.waterproof_tests.append(test)
        
        return test
    
    def add_review_conclusion(self, reviewer: str,
                              overall_status: str = 'good',
                              rate_assessment: str = 'normal',
                              amplitude_assessment: str = 'normal',
                              position_variation_assessment: str = 'normal',
                              waterproof_assessment: str = 'not_tested',
                              root_causes: Optional[List[str]] = None,
                              recommendations: Optional[List[str]] = None,
                              rework_needed: bool = False,
                              rework_reason: Optional[str] = None,
                              estimated_return_days: Optional[int] = None,
                              notes: Optional[str] = None) -> WatchReviewConclusion:
        """
        添加人工复核结论
        
        Args:
            reviewer: 复核人
            overall_status: 整体状态
            rate_assessment: 日差评估
            amplitude_assessment: 摆幅评估
            position_variation_assessment: 位差评估
            waterproof_assessment: 防水评估
            root_causes: 根本原因
            recommendations: 建议
            rework_needed: 是否需要返修
            rework_reason: 返修原因
            estimated_return_days: 预计返修天数
            notes: 备注
        
        Returns:
            新建的复核结论
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        review = WatchReviewConclusion(
            id=str(uuid.uuid4()),
            work_order_id=self.current_work_order.id,
            reviewer=reviewer,
            review_date=datetime.now(),
            overall_status=overall_status,
            rate_assessment=rate_assessment,
            amplitude_assessment=amplitude_assessment,
            position_variation_assessment=position_variation_assessment,
            waterproof_assessment=waterproof_assessment,
            root_causes=root_causes or [],
            recommendations=recommendations or [],
            rework_needed=rework_needed,
            rework_reason=rework_reason,
            estimated_return_days=estimated_return_days,
            notes=notes
        )
        
        self.current_work_order.review_conclusions.append(review)
        
        return review
    
    def update_work_order_status(self, status: str) -> None:
        """
        更新工单状态
        
        Args:
            status: 新状态
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        valid_statuses = ['received', 'in_service', 'testing', 'ready', 'delivered']
        if status not in valid_statuses:
            raise ValueError(f'无效的状态: {status}')
        
        self.current_work_order.status = status
    
    def analyze(self) -> WatchAnalysisResult:
        """
        分析当前工单
        
        Returns:
            分析结果
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        self.analysis_result = self.analyzer.analyze_work_order(self.current_work_order)
        
        self.data_store.save_analysis_result(
            self.current_work_order.id,
            self.analysis_result.to_dict()
        )
        
        return self.analysis_result
    
    def get_analysis_summary(self) -> Dict[str, Any]:
        """
        获取分析摘要
        
        Returns:
            分析摘要
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return self.analysis_result.summary.copy()
    
    def get_rate_drift_analysis(self) -> List[Dict[str, Any]]:
        """
        获取日差漂移分析结果
        
        Returns:
            日差漂移分析列表
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return [d.to_dict() for d in self.analysis_result.rate_drifts]
    
    def get_amplitude_anomalies(self) -> List[Dict[str, Any]]:
        """
        获取摆幅异常分析结果
        
        Returns:
            摆幅异常列表
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return [a.to_dict() for a in self.analysis_result.amplitude_anomalies]
    
    def get_position_variations(self) -> List[Dict[str, Any]]:
        """
        获取位差波动分析结果
        
        Returns:
            位差波动列表
        """
        if not self.analysis_result:
            raise ValueError('请先运行分析')
        
        return [v.to_dict() for v in self.analysis_result.position_variations]
    
    def get_rework_risk(self) -> Optional[Dict[str, Any]]:
        """
        获取返修风险评估结果
        
        Returns:
            返修风险评估或None
        """
        if not self.analysis_result or not self.analysis_result.rework_risk:
            return None
        
        return self.analysis_result.rework_risk.to_dict()
    
    def generate_markdown_report(self, output_path: Optional[str] = None,
                                  include_measurements: bool = True,
                                  include_steps: bool = True,
                                  include_parts: bool = True) -> str:
        """
        生成Markdown报告
        
        Args:
            output_path: 输出文件路径（可选）
            include_measurements: 是否包含详细测量数据
            include_steps: 是否包含拆洗步骤
            include_parts: 是否包含零件更换清单
        
        Returns:
            Markdown报告内容
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        if not self.analysis_result:
            self.analyze()
        
        report = self.report_exporter.export_markdown(
            self.current_work_order,
            self.analysis_result,
            include_measurements=include_measurements,
            include_steps=include_steps,
            include_parts=include_parts
        )
        
        if output_path:
            self.report_exporter.export_to_file(
                self.current_work_order,
                output_path,
                format_type='markdown',
                analysis_result=self.analysis_result,
                include_measurements=include_measurements,
                include_steps=include_steps,
                include_parts=include_parts
            )
        
        return report
    
    def export_json(self, output_path: Optional[str] = None,
                    pretty: bool = True) -> Dict[str, Any]:
        """
        导出JSON数据
        
        Args:
            output_path: 输出文件路径（可选）
            pretty: 是否格式化输出
        
        Returns:
            JSON格式的数据
        """
        if not self.current_work_order:
            raise ValueError('没有当前工单记录')
        
        if not self.analysis_result:
            self.analyze()
        
        if output_path:
            self.report_exporter.export_to_file(
                self.current_work_order,
                output_path,
                format_type='json',
                analysis_result=self.analysis_result,
                pretty=pretty
            )
        
        json_str = self.report_exporter.export_json(
            self.current_work_order,
            self.analysis_result,
            pretty=pretty
        )
        
        import json
        return json.loads(json_str)
    
    def get_import_errors(self) -> Dict[str, List[str]]:
        """
        获取导入错误
        
        Returns:
            各导入器的错误列表
        """
        return {
            'timing_logs': self.timing_importer.get_errors(),
            'service_steps': self.service_step_importer.get_errors(),
            'part_replacements': self.part_importer.get_errors(),
            'waterproof_tests': self.waterproof_importer.get_errors()
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取当前工单的统计信息
        
        Returns:
            统计信息字典
        """
        if not self.current_work_order:
            return {}
        
        stats = {
            'work_order_number': self.current_work_order.work_order_number,
            'status': self.current_work_order.status,
            'timing_log_count': len(self.current_work_order.timing_logs),
            'service_step_count': len(self.current_work_order.service_steps),
            'part_replacement_count': len(self.current_work_order.part_replacements),
            'waterproof_test_count': len(self.current_work_order.waterproof_tests),
            'review_count': len(self.current_work_order.review_conclusions),
        }
        
        latest_log = self.current_work_order.get_latest_timing_log()
        if latest_log and latest_log.measurements:
            rates = [m.rate for m in latest_log.measurements]
            amplitudes = [m.amplitude for m in latest_log.measurements]
            beat_errors = [m.beat_error for m in latest_log.measurements]
            
            stats['timing'] = {
                'avg_rate': sum(rates) / len(rates),
                'min_rate': min(rates),
                'max_rate': max(rates),
                'avg_amplitude': sum(amplitudes) / len(amplitudes),
                'min_amplitude': min(amplitudes),
                'max_amplitude': max(amplitudes),
                'avg_beat_error': sum(beat_errors) / len(beat_errors),
                'position_count': len(latest_log.measurements)
            }
        
        latest_waterproof = self.current_work_order.get_latest_waterproof_test()
        if latest_waterproof:
            stats['waterproof'] = {
                'result': latest_waterproof.result,
                'leak_detected': latest_waterproof.leak_detected
            }
        
        latest_review = self.current_work_order.get_latest_review()
        if latest_review:
            stats['review'] = {
                'overall_status': latest_review.overall_status,
                'rework_needed': latest_review.rework_needed
            }
        
        if self.analysis_result:
            stats['analysis'] = self.analysis_result.summary
        
        return stats
