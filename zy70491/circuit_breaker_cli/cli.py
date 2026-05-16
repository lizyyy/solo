from datetime import datetime
from typing import Optional

from .storage import Storage
from .query import QueryService
from .detector import AttachmentExpiryDetector
from .output import OutputFormatter
from .test_data import TestDataGenerator


class CircuitBreakerCLI:
    def __init__(self, data_dir: str = "data"):
        self.storage = Storage(data_dir)
        self.query_service = QueryService(self.storage)
        self.detector = AttachmentExpiryDetector()
        self.generator = TestDataGenerator(self.storage)

    def init_test_data(self) -> None:
        """初始化测试数据"""
        self.generator.generate_test_data()
        self.run_detection()
        print("测试数据初始化完成")

    def run_detection(self) -> None:
        """对所有记录运行异常检测"""
        records = self.storage.load_all_records()
        for record in records:
            self.detector.detect_and_update(record)
            self.storage.save_record(record)
        print(f"已对 {len(records)} 条记录完成检测")

    def list_records(
        self,
        status: Optional[str] = None,
        abnormal_only: bool = False,
        normal_only: bool = False,
        output_format: str = "json"
    ) -> None:
        """列出所有记录"""
        if abnormal_only:
            records = self.query_service.get_abnormal_records()
        elif normal_only:
            records = self.query_service.get_normal_records()
        elif status:
            from .models import RecordStatus
            records = self.query_service.query_records(status=RecordStatus(status))
        else:
            records = self.query_service.get_all_records()

        self._output_records(records, output_format)

    def show_record(self, record_id: str, output_format: str = "json") -> None:
        """显示单条记录详情"""
        record = self.query_service.get_record_by_id(record_id)
        if not record:
            print(f"未找到记录: {record_id}")
            return

        self._output_records([record], output_format)

    def add_remark(self, record_id: str, content: str, operator: str, reason: Optional[str] = None) -> None:
        """添加人工备注"""
        record = self.query_service.get_record_by_id(record_id)
        if not record:
            print(f"未找到记录: {record_id}")
            return

        record.add_remark(content, operator, reason)
        self.storage.save_record(record)
        print(f"备注已添加到记录: {record_id}")

    def add_manual_correction(
        self,
        record_id: str,
        operator: str,
        correction_type: str,
        old_value: str,
        new_value: str,
        reason: str,
        resource_scope: str
    ) -> None:
        """添加人工修正记录"""
        record = self.query_service.get_record_by_id(record_id)
        if not record:
            print(f"未找到记录: {record_id}")
            return

        record.add_manual_correction(
            operator=operator,
            correction_type=correction_type,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            resource_scope=resource_scope
        )
        self.storage.save_record(record)
        print(f"人工修正已添加到记录: {record_id}")

    def show_correction_history(self, resource_scope: str) -> None:
        """按资源范围显示修正历史"""
        history = self.query_service.get_correction_history_by_resource(resource_scope)
        
        if not history:
            print(f"未找到资源 [{resource_scope}] 的修正历史")
            return

        print(f"\n资源 [{resource_scope}] 的修正历史 ({len(history)} 条):")
        print("-" * 80)
        
        for idx, item in enumerate(history, 1):
            print(f"\n{idx}. 记录: {item['record_title']} ({item['record_id']})")
            print(f"   操作人: {item['operator']}")
            print(f"   修正类型: {item['correction_type']}")
            print(f"   原值 → 新值: {item['old_value']} → {item['new_value']}")
            print(f"   理由: {item['reason']}")
            print(f"   时间: {item['created_at'].strftime('%Y-%m-%d %H:%M:%S')}")

    def export(self, record_id: Optional[str] = None, output_format: str = "json", file_path: Optional[str] = None) -> None:
        """导出数据"""
        if record_id:
            record = self.query_service.get_record_by_id(record_id)
            if not record:
                print(f"未找到记录: {record_id}")
                return
            records = [record]
        else:
            records = self.query_service.get_all_records()

        if file_path:
            if output_format == "json":
                OutputFormatter.save_json(records, file_path)
            else:
                OutputFormatter.save_markdown(records, file_path)
            print(f"数据已导出到: {file_path}")
        else:
            self._output_records(records, output_format)

    def _output_records(self, records, output_format: str) -> None:
        if output_format == "json":
            print(OutputFormatter.to_json(records))
        elif output_format == "markdown":
            print(OutputFormatter.to_markdown(records))
        else:
            print(f"不支持的输出格式: {output_format}")