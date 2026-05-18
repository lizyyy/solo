import csv
import os
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Tuple
from .models import OrderRecord, OrderStatus, ProcessingError, SortResult


class UniformSorter:
    REQUIRED_COLUMNS = ["学校名称", "年级", "班级", "学生姓名", "学号", "性别", "校服类型", "尺码", "数量"]
    
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.result = SortResult()
        self.all_records: List[OrderRecord] = []
        
    def process(self) -> SortResult:
        self._ensure_directories()
        self._process_all_files()
        self._detect_duplicate_names()
        self._classify_records()
        self._write_outputs()
        self._write_error_summary()
        return self.result
    
    def _ensure_directories(self):
        if not self.input_dir.exists():
            raise FileNotFoundError(f"输入目录不存在: {self.input_dir}")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _process_all_files(self):
        csv_files = list(self.input_dir.glob("*.csv"))
        if not csv_files:
            self.result.errors.append(ProcessingError(
                file_name="",
                line_number=0,
                error_type="空目录",
                message=f"输入目录 {self.input_dir} 中没有找到CSV文件"
            ))
            return
        
        for file_path in csv_files:
            self._process_single_file(file_path)
    
    def _process_single_file(self, file_path: Path):
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                self._validate_header(file_path.name, reader.fieldnames)
                
                for line_num, row in enumerate(reader, start=2):
                    try:
                        record = self._parse_row(file_path.name, line_num, row)
                        self.all_records.append(record)
                    except Exception as e:
                            self.result.errors.append(ProcessingError(
                                file_name=file_path.name,
                                line_number=line_num,
                                error_type="数据格式错误",
                                message=str(e),
                                raw_data=str(row)
                            ))
        except UnicodeDecodeError:
            self.result.errors.append(ProcessingError(
                file_name=file_path.name,
                line_number=0,
                error_type="编码错误",
                message="文件编码不是UTF-8，请转换编码后重试"
            ))
        except Exception as e:
            self.result.errors.append(ProcessingError(
                file_name=file_path.name,
                line_number=0,
                error_type="文件读取错误",
                message=str(e)
            ))
    
    def _validate_header(self, file_name: str, fieldnames: List[str]):
        if not fieldnames:
            raise ValueError(f"文件 {file_name} 没有表头")
        missing = [col for col in self.REQUIRED_COLUMNS if col not in fieldnames]
        if missing:
            raise ValueError(f"文件 {file_name} 缺少必要列: {', '.join(missing)}")
    
    def _parse_row(self, file_name: str, line_num: int, row: Dict[str, str]) -> OrderRecord:
        school_name = row.get("学校名称", "").strip()
        grade = row.get("年级", "").strip()
        class_name = row.get("班级", "").strip()
        student_name = row.get("学生姓名", "").strip()
        student_id = row.get("学号", "").strip()
        gender = row.get("性别", "").strip()
        uniform_type = row.get("校服类型", "").strip()
        size = row.get("尺码", "").strip()
        quantity_str = row.get("数量", "").strip()
        remark = row.get("备注", "").strip()
        
        if not student_name:
            raise ValueError("学生姓名不能为空")
        if not student_id:
            raise ValueError("学号不能为空")
        
        try:
            quantity = int(quantity_str)
            if quantity <= 0:
                raise ValueError()
        except ValueError:
            raise ValueError(f"数量必须是正整数，当前值: {quantity_str}")
        
        status = OrderStatus.NORMAL
        original_size = None
        
        if "换码" in remark or "换尺码" in remark:
            status = OrderStatus.SIZE_CHANGE
            original_size = size
        elif "缺货" in remark or "无货" in remark:
            status = OrderStatus.OUT_OF_STOCK
        
        return OrderRecord(
            file_name=file_name,
            line_number=line_num,
            school_name=school_name,
            grade=grade,
            class_name=class_name,
            student_name=student_name,
            student_id=student_id,
            gender=gender,
            uniform_type=uniform_type,
            size=size,
            quantity=quantity,
            status=status,
            original_size=original_size,
            remark=remark
        )
    
    def _detect_duplicate_names(self):
        name_groups = defaultdict(list)
        for record in self.all_records:
            key = (record.school_name, record.grade, record.class_name, record.student_name)
            name_groups[key].append(record)
        
        for records in name_groups.values():
            if len(records) > 1:
                for record in records:
                    if record.status == OrderStatus.NORMAL:
                        record.status = OrderStatus.DUPLICATE_NAME
    
    def _classify_records(self):
        for record in self.all_records:
            if record.status == OrderStatus.NORMAL:
                key = f"{record.school_name}_{record.grade}年级_{record.class_name}班"
                if key not in self.result.normal_orders:
                    self.result.normal_orders[key] = []
                self.result.normal_orders[key].append(record)
            elif record.status == OrderStatus.SIZE_CHANGE:
                self.result.size_change_orders.append(record)
            elif record.status == OrderStatus.OUT_OF_STOCK:
                self.result.out_of_stock_orders.append(record)
            elif record.status == OrderStatus.DUPLICATE_NAME:
                self.result.duplicate_name_orders.append(record)
    
    def _write_outputs(self):
        normal_dir = self.output_dir / "正常订单"
        normal_dir.mkdir(exist_ok=True)
        
        for class_key, orders in self.result.normal_orders.items():
            file_path = normal_dir / f"{class_key}.csv"
            self._write_records_to_csv(file_path, orders)
        
        special_dir = self.output_dir / "特殊情况"
        special_dir.mkdir(exist_ok=True)
        
        if self.result.size_change_orders:
            self._write_records_to_csv(
                special_dir / "换码订单.csv",
                self.result.size_change_orders
            )
        
        if self.result.out_of_stock_orders:
            self._write_records_to_csv(
                special_dir / "缺货订单.csv",
                self.result.out_of_stock_orders
            )
        
        if self.result.duplicate_name_orders:
            self._write_records_to_csv(
                special_dir / "同名学生订单.csv",
                self.result.duplicate_name_orders
            )
    
    def _write_records_to_csv(self, file_path: Path, records: List[OrderRecord]):
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["来源文件", "行号", "学校名称", "年级", "班级", "学生姓名", "学号", "性别", "校服类型", "尺码", "数量", "状态", "原尺码", "备注"])
            for r in records:
                writer.writerow([
                    r.file_name, r.line_number, r.school_name, r.grade,
                    r.class_name, r.student_name, r.student_id,
                    r.gender, r.uniform_type, r.size, r.quantity,
                    r.status.value, r.original_size or "", r.remark
                ])
    
    def _write_error_summary(self):
        if not self.result.errors:
            return
        
        error_file = self.output_dir / "异常摘要.csv"
        with open(error_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["来源文件", "行号", "错误类型", "错误信息", "原始数据"])
            for e in self.result.errors:
                writer.writerow([e.file_name, e.line_number, e.error_type, e.message, e.raw_data])
