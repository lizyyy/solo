"""主窗口模块

实现标本流转防错台的主界面。
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from pathlib import Path

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QTabWidget, QTableWidget, QTableWidgetItem,
    QLabel, QPushButton, QGroupBox, QTextEdit, QLineEdit,
    QComboBox, QSpinBox, QCheckBox, QDateTimeEdit,
    QFileDialog, QMessageBox, QHeaderView, QMenu,
    QStatusBar, QToolBar, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QSize
from PyQt6.QtGui import QFont, QColor, QBrush, QAction

from ..models import (
    Specimen, SpecimenStatus, SpecimenEvent, Anomaly,
    EventType, AnomalyType, Patient
)
from ..database import DatabaseManager
from ..rules import RulesEngine
from ..state_machine import StateMachine, StateTransitionError
from ..io import CsvImporter, MarkdownExporter, CsvExporter, JsonExporter
from ..sample_data import populate_database

from .dialogs import (
    RegisterDialog, ReviewDialog, DelayDialog, ExportDialog,
    PhoneRemarkDialog, PhotoConfirmDialog
)


class SpecimenTableWidget(QTableWidget):
    """标本列表表格"""
    
    specimen_selected = pyqtSignal(int)
    
    STATUS_COLORS = {
        SpecimenStatus.REGISTERED: QColor(255, 255, 200),
        SpecimenStatus.IN_PROCESS: QColor(200, 255, 200),
        SpecimenStatus.PENDING_PHOTO: QColor(255, 220, 200),
        SpecimenStatus.PHOTO_COMPLETE: QColor(200, 220, 255),
        SpecimenStatus.PENDING_REVIEW: QColor(255, 200, 200),
        SpecimenStatus.REVIEWED: QColor(200, 255, 220),
        SpecimenStatus.RELEASED: QColor(220, 220, 220),
        SpecimenStatus.DELAYED: QColor(255, 180, 180),
    }
    
    COLUMNS = [
        "标本号", "患者姓名", "部位", "状态", "紧急程度",
        "登记时间", "照片数", "材料核对", "手术间"
    ]
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._specimen_ids: List[int] = []
        self._setup_ui()
    
    def _setup_ui(self):
        self.setColumnCount(len(self.COLUMNS))
        self.setHorizontalHeaderLabels(self.COLUMNS)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.setAlternatingRowColors(True)
        self.setSortingEnabled(True)
        
        self.itemSelectionChanged.connect(self._on_selection_changed)
    
    def _on_selection_changed(self):
        selected = self.selectedItems()
        if selected:
            row = selected[0].row()
            if row < len(self._specimen_ids):
                self.specimen_selected.emit(self._specimen_ids[row])
    
    def set_specimens(self, specimens: List[Specimen]):
        self.clearContents()
        self.setRowCount(len(specimens))
        self._specimen_ids = [s.id for s in specimens if s.id]
        
        for row, specimen in enumerate(specimens):
            self._set_row(row, specimen)
    
    def _set_row(self, row: int, specimen: Specimen):
        color = self.STATUS_COLORS.get(specimen.status, QColor(255, 255, 255))
        
        items = [
            QTableWidgetItem(specimen.specimen_no),
            QTableWidgetItem(specimen.patient_name),
            QTableWidgetItem(specimen.location or "-"),
            QTableWidgetItem(specimen.status.value),
            QTableWidgetItem(specimen.urgent_level),
            QTableWidgetItem(specimen.registered_at.strftime("%H:%M:%S")),
            QTableWidgetItem(str(specimen.photo_count)),
            QTableWidgetItem(self._format_materials(specimen)),
            QTableWidgetItem(specimen.operation_room or "-"),
        ]
        
        for col, item in enumerate(items):
            item.setBackground(QBrush(color))
            item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.setItem(row, col, item)
        
        if specimen.urgent_level == "急诊":
            for col in range(self.columnCount()):
                item = self.item(row, col)
                if item:
                    font = item.font()
                    font.setBold(True)
                    item.setFont(font)
    
    def _format_materials(self, specimen: Specimen) -> str:
        parts = []
        if specimen.has_specimen_bag:
            parts.append("袋✓")
        else:
            parts.append("袋✗")
        
        if specimen.has_csv:
            parts.append("单✓")
        else:
            parts.append("单✗")
        
        return " ".join(parts)


class TimelineWidget(QWidget):
    """时间线显示组件"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._events: List[SpecimenEvent] = []
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(5)
        
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        
        self._content = QWidget()
        self._content_layout = QVBoxLayout(self._content)
        self._content_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self._content_layout.setSpacing(10)
        
        self._scroll.setWidget(self._content)
        layout.addWidget(self._scroll)
    
    def set_events(self, events: List[SpecimenEvent]):
        self._events = events
        self._refresh()
    
    def _refresh(self):
        while self._content_layout.count():
            item = self._content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        for event in self._events:
            item_widget = self._create_event_item(event)
            self._content_layout.addWidget(item_widget)
        
        self._content_layout.addStretch()
    
    def _create_event_item(self, event: SpecimenEvent) -> QWidget:
        widget = QFrame()
        widget.setFrameStyle(QFrame.Shape.StyledPanel)
        widget.setLineWidth(1)
        
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(10, 8, 10, 8)
        
        time_label = QLabel(event.event_time.strftime("%H:%M:%S"))
        time_font = time_label.font()
        time_font.setBold(True)
        time_label.setFont(time_font)
        time_label.setFixedWidth(80)
        
        type_label = QLabel(f"[{event.event_type.value}]")
        type_label.setStyleSheet("color: #666; font-weight: bold;")
        
        desc_label = QLabel(event.description)
        desc_label.setWordWrap(True)
        
        layout.addWidget(time_label)
        layout.addWidget(type_label)
        layout.addWidget(desc_label, 1)
        
        if event.operator:
            op_label = QLabel(f"操作人: {event.operator}")
            op_label.setStyleSheet("color: #888; font-size: 11px;")
            layout.addWidget(op_label)
        
        return widget


