import os
import sys
from datetime import datetime
from typing import Optional, List, Dict, Any
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QListWidget, QListWidgetItem,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QSplitter, QTabWidget, QMessageBox, QFileDialog,
    QInputDialog, QDialog, QCheckBox, QSpinBox, QDoubleSpinBox,
    QTextEdit, QProgressDialog, QGroupBox, QFrame,
    QSlider, QComboBox, QLineEdit, QStatusBar
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont, QColor, QBrush

from models.database import (
    DatabaseManager, Project, MarkStatus, RiskLevel, RuleType, SensitiveHit
)
from core import (
    TranscriptionParser, ParseResult, SensitiveRuleEngine,
    AudioHandler, AudioInfo, ExportHandler, ExportItem
)


class MainWindow(QMainWindow):
    
    def __init__(self):
        super().__init__()
        
        self.db_manager = DatabaseManager()
        self.audio_handler = AudioHandler()
        self.rule_engine = SensitiveRuleEngine()
        
        self.current_project: Optional[Project] = None
        self.current_hits: List[SensitiveHit] = []
        self.current_segments: List[Dict] = []
        
        self.play_timer = QTimer()
        self.play_timer.timeout.connect(self._update_playback)
        
        self._init_ui()
        self._load_projects()
    
    def _init_ui(self):
        self.setWindowTitle("口播脱敏剪刀 v1.0.0")
        self.setMinimumSize(1400, 900)
        self.resize(1600, 1000)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        
        header_layout = QHBoxLayout()
        
        title_label = QLabel("✂️ 口播脱敏剪刀")
        title_font = QFont()
        title_font.setBold(True)
        title_font.setPointSize(16)
        title_label.setFont(title_font)
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        self.new_project_btn = QPushButton("新建项目")
        self.new_project_btn.clicked.connect(self._create_new_project)
        header_layout.addWidget(self.new_project_btn)
        
        self.open_project_btn = QPushButton("打开项目")
        self.open_project_btn.clicked.connect(self._open_selected_project)
        header_layout.addWidget(self.open_project_btn)
        
        self.delete_project_btn = QPushButton("删除项目")
        self.delete_project_btn.clicked.connect(self._delete_selected_project)
        header_layout.addWidget(self.delete_project_btn)
        
        main_layout.addLayout(header_layout)
        
        main_splitter = QSplitter(Qt.Orientation.Horizontal)
        
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(5, 5, 5, 5)
        
        project_label = QLabel("📁 项目列表")
        project_font = QFont()
        project_font.setBold(True)
        project_label.setFont(project_font)
        left_layout.addWidget(project_label)
        
        self.project_list = QListWidget()
        self.project_list.itemDoubleClicked.connect(self._open_selected_project)
        left_layout.addWidget(self.project_list)
        
        main_splitter.addWidget(left_panel)
        
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(5, 5, 5, 5)
        
        self.tabs = QTabWidget()
        
        self._create_project_tab()
        self._create_import_tab()
        self._create_scan_tab()
        self._create_review_tab()
        self._create_export_tab()
        
        right_layout.addWidget(self.tabs)
        
        main_splitter.addWidget(right_panel)
        
        main_splitter.setSizes([300, 1200])
        main_layout.addWidget(main_splitter)
        
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
    
    def _create_project_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(20, 20, 20, 20)
        
        info_group = QGroupBox("项目信息")
        info_layout = QVBoxLayout(info_group)
        
        self.project_name_label = QLabel("名称: -")
        self.project_desc_label = QLabel("描述: -")
        self.project_created_label = QLabel("创建时间: -")
        self.project_updated_label = QLabel("更新时间: -")
        
        info_layout.addWidget(self.project_name_label)
        info_layout.addWidget(self.project_desc_label)
        info_layout.addWidget(self.project_created_label)
        info_layout.addWidget(self.project_updated_label)
        
        layout.addWidget(info_group)
        
        media_group = QGroupBox("媒体文件")
        media_layout = QVBoxLayout(media_group)
        
        audio_row = QHBoxLayout()
        self.audio_path_label = QLabel("音频文件: 未加载")
        audio_row.addWidget(self.audio_path_label)
        audio_row.addStretch()
        
        self.load_audio_btn = QPushButton("加载音频")
        self.load_audio_btn.clicked.connect(self._load_audio_file)
        self.load_audio_btn.setEnabled(False)
        audio_row.addWidget(self.load_audio_btn)
        
        media_layout.addLayout(audio_row)
        
        self.audio_info_label = QLabel("音频信息: -")
        media_layout.addWidget(self.audio_info_label)
        
        transcription_row = QHBoxLayout()
        self.transcription_path_label = QLabel("转写文件: 未加载")
        transcription_row.addWidget(self.transcription_path_label)
        transcription_row.addStretch()
        
        self.load_transcription_btn = QPushButton("加载转写")
        self.load_transcription_btn.clicked.connect(self._load_transcription_file)
        self.load_transcription_btn.setEnabled(False)
        transcription_row.addWidget(self.load_transcription_btn)
        
        media_layout.addLayout(transcription_row)
        
        self.segments_count_label = QLabel("已解析片段数: 0")
        media_layout.addWidget(self.segments_count_label)
        
        layout.addWidget(media_group)
        layout.addStretch()
        
        self.tabs.addTab(tab, "📋 项目")
    
    def _create_import_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(20, 20, 20, 20)
        
        help_label = QLabel(
            "在「项目」标签页中加载音频和转写文件后，系统会自动解析时间轴。\n"
            "支持的格式:\n"
            "• 音频: MP3, WAV\n"
            "• 转写: SRT, JSON"
        )
        help_label.setStyleSheet("color: #666; padding: 10px;")
        layout.addWidget(help_label)
        
        self.import_preview_table = QTableWidget()
        self.import_preview_table.setColumnCount(4)
        self.import_preview_table.setHorizontalHeaderLabels([
            "开始时间", "结束时间", "时长", "文本预览"
        ])
        self.import_preview_table.horizontalHeader().setStretchLastSection(True)
        self.import_preview_table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.ResizeToContents
        )
        
        layout.addWidget(self.import_preview_table)
        
        self.import_warnings_label = QLabel("")
        self.import_warnings_label.setStyleSheet("color: #f57c00;")
        layout.addWidget(self.import_warnings_label)
        
        self.tabs.addTab(tab, "📥 导入预览")
    
    def _create_scan_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(20, 20, 20, 20)
        
        scan_settings_group = QGroupBox("扫描设置")
        scan_settings_layout = QHBoxLayout(scan_settings_group)
        
        self.scan_btn = QPushButton("🔍 开始扫描敏感内容")
        self.scan_btn.clicked.connect(self._run_scan)
        self.scan_btn.setEnabled(False)
        self.scan_btn.setMinimumHeight(50)
        scan_btn_font = QFont()
        scan_btn_font.setBold(True)
        scan_btn_font.setPointSize(12)
        self.scan_btn.setFont(scan_btn_font)
        scan_settings_layout.addWidget(self.scan_btn)
        
        scan_settings_layout.addStretch()
        
        self.manage_rules_btn = QPushButton("管理自定义规则")
        self.manage_rules_btn.clicked.connect(self._manage_rules)
        scan_settings_layout.addWidget(self.manage_rules_btn)
        
        layout.addWidget(scan_settings_group)
        
        scan_results_group = QGroupBox("扫描结果")
        scan_results_layout = QVBoxLayout(scan_results_group)
        
        scan_stats_row = QHBoxLayout()
        self.scan_stats_label = QLabel("高风险: 0 | 中风险: 0 | 低风险: 0 | 总计: 0")
        scan_stats_font = QFont()
        scan_stats_font.setBold(True)
        self.scan_stats_label.setFont(scan_stats_font)
        scan_stats_row.addWidget(self.scan_stats_label)
        scan_stats_row.addStretch()
        scan_results_layout.addLayout(scan_stats_row)
        
        self.scan_results_table = QTableWidget()
        self._setup_hit_table(self.scan_results_table)
        scan_results_layout.addWidget(self.scan_results_table)
        
        layout.addWidget(scan_results_group)
        
        self.tabs.addTab(tab, "🔍 扫描")
    
    def _create_review_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(10, 10, 10, 10)
        
        main_split = QSplitter(Qt.Orientation.Horizontal)
        
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        player_group = QGroupBox("播放器控制")
        player_layout = QVBoxLayout(player_group)
        
        time_row = QHBoxLayout()
        self.current_time_label = QLabel("00:00.000")
        time_row.addWidget(self.current_time_label)
        
        self.time_slider = QSlider(Qt.Orientation.Horizontal)
        self.time_slider.setMinimum(0)
        self.time_slider.setMaximum(1000)
        self.time_slider.setValue(0)
        self.time_slider.setEnabled(False)
        self.time_slider.sliderPressed.connect(self._slider_pressed)
        self.time_slider.sliderReleased.connect(self._slider_released)
        self.time_slider.sliderMoved.connect(self._slider_moved)
        time_row.addWidget(self.time_slider)
        
        self.total_time_label = QLabel("00:00.000")
        time_row.addWidget(self.total_time_label)
        
        player_layout.addLayout(time_row)
        
        controls_row = QHBoxLayout()
        
        self.play_pause_btn = QPushButton("▶ 播放")
        self.play_pause_btn.clicked.connect(self._toggle_play_pause)
        self.play_pause_btn.setEnabled(False)
        controls_row.addWidget(self.play_pause_btn)
        
        self.stop_btn = QPushButton("⏹ 停止")
        self.stop_btn.clicked.connect(self._stop_playback)
        self.stop_btn.setEnabled(False)
        controls_row.addWidget(self.stop_btn)
        
        controls_row.addStretch()
        
        self.add_manual_hit_btn = QPushButton("➕ 手动添加片段")
        self.add_manual_hit_btn.clicked.connect(self._add_manual_hit)
        controls_row.addWidget(self.add_manual_hit_btn)
        
        player_layout.addLayout(controls_row)
        
        left_layout.addWidget(player_group)
        
        hit_detail_group = QGroupBox("命中详情")
        hit_detail_layout = QVBoxLayout(hit_detail_group)
        
        detail_labels = [
            ("规则类型:", "rule_type"),
            ("规则名称:", "rule_name"),
            ("时间范围:", "time_range"),
            ("风险等级:", "risk_level"),
        ]
        
        for label_text, _ in detail_labels:
            row = QHBoxLayout()
            label = QLabel(label_text)
            label.setMinimumWidth(80)
            row.addWidget(label)
            
            value_label = QLabel("-")
            value_label.setObjectName(f"detail_{_}")
            row.addWidget(value_label, 1)
            hit_detail_layout.addLayout(row)
        
        matched_row = QHBoxLayout()
        matched_label = QLabel("匹配文本:")
        matched_label.setMinimumWidth(80)
        matched_row.addWidget(matched_label)
        self.detail_matched_text = QTextEdit()
        self.detail_matched_text.setMaximumHeight(60)
        self.detail_matched_text.setReadOnly(True)
        matched_row.addWidget(self.detail_matched_text, 1)
        hit_detail_layout.addLayout(matched_row)
        
        context_row = QHBoxLayout()
        context_label = QLabel("上下文:")
        context_label.setMinimumWidth(80)
        context_row.addWidget(context_label)
        self.detail_context = QTextEdit()
        self.detail_context.setMaximumHeight(80)
        self.detail_context.setReadOnly(True)
        context_row.addWidget(self.detail_context, 1)
        hit_detail_layout.addLayout(context_row)
        
        mark_row = QHBoxLayout()
        mark_label = QLabel("标记状态:")
        mark_label.setMinimumWidth(80)
        mark_row.addWidget(mark_label)
        
        self.mark_combo = QComboBox()
        self.mark_combo.addItems([
            "需要复核", "保留", "静音", "哔声"
        ])
        self.mark_combo.setEnabled(False)
        mark_row.addWidget(self.mark_combo)
        
        self.apply_mark_btn = QPushButton("应用")
        self.apply_mark_btn.clicked.connect(self._apply_mark)
        self.apply_mark_btn.setEnabled(False)
        mark_row.addWidget(self.apply_mark_btn)
        
        mark_row.addStretch()
        hit_detail_layout.addLayout(mark_row)
        
        note_row = QHBoxLayout()
        note_label = QLabel("备注:")
        note_label.setMinimumWidth(80)
        note_row.addWidget(note_label)
        self.detail_note = QTextEdit()
        self.detail_note.setMaximumHeight(50)
        note_row.addWidget(self.detail_note, 1)
        hit_detail_layout.addLayout(note_row)
        
        left_layout.addWidget(hit_detail_group)
        
        main_split.addWidget(left_panel)
        
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        hits_group = QGroupBox("敏感命中列表 (双击跳转到对应时间)")
        hits_layout = QVBoxLayout(hits_group)
        
        filter_row = QHBoxLayout()
        filter_label = QLabel("筛选:")
        filter_row.addWidget(filter_label)
        
        self.filter_risk_combo = QComboBox()
        self.filter_risk_combo.addItems([
            "全部", "高风险", "中风险", "低风险"
        ])
        self.filter_risk_combo.currentIndexChanged.connect(self._filter_hits)
        filter_row.addWidget(self.filter_risk_combo)
        
        self.filter_status_combo = QComboBox()
        self.filter_status_combo.addItems([
            "全部状态", "需要复核", "保留", "静音", "哔声"
        ])
        self.filter_status_combo.currentIndexChanged.connect(self._filter_hits)
        filter_row.addWidget(self.filter_status_combo)
        
        filter_row.addStretch()
        
        self.jump_to_hit_btn = QPushButton("跳转到选中项")
        self.jump_to_hit_btn.clicked.connect(self._jump_to_selected_hit)
        filter_row.addWidget(self.jump_to_hit_btn)
        
        hits_layout.addLayout(filter_row)
        
        self.review_hits_table = QTableWidget()
        self._setup_hit_table(self.review_hits_table, show_details=True)
        self.review_hits_table.itemDoubleClicked.connect(self._on_hit_double_clicked)
        self.review_hits_table.itemSelectionChanged.connect(self._on_hit_selection_changed)
        hits_layout.addWidget(self.review_hits_table)
        
        right_layout.addWidget(hits_group)
        
        main_split.addWidget(right_panel)
        
        main_split.setSizes([450, 750])
        layout.addWidget(main_split)
        
        self.tabs.addTab(tab, "🎵 复核与播放")
    
    def _create_export_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(20, 20, 20, 20)
        
        export_settings_group = QGroupBox("导出设置")
        export_settings_layout = QVBoxLayout(export_settings_group)
        
        output_row = QHBoxLayout()
        output_label = QLabel("输出目录:")
        output_row.addWidget(output_label)
        
        self.output_path_edit = QLineEdit()
        self.output_path_edit.setPlaceholderText("选择导出文件的保存目录...")
        output_row.addWidget(self.output_path_edit, 1)
        
        self.browse_output_btn = QPushButton("浏览...")
        self.browse_output_btn.clicked.connect(self._browse_output_dir)
        output_row.addWidget(self.browse_output_btn)
        
        export_settings_layout.addLayout(output_row)
        
        options_row = QHBoxLayout()
        
        self.overwrite_check = QCheckBox("覆盖已存在的文件")
        options_row.addWidget(self.overwrite_check)
        
        self.export_audio_check = QCheckBox("导出脱敏音频")
        self.export_audio_check.setChecked(True)
        options_row.addWidget(self.export_audio_check)
        
        self.export_csv_check = QCheckBox("导出CSV清单")
        self.export_csv_check.setChecked(True)
        options_row.addWidget(self.export_csv_check)
        
        self.export_json_check = QCheckBox("导出JSON清单")
        self.export_json_check.setChecked(False)
        options_row.addWidget(self.export_json_check)
        
        self.export_md_check = QCheckBox("导出Markdown报告")
        self.export_md_check.setChecked(True)
        options_row.addWidget(self.export_md_check)
        
        options_row.addStretch()
        export_settings_layout.addLayout(options_row)
        
        layout.addWidget(export_settings_group)
        
        export_btn_row = QHBoxLayout()
        
        self.export_btn = QPushButton("📤 开始导出")
        self.export_btn.clicked.connect(self._run_export)
        self.export_btn.setEnabled(False)
        self.export_btn.setMinimumHeight(50)
        export_btn_font = QFont()
        export_btn_font.setBold(True)
        export_btn_font.setPointSize(12)
        self.export_btn.setFont(export_btn_font)
        export_btn_row.addWidget(self.export_btn)
        
        export_btn_row.addStretch()
        layout.addLayout(export_btn_row)
        
        export_log_group = QGroupBox("导出日志")
        export_log_layout = QVBoxLayout(export_log_group)
        
        self.export_log = QTextEdit()
        self.export_log.setReadOnly(True)
        self.export_log.setPlaceholderText("导出操作的日志将显示在这里...")
        export_log_layout.addWidget(self.export_log)
        
        layout.addWidget(export_log_group)
        
        layout.addStretch()
        
        self.tabs.addTab(tab, "📤 导出")
    
    def _setup_hit_table(self, table: QTableWidget, show_details: bool = False):
        if show_details:
            headers = [
                "#", "风险", "状态", "开始时间", "结束时间",
                "规则类型", "规则名称", "匹配文本", "手动", "重复"
            ]
        else:
            headers = [
                "风险等级", "开始时间", "结束时间",
                "规则类型", "匹配文本", "处理状态"
            ]
        
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        table.horizontalHeader().setStretchLastSection(True)
        table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        table.verticalHeader().setVisible(False)
    
    def _load_projects(self):
        self.project_list.clear()
        projects = self.db_manager.get_all_projects()
        
        for project in projects:
            item = QListWidgetItem(f"{project.name} (ID: {project.id})")
            item.setData(Qt.ItemDataRole.UserRole, project.id)
            
            if project.updated_at:
                item.setToolTip(f"最后更新: {project.updated_at.strftime('%Y-%m-%d %H:%M')}")
            
            self.project_list.addItem(item)
        
        self.status_bar.showMessage(f"已加载 {len(projects)} 个项目")
    
    def _create_new_project(self):
        name, ok = QInputDialog.getText(
            self, "新建项目", "请输入项目名称:", text="未命名项目"
        )
        
        if not ok or not name.strip():
            return
        
        try:
            project = self.db_manager.create_project(name.strip())
            self._load_projects()
            
            for i in range(self.project_list.count()):
                item = self.project_list.item(i)
                if item.data(Qt.ItemDataRole.UserRole) == project.id:
                    self.project_list.setCurrentItem(item)
                    break
            
            self._open_project(project.id)
            self.status_bar.showMessage(f"项目 \"{name}\" 创建成功")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"创建项目失败: {str(e)}")
    
    def _open_selected_project(self):
        current = self.project_list.currentItem()
        if not current:
            QMessageBox.warning(self, "提示", "请先选择一个项目")
            return
        
        project_id = current.data(Qt.ItemDataRole.UserRole)
        self._open_project(project_id)
    
    def _open_project(self, project_id: int):
        project = self.db_manager.get_project(project_id)
        if not project:
            QMessageBox.warning(self, "错误", "无法加载项目")
            return
        
        self.current_project = project
        
        self.project_name_label.setText(f"名称: {project.name}")
        self.project_desc_label.setText(f"描述: {project.description or '(无)'}")
        if project.created_at:
            self.project_created_label.setText(f"创建时间: {project.created_at.strftime('%Y-%m-%d %H:%M')}")
        else:
            self.project_created_label.setText("创建时间: -")
        
        if project.updated_at:
            self.project_updated_label.setText(f"更新时间: {project.updated_at.strftime('%Y-%m-%d %H:%M')}")
        else:
            self.project_updated_label.setText("更新时间: -")
        
        if project.audio_path and os.path.exists(project.audio_path):
            self.audio_path_label.setText(f"音频文件: {os.path.basename(project.audio_path)}")
            try:
                info = self.audio_handler.load_audio(project.audio_path)
                self.audio_info_label.setText(
                    f"音频信息: {info.duration:.2f}秒, {info.channels}声道, {info.frame_rate}Hz"
                )
                self.total_time_label.setText(self._format_time_short(info.duration))
                self.time_slider.setMaximum(int(info.duration * 1000))
                
                self.play_pause_btn.setEnabled(True)
                self.stop_btn.setEnabled(True)
                self.time_slider.setEnabled(True)
            except Exception as e:
                self.audio_info_label.setText(f"加载音频失败: {str(e)}")
        else:
            self.audio_path_label.setText("音频文件: 未加载")
            self.audio_info_label.setText("音频信息: -")
        
        if project.transcription_path and os.path.exists(project.transcription_path):
            self.transcription_path_label.setText(
                f"转写文件: {os.path.basename(project.transcription_path)}"
            )
            self._load_segments_from_project()
        else:
            self.transcription_path_label.setText("转写文件: 未加载")
            self.segments_count_label.setText("已解析片段数: 0")
        
        self.load_audio_btn.setEnabled(True)
        self.load_transcription_btn.setEnabled(True)
        
        self._load_hits()
        
        self.status_bar.showMessage(f"已打开项目: {project.name}")
    
    def _load_segments_from_project(self):
        if not self.current_project:
            return
        
        audio_duration = None
        if self.audio_handler.is_loaded():
            audio_info = self.audio_handler.get_audio_info()
            if audio_info:
                audio_duration = audio_info.duration
        
        parse_result = TranscriptionParser.parse_file(
            self.current_project.transcription_path,
            audio_duration
        )
        
        self.import_preview_table.setRowCount(0)
        
        if parse_result.errors:
            QMessageBox.warning(self, "解析错误", "\n".join(parse_result.errors))
            return
        
        self.import_preview_table.setRowCount(len(parse_result.segments))
        
        for row_idx, seg in enumerate(parse_result.segments):
            self.import_preview_table.setItem(row_idx, 0, QTableWidgetItem(self._format_time_short(seg.start_time)))
            self.import_preview_table.setItem(row_idx, 1, QTableWidgetItem(self._format_time_short(seg.end_time)))
            self.import_preview_table.setItem(row_idx, 2, QTableWidgetItem(f"{seg.end_time - seg.start_time:.3f}s"))
            
            text_preview = seg.text[:50] + "..." if len(seg.text) > 50 else seg.text
            text_item = QTableWidgetItem(text_preview)
            if seg.is_overlapping:
                text_item.setBackground(QColor(255, 240, 180))
            self.import_preview_table.setItem(row_idx, 3, text_item)
        
        self.segments_count_label.setText(f"已解析片段数: {len(parse_result.segments)}")
        
        if parse_result.warnings:
            self.import_warnings_label.setText("警告: " + "\n".join(parse_result.warnings[:3]))
            if len(parse_result.warnings) > 3:
                self.import_warnings_label.setText(
                    self.import_warnings_label.text() + f"\n... 还有 {len(parse_result.warnings) - 3} 个警告"
                )
        else:
            self.import_warnings_label.setText("")
        
        self.db_manager.clear_project_segments(self.current_project.id)
        segments_data = [seg.to_dict() for seg in parse_result.segments]
        self.db_manager.add_segments(self.current_project.id, segments_data)
        
        self.current_segments = [
            {"id": i, "start_time": s.start_time, "end_time": s.end_time, "text": s.text}
            for i, s in enumerate(parse_result.segments)
        ]
        
        self.scan_btn.setEnabled(len(self.current_segments) > 0)
    
    def _load_hits(self):
        if not self.current_project:
            self.current_hits = []
            self._update_hits_display([])
            return
        
        self.current_hits = self.db_manager.get_project_hits(self.current_project.id)
        self._update_hits_display(self.current_hits)
        
        if self.current_hits:
            high = sum(1 for h in self.current_hits if h.risk_level == RiskLevel.HIGH)
            medium = sum(1 for h in self.current_hits if h.risk_level == RiskLevel.MEDIUM)
            low = sum(1 for h in self.current_hits if h.risk_level == RiskLevel.LOW)
            
            self.scan_stats_label.setText(
                f"高风险: {high} | 中风险: {medium} | 低风险: {low} | 总计: {len(self.current_hits)}"
            )
            
            self.export_btn.setEnabled(True)
        else:
            self.scan_stats_label.setText("高风险: 0 | 中风险: 0 | 低风险: 0 | 总计: 0")
            self.export_btn.setEnabled(False)
    
    def _update_hits_display(self, hits: List[SensitiveHit]):
        self.scan_results_table.setRowCount(0)
        self.review_hits_table.setRowCount(0)
        
        if not hits:
            return
        
        for row_idx, hit in enumerate(hits):
            self._add_hit_to_table(self.scan_results_table, row_idx, hit, show_details=False)
            self._add_hit_to_table(self.review_hits_table, row_idx, hit, show_details=True)
    
    def _add_hit_to_table(self, table: QTableWidget, row: int, hit: SensitiveHit, show_details: bool = False):
        table.insertRow(row)
        
        risk_level = hit.risk_level
        if risk_level == RiskLevel.HIGH:
            risk_text = "🔴 高"
            color = QColor(255, 200, 200)
        elif risk_level == RiskLevel.MEDIUM:
            risk_text = "🟡 中"
            color = QColor(255, 240, 180)
        else:
            risk_text = "🟢 低"
            color = QColor(200, 255, 200)
        
        mark_status = hit.mark_status
        status_text = {
            MarkStatus.KEEP: "✅ 保留",
            MarkStatus.MUTE: "🔇 静音",
            MarkStatus.BEEP: "🔔 哔声",
            MarkStatus.REVIEW: "⚠️ 待复核"
        }.get(mark_status, "未知")
        
        if show_details:
            table.setItem(row, 0, QTableWidgetItem(str(row + 1)))
            risk_item = QTableWidgetItem(risk_text)
            risk_item.setBackground(color)
            table.setItem(row, 1, risk_item)
            table.setItem(row, 2, QTableWidgetItem(status_text))
            table.setItem(row, 3, QTableWidgetItem(self._format_time_short(hit.start_time)))
            table.setItem(row, 4, QTableWidgetItem(self._format_time_short(hit.end_time)))
            table.setItem(row, 5, QTableWidgetItem(str(hit.rule_type)))
            table.setItem(row, 6, QTableWidgetItem(hit.rule_name or ""))
            table.setItem(row, 7, QTableWidgetItem(hit.matched_text))
            table.setItem(row, 8, QTableWidgetItem("是" if hit.is_manual else "否"))
            table.setItem(row, 9, QTableWidgetItem("是" if hit.is_duplicate else "否"))
            
            table.item(row, 0).setData(Qt.ItemDataRole.UserRole, hit.id)
        else:
            risk_item = QTableWidgetItem(risk_text)
            risk_item.setBackground(color)
            table.setItem(row, 0, risk_item)
            table.setItem(row, 1, QTableWidgetItem(self._format_time_short(hit.start_time)))
            table.setItem(row, 2, QTableWidgetItem(self._format_time_short(hit.end_time)))
            table.setItem(row, 3, QTableWidgetItem(str(hit.rule_type)))
            table.setItem(row, 4, QTableWidgetItem(hit.matched_text))
            table.setItem(row, 5, QTableWidgetItem(status_text))
            
            table.item(row, 0).setData(Qt.ItemDataRole.UserRole, hit.id)
    
    def _delete_selected_project(self):
        current = self.project_list.currentItem()
        if not current:
            QMessageBox.warning(self, "提示", "请先选择一个项目")
            return
        
        project_id = current.data(Qt.ItemDataRole.UserRole)
        project = self.db_manager.get_project(project_id)
        
        if not project:
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除项目 \"{project.name}\" 吗？\n此操作不可恢复。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            if self.db_manager.delete_project(project_id):
                self._load_projects()
                if self.current_project and self.current_project.id == project_id:
                    self.current_project = None
                    self._reset_ui()
                self.status_bar.showMessage("项目已删除")
            else:
                QMessageBox.warning(self, "错误", "删除项目失败")
    
    def _reset_ui(self):
        self.project_name_label.setText("名称: -")
        self.project_desc_label.setText("描述: -")
        self.project_created_label.setText("创建时间: -")
        self.project_updated_label.setText("更新时间: -")
        self.audio_path_label.setText("音频文件: 未加载")
        self.audio_info_label.setText("音频信息: -")
        self.transcription_path_label.setText("转写文件: 未加载")
        self.segments_count_label.setText("已解析片段数: 0")
        self.scan_stats_label.setText("高风险: 0 | 中风险: 0 | 低风险: 0 | 总计: 0")
        self.import_preview_table.setRowCount(0)
        self.scan_results_table.setRowCount(0)
        self.review_hits_table.setRowCount(0)
        self.import_warnings_label.setText("")
        
        self.load_audio_btn.setEnabled(False)
        self.load_transcription_btn.setEnabled(False)
        self.scan_btn.setEnabled(False)
        self.play_pause_btn.setEnabled(False)
        self.stop_btn.setEnabled(False)
        self.time_slider.setEnabled(False)
        self.export_btn.setEnabled(False)
        
        self._stop_playback()
    
    def _load_audio_file(self):
        if not self.current_project:
            QMessageBox.warning(self, "提示", "请先打开或创建一个项目")
            return
        
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择音频文件", "",
            "音频文件 (*.mp3 *.wav *.wave);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        try:
            info = self.audio_handler.load_audio(file_path)
            
            self.db_manager.update_project(
                self.current_project.id,
                audio_path=file_path,
                audio_duration=info.duration
            )
            
            self.audio_path_label.setText(f"音频文件: {os.path.basename(file_path)}")
            self.audio_info_label.setText(
                f"音频信息: {info.duration:.2f}秒, {info.channels}声道, {info.frame_rate}Hz"
            )
            self.total_time_label.setText(self._format_time_short(info.duration))
            self.time_slider.setMaximum(int(info.duration * 1000))
            
            self.play_pause_btn.setEnabled(True)
            self.stop_btn.setEnabled(True)
            self.time_slider.setEnabled(True)
            
            if self.current_project.transcription_path:
                self._load_segments_from_project()
            
            self.status_bar.showMessage(f"已加载音频: {os.path.basename(file_path)}")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"加载音频失败: {str(e)}")
    
    def _load_transcription_file(self):
        if not self.current_project:
            QMessageBox.warning(self, "提示", "请先打开或创建一个项目")
            return
        
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择转写文件", "",
            "转写文件 (*.srt *.json);;所有文件 (*)"
        )
        
        if not file_path:
            return
        
        ext = os.path.splitext(file_path)[1].lower()
        
        self.db_manager.update_project(
            self.current_project.id,
            transcription_path=file_path,
            transcription_format=ext.lstrip(".")
        )
        
        self.transcription_path_label.setText(f"转写文件: {os.path.basename(file_path)}")
        
        self._load_segments_from_project()
        
        self.status_bar.showMessage(f"已加载转写文件: {os.path.basename(file_path)}")
    
    def _run_scan(self):
        if not self.current_project or not self.current_segments:
            QMessageBox.warning(self, "提示", "请先加载转写文件")
            return
        
        progress = QProgressDialog("正在扫描敏感内容...", "取消", 0, 100, self)
        progress.setWindowModality(Qt.WindowModality.WindowModal)
        progress.show()
        
        try:
            progress.setValue(10)
            
            hits_data = self.rule_engine.scan_segments(self.current_segments)
            
            progress.setValue(80)
            
            self.db_manager.clear_project_hits(self.current_project.id)
            if hits_data:
                self.db_manager.add_hits(self.current_project.id, hits_data)
            
            progress.setValue(100)
            
            self._load_hits()
            
            self.status_bar.showMessage(f"扫描完成，发现 {len(hits_data)} 个敏感片段")
            
            QMessageBox.information(
                self, "扫描完成",
                f"扫描完成！\n共发现 {len(hits_data)} 个潜在敏感片段。\n请在「复核与播放」标签页中进行审核。"
            )
            
        except Exception as e:
            progress.close()
            QMessageBox.critical(self, "错误", f"扫描失败: {str(e)}")
    
    def _manage_rules(self):
        QMessageBox.information(
            self, "规则管理",
            "规则管理功能：\n\n"
            "内置规则（已启用）：\n"
            "• 手机号检测（中国大陆格式）\n"
            "• 邮箱地址检测\n"
            "• 身份证号检测\n"
            "• 银行卡号检测\n"
            "• 地址关键词检测\n\n"
            "自定义规则可以通过 JSON 文件导入。\n"
            "格式示例见项目文档。"
        )
    
    def _filter_hits(self):
        if not self.current_hits:
            return
        
        risk_filter = self.filter_risk_combo.currentText()
        status_filter = self.filter_status_combo.currentText()
        
        filtered = []
        for hit in self.current_hits:
            risk_match = True
            if risk_filter == "高风险" and hit.risk_level != RiskLevel.HIGH:
                risk_match = False
            elif risk_filter == "中风险" and hit.risk_level != RiskLevel.MEDIUM:
                risk_match = False
            elif risk_filter == "低风险" and hit.risk_level != RiskLevel.LOW:
                risk_match = False
            
            status_match = True
            if status_filter == "需要复核" and hit.mark_status != MarkStatus.REVIEW:
                status_match = False
            elif status_filter == "保留" and hit.mark_status != MarkStatus.KEEP:
                status_match = False
            elif status_filter == "静音" and hit.mark_status != MarkStatus.MUTE:
                status_match = False
            elif status_filter == "哔声" and hit.mark_status != MarkStatus.BEEP:
                status_match = False
            
            if risk_match and status_match:
                filtered.append(hit)
        
        self._update_hits_display(filtered)
    
    def _on_hit_double_clicked(self, item: QTableWidgetItem):
        row = item.row()
        id_item = self.review_hits_table.item(row, 0)
        if not id_item:
            return
        
        hit_id = id_item.data(Qt.ItemDataRole.UserRole)
        hit = next((h for h in self.current_hits if h.id == hit_id), None)
        
        if hit and self.audio_handler.is_loaded():
            self._jump_to_time(hit.start_time)
    
    def _on_hit_selection_changed(self):
        selected = self.review_hits_table.selectedItems()
        if not selected:
            self.mark_combo.setEnabled(False)
            self.apply_mark_btn.setEnabled(False)
            return
        
        row = selected[0].row()
        id_item = self.review_hits_table.item(row, 0)
        if not id_item:
            return
        
        hit_id = id_item.data(Qt.ItemDataRole.UserRole)
        hit = next((h for h in self.current_hits if h.id == hit_id), None)
        
        if hit:
            self._show_hit_details(hit)
    
    def _show_hit_details(self, hit: SensitiveHit):
        for label_name in ["rule_type", "rule_name", "time_range", "risk_level"]:
            label = self.findChild(QLabel, f"detail_{label_name}")
            if not label:
                continue
            
            if label_name == "rule_type":
                label.setText(str(hit.rule_type))
            elif label_name == "rule_name":
                label.setText(hit.rule_name or "-")
            elif label_name == "time_range":
                label.setText(f"{self._format_time_short(hit.start_time)} - {self._format_time_short(hit.end_time)}")
            elif label_name == "risk_level":
                risk_text = {
                    RiskLevel.HIGH: "🔴 高风险",
                    RiskLevel.MEDIUM: "🟡 中风险",
                    RiskLevel.LOW: "🟢 低风险"
                }.get(hit.risk_level, "未知")
                label.setText(risk_text)
        
        self.detail_matched_text.setText(hit.matched_text)
        
        context = ""
        if hit.context_before:
            context += f"... {hit.context_before}"
        context += f"【{hit.matched_text}】"
        if hit.context_after:
            context += f"{hit.context_after} ..."
        self.detail_context.setText(context)
        
        self.detail_note.setText(hit.manual_note or "")
        
        status_index = {
            MarkStatus.REVIEW: 0,
            MarkStatus.KEEP: 1,
            MarkStatus.MUTE: 2,
            MarkStatus.BEEP: 3
        }.get(hit.mark_status, 0)
        self.mark_combo.setCurrentIndex(status_index)
        
        self.mark_combo.setEnabled(True)
        self.apply_mark_btn.setEnabled(True)
    
    def _apply_mark(self):
        selected = self.review_hits_table.selectedItems()
        if not selected:
            return
        
        row = selected[0].row()
        id_item = self.review_hits_table.item(row, 0)
        if not id_item:
            return
        
        hit_id = id_item.data(Qt.ItemDataRole.UserRole)
        
        status_map = {
            0: MarkStatus.REVIEW,
            1: MarkStatus.KEEP,
            2: MarkStatus.MUTE,
            3: MarkStatus.BEEP
        }
        status = status_map.get(self.mark_combo.currentIndex(), MarkStatus.REVIEW)
        
        note = self.detail_note.toPlainText()
        
        if self.db_manager.update_hit_status(hit_id, status, note):
            self._load_hits()
            self.status_bar.showMessage("标记已更新")
        else:
            QMessageBox.warning(self, "错误", "更新标记失败")
    
    def _jump_to_selected_hit(self):
        self._on_hit_double_clicked(self.review_hits_table.currentItem())
    
    def _jump_to_time(self, time_sec: float):
        if not self.audio_handler.is_loaded():
            return
        
        self.audio_handler.set_playback_position(time_sec)
        self.time_slider.setValue(int(time_sec * 1000))
        self.current_time_label.setText(self._format_time_short(time_sec))
        
        if self.audio_handler.get_playback_state() != AudioPlaybackState.PLAYING:
            self._start_playback()
    
    def _toggle_play_pause(self):
        state = self.audio_handler.get_playback_state()
        
        if state == AudioPlaybackState.PLAYING:
            self._pause_playback()
        elif state == AudioPlaybackState.PAUSED:
            self._resume_playback()
        else:
            self._start_playback()
    
    def _start_playback(self):
        pos = self.audio_handler.get_playback_position()
        self.audio_handler.play_from(pos)
        self.play_pause_btn.setText("⏸ 暂停")
        self.play_timer.start(100)
    
    def _pause_playback(self):
        self.audio_handler.pause()
        self.play_pause_btn.setText("▶ 继续")
        self.play_timer.stop()
    
    def _resume_playback(self):
        self.audio_handler.resume()
        self.play_pause_btn.setText("⏸ 暂停")
        self.play_timer.start(100)
    
    def _stop_playback(self):
        self.audio_handler.stop()
        self.play_pause_btn.setText("▶ 播放")
        self.play_timer.stop()
        self.time_slider.setValue(0)
        self.current_time_label.setText("00:00.000")
    
    def _update_playback(self):
        if not self.audio_handler.is_loaded():
            return
        
        state = self.audio_handler.get_playback_state()
        if state != AudioPlaybackState.PLAYING:
            return
        
        info = self.audio_handler.get_audio_info()
        if not info:
            return
        
        current = self.audio_handler.get_playback_position() + 0.1
        current = min(current, info.duration)
        
        self.audio_handler.set_playback_position(current)
        
        self.time_slider.setValue(int(current * 1000))
        self.current_time_label.setText(self._format_time_short(current))
        
        if current >= info.duration:
            self._stop_playback()
    
    def _slider_pressed(self):
        pass
    
    def _slider_released(self):
        pos_ms = self.time_slider.value()
        pos_sec = pos_ms / 1000.0
        self.audio_handler.set_playback_position(pos_sec)
        self.current_time_label.setText(self._format_time_short(pos_sec))
    
    def _slider_moved(self, pos):
        pos_sec = pos / 1000.0
        self.current_time_label.setText(self._format_time_short(pos_sec))
    
    def _add_manual_hit(self):
        if not self.current_project:
            QMessageBox.warning(self, "提示", "请先打开项目")
            return
        
        dialog = QDialog(self)
        dialog.setWindowTitle("手动添加敏感片段")
        dialog.setMinimumWidth(400)
        
        layout = QVBoxLayout(dialog)
        
        form_layout = QVBoxLayout()
        
        start_row = QHBoxLayout()
        start_row.addWidget(QLabel("开始时间 (秒):"))
        start_spin = QDoubleSpinBox()
        start_spin.setRange(0, 99999)
        start_spin.setDecimals(3)
        start_spin.setSingleStep(0.1)
        start_row.addWidget(start_spin)
        form_layout.addLayout(start_row)
        
        end_row = QHBoxLayout()
        end_row.addWidget(QLabel("结束时间 (秒):"))
        end_spin = QDoubleSpinBox()
        end_spin.setRange(0, 99999)
        end_spin.setDecimals(3)
        end_spin.setSingleStep(0.1)
        end_row.addWidget(end_spin)
        form_layout.addLayout(end_row)
        
        info = self.audio_handler.get_audio_info()
        if info:
            start_spin.setMaximum(info.duration)
            end_spin.setMaximum(info.duration)
        
        text_row = QHBoxLayout()
        text_row.addWidget(QLabel("匹配文本/说明:"))
        text_edit = QLineEdit()
        text_edit.setPlaceholderText("请输入相关描述...")
        text_row.addWidget(text_edit)
        form_layout.addLayout(text_row)
        
        risk_row = QHBoxLayout()
        risk_row.addWidget(QLabel("风险等级:"))
        risk_combo = QComboBox()
        risk_combo.addItems(["高风险", "中风险", "低风险"])
        risk_combo.setCurrentIndex(1)
        risk_row.addWidget(risk_combo)
        form_layout.addLayout(risk_row)
        
        layout.addLayout(form_layout)
        
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(dialog.reject)
        btn_row.addWidget(cancel_btn)
        
        ok_btn = QPushButton("添加")
        ok_btn.clicked.connect(dialog.accept)
        btn_row.addWidget(ok_btn)
        
        layout.addLayout(btn_row)
        
        if dialog.exec() == QDialog.DialogCode.Accepted:
            start = start_spin.value()
            end = end_spin.value()
            
            if start >= end:
                QMessageBox.warning(self, "错误", "开始时间必须小于结束时间")
                return
            
            risk_level_map = {0: RiskLevel.HIGH, 1: RiskLevel.MEDIUM, 2: RiskLevel.LOW}
            risk_level = risk_level_map.get(risk_combo.currentIndex(), RiskLevel.MEDIUM)
            
            hit_data = {
                "segment_id": None,
                "rule_type": RuleType.CUSTOM,
                "rule_name": "手动添加",
                "start_time": start,
                "end_time": end,
                "matched_text": text_edit.text() or "(手动添加)",
                "context_before": "",
                "context_after": "",
                "risk_level": risk_level,
                "mark_status": MarkStatus.REVIEW,
                "is_duplicate": False,
                "is_manual": True,
                "manual_note": ""
            }
            
            if self.db_manager.add_hits(self.current_project.id, [hit_data]) > 0:
                self._load_hits()
                self.status_bar.showMessage("已添加手动标记的敏感片段")
            else:
                QMessageBox.warning(self, "错误", "添加失败")
    
    def _browse_output_dir(self):
        dir_path = QFileDialog.getExistingDirectory(self, "选择输出目录")
        if dir_path:
            self.output_path_edit.setText(dir_path)
    
    def _run_export(self):
        if not self.current_project or not self.current_hits:
            QMessageBox.warning(self, "提示", "没有可导出的内容")
            return
        
        output_dir = self.output_path_edit.text().strip()
        if not output_dir:
            QMessageBox.warning(self, "提示", "请选择输出目录")
            return
        
        if not os.path.exists(output_dir):
            try:
                os.makedirs(output_dir)
            except Exception as e:
                QMessageBox.critical(self, "错误", f"无法创建输出目录: {str(e)}")
                return
        
        overwrite = self.overwrite_check.isChecked()
        export_audio = self.export_audio_check.isChecked()
        export_csv = self.export_csv_check.isChecked()
        export_json = self.export_json_check.isChecked()
        export_md = self.export_md_check.isChecked()
        
        self.export_log.clear()
        self.export_log.append(f"开始导出项目: {self.current_project.name}")
        self.export_log.append(f"输出目录: {output_dir}")
        self.export_log.append("-" * 50)
        
        try:
            export_items = ExportHandler.hits_to_export_items(self.current_hits)
            summary = ExportHandler.create_summary(self.current_project, export_items)
            
            if export_csv:
                csv_path = os.path.join(output_dir, f"{self.current_project.name}_剪辑清单.csv")
                try:
                    path, warnings = ExportHandler.export_csv(csv_path, export_items, summary, overwrite)
                    self.export_log.append(f"✓ CSV清单已导出: {path}")
                    for w in warnings:
                        self.export_log.append(f"  警告: {w}")
                except ExportHandlerError as e:
                    self.export_log.append(f"✗ CSV导出失败: {str(e)}")
            
            if export_json:
                json_path = os.path.join(output_dir, f"{self.current_project.name}_剪辑清单.json")
                try:
                    path, warnings = ExportHandler.export_json(json_path, export_items, summary, overwrite)
                    self.export_log.append(f"✓ JSON清单已导出: {path}")
                    for w in warnings:
                        self.export_log.append(f"  警告: {w}")
                except ExportHandlerError as e:
                    self.export_log.append(f"✗ JSON导出失败: {str(e)}")
            
            if export_md:
                md_path = os.path.join(output_dir, f"{self.current_project.name}_交付报告.md")
                project_info = {}
                if self.current_project.audio_path:
                    project_info["audio_path"] = self.current_project.audio_path
                if self.current_project.transcription_path:
                    project_info["transcription_path"] = self.current_project.transcription_path
                
                try:
                    path, warnings = ExportHandler.export_markdown_report(
                        md_path, export_items, summary, project_info, overwrite
                    )
                    self.export_log.append(f"✓ Markdown报告已导出: {path}")
                    for w in warnings:
                        self.export_log.append(f"  警告: {w}")
                except ExportHandlerError as e:
                    self.export_log.append(f"✗ Markdown报告导出失败: {str(e)}")
            
            if export_audio and self.audio_handler.is_loaded():
                from core.audio_handler import AudioSegmentAction
                
                actions = []
                for hit in self.current_hits:
                    if hit.mark_status == MarkStatus.MUTE:
                        action = "mute"
                    elif hit.mark_status == MarkStatus.BEEP:
                        action = "beep"
                    elif hit.mark_status == MarkStatus.KEEP:
                        action = "keep"
                    else:
                        continue
                    
                    actions.append(AudioSegmentAction(
                        start_time=hit.start_time,
                        end_time=hit.end_time,
                        action=action,
                        matched_text=hit.matched_text
                    ))
                
                if actions:
                    ext = "wav"
                    if self.current_project.audio_path:
                        orig_ext = os.path.splitext(self.current_project.audio_path)[1].lower()
                        if orig_ext == ".mp3":
                            ext = "mp3"
                    
                    audio_path = os.path.join(output_dir, f"{self.current_project.name}_脱敏后.{ext}")
                    
                    try:
                        path, warnings = self.audio_handler.export_desensitized_audio(
                            audio_path, actions, overwrite
                        )
                        self.export_log.append(f"✓ 脱敏音频已导出: {path}")
                        for w in warnings:
                            self.export_log.append(f"  警告: {w}")
                    except AudioHandlerError as e:
                        self.export_log.append(f"✗ 音频导出失败: {str(e)}")
                else:
                    self.export_log.append("ℹ 没有需要处理的音频片段（所有片段都标记为保留或待复核）")
            
            self.export_log.append("-" * 50)
            self.export_log.append("导出完成！")
            
            self.status_bar.showMessage("导出完成")
            
            QMessageBox.information(self, "导出完成", f"导出操作已完成。\n输出目录: {output_dir}")
            
        except Exception as e:
            self.export_log.append(f"✗ 导出过程出错: {str(e)}")
            QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
    
    @staticmethod
    def _format_time_short(seconds: float) -> str:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{minutes:02d}:{secs:02d}.{millis:03d}"
    
    def closeEvent(self, event):
        self.play_timer.stop()
        self._stop_playback()
        event.accept()
