import os
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    WorkOrder, TimingLog, TimingMeasurement,
    ServiceStep, PartReplacement, WaterproofTest,
    WatchReviewConclusion, WatchAnalysisResult
)


class WatchDataStore:
    """钟表维修数据存储管理器"""
    
    def __init__(self, storage_dir: str = './watch_data'):
        """
        初始化数据存储
        
        Args:
            storage_dir: 存储目录路径
        """
        self.storage_dir = storage_dir
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self):
        """确保存储目录存在"""
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir)
        
        work_orders_dir = os.path.join(self.storage_dir, 'work_orders')
        if not os.path.exists(work_orders_dir):
            os.makedirs(work_orders_dir)
        
        analysis_dir = os.path.join(self.storage_dir, 'analysis_results')
        if not os.path.exists(analysis_dir):
            os.makedirs(analysis_dir)
        
        reports_dir = os.path.join(self.storage_dir, 'reports')
        if not os.path.exists(reports_dir):
            os.makedirs(reports_dir)
    
    def save_work_order(self, work_order: WorkOrder) -> str:
        """
        保存工单记录
        
        Args:
            work_order: 工单记录
        
        Returns:
            工单ID
        """
        work_order_file = os.path.join(self.storage_dir, 'work_orders', f'{work_order.id}.json')
        
        with open(work_order_file, 'w', encoding='utf-8') as f:
            json.dump(work_order.to_dict(), f, ensure_ascii=False, indent=2, default=self._datetime_serializer)
        
        return work_order.id
    
    def load_work_order(self, work_order_id: str) -> Optional[WorkOrder]:
        """
        加载工单记录
        
        Args:
            work_order_id: 工单ID
        
        Returns:
            工单记录或None
        """
        work_order_file = os.path.join(self.storage_dir, 'work_orders', f'{work_order_id}.json')
        
        if not os.path.exists(work_order_file):
            return None
        
        with open(work_order_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_work_order(data)
    
    def list_work_orders(self) -> List[Dict[str, Any]]:
        """
        列出所有工单
        
        Returns:
            工单列表（包含基本信息）
        """
        work_orders_dir = os.path.join(self.storage_dir, 'work_orders')
        
        if not os.path.exists(work_orders_dir):
            return []
        
        work_orders = []
        
        for filename in os.listdir(work_orders_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(work_orders_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    is_overdue = False
                    days_until_due = None
                    if data.get('due_date'):
                        try:
                            due_date = datetime.fromisoformat(data['due_date'])
                            is_overdue = datetime.now() > due_date
                            delta = due_date - datetime.now()
                            days_until_due = max(0, delta.days)
                        except:
                            pass
                    
                    work_orders.append({
                        'id': data.get('id'),
                        'work_order_number': data.get('work_order_number'),
                        'customer_name': data.get('customer_name'),
                        'watch_brand': data.get('watch_brand'),
                        'watch_model': data.get('watch_model'),
                        'movement_type': data.get('movement_type'),
                        'movement_model': data.get('movement_model'),
                        'received_date': data.get('received_date'),
                        'due_date': data.get('due_date'),
                        'is_overdue': is_overdue,
                        'days_until_due': days_until_due,
                        'status': data.get('status'),
                        'timing_log_count': len(data.get('timing_logs', [])),
                        'part_replacement_count': len(data.get('part_replacements', [])),
                        'review_count': len(data.get('review_conclusions', []))
                    })
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
        
        return sorted(work_orders, key=lambda x: x.get('received_date', ''), reverse=True)
    
    def list_work_orders_by_movement(self, movement_model: str) -> List[Dict[str, Any]]:
        """
        按机芯型号列出工单
        
        Args:
            movement_model: 机芯型号
        
        Returns:
            匹配的工单列表
        """
        all_work_orders = self.list_work_orders()
        
        return [
            wo for wo in all_work_orders
            if wo.get('movement_model') and movement_model.lower() in wo.get('movement_model', '').lower()
        ]
    
    def list_work_orders_by_status(self, status: str) -> List[Dict[str, Any]]:
        """
        按状态列出工单
        
        Args:
            status: 状态
        
        Returns:
            匹配的工单列表
        """
        all_work_orders = self.list_work_orders()
        
        return [
            wo for wo in all_work_orders
            if wo.get('status') == status
        ]
    
    def list_overdue_work_orders(self) -> List[Dict[str, Any]]:
        """
        列出逾期工单
        
        Returns:
            逾期工单列表
        """
        all_work_orders = self.list_work_orders()
        
        return [
            wo for wo in all_work_orders
            if wo.get('is_overdue', False)
        ]
    
    def delete_work_order(self, work_order_id: str) -> bool:
        """
        删除工单记录
        
        Args:
            work_order_id: 工单ID
        
        Returns:
            是否成功删除
        """
        work_order_file = os.path.join(self.storage_dir, 'work_orders', f'{work_order_id}.json')
        
        if os.path.exists(work_order_file):
            os.remove(work_order_file)
            
            analysis_file = os.path.join(self.storage_dir, 'analysis_results', f'{work_order_id}.json')
            if os.path.exists(analysis_file):
                os.remove(analysis_file)
            
            return True
        
        return False
    
    def save_analysis_result(self, work_order_id: str, analysis_data: Dict[str, Any]) -> str:
        """
        保存分析结果
        
        Args:
            work_order_id: 工单ID
            analysis_data: 分析数据
        
        Returns:
            保存的文件路径
        """
        analysis_file = os.path.join(self.storage_dir, 'analysis_results', f'{work_order_id}.json')
        
        with open(analysis_file, 'w', encoding='utf-8') as f:
            json.dump(analysis_data, f, ensure_ascii=False, indent=2, default=self._datetime_serializer)
        
        return analysis_file
    
    def load_analysis_result(self, work_order_id: str) -> Optional[Dict[str, Any]]:
        """
        加载分析结果
        
        Args:
            work_order_id: 工单ID
        
        Returns:
            分析数据或None
        """
        analysis_file = os.path.join(self.storage_dir, 'analysis_results', f'{work_order_id}.json')
        
        if not os.path.exists(analysis_file):
            return None
        
        with open(analysis_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _dict_to_work_order(self, data: Dict[str, Any]) -> WorkOrder:
        """
        将字典转换为WorkOrder对象
        
        Args:
            data: 字典数据
        
        Returns:
            WorkOrder对象
        """
        received_date = None
        if data.get('received_date'):
            received_date = datetime.fromisoformat(data['received_date'])
        
        due_date = None
        if data.get('due_date'):
            due_date = datetime.fromisoformat(data['due_date'])
        
        timing_logs = []
        for log_data in data.get('timing_logs', []):
            timing_logs.append(self._dict_to_timing_log(log_data))
        
        service_steps = []
        for step_data in data.get('service_steps', []):
            service_steps.append(self._dict_to_service_step(step_data))
        
        part_replacements = []
        for part_data in data.get('part_replacements', []):
            part_replacements.append(self._dict_to_part_replacement(part_data))
        
        waterproof_tests = []
        for test_data in data.get('waterproof_tests', []):
            waterproof_tests.append(self._dict_to_waterproof_test(test_data))
        
        review_conclusions = []
        for review_data in data.get('review_conclusions', []):
            review_conclusions.append(self._dict_to_review_conclusion(review_data))
        
        return WorkOrder(
            id=data.get('id', str(uuid.uuid4())),
            work_order_number=data.get('work_order_number', ''),
            customer_name=data.get('customer_name', ''),
            watch_brand=data.get('watch_brand', ''),
            watch_model=data.get('watch_model', ''),
            movement_type=data.get('movement_type', 'mechanical'),
            movement_model=data.get('movement_model'),
            serial_number=data.get('serial_number'),
            received_date=received_date,
            due_date=due_date,
            status=data.get('status', 'received'),
            timing_logs=timing_logs,
            service_steps=service_steps,
            part_replacements=part_replacements,
            waterproof_tests=waterproof_tests,
            review_conclusions=review_conclusions,
            service_type=data.get('service_type'),
            initial_complaints=data.get('initial_complaints', []),
            estimated_cost=data.get('estimated_cost'),
            actual_cost=data.get('actual_cost'),
            notes=data.get('notes')
        )
    
    def _dict_to_timing_log(self, data: Dict[str, Any]) -> TimingLog:
        """将字典转换为TimingLog对象"""
        test_date = None
        if data.get('test_date'):
            test_date = datetime.fromisoformat(data['test_date'])
        
        measurements = []
        for m_data in data.get('measurements', []):
            measurements.append(self._dict_to_timing_measurement(m_data))
        
        return TimingLog(
            id=data.get('id', str(uuid.uuid4())),
            work_order_id=data.get('work_order_id', ''),
            test_date=test_date or datetime.now(),
            instrument_model=data.get('instrument_model'),
            measurements=measurements,
            notes=data.get('notes')
        )
    
    def _dict_to_timing_measurement(self, data: Dict[str, Any]) -> TimingMeasurement:
        """将字典转换为TimingMeasurement对象"""
        measurement_time = None
        if data.get('measurement_time'):
            measurement_time = datetime.fromisoformat(data['measurement_time'])
        
        return TimingMeasurement(
            id=data.get('id', str(uuid.uuid4())),
            position=data.get('position', ''),
            rate=data.get('rate', 0.0),
            amplitude=data.get('amplitude', 0.0),
            beat_error=data.get('beat_error', 0.0),
            temperature=data.get('temperature'),
            measurement_time=measurement_time,
            notes=data.get('notes')
        )
    
    def _dict_to_service_step(self, data: Dict[str, Any]) -> ServiceStep:
        """将字典转换为ServiceStep对象"""
        start_time = None
        if data.get('start_time'):
            start_time = datetime.fromisoformat(data['start_time'])
        
        end_time = None
        if data.get('end_time'):
            end_time = datetime.fromisoformat(data['end_time'])
        
        return ServiceStep(
            id=data.get('id', str(uuid.uuid4())),
            work_order_id=data.get('work_order_id', ''),
            step_number=data.get('step_number', 0),
            step_name=data.get('step_name', ''),
            technician=data.get('technician', ''),
            start_time=start_time,
            end_time=end_time,
            duration_minutes=data.get('duration_minutes'),
            status=data.get('status', 'pending'),
            notes=data.get('notes'),
            issues_found=data.get('issues_found', [])
        )
    
    def _dict_to_part_replacement(self, data: Dict[str, Any]) -> PartReplacement:
        """将字典转换为PartReplacement对象"""
        replacement_date = None
        if data.get('replacement_date'):
            replacement_date = datetime.fromisoformat(data['replacement_date'])
        
        return PartReplacement(
            id=data.get('id', str(uuid.uuid4())),
            work_order_id=data.get('work_order_id', ''),
            part_number=data.get('part_number', ''),
            part_name=data.get('part_name', ''),
            quantity=data.get('quantity', 1),
            reason=data.get('reason', ''),
            old_part_condition=data.get('old_part_condition'),
            new_part_serial=data.get('new_part_serial'),
            replacement_date=replacement_date,
            technician=data.get('technician'),
            cost=data.get('cost'),
            notes=data.get('notes')
        )
    
    def _dict_to_waterproof_test(self, data: Dict[str, Any]) -> WaterproofTest:
        """将字典转换为WaterproofTest对象"""
        test_date = None
        if data.get('test_date'):
            test_date = datetime.fromisoformat(data['test_date'])
        
        return WaterproofTest(
            id=data.get('id', str(uuid.uuid4())),
            work_order_id=data.get('work_order_id', ''),
            test_date=test_date or datetime.now(),
            test_type=data.get('test_type', 'pressure'),
            pressure_bar=data.get('pressure_bar'),
            duration_minutes=data.get('duration_minutes'),
            result=data.get('result', 'fail'),
            leak_detected=data.get('leak_detected', False),
            leak_location=data.get('leak_location'),
            technician=data.get('technician'),
            equipment_model=data.get('equipment_model'),
            notes=data.get('notes')
        )
    
    def _dict_to_review_conclusion(self, data: Dict[str, Any]) -> WatchReviewConclusion:
        """将字典转换为WatchReviewConclusion对象"""
        review_date = None
        if data.get('review_date'):
            review_date = datetime.fromisoformat(data['review_date'])
        
        return WatchReviewConclusion(
            id=data.get('id', str(uuid.uuid4())),
            work_order_id=data.get('work_order_id', ''),
            reviewer=data.get('reviewer', ''),
            review_date=review_date or datetime.now(),
            overall_status=data.get('overall_status', 'good'),
            rate_assessment=data.get('rate_assessment', 'normal'),
            amplitude_assessment=data.get('amplitude_assessment', 'normal'),
            position_variation_assessment=data.get('position_variation_assessment', 'normal'),
            waterproof_assessment=data.get('waterproof_assessment', 'not_tested'),
            root_causes=data.get('root_causes', []),
            recommendations=data.get('recommendations', []),
            rework_needed=data.get('rework_needed', False),
            rework_reason=data.get('rework_reason'),
            estimated_return_days=data.get('estimated_return_days'),
            notes=data.get('notes')
        )
    
    @staticmethod
    def _datetime_serializer(obj):
        """日期时间序列化器"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')
