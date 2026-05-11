"""订单导入和验证模块"""
import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import uuid

from .database import Database
from .models import Order, OrderStatus, Anomaly


class ImportResult:
    def __init__(self):
        self.success_count = 0
        self.duplicate_count = 0
        self.error_count = 0
        self.errors: List[Dict[str, Any]] = []
        self.imported_orders: List[str] = []


class OrderImporter:
    def __init__(self, db: Database):
        self.db = db

    def _generate_order_id(self) -> str:
        return f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    def _generate_anomaly_id(self) -> str:
        return f"ANM-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    def validate_order_data(self, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        required_fields = [
            'source_system', 'source_record_id', 'product_id',
            'quantity', 'customer_name', 'delivery_window_id'
        ]
        for field in required_fields:
            if field not in data or not str(data[field]).strip():
                return False, f"缺少必填字段: {field}"

        try:
            quantity = int(data['quantity'])
            if quantity <= 0:
                return False, "数量必须大于0"
        except (ValueError, TypeError):
            return False, "数量必须是有效数字"

        product = self.db.get_product(str(data['product_id']))
        if not product:
            return False, f"产品不存在: {data['product_id']}"

        window = self.db.get_delivery_window(str(data['delivery_window_id']))
        if not window:
            return False, f"配送窗口不存在: {data['delivery_window_id']}"

        return True, None

    def check_duplicate(self, source_system: str, source_record_id: str) -> Optional[Order]:
        return self.db.get_order_by_source(source_system, source_record_id)

    def create_order_from_data(self, data: Dict[str, Any]) -> Order:
        return Order(
            order_id=self._generate_order_id(),
            source_system=str(data['source_system']),
            source_record_id=str(data['source_record_id']),
            product_id=str(data['product_id']),
            quantity=int(data['quantity']),
            customer_name=str(data['customer_name']),
            delivery_window_id=str(data['delivery_window_id']),
            priority=int(data.get('priority', 0)),
            notes=data.get('notes')
        )

    def import_single_order(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[str]]:
        is_valid, error_msg = self.validate_order_data(data)
        if not is_valid:
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                order_id=f"TEMP-{uuid.uuid4().hex[:6]}",
                anomaly_type="validation_error",
                description=f"订单数据验证失败: {error_msg} | 数据: {json.dumps(data, ensure_ascii=False)}"
            )
            self.db.create_anomaly(anomaly)
            return False, "validation_error", error_msg

        existing_order = self.check_duplicate(
            data['source_system'],
            data['source_record_id']
        )
        if existing_order:
            if existing_order.status in [OrderStatus.PROOFING, OrderStatus.BAKING, OrderStatus.READY, OrderStatus.DELIVERED]:
                anomaly = Anomaly(
                    anomaly_id=self._generate_anomaly_id(),
                    order_id=existing_order.order_id,
                    anomaly_type="status_conflict",
                    description=f"重复提交: 订单 {existing_order.order_id} 已处于 {existing_order.status.value} 状态，无法重复处理"
                )
                self.db.create_anomaly(anomaly)
                return False, "status_conflict", f"订单已在处理中，状态: {existing_order.status.value}"
            else:
                return False, "duplicate", f"订单已存在: {existing_order.order_id}"

        order = self.create_order_from_data(data)
        success = self.db.create_order(order)
        if success:
            return True, "success", order.order_id
        else:
            return False, "database_error", "数据库插入失败"

    def import_from_csv(self, file_path: str) -> ImportResult:
        result = ImportResult()
        path = Path(file_path)
        
        if not path.exists():
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                order_id=f"TEMP-{uuid.uuid4().hex[:6]}",
                anomaly_type="source_missing",
                description=f"来源文件不存在: {file_path}"
            )
            self.db.create_anomaly(anomaly)
            result.error_count = 1
            result.errors.append({
                'type': 'source_missing',
                'message': f"文件不存在: {file_path}"
            })
            return result

        try:
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    success, error_type, message = self.import_single_order(row)
                    if success:
                        result.success_count += 1
                        result.imported_orders.append(message)
                    elif error_type == 'duplicate':
                        result.duplicate_count += 1
                    else:
                        result.error_count += 1
                        result.errors.append({
                            'row': row_num,
                            'type': error_type,
                            'message': message
                        })
        except Exception as e:
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                order_id=f"TEMP-{uuid.uuid4().hex[:6]}",
                anomaly_type="import_error",
                description=f"CSV导入失败: {file_path} | 错误: {str(e)}"
            )
            self.db.create_anomaly(anomaly)
            result.error_count += 1
            result.errors.append({
                'type': 'import_error',
                'message': str(e)
            })

        return result

    def import_from_json(self, file_path: str) -> ImportResult:
        result = ImportResult()
        path = Path(file_path)
        
        if not path.exists():
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                order_id=f"TEMP-{uuid.uuid4().hex[:6]}",
                anomaly_type="source_missing",
                description=f"来源文件不存在: {file_path}"
            )
            self.db.create_anomaly(anomaly)
            result.error_count = 1
            result.errors.append({
                'type': 'source_missing',
                'message': f"文件不存在: {file_path}"
            })
            return result

        try:
            with open(path, 'r', encoding='utf-8') as f:
                orders_data = json.load(f)
            
            if not isinstance(orders_data, list):
                orders_data = [orders_data]

            for idx, data in enumerate(orders_data):
                success, error_type, message = self.import_single_order(data)
                if success:
                    result.success_count += 1
                    result.imported_orders.append(message)
                elif error_type == 'duplicate':
                    result.duplicate_count += 1
                else:
                    result.error_count += 1
                    result.errors.append({
                        'index': idx,
                        'type': error_type,
                        'message': message
                    })
        except Exception as e:
            anomaly = Anomaly(
                anomaly_id=self._generate_anomaly_id(),
                order_id=f"TEMP-{uuid.uuid4().hex[:6]}",
                anomaly_type="import_error",
                description=f"JSON导入失败: {file_path} | 错误: {str(e)}"
            )
            self.db.create_anomaly(anomaly)
            result.error_count += 1
            result.errors.append({
                'type': 'import_error',
                'message': str(e)
            })

        return result