class AnomalyTableWidget(QTableWidget):
    """异常清单表格"""
    
    COLUMNS = [
        "严重程度", "异常类型", "标本号", "患者姓名", "描述", "检测时间", "状态"
    ]
    
    SEVERITY_COLORS = {
        "high": QColor(255, 200, 200),
        "medium": QColor(255, 240, 200),
        "low": QColor(240, 255, 240),
    }
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
    
    def _setup_ui(self):
        self.setColumnCount(len(self.COLUMNS))
        self.setHorizontalHeaderLabels(self.COLUMNS)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setAlternatingRowColors(True)
    
    def set_anomalies(self, anomalies: List[Anomaly], specimens: Dict[int, Specimen]):
        self.clearContents()
        self.setRowCount(len(anomalies))
        
        for row, anomaly in enumerate(anomalies):
            specimen = specimens.get(anomaly.specimen_id)
            color = self.SEVERITY_COLORS.get(anomaly.severity, QColor(255, 255, 255))
            
            severity_text = "高" if anomaly.severity == "high" else "中" if anomaly.severity == "medium" else "低"
            
            items = [
                QTableWidgetItem(severity_text),
                QTableWidgetItem(anomaly.anomaly_type.value),
                QTableWidgetItem(specimen.specimen_no if specimen else "-"),
                QTableWidgetItem(specimen.patient_name if specimen else "-"),
                QTableWidgetItem(anomaly.description),
                QTableWidgetItem(anomaly.detected_at.strftime("%H:%M:%S") if anomaly.detected_at else "-"),
                QTableWidgetItem("已解决" if anomaly.is_resolved else "未解决"),
            ]
            
            for col, item in enumerate(items):
                item.setBackground(QBrush(color))
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                self.setItem(row, col, item)


