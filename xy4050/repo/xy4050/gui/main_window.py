import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QSplitter, QListWidget, QListWidgetItem,
    QTableWidget, QTableWidgetItem, QTreeWidget, QTreeWidgetItem,
    QLabel, QPushButton, QComboBox, QLineEdit, QTextEdit,
    QGroupBox, QFrame, QMessageBox, QFileDialog, QHeaderView,
    QSpinBox, QDoubleSpinBox, QCheckBox, QRadioButton,
    QButtonGroup, QProgressBar, QStatusBar, QMenuBar, QToolBar,
    QSplitter, QMenu, QApplication, QDialog, QDialogButtonBox,
    QDateEdit, QTimeEdit, QDateTimeEdit, QFontComboBox,
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QSize
from PyQt6.QtGui import QAction, QIcon, QFont, QColor, QBrush

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import APP_NAME, APP_VERSION, ensure_data_dir
from models.drill import Drill, DrillStatus
from models.event import Event, MergeStatus
from models.risk_level import RiskLevel
from models.area import Area
from models.observer import Observer
from models.event_type import EventType
from importer.parser import CSVParser, JSONParser, RawEventRecord, ParseError
from importer.validator import EventValidator, ValidationResult, ValidationError
from importer.import_batch import ImportBatch, ImportStatus
from merger.time_offset import TimeOffsetManager, SourceOffset
from merger.event_merger import EventMerger, MergeResult, MergeGroup
from merger.duplicate_detector import DuplicateDetector, DuplicateCandidate
from detector.issue_detector import IssueDetector, Issue, IssueType, IssueSeverity, IssueStatus
from exporter.markdown_exporter import MarkdownExporter
from exporter.csv_exporter import CSVExporter
from exporter.json_exporter import JSONExporter
from persistence.database import get_db
from persistence.repository import (
    DrillRepository, EventRepository, AreaRepository, ObserverRepository,
    EventTypeRepository, ImportBatchRepository, IssueRepository,
    initialize_default_data,
)


