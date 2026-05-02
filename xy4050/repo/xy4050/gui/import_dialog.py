import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLabel, QLineEdit, QTextEdit, QComboBox,
    QPushButton, QTableWidget, QTableWidgetItem,
    QFileDialog, QMessageBox, QGroupBox, QTabWidget,
    QWidget, QSplitter, QHeaderView, QCheckBox,
    QProgressBar, QDialogButtonBox, QSpinBox, QDialog
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.drill import Drill
from models.event import Event
from models.risk_level import RiskLevel
from importer.parser import (
    CSVParser, JSONParser, RawEventRecord, ParseError, FieldMapping
)
from importer.validator import (
    EventValidator, ValidationResult, ValidationError, ValidationIssueType
)
from importer.import_batch import ImportBatch, ImportStatus
from persistence.repository import (
    EventRepository, ImportBatchRepository, AreaRepository,
    EventTypeRepository
)


class ImportDialog(QDialog):
    def __init__(self, parent=None, drill: Optional[Drill] = None):
        super().__init__(parent)
        self._drill = drill
        self._file_path: Optional[str] = None
        self._raw_records: List[RawEventRecord] = []
        self._parse_errors: List[ParseError] = []
        self._validation_result: Optional[ValidationResult] = None
        self._imported_count: int = 0
        
        self.setWindowTitle("导入记录")
        self.setMinimumSize(900, 600)
        
        self._init_ui()
        self._load_reference_data()
    
    def _load_reference_data(self):
        self._area_codes = set()
        areas = AreaRepository().get_all()
        for area in areas:
            self._area_codes.add(area.code)
        
        self._event_type_codes = set()
        event_types = EventTypeRepository().get_all()
        for et in event_types:
            self._event_type_codes.add(et.code)
        
        self._risk_levels = {
            RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL
        }
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        file_group = QGroupBox("文件选择")
        file_layout = QHBoxLayout(file_group)
        
        file_layout.addWidget(QLabel("文件:"))
        
        self._edit_file_path = QLineEdit()
        self._edit_file_path.setReadOnly(True)
        file_layout.addWidget(self._edit_file_path, 1)
        
        self._btn_browse = QPushButton("浏览...")
        self._btn_browse.clicked.connect(self._on_browse)
        file_layout.addWidget(self._btn_browse)
        
        self._btn_parse = QPushButton("解析")
        self._btn_parse.clicked.connect(self._on_parse)
        file_layout.addWidget(self._btn_parse)
        
        layout.addWidget(file_group)
        
        source_group = QGroupBox("导入设置")
        source_layout = QFormLayout(source_group)
        
        self._edit_source_name = QLineEdit()
        self._edit_source_name.setPlaceholderText("例如：楼层观察员、门岗、医务点等")
        source_layout.addRow("来源名称:", self._edit_source_name)
        
        hint_label = QLabel(
            "提示: 所有从同一来源导入的记录会使用统一的来源名称。\n"
            "来源名称用于区分不同观察员/岗位的记录。"
        )
        hint_label.setWordWrap(True)
        source_layout.addRow(hint_label)
        
        layout.addWidget(source_group)
        
        tab_widget = QTabWidget()
        
        preview_tab = self._create_preview_tab()
        tab_widget.addTab(preview_tab, "数据预览")
        
        issues_tab = self._create_issues_tab()
        tab_widget.addTab(issues_tab, "问题记录")
        
        layout.addWidget(tab_widget, 1)
        
        stats_group = QGroupBox("导入统计")
        stats_layout = QHBoxLayout(stats_group)
        
        self._lbl_total = QLabel("总记录: 0")
        self._lbl_valid = QLabel("有效: 0")
        self._lbl_invalid = QLabel("无效: 0")
        self._lbl_warnings = QLabel("警告: 0")
        
        stats_layout.addWidget(self._lbl_total)
        stats_layout.addWidget(self._lbl_valid)
        stats_layout.addWidget(self._lbl_invalid)
        stats_layout.addWidget(self._lbl_warnings)
        stats_layout.addStretch()
        
        layout.addWidget(stats_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        self._btn_ok = buttons.button(QDialogButtonBox.StandardButton.Ok)
        self._btn_ok.setText("导入")
        self._btn_ok.setEnabled(False)
        buttons.accepted.connect(self._on_import)
        buttons.rejected.connect(self.reject)
        
        layout.addWidget(buttons)
    
    def _create_preview_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self._preview_table = QTableWidget()
        self._preview_table.setColumnCount(10)
        self._preview_table.setHorizontalHeaderLabels([
            "行号", "来源", "时间", "区域", "事件类型", 
            "描述", "人数", "照片编号", "备注", "状态"
        ])
        self._preview_table.horizontalHeader().setStretchLastSection(True)
        self._preview_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._preview_table.setAlternatingRowColors(True)
        
        header = self._preview_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(7, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(8, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(9, QHeaderView.ResizeMode.ResizeToContents)
        
        layout.addWidget(self._preview_table)
        
        return widget
    
    def _create_issues_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self._issues_table = QTableWidget()
        self._issues_table.setColumnCount(4)
        self._issues_table.setHorizontalHeaderLabels([
            "行号", "严重程度", "问题类型", "描述"
        ])
        self._issues_table.horizontalHeader().setStretchLastSection(True)
        self._issues_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._issues_table.setAlternatingRowColors(True)
        
        header = self._issues_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self._issues_table)
        
        return widget
    
    def _on_browse(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择导入文件",
            "",
            "支持的格式 (*.csv *.json);;CSV文件 (*.csv);;JSON文件 (*.json)"
        )
        
        if file_path:
            self._file_path = file_path
            self._edit_file_path.setText(file_path)
            
            if self._detect_source_name(file_path):
                pass
    
    def _detect_source_name(self, file_path: str) -> Optional[str]:
        file_name = Path(file_path).stem.lower()
        
        source_keywords = {
            "floor": "楼层观察员",
            "楼层": "楼层观察员",
            "gate": "门岗",
            "门岗": "门岗",
            "medical": "医务点",
            "医务": "医务点",
            "observer": "观察员",
            "观察": "观察员",
            "evac": "疏散观察员",
            "疏散": "疏散观察员",
        }
        
        for keyword, source_name in source_keywords.items():
            if keyword in file_name:
                self._edit_source_name.setText(source_name)
                return source_name
        
        return None
    
    def _on_parse(self):
        if not self._file_path:
            QMessageBox.warning(self, "提示", "请先选择一个文件")
            return
        
        file_path = Path(self._file_path)
        
        if file_path.suffix.lower() == '.csv':
            parser = CSVParser()
        elif file_path.suffix.lower() == '.json':
            parser = JSONParser()
        else:
            QMessageBox.warning(self, "提示", "不支持的文件格式")
            return
        
        try:
            result = parser.parse_file(self._file_path)
            self._raw_records = result.records
            self._parse_errors = result.errors
            
            if self._raw_records and not self._edit_source_name.text().strip():
                first_source = self._raw_records[0].source
                if first_source:
                    self._edit_source_name.setText(first_source)
            
            self._validate_records()
            self._refresh_preview()
            self._refresh_issues()
            self._update_stats()
            
            if self._raw_records:
                self._btn_ok.setEnabled(True)
            
        except Exception as e:
            QMessageBox.critical(self, "解析错误", f"文件解析失败:\n{str(e)}")
    
    def _validate_records(self):
        if not self._raw_records:
            self._validation_result = None
            return
        
        validator = EventValidator(
            area_codes=self._area_codes,
            event_type_codes=self._event_type_codes,
            risk_levels=self._risk_levels
        )
        
        source_name = self._edit_source_name.text().strip()
        source_counts: Dict[str, int] = {}
        
        validated_records = []
        for record in self._raw_records:
            if source_name:
                record.source = source_name
            
            if record.source:
                if record.source not in source_counts:
                    source_counts[record.source] = 0
                source_counts[record.source] += 1
        
        self._validation_result = validator.validate_all(
            self._raw_records,
            source_photo_counts=source_counts
        )
    
    def _refresh_preview(self):
        self._preview_table.setRowCount(0)
        
        if not self._raw_records:
            return
        
        max_rows = min(len(self._raw_records), 100)
        
        for i in range(max_rows):
            record = self._raw_records[i]
            row = self._preview_table.rowCount()
            self._preview_table.insertRow(row)
            
            is_valid = True
            status_text = "正常"
            
            if self._validation_result:
                for issue in self._validation_result.record_issues.get(record.row_number, []):
                    if issue.issue_type in [
                        ValidationIssueType.MISSING_REQUIRED_FIELD,
                        ValidationIssueType.INVALID_TIME_FORMAT,
                        ValidationIssueType.UNKNOWN_AREA,
                        ValidationIssueType.UNKNOWN_EVENT_TYPE,
                        ValidationIssueType.DUPLICATE_PHOTO_NUMBER,
                    ]:
                        is_valid = False
                        status_text = "无效"
                        break
            
            if not record.parsed_time and record.original_time:
                status_text = "无效(时间解析失败)"
                is_valid = False
            
            self._preview_table.setItem(row, 0, QTableWidgetItem(str(record.row_number)))
            self._preview_table.setItem(row, 1, QTableWidgetItem(record.source or ""))
            self._preview_table.setItem(row, 2, QTableWidgetItem(str(record.original_time or "")))
            self._preview_table.setItem(row, 3, QTableWidgetItem(record.area_code or ""))
            self._preview_table.setItem(row, 4, QTableWidgetItem(record.event_type_code or ""))
            self._preview_table.setItem(row, 5, QTableWidgetItem(record.description or ""))
            self._preview_table.setItem(row, 6, QTableWidgetItem(str(record.person_count) if record.person_count else ""))
            self._preview_table.setItem(row, 7, QTableWidgetItem(", ".join(record.photo_numbers) if record.photo_numbers else ""))
            self._preview_table.setItem(row, 8, QTableWidgetItem(record.notes or ""))
            
            status_item = QTableWidgetItem(status_text)
            if not is_valid:
                from PyQt6.QtGui import QBrush, QColor
                status_item.setForeground(QBrush(QColor("#CC0000")))
            self._preview_table.setItem(row, 9, status_item)
    
    def _refresh_issues(self):
        self._issues_table.setRowCount(0)
        
        if self._parse_errors:
            for error in self._parse_errors:
                row = self._issues_table.rowCount()
                self._issues_table.insertRow(row)
                
                self._issues_table.setItem(row, 0, QTableWidgetItem(str(error.row_number)))
                self._issues_table.setItem(row, 1, QTableWidgetItem("错误"))
                self._issues_table.setItem(row, 2, QTableWidgetItem("解析错误"))
                self._issues_table.setItem(row, 3, QTableWidgetItem(str(error.error_message)))
        
        if self._validation_result:
            issues_list = []
            for row_num, issues in self._validation_result.record_issues.items():
                for issue in issues:
                    issues_list.append((row_num, issue))
            
            issues_list.sort(key=lambda x: (
                0 if x[1].severity == 'error' else 1 if x[1].severity == 'warning' else 2,
                x[0]
            ))
            
            for row_num, issue in issues_list:
                row = self._issues_table.rowCount()
                self._issues_table.insertRow(row)
                
                severity_text = "警告" if issue.severity == 'warning' else "错误"
                
                self._issues_table.setItem(row, 0, QTableWidgetItem(str(row_num)))
                self._issues_table.setItem(row, 1, QTableWidgetItem(severity_text))
                self._issues_table.setItem(row, 2, QTableWidgetItem(str(issue.issue_type)))
                self._issues_table.setItem(row, 3, QTableWidgetItem(issue.message))
    
    def _update_stats(self):
        total = len(self._raw_records)
        valid = total
        invalid = 0
        warnings = 0
        
        if self._validation_result:
            for row_num, issues in self._validation_result.record_issues.items():
                has_error = False
                has_warning = False
                
                for issue in issues:
                    if issue.severity == 'error':
                        has_error = True
                    elif issue.severity == 'warning':
                        has_warning = True
                
                if has_error:
                    invalid += 1
                    valid -= 1
                if has_warning:
                    warnings += 1
        
        for error in self._parse_errors:
            if error.row_number not in [r.row_number for r in self._raw_records]:
                total += 1
                invalid += 1
        
        self._lbl_total.setText(f"总记录: {total}")
        self._lbl_valid.setText(f"有效: {valid}")
        self._lbl_invalid.setText(f"无效: {invalid}")
        self._lbl_warnings.setText(f"警告: {warnings}")
        
        if valid == 0 and total > 0:
            self._btn_ok.setEnabled(False)
        elif total > 0:
            self._btn_ok.setEnabled(True)
    
    def _on_import(self):
        if not self._drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        if not self._raw_records:
            QMessageBox.warning(self, "提示", "没有可导入的记录")
            return
        
        drill_id = self._drill.id
        source_name = self._edit_source_name.text().strip()
        
        batch = ImportBatch()
        batch.drill_id = drill_id
        batch.file_name = Path(self._file_path).name if self._file_path else ""
        batch.source_name = source_name
        batch.total_records = len(self._raw_records)
        batch.valid_records = 0
        batch.invalid_records = 0
        
        events: List[Event] = []
        valid_count = 0
        invalid_count = 0
        
        for record in self._raw_records:
            event = Event()
            event.drill_id = drill_id
            event.source = source_name or record.source or "UNKNOWN"
            event.original_time = record.parsed_time
            event.original_time_str = str(record.original_time) if record.original_time else None
            event.unified_time = record.parsed_time
            event.area_code = record.area_code
            event.event_type_code = record.event_type_code
            event.description = record.description
            event.person_count = record.person_count
            event.photo_numbers = record.photo_numbers
            event.notes = record.notes
            event.is_valid = True
            
            if self._validation_result:
                record_issues = self._validation_result.record_issues.get(record.row_number, [])
                for issue in record_issues:
                    if issue.severity == 'error':
                        event.is_valid = False
                        break
            
            if event.is_valid:
                valid_count += 1
            else:
                invalid_count += 1
            
            event.validation_errors = [
                {
                    "issue_type": str(issue.issue_type),
                    "severity": issue.severity,
                    "message": issue.message,
                    "field_name": issue.field_name,
                    "value": issue.value,
                }
                for issue in self._validation_result.record_issues.get(record.row_number, [])
            ]
            
            events.append(event)
        
        batch.valid_records = valid_count
        batch.invalid_records = invalid_count
        batch.status = ImportStatus.COMPLETED
        
        ImportBatchRepository().create(batch)
        
        for event in events:
            event.import_batch_id = batch.id
            EventRepository().create(event)
        
        self._imported_count = valid_count
        
        QMessageBox.information(
            self, "导入完成",
            f"导入完成:\n"
            f"  总记录: {len(self._raw_records)}\n"
            f"  有效: {valid_count}\n"
            f"  无效: {invalid_count}"
        )
        
        self.accept()
    
    def get_import_stats(self) -> Dict[str, Any]:
        return {
            "imported_count": self._imported_count,
            "total_records": len(self._raw_records),
        }