class StatusPanelWidget(QGroupBox):
    """状态统计面板"""
    
    def __init__(self, parent=None):
        super().__init__("当前状态统计", parent)
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        
        self._status_labels: Dict[SpecimenStatus, QLabel] = {}
        
        grid_layout = QHBoxLayout()
        
        statuses = [
            (SpecimenStatus.REGISTERED, "已登记"),
            (SpecimenStatus.IN_PROCESS, "处理中"),
            (SpecimenStatus.PENDING_PHOTO, "待拍照"),
            (SpecimenStatus.PHOTO_COMPLETE, "拍照完成"),
            (SpecimenStatus.PENDING_REVIEW, "待复核"),
            (SpecimenStatus.REVIEWED, "已复核"),
            (SpecimenStatus.DELAYED, "已延迟"),
        ]
        
        for status, name in statuses:
            group = QVBoxLayout()
            count_label = QLabel("0")
            count_font = count_label.font()
            count_font.setPointSize(16)
            count_font.setBold(True)
            count_label.setFont(count_font)
            count_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            
            name_label = QLabel(name)
            name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            
            group.addWidget(count_label)
            group.addWidget(name_label)
            
            grid_layout.addLayout(group)
            
            self._status_labels[status] = count_label
        
        grid_layout.addStretch()
        layout.addLayout(grid_layout)
        
        self._anomaly_label = QLabel("异常: 0 项")
        anomaly_font = self._anomaly_label.font()
        anomaly_font.setBold(True)
        self._anomaly_label.setFont(anomaly_font)
        self._anomaly_label.setStyleSheet("color: #c00; padding: 5px;")
        layout.addWidget(self._anomaly_label)
    
    def update_counts(self, specimens: List[Specimen], anomaly_count: int):
        counts: Dict[SpecimenStatus, int] = defaultdict(int)
        for s in specimens:
            counts[s.status] += 1
        
        for status, label in self._status_labels.items():
            label.setText(str(counts.get(status, 0)))
        
        self._anomaly_label.setText(f"异常: {anomaly_count} 项")