class MainWindow(QMainWindow):
    current_drill_changed = pyqtSignal()
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_NAME} v{APP_VERSION}")
        self.setMinimumSize(1200, 800)
        
        ensure_data_dir()
        initialize_default_data()
        
        self._current_drill: Optional[Drill] = None
        self._events: List[Event] = []
        self._issues: List[Issue] = []
        self._import_batches: List[ImportBatch] = []
        self._time_offset_manager = TimeOffsetManager()
        self._area_names: Dict[str, str] = {}
        self._event_type_names: Dict[str, str] = {}
        self._observer_names: Dict[str, str] = {}
        
        self._load_reference_data()
        
        self._init_ui()
        self._init_menu_bar()
        self._init_tool_bar()
        self._init_status_bar()
        self._connect_signals()
        
        self._refresh_drill_list()
    
    def _load_reference_data(self):
        areas = AreaRepository().get_all()
        for area in areas:
            self._area_names[area.code] = area.name
        
        event_types = EventTypeRepository().get_all()
        for et in event_types:
            self._event_type_names[et.code] = et.name
        
        observers = ObserverRepository().get_all()
        for obs in observers:
            self._observer_names[obs.code] = obs.name
    
    def _init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        left_panel = self._create_left_panel()
        splitter.addWidget(left_panel)
        splitter.setStretchFactor(0, 1)
        
        right_panel = self._create_right_panel()
        splitter.addWidget(right_panel)
        splitter.setStretchFactor(1, 3)
    
    def _create_left_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        drill_group = QGroupBox("演练档案")
        drill_layout = QVBoxLayout(drill_group)
        
        drill_toolbar = QHBoxLayout()
        
        self._btn_new_drill = QPushButton("新建")
        self._btn_edit_drill = QPushButton("编辑")
        self._btn_delete_drill = QPushButton("删除")
        
        drill_toolbar.addWidget(self._btn_new_drill)
        drill_toolbar.addWidget(self._btn_edit_drill)
        drill_toolbar.addWidget(self._btn_delete_drill)
        drill_toolbar.addStretch()
        
        drill_layout.addLayout(drill_toolbar)
        
        self._drill_list = QListWidget()
        self._drill_list.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        drill_layout.addWidget(self._drill_list)
        
        layout.addWidget(drill_group)
        
        drill_info_group = QGroupBox("演练信息")
        drill_info_layout = QVBoxLayout(drill_info_group)
        
        self._drill_info_text = QTextEdit()
        self._drill_info_text.setReadOnly(True)
        self._drill_info_text.setMaximumHeight(150)
        drill_info_layout.addWidget(self._drill_info_text)
        
        layout.addWidget(drill_info_group)
        
        quick_stats_group = QGroupBox("快捷统计")
        quick_stats_layout = QVBoxLayout(quick_stats_group)
        
        self._stats_label = QLabel("选择一个演练查看统计")
        self._stats_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        quick_stats_layout.addWidget(self._stats_label)
        
        layout.addWidget(quick_stats_group)
        layout.addStretch()
        
        return panel
    
    def _create_right_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self._tab_widget = QTabWidget()
        
        self._tab_events = self._create_events_tab()
        self._tab_widget.addTab(self._tab_events, "事件时间线")
        
        self._tab_issues = self._create_issues_tab()
        self._tab_widget.addTab(self._tab_issues, "问题检测")
        
        self._tab_imports = self._create_imports_tab()
        self._tab_widget.addTab(self._tab_imports, "导入记录")
        
        self._tab_offsets = self._create_offsets_tab()
        self._tab_widget.addTab(self._tab_offsets, "时间偏移")
        
        layout.addWidget(self._tab_widget)
        
        return panel
    
    def _create_events_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._btn_import = QPushButton("导入记录")
        self._btn_detect_duplicates = QPushButton("检测重复")
        self._btn_merge = QPushButton("自动合并")
        self._btn_detect_issues = QPushButton("检测问题")
        self._btn_export_events = QPushButton("导出CSV")
        
        toolbar.addWidget(self._btn_import)
        toolbar.addWidget(self._btn_detect_duplicates)
        toolbar.addWidget(self._btn_merge)
        toolbar.addWidget(self._btn_detect_issues)
        toolbar.addWidget(self._btn_export_events)
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self._events_table = QTableWidget()
        self._events_table.setColumnCount(10)
        self._events_table.setHorizontalHeaderLabels([
            "ID", "时间", "来源", "区域", "事件类型", "风险", "描述", "照片", "备注", "状态"
        ])
        self._events_table.horizontalHeader().setStretchLastSection(True)
        self._events_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._events_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._events_table.setAlternatingRowColors(True)
        
        header = self._events_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(7, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(8, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(9, QHeaderView.ResizeMode.ResizeToContents)
        
        layout.addWidget(self._events_table)
        
        return widget
    
    def _create_issues_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._btn_refresh_issues = QPushButton("刷新问题")
        self._btn_resolve_issue = QPushButton("标记已解决")
        self._btn_ignore_issue = QPushButton("忽略")
        self._btn_export_report = QPushButton("导出报告")
        
        toolbar.addWidget(self._btn_refresh_issues)
        toolbar.addWidget(self._btn_resolve_issue)
        toolbar.addWidget(self._btn_ignore_issue)
        toolbar.addStretch()
        toolbar.addWidget(self._btn_export_report)
        
        layout.addLayout(toolbar)
        
        self._issues_table = QTableWidget()
        self._issues_table.setColumnCount(7)
        self._issues_table.setHorizontalHeaderLabels([
            "ID", "严重程度", "类型", "标题", "描述", "状态", "检测时间"
        ])
        self._issues_table.horizontalHeader().setStretchLastSection(True)
        self._issues_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._issues_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._issues_table.setAlternatingRowColors(True)
        
        header = self._issues_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.ResizeToContents)
        
        layout.addWidget(self._issues_table)
        
        return widget
    
    def _create_imports_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._btn_import_new = QPushButton("导入新文件")
        self._btn_view_invalid = QPushButton("查看无效记录")
        
        toolbar.addWidget(self._btn_import_new)
        toolbar.addWidget(self._btn_view_invalid)
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self._imports_table = QTableWidget()
        self._imports_table.setColumnCount(8)
        self._imports_table.setHorizontalHeaderLabels([
            "ID", "文件名", "来源", "总记录", "有效", "无效", "状态", "导入时间"
        ])
        self._imports_table.horizontalHeader().setStretchLastSection(True)
        self._imports_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._imports_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._imports_table.setAlternatingRowColors(True)
        
        header = self._imports_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(7, QHeaderView.ResizeMode.ResizeToContents)
        
        layout.addWidget(self._imports_table)
        
        return widget
    
    def _create_offsets_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(5, 5, 5, 5)
        
        toolbar = QHBoxLayout()
        
        self._btn_estimate_offsets = QPushButton("自动估算偏移")
        self._btn_apply_offsets = QPushButton("应用偏移到事件")
        
        toolbar.addWidget(self._btn_estimate_offsets)
        toolbar.addWidget(self._btn_apply_offsets)
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self._offsets_table = QTableWidget()
        self._offsets_table.setColumnCount(4)
        self._offsets_table.setHorizontalHeaderLabels([
            "来源", "偏移量(秒)", "是否手动", "置信度"
        ])
        self._offsets_table.horizontalHeader().setStretchLastSection(True)
        self._offsets_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._offsets_table.setAlternatingRowColors(True)
        
        header = self._offsets_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        
        layout.addWidget(self._offsets_table)
        
        help_label = QLabel(
            "提示: 时间偏移用于将不同来源的记录同步到统一时间线。\n"
            "正偏移表示该来源的时间需要提前，负偏移表示需要延后。"
        )
        help_label.setWordWrap(True)
        layout.addWidget(help_label)
        
        return widget
    
    def _init_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_drill_action = QAction("新建演练(&N)", self)
        new_drill_action.setShortcut("Ctrl+N")
        new_drill_action.triggered.connect(self._on_new_drill)
        file_menu.addAction(new_drill_action)
        
        file_menu.addSeparator()
        
        import_action = QAction("导入记录(&I)", self)
        import_action.setShortcut("Ctrl+I")
        import_action.triggered.connect(self._on_import)
        file_menu.addAction(import_action)
        
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_csv_action = QAction("导出CSV事件明细(&C)", self)
        export_csv_action.triggered.connect(self._on_export_csv)
        export_menu.addAction(export_csv_action)
        
        export_md_action = QAction("导出Markdown复盘报告(&M)", self)
        export_md_action.triggered.connect(self._on_export_markdown)
        export_menu.addAction(export_md_action)
        
        export_json_action = QAction("导出JSON完整档案(&J)", self)
        export_json_action.triggered.connect(self._on_export_json)
        export_menu.addAction(export_json_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        detect_duplicates_action = QAction("检测重复事件(&D)", self)
        detect_duplicates_action.triggered.connect(self._on_detect_duplicates)
        edit_menu.addAction(detect_duplicates_action)
        
        detect_issues_action = QAction("检测问题(&P)", self)
        detect_issues_action.triggered.connect(self._on_detect_issues)
        edit_menu.addAction(detect_issues_action)
        
        edit_menu.addSeparator()
        
        merge_action = QAction("自动合并(&M)", self)
        merge_action.triggered.connect(self._on_merge)
        edit_menu.addAction(merge_action)
        
        tools_menu = menubar.addMenu("工具(&T)")
        
        estimate_offsets_action = QAction("估算时间偏移(&O)", self)
        estimate_offsets_action.triggered.connect(self._on_estimate_offsets)
        tools_menu.addAction(estimate_offsets_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._on_about)
        help_menu.addAction(about_action)
    
    def _init_tool_bar(self):
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        toolbar.addAction("新建演练", self._on_new_drill)
        toolbar.addAction("导入", self._on_import)
        toolbar.addSeparator()
        toolbar.addAction("检测重复", self._on_detect_duplicates)
        toolbar.addAction("检测问题", self._on_detect_issues)
        toolbar.addSeparator()
        toolbar.addAction("导出报告", self._on_export_markdown)
    
    def _init_status_bar(self):
        self._status_bar = QStatusBar()
        self.setStatusBar(self._status_bar)
        self._status_bar.showMessage("就绪")
    
    def _connect_signals(self):
        self._drill_list.itemSelectionChanged.connect(self._on_drill_selected)
        
        self._btn_new_drill.clicked.connect(self._on_new_drill)
        self._btn_edit_drill.clicked.connect(self._on_edit_drill)
        self._btn_delete_drill.clicked.connect(self._on_delete_drill)
        
        self._btn_import.clicked.connect(self._on_import)
        self._btn_detect_duplicates.clicked.connect(self._on_detect_duplicates)
        self._btn_merge.clicked.connect(self._on_merge)
        self._btn_detect_issues.clicked.connect(self._on_detect_issues)
        self._btn_export_events.clicked.connect(self._on_export_csv)
        
        self._btn_refresh_issues.clicked.connect(self._on_detect_issues)
        self._btn_resolve_issue.clicked.connect(self._on_resolve_issue)
        self._btn_ignore_issue.clicked.connect(self._on_ignore_issue)
        self._btn_export_report.clicked.connect(self._on_export_markdown)
        
        self._btn_import_new.clicked.connect(self._on_import)
        self._btn_estimate_offsets.clicked.connect(self._on_estimate_offsets)
        self._btn_apply_offsets.clicked.connect(self._on_apply_offsets)
    
    def _refresh_drill_list(self):
        self._drill_list.clear()
        
        drills = DrillRepository().get_all()
        
        for drill in drills:
            item = QListWidgetItem(f"{drill.name} ({drill.code})")
            item.setData(Qt.ItemDataRole.UserRole, drill.id)
            
            status_text = str(drill.status)
            if drill.status == DrillStatus.DRAFT:
                item.setForeground(QBrush(QColor("#888888")))
            elif drill.status == DrillStatus.IN_REVIEWING:
                item.setForeground(QBrush(QColor("#0066CC")))
            elif drill.status == DrillStatus.COMPLETED:
                item.setForeground(QBrush(QColor("#009933")))
            
            self._drill_list.addItem(item)
        
        self._status_bar.showMessage(f"共 {len(drills)} 个演练档案")
    
    def _on_drill_selected(self):
        items = self._drill_list.selectedItems()
        if not items:
            self._current_drill = None
            self._clear_drill_details()
            return
        
        drill_id = items[0].data(Qt.ItemDataRole.UserRole)
        drill = DrillRepository().get_by_id(drill_id)
        
        if drill:
            self._current_drill = drill
            self._load_drill_data()
            self._update_drill_info()
    
    def _clear_drill_details(self):
        self._events_table.setRowCount(0)
        self._issues_table.setRowCount(0)
        self._imports_table.setRowCount(0)
        self._offsets_table.setRowCount(0)
        self._drill_info_text.clear()
        self._stats_label.setText("选择一个演练查看统计")
    
    def _load_drill_data(self):
        if not self._current_drill:
            return
        
        drill_id = self._current_drill.id
        
        self._events = EventRepository().get_by_drill(drill_id, only_valid=False)
        self._issues = IssueRepository().get_by_drill(drill_id, include_resolved=False)
        self._import_batches = ImportBatchRepository().get_by_drill(drill_id)
        
        self._refresh_events_table()
        self._refresh_issues_table()
        self._refresh_imports_table()
        self._refresh_offsets_table()
        
        self._update_stats()
    
    def _update_drill_info(self):
        if not self._current_drill:
            return
        
        info_lines = [
            f"名称: {self._current_drill.name}",
            f"编号: {self._current_drill.code}",
            f"类型: {self._current_drill.drill_type or '未指定'}",
            f"状态: {self._current_drill.status}",
            f"计划开始: {self._format_time(self._current_drill.planned_start_time)}",
            f"实际开始: {self._format_time(self._current_drill.actual_start_time)}",
            f"实际结束: {self._format_time(self._current_drill.actual_end_time)}",
        ]
        
        if self._current_drill.description:
            info_lines.append("")
            info_lines.append(f"描述: {self._current_drill.description}")
        
        self._drill_info_text.setText("\n".join(info_lines))
    
    def _update_stats(self):
        if not self._current_drill:
            return
        
        valid_events = sum(1 for e in self._events if e.is_valid)
        invalid_events = len(self._events) - valid_events
        
        stats_text = (
            f"事件: {valid_events} 有效 / {invalid_events} 无效\n"
            f"问题: {len(self._issues)} 个待处理\n"
            f"导入批次: {len(self._import_batches)} 个"
        )
        self._stats_label.setText(stats_text)
    
    def _format_time(self, dt) -> str:
        if dt is None:
            return "未设置"
        if isinstance(dt, str):
            return dt
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    
    def _refresh_events_table(self):
        self._events_table.setRowCount(0)
        
        valid_events = [e for e in self._events if e.is_valid]
        valid_events.sort(key=lambda e: e.unified_time or e.original_time or datetime.min)
        
        for event in valid_events:
            row = self._events_table.rowCount()
            self._events_table.insertRow(row)
            
            risk_color = self._get_risk_color(event.risk_level)
            
            self._events_table.setItem(row, 0, QTableWidgetItem(str(event.id or "")))
            self._events_table.setItem(row, 1, QTableWidgetItem(self._format_time_short(event.unified_time or event.original_time)))
            self._events_table.setItem(row, 2, QTableWidgetItem(event.source))
            self._events_table.setItem(row, 3, QTableWidgetItem(self._area_names.get(event.area_code, event.area_code)))
            self._events_table.setItem(row, 4, QTableWidgetItem(self._event_type_names.get(event.event_type_code, event.event_type_code)))
            
            risk_item = QTableWidgetItem(str(event.risk_level))
            risk_item.setBackground(QBrush(QColor(risk_color)))
            self._events_table.setItem(row, 5, risk_item)
            
            self._events_table.setItem(row, 6, QTableWidgetItem(event.description))
            self._events_table.setItem(row, 7, QTableWidgetItem(", ".join(event.photo_numbers) if event.photo_numbers else ""))
            self._events_table.setItem(row, 8, QTableWidgetItem(event.notes))
            self._events_table.setItem(row, 9, QTableWidgetItem(str(event.merge_status)))
    
    def _format_time_short(self, dt) -> str:
        if dt is None:
            return "--:--:--"
        if isinstance(dt, str):
            return dt
        return dt.strftime("%H:%M:%S")
    
    def _get_risk_color(self, risk_level) -> str:
        level_str = str(risk_level)
        if level_str == "紧急":
            return "#FF6B6B"
        elif level_str == "高":
            return "#FFB366"
        elif level_str == "中":
            return "#FFFF99"
        else:
            return "#CCFFCC"
    
    def _refresh_issues_table(self):
        self._issues_table.setRowCount(0)
        
        for issue in self._issues:
            row = self._issues_table.rowCount()
            self._issues_table.insertRow(row)
            
            severity_color = self._get_severity_color(issue.severity)
            
            self._issues_table.setItem(row, 0, QTableWidgetItem(str(issue.id or "")))
            
            severity_item = QTableWidgetItem(str(issue.severity))
            severity_item.setBackground(QBrush(QColor(severity_color)))
            self._issues_table.setItem(row, 1, severity_item)
            
            self._issues_table.setItem(row, 2, QTableWidgetItem(str(issue.issue_type)))
            self._issues_table.setItem(row, 3, QTableWidgetItem(issue.title))
            self._issues_table.setItem(row, 4, QTableWidgetItem(issue.description))
            self._issues_table.setItem(row, 5, QTableWidgetItem(str(issue.status)))
            self._issues_table.setItem(row, 6, QTableWidgetItem(self._format_time_short(issue.detected_at)))
    
    def _get_severity_color(self, severity) -> str:
        level_str = str(severity)
        if level_str == "严重":
            return "#FF6B6B"
        elif level_str == "高":
            return "#FFB366"
        elif level_str == "中":
            return "#FFFF99"
        else:
            return "#CCFFCC"
    
    def _refresh_imports_table(self):
        self._imports_table.setRowCount(0)
        
        for batch in self._import_batches:
            row = self._imports_table.rowCount()
            self._imports_table.insertRow(row)
            
            self._imports_table.setItem(row, 0, QTableWidgetItem(str(batch.id or "")))
            self._imports_table.setItem(row, 1, QTableWidgetItem(batch.file_name))
            self._imports_table.setItem(row, 2, QTableWidgetItem(batch.source_name or ""))
            self._imports_table.setItem(row, 3, QTableWidgetItem(str(batch.total_records)))
            self._imports_table.setItem(row, 4, QTableWidgetItem(str(batch.valid_records)))
            self._imports_table.setItem(row, 5, QTableWidgetItem(str(batch.invalid_records)))
            self._imports_table.setItem(row, 6, QTableWidgetItem(str(batch.status)))
            self._imports_table.setItem(row, 7, QTableWidgetItem(self._format_time_short(batch.imported_at)))
    
    def _refresh_offsets_table(self):
        self._offsets_table.setRowCount(0)
        
        offsets = self._time_offset_manager.get_all_offsets()
        
        for source, offset_info in offsets.items():
            row = self._offsets_table.rowCount()
            self._offsets_table.insertRow(row)
            
            self._offsets_table.setItem(row, 0, QTableWidgetItem(source))
            self._offsets_table.setItem(row, 1, QTableWidgetItem(str(offset_info.offset_seconds)))
            self._offsets_table.setItem(row, 2, QTableWidgetItem("是" if offset_info.is_manual else "否"))
            self._offsets_table.setItem(row, 3, QTableWidgetItem(f"{offset_info.confidence:.2f}"))
    
    def _on_new_drill(self):
        from gui.drill_dialog import DrillDialog
        dialog = DrillDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            drill = dialog.get_drill()
            DrillRepository().create(drill)
            self._refresh_drill_list()
            self._status_bar.showMessage(f"演练 '{drill.name}' 创建成功")
    
    def _on_edit_drill(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        from gui.drill_dialog import DrillDialog
        dialog = DrillDialog(self, self._current_drill)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            drill = dialog.get_drill()
            DrillRepository().update(drill)
            self._current_drill = drill
            self._update_drill_info()
            self._refresh_drill_list()
            self._status_bar.showMessage(f"演练 '{drill.name}' 更新成功")
    
    def _on_delete_drill(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除演练 '{self._current_drill.name}' 吗？\n"
            f"这将同时删除所有相关的事件记录和问题报告。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            drill_id = self._current_drill.id
            IssueRepository().delete_by_drill(drill_id)
            DrillRepository().delete(drill_id)
            
            self._current_drill = None
            self._clear_drill_details()
            self._refresh_drill_list()
            self._status_bar.showMessage("演练删除成功")
    
    def _on_import(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        from gui.import_dialog import ImportDialog
        dialog = ImportDialog(self, self._current_drill)
        
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._load_drill_data()
            self._status_bar.showMessage("导入完成")
    
    def _on_detect_duplicates(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        valid_events = [e for e in self._events if e.is_valid]
        
        if len(valid_events) < 2:
            QMessageBox.information(self, "提示", "有效事件不足，无法检测重复")
            return
        
        detector = DuplicateDetector()
        candidates = detector.detect_duplicates(valid_events)
        
        if candidates:
            QMessageBox.information(
                self, "检测结果",
                f"检测到 {len(candidates)} 组潜在的重复事件。\n"
                f"请在事件列表中查看详细信息。"
            )
            self._status_bar.showMessage(f"检测到 {len(candidates)} 组潜在重复事件")
        else:
            QMessageBox.information(self, "检测结果", "未检测到明显的重复事件")
            self._status_bar.showMessage("未检测到重复事件")
    
    def _on_merge(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        valid_events = [e for e in self._events if e.is_valid]
        
        if len(valid_events) < 2:
            QMessageBox.information(self, "提示", "有效事件不足，无法进行合并")
            return
        
        merger = EventMerger(self._time_offset_manager)
        result = merger.merge_events(valid_events)
        
        QMessageBox.information(
            self, "合并结果",
            f"共 {result.total_events} 个事件\n"
            f"合并为 {len(result.groups)} 个分组\n"
            f"检测到 {result.duplicate_count} 组潜在重复"
        )
        self._status_bar.showMessage(f"合并完成: {result.total_events} 事件 -> {len(result.groups)} 分组")
    
    def _on_detect_issues(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        valid_events = [e for e in self._events if e.is_valid]
        
        if not valid_events:
            QMessageBox.information(self, "提示", "没有有效事件可检测")
            return
        
        IssueRepository().delete_by_drill(self._current_drill.id)
        
        detector = IssueDetector()
        result = detector.detect_all(valid_events)
        
        for issue in result.issues:
            issue.drill_id = self._current_drill.id
            IssueRepository().create(issue)
        
        self._issues = result.issues
        self._refresh_issues_table()
        self._update_stats()
        
        QMessageBox.information(
            self, "检测完成",
            f"检测到 {result.total_issues} 个问题:\n"
            f"  - 严重: {result.critical_count}\n"
            f"  - 高: {result.high_count}\n"
            f"  - 中: {result.medium_count}\n"
            f"  - 低: {result.low_count}"
        )
        self._status_bar.showMessage(f"检测到 {result.total_issues} 个问题")
    
    def _on_resolve_issue(self):
        rows = self._issues_table.selectedItems()
        if not rows:
            QMessageBox.warning(self, "提示", "请先选择一个问题")
            return
        
        row = self._issues_table.currentRow()
        if row < 0 or row >= len(self._issues):
            return
        
        issue = self._issues[row]
        issue.status = IssueStatus.RESOLVED
        issue.resolved_at = datetime.now()
        
        IssueRepository().update(issue)
        
        self._load_drill_data()
        self._status_bar.showMessage("问题已标记为已解决")
    
    def _on_ignore_issue(self):
        rows = self._issues_table.selectedItems()
        if not rows:
            QMessageBox.warning(self, "提示", "请先选择一个问题")
            return
        
        row = self._issues_table.currentRow()
        if row < 0 or row >= len(self._issues):
            return
        
        issue = self._issues[row]
        issue.status = IssueStatus.IGNORED
        
        IssueRepository().update(issue)
        
        self._load_drill_data()
        self._status_bar.showMessage("问题已标记为已忽略")
    
    def _on_estimate_offsets(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        valid_events = [e for e in self._events if e.is_valid]
        
        if not valid_events:
            QMessageBox.information(self, "提示", "没有有效事件可用于估算偏移")
            return
        
        events_by_source: Dict[str, List] = {}
        for event in valid_events:
            source = event.source or "UNKNOWN"
            if source not in events_by_source:
                events_by_source[source] = []
            events_by_source[source].append(event)
        
        if len(events_by_source) < 2:
            QMessageBox.information(self, "提示", "需要至少两个不同来源的事件才能估算偏移")
            return
        
        self._time_offset_manager.estimate_offset_by_anchor_events(
            events_by_source,
            ['ALARM_START', 'EVAC_START', 'DRILL_END']
        )
        
        self._refresh_offsets_table()
        
        offsets = self._time_offset_manager.get_all_offsets()
        if offsets:
            QMessageBox.information(
                self, "估算完成",
                f"已估算 {len(offsets)} 个来源的时间偏移\n"
                f"请在时间偏移选项卡中查看详细信息"
            )
            self._status_bar.showMessage(f"已估算 {len(offsets)} 个来源的时间偏移")
        else:
            QMessageBox.information(self, "提示", "无法估算时间偏移，缺少共同的锚点事件")
    
    def _on_apply_offsets(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        offsets = self._time_offset_manager.get_all_offsets()
        if not offsets:
            QMessageBox.information(self, "提示", "没有时间偏移需要应用")
            return
        
        count = 0
        for event in self._events:
            if event.source in offsets:
                offset = offsets[event.source].offset_seconds
                if event.time_offset_seconds != offset:
                    event.time_offset_seconds = offset
                    EventRepository().update(event)
                    count += 1
        
        self._load_drill_data()
        
        QMessageBox.information(self, "应用完成", f"已更新 {count} 个事件的时间偏移")
        self._status_bar.showMessage(f"已更新 {count} 个事件的时间偏移")
    
    def _on_export_csv(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        if not self._events:
            QMessageBox.information(self, "提示", "没有事件可导出")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出CSV文件",
            f"{self._current_drill.name}_事件明细.csv",
            "CSV文件 (*.csv)"
        )
        
        if file_path:
            exporter = CSVExporter()
            exporter.set_area_names(self._area_names)
            exporter.set_event_type_names(self._event_type_names)
            exporter.export_events(self._events, file_path)
            
            QMessageBox.information(self, "导出成功", f"CSV文件已保存到:\n{file_path}")
            self._status_bar.showMessage(f"导出成功: {file_path}")
    
    def _on_export_markdown(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出Markdown报告",
            f"{self._current_drill.name}_复盘报告.md",
            "Markdown文件 (*.md)"
        )
        
        if file_path:
            exporter = MarkdownExporter()
            exporter.set_area_names(self._area_names)
            exporter.set_event_type_names(self._event_type_names)
            
            offsets = self._time_offset_manager.get_all_offsets()
            offset_dict = {k: v.offset_seconds for k, v in offsets.items()}
            
            exporter.export(
                drill=self._current_drill,
                events=self._events,
                issues=self._issues,
                import_batches=self._import_batches,
                time_offsets=offset_dict,
                output_path=file_path
            )
            
            QMessageBox.information(self, "导出成功", f"Markdown报告已保存到:\n{file_path}")
            self._status_bar.showMessage(f"导出成功: {file_path}")
    
    def _on_export_json(self):
        if not self._current_drill:
            QMessageBox.warning(self, "提示", "请先选择一个演练")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出JSON档案",
            f"{self._current_drill.name}_完整档案.json",
            "JSON文件 (*.json)"
        )
        
        if file_path:
            exporter = JSONExporter()
            
            areas = AreaRepository().get_all()
            event_types = EventTypeRepository().get_all()
            observers = ObserverRepository().get_all()
            
            offsets = self._time_offset_manager.get_all_offsets()
            offset_dict = {k: v.offset_seconds for k, v in offsets.items()}
            
            exporter.export_drill_archive(
                drill=self._current_drill,
                events=self._events,
                issues=self._issues,
                import_batches=self._import_batches,
                time_offsets=offset_dict,
                areas=areas,
                event_types=event_types,
                observers=observers,
                output_path=file_path
            )
            
            QMessageBox.information(self, "导出成功", f"JSON档案已保存到:\n{file_path}")
            self._status_bar.showMessage(f"导出成功: {file_path}")
    
    def _on_about(self):
        QMessageBox.about(
            self, "关于",
            f"{APP_NAME} v{APP_VERSION}\n\n"
            f"应急演练观察合并台\n"
            f"用于整合和分析消防疏散、反恐演练等应急事件记录。\n\n"
            f"功能特点:\n"
            f"- 多源数据导入 (CSV/JSON)\n"
            f"- 智能数据校验\n"
            f"- 时间偏移校准\n"
            f"- 重复事件检测\n"
            f"- 问题自动检测\n"
            f"- 多格式导出"
        )
    
    def closeEvent(self, event):
        get_db().close()
        event.accept()
