import sys
import os
from typing import Optional, Dict, List
from datetime import datetime

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTreeWidget, QTreeWidgetItem, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QFileDialog, QMessageBox, QSplitter, QGroupBox,
    QComboBox, QCheckBox, QLineEdit, QTextEdit, QStatusBar, QToolBar,
    QAction, QMenu, QMenuBar, QHeaderView, QFrame, QScrollArea
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QIcon, QFont, QColor

from models import (
    ShowData, Scene, PropUsage, Cue, Alert, AlertType, CheckStatus
)
from importers import DataImporter
from rules import RuleEngine
from storage import StorageManager, StatusManager
from exporters import MarkdownExporter, CSVExporter


class StageManagerGUI(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.show_data: Optional[ShowData] = None
        self.current_project_path: Optional[str] = None
        
        self.storage = StorageManager()
        self.importer = DataImporter()
        self.rule_engine = RuleEngine()
        self.status_manager = StatusManager()
        self.md_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        
        self.init_ui()
        self.create_menu_bar()
        self.create_toolbar()
        
        self.statusBar().showMessage("就绪")
        
    def init_ui(self):
        self.setWindowTitle("小剧场舞台监督工具")
        self.setMinimumSize(1200, 800)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        self.tab_widget = QTabWidget()
        self.tab_widget.addTab(self.create_import_tab(), "数据导入")
        self.tab_widget.addTab(self.create_scenes_tab(), "场次管理")
        self.tab_widget.addTab(self.create_props_tab(), "道具清单")
        self.tab_widget.addTab(self.create_alerts_tab(), "异常检查")
        self.tab_widget.addTab(self.create_export_tab(), "导出")
        
        main_layout.addWidget(self.tab_widget)
        
    def create_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_action = QAction("新建项目(&N)", self)
        new_action.setShortcut("Ctrl+N")
        new_action.triggered.connect(self.new_project)
        file_menu.addAction(new_action)
        
        open_action = QAction("打开项目(&O)", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self.open_project)
        file_menu.addAction(open_action)
        
        save_action = QAction("保存项目(&S)", self)
        save_action.setShortcut("Ctrl+S")
        save_action.triggered.connect(self.save_project)
        file_menu.addAction(save_action)
        
        save_as_action = QAction("另存为(&A)...", self)
        save_as_action.triggered.connect(self.save_project_as)
        file_menu.addAction(save_as_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        tools_menu = menubar.addMenu("工具(&T)")
        
        run_checks_action = QAction("运行规则检查(&R)", self)
        run_checks_action.setShortcut("F5")
        run_checks_action.triggered.connect(self.run_checks)
        tools_menu.addAction(run_checks_action)
        
        load_sample_action = QAction("加载示例数据(&L)", self)
        load_sample_action.triggered.connect(self.load_sample_data)
        tools_menu.addAction(load_sample_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
        
    def create_toolbar(self):
        toolbar = QToolBar("主工具栏")
        toolbar.setIconSize(QSize(24, 24))
        self.addToolBar(toolbar)
        
        new_btn = QPushButton("新建")
        new_btn.clicked.connect(self.new_project)
        toolbar.addWidget(new_btn)
        
        open_btn = QPushButton("打开")
        open_btn.clicked.connect(self.open_project)
        toolbar.addWidget(open_btn)
        
        save_btn = QPushButton("保存")
        save_btn.clicked.connect(self.save_project)
        toolbar.addWidget(save_btn)
        
        toolbar.addSeparator()
        
        check_btn = QPushButton("检查")
        check_btn.clicked.connect(self.run_checks)
        toolbar.addWidget(check_btn)
        
        toolbar.addSeparator()
        
        export_btn = QPushButton("导出")
        export_btn.clicked.connect(self.tab_widget.setCurrentIndex)
        toolbar.addWidget(export_btn)
        
    def create_import_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        info_group = QGroupBox("项目信息")
        info_layout = QVBoxLayout(info_group)
        
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("演出名称:"))
        self.show_name_edit = QLineEdit()
        name_layout.addWidget(self.show_name_edit)
        info_layout.addLayout(name_layout)
        
        layout.addWidget(info_group)
        
        import_group = QGroupBox("数据导入")
        import_layout = QVBoxLayout(import_group)
        
        scenes_layout = QHBoxLayout()
        scenes_layout.addWidget(QLabel("场次 CSV:"))
        self.scenes_path_edit = QLineEdit()
        self.scenes_path_edit.setReadOnly(True)
        scenes_layout.addWidget(self.scenes_path_edit)
        scenes_btn = QPushButton("选择...")
        scenes_btn.clicked.connect(lambda: self.select_file(self.scenes_path_edit, "CSV文件 (*.csv)"))
        scenes_layout.addWidget(scenes_btn)
        import_layout.addLayout(scenes_layout)
        
        actors_layout = QHBoxLayout()
        actors_layout.addWidget(QLabel("演员 JSON:"))
        self.actors_path_edit = QLineEdit()
        self.actors_path_edit.setReadOnly(True)
        actors_layout.addWidget(self.actors_path_edit)
        actors_btn = QPushButton("选择...")
        actors_btn.clicked.connect(lambda: self.select_file(self.actors_path_edit, "JSON文件 (*.json)"))
        actors_layout.addWidget(actors_btn)
        import_layout.addLayout(actors_layout)
        
        props_layout = QHBoxLayout()
        props_layout.addWidget(QLabel("道具 CSV:"))
        self.props_path_edit = QLineEdit()
        self.props_path_edit.setReadOnly(True)
        props_layout.addWidget(self.props_path_edit)
        props_btn = QPushButton("选择...")
        props_btn.clicked.connect(lambda: self.select_file(self.props_path_edit, "CSV文件 (*.csv)"))
        props_layout.addWidget(props_btn)
        import_layout.addLayout(props_layout)
        
        cues_layout = QHBoxLayout()
        cues_layout.addWidget(QLabel("提示词 CSV:"))
        self.cues_path_edit = QLineEdit()
        self.cues_path_edit.setReadOnly(True)
        cues_layout.addWidget(self.cues_path_edit)
        cues_btn = QPushButton("选择...")
        cues_btn.clicked.connect(lambda: self.select_file(self.cues_path_edit, "CSV文件 (*.csv)"))
        cues_layout.addWidget(cues_btn)
        import_layout.addLayout(cues_layout)
        
        photos_layout = QHBoxLayout()
        photos_layout.addWidget(QLabel("道具照片目录:"))
        self.photos_path_edit = QLineEdit()
        self.photos_path_edit.setReadOnly(True)
        photos_layout.addWidget(self.photos_path_edit)
        photos_btn = QPushButton("选择...")
        photos_btn.clicked.connect(self.select_directory)
        photos_layout.addWidget(photos_btn)
        import_layout.addLayout(photos_layout)
        
        import_btn_layout = QHBoxLayout()
        import_all_btn = QPushButton("导入所有数据")
        import_all_btn.clicked.connect(self.import_all_data)
        import_btn_layout.addWidget(import_all_btn)
        
        load_sample_btn = QPushButton("加载示例数据")
        load_sample_btn.clicked.connect(self.load_sample_data)
        import_btn_layout.addWidget(load_sample_btn)
        
        import_btn_layout.addStretch()
        import_layout.addLayout(import_btn_layout)
        
        layout.addWidget(import_group)
        
        self.import_log = QTextEdit()
        self.import_log.setReadOnly(True)
        self.import_log.setPlaceholderText("导入日志将显示在这里...")
        layout.addWidget(self.import_log)
        
        return widget
        
    def create_scenes_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        splitter = QSplitter(Qt.Horizontal)
        
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        left_layout.addWidget(QLabel("场次列表:"))
        
        self.scenes_tree = QTreeWidget()
        self.scenes_tree.setHeaderLabels(["场次", "道具数", "提示词数"])
        self.scenes_tree.setColumnWidth(0, 200)
        self.scenes_tree.itemClicked.connect(self.on_scene_selected)
        left_layout.addWidget(self.scenes_tree)
        
        splitter.addWidget(left_panel)
        
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        details_group = QGroupBox("场次详情")
        details_layout = QVBoxLayout(details_group)
        
        self.scene_info_label = QLabel("选择场次查看详情")
        details_layout.addWidget(self.scene_info_label)
        
        right_layout.addWidget(details_group)
        
        props_group = QGroupBox("上场道具")
        props_layout = QVBoxLayout(props_group)
        
        self.scene_props_table = QTableWidget()
        self.scene_props_table.setColumnCount(5)
        self.scene_props_table.setHorizontalHeaderLabels(["状态", "道具名称", "类型", "负责演员", "备注"])
        self.scene_props_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.scene_props_table.itemClicked.connect(self.on_prop_item_clicked)
        props_layout.addWidget(self.scene_props_table)
        
        right_layout.addWidget(props_group)
        
        cues_group = QGroupBox("提示词")
        cues_layout = QVBoxLayout(cues_group)
        
        self.scene_cues_table = QTableWidget()
        self.scene_cues_table.setColumnCount(4)
        self.scene_cues_table.setHorizontalHeaderLabels(["类型", "内容", "演员", "备注"])
        self.scene_cues_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        cues_layout.addWidget(self.scene_cues_table)
        
        right_layout.addWidget(cues_group)
        
        splitter.addWidget(right_panel)
        splitter.setSizes([300, 900])
        
        layout.addWidget(splitter)
        
        return widget
        
    def create_props_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("筛选:"))
        
        self.props_status_filter = QComboBox()
        self.props_status_filter.addItems(["全部状态", "待核对", "已核对", "有问题"])
        self.props_status_filter.currentIndexChanged.connect(self.filter_props_table)
        filter_layout.addWidget(self.props_status_filter)
        
        self.props_type_filter = QComboBox()
        self.props_type_filter.addItems(["全部类型", "上场", "撤场"])
        self.props_type_filter.currentIndexChanged.connect(self.filter_props_table)
        filter_layout.addWidget(self.props_type_filter)
        
        filter_layout.addWidget(QLabel("搜索:"))
        self.props_search_edit = QLineEdit()
        self.props_search_edit.setPlaceholderText("输入道具名称...")
        self.props_search_edit.textChanged.connect(self.filter_props_table)
        filter_layout.addWidget(self.props_search_edit)
        
        filter_layout.addStretch()
        
        mark_all_btn = QPushButton("全部标记已核对")
        mark_all_btn.clicked.connect(self.mark_all_props_checked)
        filter_layout.addWidget(mark_all_btn)
        
        layout.addLayout(filter_layout)
        
        self.all_props_table = QTableWidget()
        self.all_props_table.setColumnCount(7)
        self.all_props_table.setHorizontalHeaderLabels(
            ["场景", "道具名称", "类型", "状态", "负责演员", "备注", "操作"]
        )
        self.all_props_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.all_props_table.itemClicked.connect(self.on_all_props_item_clicked)
        layout.addWidget(self.all_props_table)
        
        return widget
        
    def create_alerts_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("异常类型:"))
        
        self.alerts_type_filter = QComboBox()
        self.alerts_type_filter.addItems([
            "全部类型", "道具冲突", "演员未到", "照片缺失", "换场时间不足"
        ])
        self.alerts_type_filter.currentIndexChanged.connect(self.filter_alerts_table)
        filter_layout.addWidget(self.alerts_type_filter)
        
        self.alerts_resolved_filter = QComboBox()
        self.alerts_resolved_filter.addItems(["全部状态", "未解决", "已解决"])
        self.alerts_resolved_filter.currentIndexChanged.connect(self.filter_alerts_table)
        filter_layout.addWidget(self.alerts_resolved_filter)
        
        filter_layout.addStretch()
        
        run_checks_btn = QPushButton("运行检查")
        run_checks_btn.clicked.connect(self.run_checks)
        filter_layout.addWidget(run_checks_btn)
        
        mark_resolved_btn = QPushButton("全部标记已解决")
        mark_resolved_btn.clicked.connect(self.mark_all_alerts_resolved)
        filter_layout.addWidget(mark_resolved_btn)
        
        layout.addLayout(filter_layout)
        
        stats_group = QGroupBox("统计信息")
        stats_layout = QHBoxLayout(stats_group)
        
        self.alert_stats_labels = {}
        for label_text in ["道具冲突", "演员未到", "照片缺失", "换场时间不足", "总计"]:
            frame = QFrame()
            frame.setFrameStyle(QFrame.Box | QFrame.Raised)
            frame_layout = QVBoxLayout(frame)
            
            count_label = QLabel("0")
            count_label.setAlignment(Qt.AlignCenter)
            count_label.setFont(QFont("Arial", 16, QFont.Bold))
            
            name_label = QLabel(label_text)
            name_label.setAlignment(Qt.AlignCenter)
            
            frame_layout.addWidget(count_label)
            frame_layout.addWidget(name_label)
            
            stats_layout.addWidget(frame)
            self.alert_stats_labels[label_text] = count_label
            
        stats_layout.addStretch()
        layout.addWidget(stats_group)
        
        self.alerts_table = QTableWidget()
        self.alerts_table.setColumnCount(6)
        self.alerts_table.setHorizontalHeaderLabels(
            ["类型", "场景", "消息", "状态", "已解决", "操作"]
        )
        self.alerts_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.alerts_table.itemClicked.connect(self.on_alert_item_clicked)
        layout.addWidget(self.alerts_table)
        
        return widget
        
    def create_export_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        md_group = QGroupBox("Markdown 导出")
        md_layout = QVBoxLayout(md_group)
        
        md_info = QLabel("导出完整的演出道具清单，包含所有场次、道具、提示词和异常报告")
        md_info.setWordWrap(True)
        md_layout.addWidget(md_info)
        
        md_btn_layout = QHBoxLayout()
        export_md_btn = QPushButton("导出 Markdown")
        export_md_btn.clicked.connect(self.export_markdown)
        md_btn_layout.addWidget(export_md_btn)
        md_btn_layout.addStretch()
        md_layout.addLayout(md_btn_layout)
        
        layout.addWidget(md_group)
        
        csv_group = QGroupBox("CSV 导出")
        csv_layout = QVBoxLayout(csv_group)
        
        csv_info = QLabel("分别导出道具清单、异常报告和提示词为 CSV 文件，方便在 Excel 中查看")
        csv_info.setWordWrap(True)
        csv_layout.addWidget(csv_info)
        
        csv_btn_layout = QHBoxLayout()
        
        export_props_csv_btn = QPushButton("导出道具清单 CSV")
        export_props_csv_btn.clicked.connect(self.export_props_csv)
        csv_btn_layout.addWidget(export_props_csv_btn)
        
        export_alerts_csv_btn = QPushButton("导出异常报告 CSV")
        export_alerts_csv_btn.clicked.connect(self.export_alerts_csv)
        csv_btn_layout.addWidget(export_alerts_csv_btn)
        
        export_cues_csv_btn = QPushButton("导出提示词 CSV")
        export_cues_csv_btn.clicked.connect(self.export_cues_csv)
        csv_btn_layout.addWidget(export_cues_csv_btn)
        
        csv_btn_layout.addStretch()
        csv_layout.addLayout(csv_btn_layout)
        
        layout.addWidget(csv_group)
        
        layout.addStretch()
        
        return widget
        
    def select_file(self, line_edit: QLineEdit, file_filter: str):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择文件", "", file_filter
        )
        if file_path:
            line_edit.setText(file_path)
            
    def select_directory(self):
        dir_path = QFileDialog.getExistingDirectory(self, "选择道具照片目录")
        if dir_path:
            self.photos_path_edit.setText(dir_path)
            
    def new_project(self):
        reply = QMessageBox.question(
            self, "新建项目",
            "当前项目未保存的数据将会丢失，确定要新建项目吗？",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.show_data = ShowData()
            self.current_project_path = None
            self.show_name_edit.setText("")
            self.scenes_path_edit.setText("")
            self.actors_path_edit.setText("")
            self.props_path_edit.setText("")
            self.cues_path_edit.setText("")
            self.photos_path_edit.setText("")
            self.import_log.clear()
            self.refresh_all_views()
            self.statusBar().showMessage("已创建新项目")
            
    def open_project(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "打开项目", "", "JSON文件 (*.json)"
        )
        
        if file_path:
            try:
                self.show_data = self.storage.load_project(file_path)
                self.current_project_path = file_path
                self.show_name_edit.setText(self.show_data.show_name)
                self.refresh_all_views()
                self.log_message(f"已打开项目: {file_path}")
                self.statusBar().showMessage(f"已打开: {os.path.basename(file_path)}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"打开项目失败: {str(e)}")
                
    def save_project(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可保存的项目数据")
            return
            
        if self.current_project_path:
            try:
                self.show_data.show_name = self.show_name_edit.text()
                self.storage.save_project(self.show_data, os.path.basename(self.current_project_path))
                self.log_message(f"已保存项目: {self.current_project_path}")
                self.statusBar().showMessage("已保存")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存项目失败: {str(e)}")
        else:
            self.save_project_as()
            
    def save_project_as(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可保存的项目数据")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存项目", "", "JSON文件 (*.json)"
        )
        
        if file_path:
            try:
                self.show_data.show_name = self.show_name_edit.text()
                project_name = os.path.splitext(os.path.basename(file_path))[0]
                self.current_project_path = self.storage.save_project(self.show_data, project_name)
                self.log_message(f"已保存项目: {file_path}")
                self.statusBar().showMessage(f"已保存: {os.path.basename(file_path)}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存项目失败: {str(e)}")
                
    def import_all_data(self):
        scenes_csv = self.scenes_path_edit.text() or None
        actors_json = self.actors_path_edit.text() or None
        props_csv = self.props_path_edit.text() or None
        cues_csv = self.cues_path_edit.text() or None
        photos_dir = self.photos_path_edit.text() or None
        
        if not any([scenes_csv, actors_json, props_csv, cues_csv, photos_dir]):
            QMessageBox.warning(self, "警告", "请至少选择一个文件进行导入")
            return
            
        try:
            if not self.show_data:
                self.show_data = ShowData()
                
            if scenes_csv:
                scenes = self.importer.csv_importer.import_scenes(scenes_csv)
                self.show_data.scenes.update(scenes)
                self.log_message(f"导入场次: {len(scenes)} 个")
                for error in self.importer.csv_importer.errors:
                    self.log_message(f"  警告: {error}")
                    
            if actors_json:
                actors = self.importer.json_importer.import_actors(actors_json)
                self.show_data.actors.update(actors)
                self.log_message(f"导入演员: {len(actors)} 个")
                for error in self.importer.json_importer.errors:
                    self.log_message(f"  警告: {error}")
                    
            if props_csv and self.show_data.scenes:
                props, _ = self.importer.csv_importer.import_props_from_csv(
                    props_csv, self.show_data.scenes
                )
                self.show_data.props.update(props)
                self.log_message(f"导入道具: {len(props)} 个")
                for error in self.importer.csv_importer.errors:
                    self.log_message(f"  警告: {error}")
                    
            if cues_csv and self.show_data.scenes:
                self.importer.csv_importer.import_cues_from_csv(
                    cues_csv, self.show_data.scenes
                )
                self.log_message(f"导入提示词完成")
                for error in self.importer.csv_importer.errors:
                    self.log_message(f"  警告: {error}")
                    
            if photos_dir and self.show_data.props:
                self.show_data.prop_photos_dir = photos_dir
                photo_map = self.importer.photo_scanner.scan_photos(
                    photos_dir, self.show_data.props
                )
                self.log_message(f"发现道具照片: {len(photo_map)} 张")
                for error in self.importer.photo_scanner.errors:
                    self.log_message(f"  警告: {error}")
                    
            self.show_data.last_updated = datetime.now()
            self.refresh_all_views()
            self.log_message("导入完成")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"导入失败: {str(e)}")
            self.log_message(f"错误: {str(e)}")
            
    def load_sample_data(self):
        try:
            self.show_data = ShowData()
            self.show_data.show_name = "示例话剧 - 《茶馆》片段"
            
            scene1 = Scene(id="scene_1", name="开场 - 王掌柜迎客", act=1, scene_number=1, duration=15)
            scene2 = Scene(id="scene_2", name="中场 - 秦仲义来访", act=1, scene_number=2, duration=20)
            scene3 = Scene(id="scene_3", name="尾声 - 茶馆变迁", act=1, scene_number=3, duration=10)
            
            self.show_data.scenes = {
                "scene_1": scene1,
                "scene_2": scene2,
                "scene_3": scene3
            }
            
            self.show_data.actors = {
                "actor_1": Actor(id="actor_1", name="王利发", is_present=True),
                "actor_2": Actor(id="actor_2", name="秦仲义", is_present=False, notes="迟到中"),
                "actor_3": Actor(id="actor_3", name="常四爷", is_present=True),
                "actor_4": Actor(id="actor_4", name="松二爷", is_present=True)
            }
            
            self.show_data.props = {
                "prop_1": Prop(id="prop_1", name="茶壶"),
                "prop_2": Prop(id="prop_2", name="茶碗"),
                "prop_3": Prop(id="prop_3", name="折扇"),
                "prop_4": Prop(id="prop_4", name="账本"),
                "prop_5": Prop(id="prop_5", name="鸟笼")
            }
            
            scene1.props = [
                PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场", 
                          scene_id="scene_1", scene_name=scene1.name, actor_id="actor_1", actor_name="王利发"),
                PropUsage(prop_id="prop_2", prop_name="茶碗", usage_type="上场",
                          scene_id="scene_1", scene_name=scene1.name),
                PropUsage(prop_id="prop_3", prop_name="折扇", usage_type="上场",
                          scene_id="scene_1", scene_name=scene1.name, actor_id="actor_3", actor_name="常四爷")
            ]
            
            scene2.props = [
                PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="上场",
                          scene_id="scene_2", scene_name=scene2.name, actor_id="actor_1", actor_name="王利发"),
                PropUsage(prop_id="prop_4", prop_name="账本", usage_type="上场",
                          scene_id="scene_2", scene_name=scene2.name, actor_id="actor_2", actor_name="秦仲义"),
                PropUsage(prop_id="prop_3", prop_name="折扇", usage_type="撤场",
                          scene_id="scene_2", scene_name=scene2.name)
            ]
            
            scene3.props = [
                PropUsage(prop_id="prop_5", prop_name="鸟笼", usage_type="上场",
                          scene_id="scene_3", scene_name=scene3.name, actor_id="actor_4", actor_name="松二爷"),
                PropUsage(prop_id="prop_1", prop_name="茶壶", usage_type="撤场",
                          scene_id="scene_3", scene_name=scene3.name)
            ]
            
            scene1.cues = [
                Cue(id="cue_1", scene_id="scene_1", cue_type="灯光", content="开场灯光渐亮"),
                Cue(id="cue_2", scene_id="scene_1", cue_type="音效", content="茶馆背景音起"),
                Cue(id="cue_3", scene_id="scene_1", cue_type="演员", content="王利发上场",
                    actor_id="actor_1", actor_name="王利发")
            ]
            
            scene2.cues = [
                Cue(id="cue_4", scene_id="scene_2", cue_type="演员", content="秦仲义上场",
                    actor_id="actor_2", actor_name="秦仲义"),
                Cue(id="cue_5", scene_id="scene_2", cue_type="灯光", content="聚焦秦仲义")
            ]
            
            scene3.cues = [
                Cue(id="cue_6", scene_id="scene_3", cue_type="灯光", content="灯光渐暗"),
                Cue(id="cue_7", scene_id="scene_3", cue_type="音效", content="背景音乐淡出")
            ]
            
            self.show_name_edit.setText(self.show_data.show_name)
            self.refresh_all_views()
            self.log_message("已加载示例数据")
            self.log_message("提示: 点击 '运行检查' 查看异常检测结果")
            self.statusBar().showMessage("已加载示例数据")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"加载示例数据失败: {str(e)}")
            
    def run_checks(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "请先导入或创建项目数据")
            return
            
        try:
            alerts = self.rule_engine.run_all_checks(self.show_data)
            self.refresh_alerts_view()
            self.log_message(f"规则检查完成，发现 {len(alerts)} 个异常")
            self.statusBar().showMessage(f"发现 {len(alerts)} 个异常")
            
            if alerts:
                self.tab_widget.setCurrentIndex(3)
                
        except Exception as e:
            QMessageBox.critical(self, "错误", f"规则检查失败: {str(e)}")
            
    def refresh_all_views(self):
        self.refresh_scenes_view()
        self.refresh_props_view()
        self.refresh_alerts_view()
        
    def refresh_scenes_view(self):
        self.scenes_tree.clear()
        
        if not self.show_data:
            return
            
        sorted_scenes = sorted(
            self.show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        current_act = None
        act_item = None
        
        for scene in sorted_scenes:
            if scene.act != current_act:
                current_act = scene.act
                act_item = QTreeWidgetItem(self.scenes_tree)
                act_item.setText(0, f"第 {current_act} 幕")
                act_item.setData(0, Qt.UserRole, None)
                
            scene_item = QTreeWidgetItem(act_item)
            scene_item.setText(0, scene.name)
            scene_item.setText(1, str(len(scene.props)))
            scene_item.setText(2, str(len(scene.cues)))
            scene_item.setData(0, Qt.UserRole, scene.id)
            
            prop_stats = {"上场": 0, "撤场": 0}
            for prop in scene.props:
                if prop.usage_type in prop_stats:
                    prop_stats[prop.usage_type] += 1
            scene_item.setToolTip(0, f"上场: {prop_stats['上场']} | 撤场: {prop_stats['撤场']}")
            
        self.scenes_tree.expandAll()
        
    def refresh_props_view(self):
        self.all_props_table.setRowCount(0)
        self.filter_props_table()
        
    def filter_props_table(self):
        self.all_props_table.setRowCount(0)
        
        if not self.show_data:
            return
            
        status_filter = self.props_status_filter.currentText()
        type_filter = self.props_type_filter.currentText()
        search_text = self.props_search_edit.text().lower()
        
        sorted_scenes = sorted(
            self.show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        row = 0
        for scene in sorted_scenes:
            for prop_usage in scene.props:
                if status_filter != "全部状态":
                    status_map = {"待核对": CheckStatus.PENDING, "已核对": CheckStatus.CHECKED, "有问题": CheckStatus.ISSUE}
                    if prop_usage.check_status != status_map.get(status_filter):
                        continue
                        
                if type_filter != "全部类型":
                    if prop_usage.usage_type != type_filter:
                        continue
                        
                if search_text:
                    if search_text not in prop_usage.prop_name.lower():
                        continue
                        
                self.all_props_table.insertRow(row)
                
                scene_item = QTableWidgetItem(f"第{scene.act}幕 - {scene.name}")
                scene_item.setData(Qt.UserRole, (scene.id, prop_usage.prop_id, prop_usage.usage_type))
                self.all_props_table.setItem(row, 0, scene_item)
                
                name_item = QTableWidgetItem(prop_usage.prop_name)
                self.all_props_table.setItem(row, 1, name_item)
                
                type_item = QTableWidgetItem(prop_usage.usage_type)
                self.all_props_table.setItem(row, 2, type_item)
                
                status_text, status_color = self.get_status_display(prop_usage.check_status)
                status_item = QTableWidgetItem(status_text)
                if status_color:
                    status_item.setForeground(QColor(status_color))
                self.all_props_table.setItem(row, 3, status_item)
                
                actor_item = QTableWidgetItem(prop_usage.actor_name or "-")
                self.all_props_table.setItem(row, 4, actor_item)
                
                notes_item = QTableWidgetItem(prop_usage.notes or "-")
                self.all_props_table.setItem(row, 5, notes_item)
                
                action_item = QTableWidgetItem("点击标记")
                action_item.setForeground(QColor("#0066cc"))
                self.all_props_table.setItem(row, 6, action_item)
                
                row += 1
                
    def refresh_alerts_view(self):
        self.alerts_table.setRowCount(0)
        
        if self.show_data:
            stats = self.rule_engine.get_alert_stats(self.show_data.alerts)
            
            type_mapping = {
                "prop_conflict": "道具冲突",
                "actor_missing": "演员未到",
                "photo_missing": "照片缺失",
                "transition_short": "换场时间不足"
            }
            
            for alert_type_key, count in stats["by_type"].items():
                label_text = type_mapping.get(alert_type_key, alert_type_key)
                if label_text in self.alert_stats_labels:
                    self.alert_stats_labels[label_text].setText(str(count))
                    
            self.alert_stats_labels["总计"].setText(str(stats["total"]))
            
        self.filter_alerts_table()
        
    def filter_alerts_table(self):
        self.alerts_table.setRowCount(0)
        
        if not self.show_data:
            return
            
        type_filter = self.alerts_type_filter.currentText()
        resolved_filter = self.alerts_resolved_filter.currentText()
        
        type_mapping = {
            "道具冲突": AlertType.PROP_CONFLICT,
            "演员未到": AlertType.ACTOR_MISSING,
            "照片缺失": AlertType.PHOTO_MISSING,
            "换场时间不足": AlertType.TRANSITION_SHORT
        }
        
        filtered_alerts = []
        for alert in self.show_data.alerts:
            if type_filter != "全部类型":
                if alert.alert_type != type_mapping.get(type_filter):
                    continue
                    
            if resolved_filter == "未解决" and alert.resolved:
                continue
            if resolved_filter == "已解决" and not alert.resolved:
                continue
                
            filtered_alerts.append(alert)
            
        type_display = {
            AlertType.PROP_CONFLICT: ("道具冲突", "#cc0000"),
            AlertType.ACTOR_MISSING: ("演员未到", "#cc6600"),
            AlertType.PHOTO_MISSING: ("照片缺失", "#cc9900"),
            AlertType.TRANSITION_SHORT: ("换场时间不足", "#6600cc")
        }
        
        for row, alert in enumerate(filtered_alerts):
            self.alerts_table.insertRow(row)
            
            type_text, type_color = type_display.get(alert.alert_type, ("未知", "#000000"))
            type_item = QTableWidgetItem(type_text)
            type_item.setForeground(QColor(type_color))
            type_item.setData(Qt.UserRole, row)
            self.alerts_table.setItem(row, 0, type_item)
            
            scene_name = alert.details.get('scene1_name', alert.details.get('from_scene_name', '-'))
            if 'scene2_name' in alert.details:
                scene_name += f" → {alert.details['scene2_name']}"
            elif 'to_scene_name' in alert.details:
                scene_name += f" → {alert.details['to_scene_name']}"
            scene_item = QTableWidgetItem(scene_name)
            self.alerts_table.setItem(row, 1, scene_item)
            
            msg_item = QTableWidgetItem(alert.message)
            self.alerts_table.setItem(row, 2, msg_item)
            
            status_text, status_color = self.get_status_display(alert.check_status)
            status_item = QTableWidgetItem(status_text)
            if status_color:
                status_item.setForeground(QColor(status_color))
            self.alerts_table.setItem(row, 3, status_item)
            
            resolved_item = QTableWidgetItem("已解决" if alert.resolved else "未解决")
            resolved_item.setForeground(QColor("#009900") if alert.resolved else QColor("#cc0000"))
            self.alerts_table.setItem(row, 4, resolved_item)
            
            action_item = QTableWidgetItem("点击处理")
            action_item.setForeground(QColor("#0066cc"))
            self.alerts_table.setItem(row, 5, action_item)
            
    def get_status_display(self, status: CheckStatus) -> tuple:
        mapping = {
            CheckStatus.PENDING: ("待核对", "#999999"),
            CheckStatus.CHECKED: ("已核对", "#009900"),
            CheckStatus.ISSUE: ("有问题", "#cc0000")
        }
        return mapping.get(status, ("未知", None))
        
    def on_scene_selected(self, item: QTreeWidgetItem, column: int):
        scene_id = item.data(0, Qt.UserRole)
        
        if not scene_id or not self.show_data:
            return
            
        scene = self.show_data.scenes.get(scene_id)
        if not scene:
            return
            
        self.scene_info_label.setText(
            f"第{scene.act}幕 第{scene.scene_number}场: {scene.name} | "
            f"预计时长: {scene.duration}分钟 | 道具数: {len(scene.props)} | 提示词数: {len(scene.cues)}"
        )
        
        self.scene_props_table.setRowCount(0)
        for row, prop_usage in enumerate(scene.props):
            self.scene_props_table.insertRow(row)
            
            status_text, status_color = self.get_status_display(prop_usage.check_status)
            status_item = QTableWidgetItem(status_text)
            if status_color:
                status_item.setForeground(QColor(status_color))
            status_item.setData(Qt.UserRole, (scene_id, prop_usage.prop_id, prop_usage.usage_type))
            self.scene_props_table.setItem(row, 0, status_item)
            
            self.scene_props_table.setItem(row, 1, QTableWidgetItem(prop_usage.prop_name))
            self.scene_props_table.setItem(row, 2, QTableWidgetItem(prop_usage.usage_type))
            self.scene_props_table.setItem(row, 3, QTableWidgetItem(prop_usage.actor_name or "-"))
            self.scene_props_table.setItem(row, 4, QTableWidgetItem(prop_usage.notes or "-"))
            
        self.scene_cues_table.setRowCount(0)
        for row, cue in enumerate(scene.cues):
            self.scene_cues_table.insertRow(row)
            self.scene_cues_table.setItem(row, 0, QTableWidgetItem(cue.cue_type))
            self.scene_cues_table.setItem(row, 1, QTableWidgetItem(cue.content))
            self.scene_cues_table.setItem(row, 2, QTableWidgetItem(cue.actor_name or "-"))
            self.scene_cues_table.setItem(row, 3, QTableWidgetItem(cue.notes or "-"))
            
    def on_prop_item_clicked(self, item: QTableWidgetItem):
        data = item.data(Qt.UserRole)
        if not data:
            return
            
        scene_id, prop_id, usage_type = data
        self.show_prop_status_dialog(scene_id, prop_id, usage_type)
        
    def on_all_props_item_clicked(self, item: QTableWidgetItem):
        row = item.row()
        scene_item = self.all_props_table.item(row, 0)
        if scene_item:
            data = scene_item.data(Qt.UserRole)
            if data:
                scene_id, prop_id, usage_type = data
                self.show_prop_status_dialog(scene_id, prop_id, usage_type)
                
    def on_alert_item_clicked(self, item: QTableWidgetItem):
        row = item.row()
        type_item = self.alerts_table.item(row, 0)
        if type_item:
            alert_index = type_item.data(Qt.UserRole)
            if alert_index is not None:
                self.show_alert_dialog(alert_index)
                
    def show_prop_status_dialog(self, scene_id: str, prop_id: str, usage_type: str):
        if not self.show_data:
            return
            
        scene = self.show_data.scenes.get(scene_id)
        if not scene:
            return
            
        prop_usage = None
        for p in scene.props:
            if p.prop_id == prop_id and p.usage_type == usage_type:
                prop_usage = p
                break
                
        if not prop_usage:
            return
            
        dialog = QMessageBox(self)
        dialog.setWindowTitle("道具核对状态")
        dialog.setText(
            f"道具: {prop_usage.prop_name}\n"
            f"场景: {scene.name}\n"
            f"类型: {prop_usage.usage_type}\n"
            f"当前状态: {self.get_status_display(prop_usage.check_status)[0]}"
        )
        
        btn_pending = dialog.addButton("标记待核对", QMessageBox.ActionRole)
        btn_checked = dialog.addButton("标记已核对", QMessageBox.ActionRole)
        btn_issue = dialog.addButton("标记有问题", QMessageBox.ActionRole)
        dialog.addButton(QMessageBox.Cancel)
        
        dialog.exec_()
        
        clicked_btn = dialog.clickedButton()
        
        if clicked_btn == btn_pending:
            self.status_manager.update_prop_check_status(
                self.show_data, scene_id, prop_id, usage_type, CheckStatus.PENDING
            )
        elif clicked_btn == btn_checked:
            self.status_manager.update_prop_check_status(
                self.show_data, scene_id, prop_id, usage_type, CheckStatus.CHECKED
            )
        elif clicked_btn == btn_issue:
            self.status_manager.update_prop_check_status(
                self.show_data, scene_id, prop_id, usage_type, CheckStatus.ISSUE
            )
            
        self.refresh_scenes_view()
        self.filter_props_table()
        
    def show_alert_dialog(self, alert_index: int):
        if not self.show_data or alert_index >= len(self.show_data.alerts):
            return
            
        alert = self.show_data.alerts[alert_index]
        
        dialog = QMessageBox(self)
        dialog.setWindowTitle("处理异常")
        dialog.setText(
            f"类型: {alert.alert_type.value}\n"
            f"消息: {alert.message}\n"
            f"当前状态: {'已解决' if alert.resolved else '未解决'}"
        )
        
        btn_resolve = dialog.addButton("标记已解决", QMessageBox.ActionRole)
        btn_unresolve = dialog.addButton("标记未解决", QMessageBox.ActionRole)
        dialog.addButton(QMessageBox.Cancel)
        
        dialog.exec_()
        
        clicked_btn = dialog.clickedButton()
        
        if clicked_btn == btn_resolve:
            self.status_manager.update_alert_status(
                self.show_data, alert_index, CheckStatus.CHECKED, True
            )
        elif clicked_btn == btn_unresolve:
            self.status_manager.update_alert_status(
                self.show_data, alert_index, CheckStatus.PENDING, False
            )
            
        self.refresh_alerts_view()
        
    def mark_all_props_checked(self):
        if not self.show_data:
            return
            
        count = self.status_manager.mark_all_props_checked(self.show_data)
        self.refresh_props_view()
        self.refresh_scenes_view()
        self.log_message(f"已标记 {count} 个道具为已核对")
        self.statusBar().showMessage(f"已标记 {count} 个道具")
        
    def mark_all_alerts_resolved(self):
        if not self.show_data:
            return
            
        count = self.status_manager.mark_all_alerts_resolved(self.show_data)
        self.refresh_alerts_view()
        self.log_message(f"已标记 {count} 个异常为已解决")
        self.statusBar().showMessage(f"已标记 {count} 个异常")
        
    def export_markdown(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出 Markdown", "", "Markdown文件 (*.md)"
        )
        
        if file_path:
            try:
                self.md_exporter.export(self.show_data, file_path)
                self.log_message(f"已导出 Markdown: {file_path}")
                self.statusBar().showMessage(f"已导出: {os.path.basename(file_path)}")
                QMessageBox.information(self, "成功", f"已导出到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
                
    def export_props_csv(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出道具清单", "", "CSV文件 (*.csv)"
        )
        
        if file_path:
            try:
                self.csv_exporter.export_props(self.show_data, file_path)
                self.log_message(f"已导出道具 CSV: {file_path}")
                self.statusBar().showMessage(f"已导出: {os.path.basename(file_path)}")
                QMessageBox.information(self, "成功", f"已导出到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
                
    def export_alerts_csv(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出异常报告", "", "CSV文件 (*.csv)"
        )
        
        if file_path:
            try:
                self.csv_exporter.export_alerts(self.show_data, file_path)
                self.log_message(f"已导出异常 CSV: {file_path}")
                self.statusBar().showMessage(f"已导出: {os.path.basename(file_path)}")
                QMessageBox.information(self, "成功", f"已导出到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
                
    def export_cues_csv(self):
        if not self.show_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return
            
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出提示词", "", "CSV文件 (*.csv)"
        )
        
        if file_path:
            try:
                self.csv_exporter.export_cues(self.show_data, file_path)
                self.log_message(f"已导出提示词 CSV: {file_path}")
                self.statusBar().showMessage(f"已导出: {os.path.basename(file_path)}")
                QMessageBox.information(self, "成功", f"已导出到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
                
    def log_message(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.import_log.append(f"[{timestamp}] {message}")
        
    def show_about(self):
        QMessageBox.about(
            self, "关于",
            "小剧场舞台监督工具 v1.0\n\n"
            "功能:\n"
            "- 导入场次CSV、演员JSON、道具照片\n"
            "- 自动生成道具上场/撤场清单\n"
            "- 检测道具冲突、演员未到、照片缺失、换场时间不足\n"
            "- 支持核对状态标记和筛选\n"
            "- 导出Markdown和CSV格式报告"
        )
        
    def closeEvent(self, event):
        if self.show_data:
            reply = QMessageBox.question(
                self, "退出",
                "是否保存当前项目？",
                QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel
            )
            
            if reply == QMessageBox.Yes:
                self.save_project()
                event.accept()
            elif reply == QMessageBox.No:
                event.accept()
            else:
                event.ignore()
        else:
            event.accept()


def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    window = StageManagerGUI()
    window.show()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