class MainWindow(QMainWindow):
    """主窗口"""
    
    def __init__(self, db_manager: DatabaseManager, parent=None):
        super().__init__(parent)
        
        self._db = db_manager
        self._rules_engine = RulesEngine()
        self._state_machine = StateMachine()
        self._current_specimen_id: Optional[int] = None
        
        self._setup_ui()
        self._setup_menu()
        self._setup_toolbar()
        self._setup_timers()
        
        self.refresh_data()
    
    def _setup_ui(self):
        self.setWindowTitle("标本流转防错台")
        self.setMinimumSize(1400, 900)
        
        central = QWidget()
        self.setCentralWidget(central)
        
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)
        
        main_layout.addWidget(self._create_top_bar())
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 0, 0)
        left_layout.setSpacing(5)
        
        self._specimen_table = SpecimenTableWidget()
        self._specimen_table.specimen_selected.connect(self._on_specimen_selected)
        left_layout.addWidget(QLabel("标本列表:"))
        left_layout.addWidget(self._specimen_table)
        
        self._status_panel = StatusPanelWidget()
        left_layout.addWidget(self._status_panel)
        
        splitter.addWidget(left_widget)
        
        right_tabs = QTabWidget()
        
        timeline_tab = QWidget()
        timeline_layout = QVBoxLayout(timeline_tab)
        timeline_layout.setContentsMargins(5, 5, 5, 5)
        self._timeline_widget = TimelineWidget()
        timeline_layout.addWidget(QLabel("标本时间线:"))
        timeline_layout.addWidget(self._timeline_widget)
        right_tabs.addTab(timeline_tab, "时间线")
        
        anomaly_tab = QWidget()
        anomaly_layout = QVBoxLayout(anomaly_tab)
        anomaly_layout.setContentsMargins(5, 5, 5, 5)
        self._anomaly_table = AnomalyTableWidget()
        anomaly_layout.addWidget(QLabel("异常清单:"))
        anomaly_layout.addWidget(self._anomaly_table)
        right_tabs.addTab(anomaly_tab, "异常清单")
        
        detail_tab = QWidget()
        detail_layout = QVBoxLayout(detail_tab)
        detail_layout.setContentsMargins(5, 5, 5, 5)
        self._detail_text = QTextEdit()
        self._detail_text.setReadOnly(True)
        detail_layout.addWidget(QLabel("标本详情:"))
        detail_layout.addWidget(self._detail_text)
        right_tabs.addTab(detail_tab, "详情")
        
        splitter.addWidget(right_tabs)
        
        splitter.setSizes([800, 600])
        
        main_layout.addWidget(splitter, 1)
        
        self._status_bar = QStatusBar()
        self.setStatusBar(self._status_bar)
        self._status_bar.showMessage("就绪")
    
    def _create_top_bar(self) -> QWidget:
        bar = QWidget()
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(0, 0, 0, 0)
        
        scan_label = QLabel("扫码/输入标本号:")
        layout.addWidget(scan_label)
        
        self._scan_input = QLineEdit()
        self._scan_input.setPlaceholderText("扫描条码或输入标本号...")
        self._scan_input.setMinimumWidth(200)
        self._scan_input.returnPressed.connect(self._on_scan_enter)
        layout.addWidget(self._scan_input)
        
        scan_btn = QPushButton("登记")
        scan_btn.clicked.connect(self._on_register_clicked)
        layout.addWidget(scan_btn)
        
        layout.addSpacing(20)
        
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.refresh_data)
        layout.addWidget(refresh_btn)
        
        layout.addStretch()
        
        self._clock_label = QLabel()
        clock_font = self._clock_label.font()
        clock_font.setBold(True)
        self._clock_label.setFont(clock_font)
        layout.addWidget(self._clock_label)
        
        return bar
    
    def _setup_menu(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        import_csv_action = QAction("导入申请单CSV...", self)
        import_csv_action.triggered.connect(self._import_csv)
        file_menu.addAction(import_csv_action)
        
        file_menu.addSeparator()
        
        export_md_action = QAction("导出交接班Markdown...", self)
        export_md_action.triggered.connect(self._export_handover)
        file_menu.addAction(export_md_action)
        
        export_csv_action = QAction("导出异常表CSV...", self)
        export_csv_action.triggered.connect(self._export_anomalies_csv)
        file_menu.addAction(export_csv_action)
        
        export_json_action = QAction("导出审计包JSON...", self)
        export_json_action.triggered.connect(self._export_audit_json)
        file_menu.addAction(export_json_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        data_menu = menubar.addMenu("数据(&D)")
        
        sample_action = QAction("导入示例数据", self)
        sample_action.triggered.connect(self._load_sample_data)
        data_menu.addAction(sample_action)
        
        clear_action = QAction("清空所有数据", self)
        clear_action.triggered.connect(self._clear_all_data)
        data_menu.addAction(clear_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        about_action = QAction("关于", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _setup_toolbar(self):
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        register_action = QAction("登记标本", self)
        register_action.triggered.connect(self._on_register_clicked)
        toolbar.addAction(register_action)
        
        toolbar.addSeparator()
        
        photo_action = QAction("拍照确认", self)
        photo_action.triggered.connect(self._on_photo_confirm)
        toolbar.addAction(photo_action)
        
        review_action = QAction("复核签名", self)
        review_action.triggered.connect(self._on_review_clicked)
        toolbar.addAction(review_action)
        
        release_action = QAction("放行", self)
        release_action.triggered.connect(self._on_release_clicked)
        toolbar.addAction(release_action)
        
        toolbar.addSeparator()
        
        delay_action = QAction("标记延迟", self)
        delay_action.triggered.connect(self._on_delay_clicked)
        toolbar.addAction(delay_action)
        
        phone_action = QAction("电话备注", self)
        phone_action.triggered.connect(self._on_phone_remark)
        toolbar.addAction(phone_action)
    
    def _setup_timers(self):
        self._clock_timer = QTimer(self)
        self._clock_timer.timeout.connect(self._update_clock)
        self._clock_timer.start(1000)
        self._update_clock()
        
        self._refresh_timer = QTimer(self)
        self._refresh_timer.timeout.connect(self._periodic_refresh)
        self._refresh_timer.start(30000)
    
    def _update_clock(self):
        now = datetime.now()
        self._clock_label.setText(now.strftime("%Y-%m-%d %H:%M:%S"))
    
    def _periodic_refresh(self):
        self._check_anomalies()
    
    def refresh_data(self):
        specimens = self._db.get_all_specimens(include_released=False)
        self._specimen_table.set_specimens(specimens)
        
        specimens_dict = {s.id: s for s in specimens if s.id}
        
        anomalies = self._rules_engine.validate_all(specimens)
        
        for anomaly in anomalies:
            if anomaly.specimen_id and anomaly.specimen_id not in [a.specimen_id for a in self._db.get_unresolved_anomalies()]:
                self._db.save_anomaly(anomaly)
        
        unresolved_anomalies = self._db.get_unresolved_anomalies()
        self._anomaly_table.set_anomalies(unresolved_anomalies, specimens_dict)
        
        total_anomaly_count = len(anomalies) + len([a for a in unresolved_anomalies if not a.is_resolved])
        self._status_panel.update_counts(specimens, total_anomaly_count)
        
        if self._current_specimen_id:
            self._show_specimen_detail(self._current_specimen_id)
        
        self._status_bar.showMessage(f"已刷新 - 标本数: {len(specimens)}, 异常数: {total_anomaly_count}")
    
    def _check_anomalies(self):
        specimens = self._db.get_all_specimens(include_released=False)
        anomalies = self._rules_engine.validate_all(specimens)
        
        specimens_dict = {s.id: s for s in specimens if s.id}
        unresolved_anomalies = self._db.get_unresolved_anomalies()
        
        total_anomaly_count = len(anomalies) + len([a for a in unresolved_anomalies if not a.is_resolved])
        self._status_panel.update_counts(specimens, total_anomaly_count)
        self._anomaly_table.set_anomalies(unresolved_anomalies, specimens_dict)
        
        if total_anomaly_count > 0:
            self._status_bar.showMessage(f"检测到 {total_anomaly_count} 项异常")
    
    def _on_specimen_selected(self, specimen_id: int):
        self._current_specimen_id = specimen_id
        self._show_specimen_detail(specimen_id)
    
    def _show_specimen_detail(self, specimen_id: int):
        specimen = self._db.get_specimen_by_id(specimen_id)
        if not specimen:
            return
        
        events = self._db.get_events_by_specimen(specimen_id)
        self._timeline_widget.set_events(events)
        
        detail_lines = [
            "=== 标本基本信息 ===",
            "",
            f"标本号: {specimen.specimen_no}",
            f"患者姓名: {specimen.patient_name}",
            f"患者ID: {specimen.patient_id}",
            f"部位: {specimen.location or '-'}",
            f"标本类型: {specimen.specimen_type or '-'}",
            "",
            "=== 状态信息 ===",
            "",
            f"当前状态: {specimen.status.value}",
            f"紧急程度: {specimen.urgent_level}",
            f"登记时间: {specimen.registered_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "=== 材料核对 ===",
            "",
            f"照片数量: {specimen.photo_count} 张",
            f"标本袋: {'已收到' if specimen.has_specimen_bag else '未收到'}",
            f"申请单CSV: {'已收到' if specimen.has_csv else '未收到'}",
            "",
        ]
        
        if specimen.phone_remark:
            detail_lines.extend([
                "=== 术中电话备注 ===",
                "",
                specimen.phone_remark,
                "",
            ])
        
        if specimen.reviewed_by:
            detail_lines.extend([
                "=== 复核信息 ===",
                "",
                f"复核人: {specimen.reviewed_by}",
            ])
            if specimen.reviewed_at:
                detail_lines.append(f"复核时间: {specimen.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        
        self._detail_text.setText("\n".join(detail_lines))
    
    def _on_scan_enter(self):
        text = self._scan_input.text().strip()
        if not text:
            return
        
        specimen = self._db.get_specimen_by_no(text)
        if specimen:
            self._current_specimen_id = specimen.id
            self._show_specimen_detail(specimen.id)
            self._status_bar.showMessage(f"已找到标本: {text}")
        else:
            self._show_register_dialog(text)
        
        self._scan_input.clear()
    
    def _on_register_clicked(self):
        self._show_register_dialog("")
    
    def _show_register_dialog(self, initial_no: str):
        dialog = RegisterDialog(self._db, initial_no, self)
        if dialog.exec():
            self.refresh_data()
            self._status_bar.showMessage("标本登记成功")
    
    def _on_photo_confirm(self):
        if not self._current_specimen_id:
            QMessageBox.warning(self, "提示", "请先选择一个标本")
            return
        
        dialog = PhotoConfirmDialog(self._current_specimen_id, self._db, self)
        if dialog.exec():
            self.refresh_data()
    
    def _on_review_clicked(self):
        if not self._current_specimen_id:
            QMessageBox.warning(self, "提示", "请先选择一个标本")
            return
        
        specimen = self._db.get_specimen_by_id(self._current_specimen_id)
        if not specimen:
            return
        
        if specimen.status != SpecimenStatus.PENDING_REVIEW:
            QMessageBox.warning(self, "提示", "该标本不在待复核状态")
            return
        
        dialog = ReviewDialog(specimen, self._db, self)
        if dialog.exec():
            self.refresh_data()
            self._status_bar.showMessage("复核完成")
    
    def _on_release_clicked(self):
        if not self._current_specimen_id:
            QMessageBox.warning(self, "提示", "请先选择一个标本")
            return
        
        specimen = self._db.get_specimen_by_id(self._current_specimen_id)
        if not specimen:
            return
        
        if specimen.status != SpecimenStatus.REVIEWED:
            QMessageBox.warning(self, "提示", "该标本不在已复核状态，无法放行")
            return
        
        reply = QMessageBox.question(
            self, "确认放行",
            f"确认放行动标本 '{specimen.specimen_no}' ({specimen.patient_name})?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            try:
                event = self._state_machine.transition(
                    specimen, SpecimenStatus.RELEASED,
                    operator="值班员",
                    description="标本放行"
                )
                specimen.released_at = datetime.now()
                self._db.save_specimen(specimen)
                if specimen.id:
                    event.specimen_id = specimen.id
                    self._db.save_event(event)
                
                self.refresh_data()
                self._status_bar.showMessage(f"标本 {specimen.specimen_no} 已放行")
            except StateTransitionError as e:
                QMessageBox.critical(self, "错误", str(e))
    
    def _on_delay_clicked(self):
        if not self._current_specimen_id:
            QMessageBox.warning(self, "提示", "请先选择一个标本")
            return
        
        specimen = self._db.get_specimen_by_id(self._current_specimen_id)
        if not specimen:
            return
        
        dialog = DelayDialog(specimen, self._db, self._state_machine, self)
        if dialog.exec():
            self.refresh_data()
    
    def _on_phone_remark(self):
        if not self._current_specimen_id:
            QMessageBox.warning(self, "提示", "请先选择一个标本")
            return
        
        specimen = self._db.get_specimen_by_id(self._current_specimen_id)
        if not specimen:
            return
        
        dialog = PhoneRemarkDialog(specimen, self._db, self)
        if dialog.exec():
            self.refresh_data()
    
    def _import_csv(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择申请单CSV文件", "", "CSV文件 (*.csv)"
        )
        
        if not file_path:
            return
        
        importer = CsvImporter()
        specimens, patients = importer.import_from_file(file_path)
        
        if importer.errors:
            error_msg = "\n".join(importer.errors[:10])
            if len(importer.errors) > 10:
                error_msg += f"\n... 还有 {len(importer.errors) - 10} 项错误"
            QMessageBox.critical(self, "导入错误", error_msg)
            return
        
        if not specimens:
            QMessageBox.information(self, "提示", "没有可导入的数据")
            return
        
        for patient in patients:
            self._db.save_patient(patient)
        
        count = 0
        for specimen in specimens:
            existing = self._db.get_specimen_by_no(specimen.specimen_no)
            if not existing:
                self._db.save_specimen(specimen)
                count += 1
        
        self.refresh_data()
        QMessageBox.information(self, "导入成功", f"成功导入 {count} 条标本记录")
    
    def _export_handover(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存交接班记录", "", "Markdown文件 (*.md)"
        )
        
        if not file_path:
            return
        
        specimens = self._db.get_all_specimens(include_released=False)
        events_dict: Dict[int, List[SpecimenEvent]] = {}
        
        for specimen in specimens:
            if specimen.id:
                events_dict[specimen.id] = self._db.get_events_by_specimen(specimen.id)
        
        shift_info = {
            "交班时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "未完成标本数": str(len(specimens)),
        }
        
        exporter = MarkdownExporter()
        if exporter.export_handover(specimens, events_dict, file_path, shift_info):
            QMessageBox.information(self, "导出成功", f"已保存到: {file_path}")
        else:
            QMessageBox.critical(self, "导出失败", "导出文件时发生错误")
    
    def _export_anomalies_csv(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存异常表", "", "CSV文件 (*.csv)"
        )
        
        if not file_path:
            return
        
        anomalies = self._db.get_unresolved_anomalies()
        specimens = self._db.get_all_specimens(include_released=True)
        specimens_dict = {s.id: s for s in specimens if s.id}
        
        exporter = CsvExporter()
        if exporter.export_anomalies(anomalies, specimens_dict, file_path):
            QMessageBox.information(self, "导出成功", f"已保存到: {file_path}")
        else:
            QMessageBox.critical(self, "导出失败", "导出文件时发生错误")
    
    def _export_audit_json(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存审计包", "", "JSON文件 (*.json)"
        )
        
        if not file_path:
            return
        
        exporter = JsonExporter()
        if exporter.export_audit_package(self._db, file_path, include_all=True):
            QMessageBox.information(self, "导出成功", f"已保存到: {file_path}")
        else:
            QMessageBox.critical(self, "导出失败", "导出文件时发生错误")
    
    def _load_sample_data(self):
        reply = QMessageBox.question(
            self, "确认",
            "导入示例数据将添加一些测试标本，是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            patients, specimens = populate_database(self._db, patient_count=8)
            self.refresh_data()
            QMessageBox.information(
                self, "完成",
                f"已导入 {len(patients)} 位患者，{len(specimens)} 例标本"
            )
    
    def _clear_all_data(self):
        reply = QMessageBox.question(
            self, "确认删除",
            "此操作将清空所有标本数据，且无法恢复！是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            import os
            if os.path.exists(self._db.db_path):
                os.remove(self._db.db_path)
            self._db.initialize_database()
            self.refresh_data()
            self._status_bar.showMessage("数据已清空")
    
    def _show_about(self):
        QMessageBox.about(
            self, "关于标本流转防错台",
            "标本流转防错台 v1.0.0\n\n"
            "用于医院病理科冰冻切片值班员的标本追踪工具。\n\n"
            "功能特点:\n"
            "- 标本扫码/手工登记\n"
            "- 标本时间线追踪\n"
            "- 异常检测与提醒\n"
            "- 复核放行管理\n"
            "- 多格式数据导出"
        )
