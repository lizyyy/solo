import sys
import os
from typing import Optional, List

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QMenuBar, QMenu, QToolBar, QStatusBar, QSplitter,
    QMessageBox, QFileDialog, QDialog, QFormLayout,
    QLabel, QLineEdit, QPushButton, QSpinBox, 
    QDoubleSpinBox, QCheckBox, QComboBox, QGroupBox,
    QTabWidget, QTextEdit, QAction, QApplication,
    QScrollArea
)
from PyQt5.QtCore import Qt, pyqtSignal, QSize
from PyQt5.QtGui import QKeySequence, QIcon

from models.project import Project
from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings, NoPlaceZone
from models.validation import ValidationResult
from geometry.point import Point
from geometry.rectangle import Rectangle
from persistence.manager import ProjectManager
from nesting.algorithm import NestingEngine, NestingConfig, NestingResult
from validation.rules import ValidationEngine
from import_export.svg_handler import SVGImporter, SVGExporter
from import_export.markdown_handler import MarkdownExporter
from import_export.csv_handler import CSVExporter

from gui.canvas import NestingCanvas
from gui.property_panel import PropertyPanel
from gui.piece_list import PieceListWidget
from gui.validation_panel import ValidationPanel


class MainWindow(QMainWindow):
    project_changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.project_manager = ProjectManager()
        self.project: Optional[Project] = None
        self.nesting_engine = NestingEngine()
        self.validation_engine = ValidationEngine()
        self.nesting_result: Optional[NestingResult] = None
        self.validation_result: Optional[ValidationResult] = None
        
        self._current_file: Optional[str] = None
        
        self._init_ui()
        self._init_menu_bar()
        self._init_tool_bar()
        self._init_status_bar()
        
        self._create_new_project()

    def _init_ui(self):
        self.setWindowTitle("纸样排料用布预估台")
        self.setMinimumSize(1200, 800)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        
        left_splitter = QSplitter(Qt.Vertical)
        
        self.piece_list = PieceListWidget()
        self.piece_list.piece_selected.connect(self._on_piece_selected)
        self.piece_list.piece_deleted.connect(self._on_piece_deleted)
        left_splitter.addWidget(self.piece_list)
        
        self.property_panel = PropertyPanel()
        self.property_panel.piece_changed.connect(self._on_piece_property_changed)
        self.property_panel.fabric_changed.connect(self._on_fabric_property_changed)
        left_splitter.addWidget(self.property_panel)
        
        main_splitter = QSplitter(Qt.Horizontal)
        main_splitter.addWidget(left_splitter)
        
        self.canvas = NestingCanvas()
        self.canvas.piece_selected.connect(self._on_canvas_piece_selected)
        self.canvas.piece_moved.connect(self._on_canvas_piece_moved)
        self.canvas.piece_rotated.connect(self._on_canvas_piece_rotated)
        self.canvas.piece_placed.connect(self._on_canvas_piece_placed)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.canvas)
        main_splitter.addWidget(scroll)
        
        right_splitter = QSplitter(Qt.Vertical)
        
        stats_group = QGroupBox("排料统计")
        stats_layout = QFormLayout(stats_group)
        
        self.stats_fabric_length = QLabel("-")
        self.stats_waste_rate = QLabel("-")
        self.stats_pieces_count = QLabel("-")
        
        stats_layout.addRow("用布长度:", self.stats_fabric_length)
        stats_layout.addRow("余料率:", self.stats_waste_rate)
        stats_layout.addRow("裁片数量:", self.stats_pieces_count)
        
        right_splitter.addWidget(stats_group)
        
        self.validation_panel = ValidationPanel()
        right_splitter.addWidget(self.validation_panel)
        
        main_splitter.addWidget(right_splitter)
        
        main_splitter.setSizes([250, 700, 250])
        left_splitter.setSizes([300, 400])
        
        main_layout.addWidget(main_splitter)

    def _init_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_action = QAction("新建项目(&N)", self)
        new_action.setShortcut(QKeySequence.New)
        new_action.triggered.connect(self._create_new_project)
        file_menu.addAction(new_action)
        
        open_action = QAction("打开项目(&O)", self)
        open_action.setShortcut(QKeySequence.Open)
        open_action.triggered.connect(self._open_project)
        file_menu.addAction(open_action)
        
        save_action = QAction("保存项目(&S)", self)
        save_action.setShortcut(QKeySequence.Save)
        save_action.triggered.connect(self._save_project)
        file_menu.addAction(save_action)
        
        save_as_action = QAction("另存为(&A)", self)
        save_as_action.setShortcut(QKeySequence.SaveAs)
        save_as_action.triggered.connect(self._save_project_as)
        file_menu.addAction(save_as_action)
        
        file_menu.addSeparator()
        
        import_menu = file_menu.addMenu("导入(&I)")
        
        import_json_action = QAction("从 JSON 导入裁片", self)
        import_json_action.triggered.connect(self._import_pieces_json)
        import_menu.addAction(import_json_action)
        
        import_svg_action = QAction("从 SVG 导入裁片", self)
        import_svg_action.triggered.connect(self._import_pieces_svg)
        import_menu.addAction(import_svg_action)
        
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_json_action = QAction("导出项目为 JSON", self)
        export_json_action.triggered.connect(self._export_project_json)
        export_menu.addAction(export_json_action)
        
        export_svg_action = QAction("导出排料图为 SVG", self)
        export_svg_action.triggered.connect(self._export_nesting_svg)
        export_menu.addAction(export_svg_action)
        
        export_md_action = QAction("导出报价说明 (Markdown)", self)
        export_md_action.triggered.connect(self._export_quote_md)
        export_menu.addAction(export_md_action)
        
        export_csv_action = QAction("导出裁片清单 (CSV)", self)
        export_csv_action.triggered.connect(self._export_pieces_csv)
        export_menu.addAction(export_csv_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut(QKeySequence.Quit)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        add_piece_action = QAction("添加裁片(&P)", self)
        add_piece_action.triggered.connect(self._add_new_piece)
        edit_menu.addAction(add_piece_action)
        
        edit_menu.addSeparator()
        
        fabric_settings_action = QAction("布料设置(&F)", self)
        fabric_settings_action.triggered.connect(self._show_fabric_dialog)
        edit_menu.addAction(fabric_settings_action)
        
        nesting_menu = menubar.addMenu("排料(&N)")
        
        auto_nest_action = QAction("自动排料(&A)", self)
        auto_nest_action.setShortcut("F5")
        auto_nest_action.triggered.connect(self._run_auto_nesting)
        nesting_menu.addAction(auto_nest_action)
        
        validate_action = QAction("校验排料(&V)", self)
        validate_action.setShortcut("F6")
        validate_action.triggered.connect(self._run_validation)
        nesting_menu.addAction(validate_action)
        
        nesting_menu.addSeparator()
        
        clear_placement_action = QAction("清除所有放置", self)
        clear_placement_action.triggered.connect(self._clear_all_placements)
        nesting_menu.addAction(clear_placement_action)
        
        view_menu = menubar.addMenu("视图(&V)")
        
        zoom_in_action = QAction("放大(&I)", self)
        zoom_in_action.setShortcut(QKeySequence.ZoomIn)
        zoom_in_action.triggered.connect(self.canvas.zoom_in)
        view_menu.addAction(zoom_in_action)
        
        zoom_out_action = QAction("缩小(&O)", self)
        zoom_out_action.setShortcut(QKeySequence.ZoomOut)
        zoom_out_action.triggered.connect(self.canvas.zoom_out)
        view_menu.addAction(zoom_out_action)
        
        reset_zoom_action = QAction("重置缩放(&R)", self)
        reset_zoom_action.setShortcut("Ctrl+0")
        reset_zoom_action.triggered.connect(self.canvas.reset_zoom)
        view_menu.addAction(reset_zoom_action)
        
        view_menu.addSeparator()
        
        show_grid_action = QAction("显示网格(&G)", self)
        show_grid_action.setCheckable(True)
        show_grid_action.setChecked(True)
        show_grid_action.triggered.connect(self._toggle_grid)
        view_menu.addAction(show_grid_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)

    def _init_tool_bar(self):
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        new_action = QAction("新建", self)
        new_action.triggered.connect(self._create_new_project)
        toolbar.addAction(new_action)
        
        open_action = QAction("打开", self)
        open_action.triggered.connect(self._open_project)
        toolbar.addAction(open_action)
        
        save_action = QAction("保存", self)
        save_action.triggered.connect(self._save_project)
        toolbar.addAction(save_action)
        
        toolbar.addSeparator()
        
        add_piece_action = QAction("添加裁片", self)
        add_piece_action.triggered.connect(self._add_new_piece)
        toolbar.addAction(add_piece_action)
        
        toolbar.addSeparator()
        
        nest_action = QAction("自动排料", self)
        nest_action.triggered.connect(self._run_auto_nesting)
        toolbar.addAction(nest_action)
        
        validate_action = QAction("校验", self)
        validate_action.triggered.connect(self._run_validation)
        toolbar.addAction(validate_action)

    def _init_status_bar(self):
        self.statusBar().showMessage("就绪")

    def _create_new_project(self):
        self.project = self.project_manager.new_project("未命名项目")
        self._current_file = None
        self._update_ui_from_project()
        self.statusBar().showMessage("已创建新项目")

    def _open_project(self):
        filepath, _ = QFileDialog.getOpenFileName(
            self, "打开项目", "", "项目文件 (*.json);;所有文件 (*)"
        )
        
        if filepath:
            project = self.project_manager.load_project(filepath)
            if project:
                self.project = project
                self._current_file = filepath
                self._update_ui_from_project()
                self.statusBar().showMessage(f"已打开: {os.path.basename(filepath)}")
            else:
                QMessageBox.warning(self, "错误", "无法打开项目文件")

    def _save_project(self):
        if self._current_file:
            if self.project_manager.save_project(self._current_file, self.project):
                self.statusBar().showMessage("已保存")
                return True
        else:
            return self._save_project_as()
        return False

    def _save_project_as(self):
        filepath, _ = QFileDialog.getSaveFileName(
            self, "保存项目", "", "项目文件 (*.json);;所有文件 (*)"
        )
        
        if filepath:
            if not filepath.endswith('.json'):
                filepath += '.json'
            
            if self.project_manager.save_project(filepath, self.project):
                self._current_file = filepath
                self.statusBar().showMessage(f"已保存: {os.path.basename(filepath)}")
                return True
            else:
                QMessageBox.warning(self, "错误", "无法保存项目文件")
        
        return False

    def _import_pieces_json(self):
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入裁片 JSON", "", "JSON 文件 (*.json);;所有文件 (*)"
        )
        
        if filepath:
            count = self.project_manager.import_pieces_json(filepath, self.project)
            if count > 0:
                self._update_ui_from_project()
                self.statusBar().showMessage(f"已导入 {count} 个裁片")
            else:
                QMessageBox.warning(self, "提示", "未能导入任何裁片")

    def _import_pieces_svg(self):
        filepath, _ = QFileDialog.getOpenFileName(
            self, "导入裁片 SVG", "", "SVG 文件 (*.svg);;所有文件 (*)"
        )
        
        if filepath:
            importer = SVGImporter()
            pieces = importer.import_from_file(filepath)
            
            if pieces:
                for idx, piece in enumerate(pieces):
                    if not piece.name or piece.name == '裁片':
                        piece.name = f"导入裁片 {idx + 1}"
                    self.project.add_piece(piece)
                
                self._update_ui_from_project()
                self.statusBar().showMessage(f"已导入 {len(pieces)} 个裁片")
            else:
                QMessageBox.warning(self, "提示", "未能从 SVG 中识别任何裁片")

    def _export_project_json(self):
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出项目", "", "JSON 文件 (*.json);;所有文件 (*)"
        )
        
        if filepath:
            if not filepath.endswith('.json'):
                filepath += '.json'
            
            if self.project_manager.save_project(filepath, self.project):
                self.statusBar().showMessage(f"已导出: {os.path.basename(filepath)}")
            else:
                QMessageBox.warning(self, "错误", "导出失败")

    def _export_nesting_svg(self):
        if not self.project.placements:
            QMessageBox.warning(self, "提示", "没有排料数据可导出")
            return
        
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出 SVG 排料图", "", "SVG 文件 (*.svg);;所有文件 (*)"
        )
        
        if filepath:
            if not filepath.endswith('.svg'):
                filepath += '.svg'
            
            exporter = SVGExporter()
            
            fabric_length = 200.0
            if self.nesting_result:
                fabric_length = self.nesting_result.fabric_length
            
            success = exporter.export_to_file(
                filepath,
                self.project.placements,
                self.project.fabric_settings.width,
                fabric_length
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {os.path.basename(filepath)}")
            else:
                QMessageBox.warning(self, "错误", "导出失败")

    def _export_quote_md(self):
        if not self.project:
            QMessageBox.warning(self, "提示", "没有项目数据")
            return
        
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出报价说明", "", "Markdown 文件 (*.md);;所有文件 (*)"
        )
        
        if filepath:
            if not filepath.endswith('.md'):
                filepath += '.md'
            
            exporter = MarkdownExporter()
            success = exporter.export_quote(
                filepath,
                self.project,
                self.nesting_result,
                self.validation_result
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {os.path.basename(filepath)}")
            else:
                QMessageBox.warning(self, "错误", "导出失败")

    def _export_pieces_csv(self):
        if not self.project:
            QMessageBox.warning(self, "提示", "没有项目数据")
            return
        
        filepath, _ = QFileDialog.getSaveFileName(
            self, "导出裁片清单", "", "CSV 文件 (*.csv);;所有文件 (*)"
        )
        
        if filepath:
            if not filepath.endswith('.csv'):
                filepath += '.csv'
            
            exporter = CSVExporter()
            success = exporter.export_pieces_list(
                filepath,
                self.project,
                self.nesting_result
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {os.path.basename(filepath)}")
            else:
                QMessageBox.warning(self, "错误", "导出失败")

    def _add_new_piece(self):
        dialog = AddPieceDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            piece = dialog.get_piece()
            if piece.points:
                self.project.add_piece(piece)
                self._update_ui_from_project()
                self.statusBar().showMessage(f"已添加裁片: {piece.name}")

    def _on_piece_selected(self, piece_id: str):
        piece = self.project.get_piece_by_id(piece_id)
        if piece:
            self.property_panel.set_selected_piece(piece)
            self.canvas.set_selected_piece(piece_id)

    def _on_piece_deleted(self, piece_id: str):
        self.project.remove_piece(piece_id)
        self.property_panel.clear_piece_selection()
        self._update_ui_from_project()

    def _on_piece_property_changed(self, piece_id: str):
        self._update_ui_from_project()

    def _on_fabric_property_changed(self):
        self.canvas.set_fabric_settings(self.project.fabric_settings)
        self.canvas.update()

    def _on_canvas_piece_selected(self, piece_id: str):
        self.piece_list.select_piece(piece_id)
        piece = self.project.get_piece_by_id(piece_id)
        if piece:
            self.property_panel.set_selected_piece(piece)

    def _on_canvas_piece_moved(self, piece_id: str, x: float, y: float):
        placement = self.project.get_placement_by_piece_id(piece_id)
        if placement:
            placement.position = Point(x, y)
            placement.is_placed = True
            self._update_stats()

    def _on_canvas_piece_rotated(self, piece_id: str, angle: float):
        placement = self.project.get_placement_by_piece_id(piece_id)
        if placement:
            placement.rotation = angle

    def _on_canvas_piece_placed(self, piece_id: str, is_placed: bool):
        placement = self.project.get_placement_by_piece_id(piece_id)
        if placement:
            placement.is_placed = is_placed
            self._update_stats()

    def _run_auto_nesting(self):
        if not self.project or not self.project.pieces:
            QMessageBox.warning(self, "提示", "没有裁片可以排料")
            return
        
        self.statusBar().showMessage("正在进行自动排料...")
        QApplication.processEvents()
        
        config = NestingConfig(
            fabric_width=self.project.fabric_settings.width,
            safety_margin=self.project.fabric_settings.safety_margin,
            allow_rotation=True
        )
        
        self.nesting_engine.config = config
        self.nesting_result = self.nesting_engine.nest(self.project.pieces, self.project.fabric_settings)
        
        if self.nesting_result:
            self.project.placements = self.nesting_result.placements
            self._update_ui_from_project()
            
            message = f"排料完成: 用布长度 {self.nesting_result.fabric_length:.2f}cm, 余料率 {self.nesting_result.waste_rate:.1f}%"
            self.statusBar().showMessage(message)
            QMessageBox.information(self, "自动排料", message)
        else:
            self.statusBar().showMessage("排料失败")
            QMessageBox.warning(self, "排料失败", "无法完成排料")

    def _run_validation(self):
        if not self.project or not self.project.placements:
            QMessageBox.warning(self, "提示", "没有排料数据可以校验")
            return
        
        self.statusBar().showMessage("正在校验排料...")
        QApplication.processEvents()
        
        self.validation_result = self.validation_engine.validate(
            self.project.placements,
            self.project.fabric_settings
        )
        
        self.validation_panel.set_validation_result(self.validation_result)
        
        if self.validation_result.is_valid:
            self.statusBar().showMessage("校验通过: 所有裁片放置正确")
            QMessageBox.information(self, "校验结果", "所有裁片放置正确!")
        else:
            error_count = self.validation_result.error_count()
            warning_count = self.validation_result.warning_count()
            message = f"发现 {error_count} 个错误, {warning_count} 个警告"
            self.statusBar().showMessage(message)
            QMessageBox.warning(self, "校验结果", message)

    def _clear_all_placements(self):
        for placement in self.project.placements:
            placement.position = Point(0, 0)
            placement.rotation = 0.0
            placement.is_placed = False
        
        self.nesting_result = None
        self.validation_result = None
        self._update_ui_from_project()
        self.statusBar().showMessage("已清除所有放置")

    def _show_fabric_dialog(self):
        dialog = FabricSettingsDialog(self, self.project.fabric_settings)
        if dialog.exec_() == QDialog.Accepted:
            dialog.update_settings(self.project.fabric_settings)
            self._update_ui_from_project()
            self.statusBar().showMessage("布料设置已更新")

    def _toggle_grid(self, show: bool):
        self.canvas.set_show_grid(show)

    def _show_about(self):
        QMessageBox.about(
            self,
            "关于 纸样排料用布预估台",
            "纸样排料用布预估台 v1.0.0\n\n"
            "用于服装打样工作室的纸样排料和用布预估工具。\n\n"
            "功能:\n"
            "• 导入纸样片 (JSON/SVG)\n"
            "• 维护布料设置 (宽度、纹向、缩水率)\n"
            "• 拖拽/旋转纸样片\n"
            "• 自动排料\n"
            "• 实时校验\n"
            "• 导出报价说明和裁片清单"
        )

    def _update_ui_from_project(self):
        if self.project:
            self.piece_list.set_pieces(self.project.pieces, self.project.placements)
            self.canvas.set_project(self.project)
            self.canvas.set_fabric_settings(self.project.fabric_settings)
            self.canvas.set_placements(self.project.placements)
            self.property_panel.set_fabric_settings(self.project.fabric_settings)
            self._update_stats()

    def _update_stats(self):
        if self.project:
            total_count = len(self.project.pieces)
            total_quantity = sum(p.quantity for p in self.project.pieces)
            placed_count = sum(1 for p in self.project.placements if p.is_placed)
            
            self.stats_pieces_count.setText(f"{total_count} 种 ({total_quantity} 片)")
            
            if self.nesting_result:
                self.stats_fabric_length.setText(f"{self.nesting_result.fabric_length:.2f} cm")
                self.stats_waste_rate.setText(f"{self.nesting_result.waste_rate:.1f}%")
            else:
                max_y = 0.0
                for placement in self.project.placements:
                    if placement.is_placed:
                        from geometry.transform import Transform
                        bounds = Transform.get_bounds_after_transform(
                            placement.piece.points,
                            placement.position,
                            placement.rotation,
                            placement.mirror
                        )
                        max_y = max(max_y, bounds.bottom)
                
                if max_y > 0:
                    self.stats_fabric_length.setText(f"{max_y:.2f} cm")
                    
                    total_area = sum(p.piece.get_area() for p in self.project.placements if p.is_placed)
                    fabric_area = self.project.fabric_settings.width * max_y
                    if fabric_area > 0:
                        waste_rate = (1 - total_area / fabric_area) * 100
                        self.stats_waste_rate.setText(f"{waste_rate:.1f}%")
                    else:
                        self.stats_waste_rate.setText("-")
                else:
                    self.stats_fabric_length.setText("-")
                    self.stats_waste_rate.setText("-")


class AddPieceDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("添加裁片")
        self.setMinimumSize(400, 500)
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.name_edit = QLineEdit("新裁片")
        form_layout.addRow("名称:", self.name_edit)
        
        self.quantity_spin = QSpinBox()
        self.quantity_spin.setRange(1, 100)
        self.quantity_spin.setValue(1)
        form_layout.addRow("数量:", self.quantity_spin)
        
        self.can_rotate_check = QCheckBox("允许旋转")
        self.can_rotate_check.setChecked(True)
        form_layout.addRow(self.can_rotate_check)
        
        self.has_plaid_check = QCheckBox("需要格纹对齐")
        form_layout.addRow(self.has_plaid_check)
        
        layout.addLayout(form_layout)
        
        shape_group = QGroupBox("形状 (选择预设或输入坐标)")
        shape_layout = QVBoxLayout(shape_group)
        
        preset_layout = QHBoxLayout()
        preset_layout.addWidget(QLabel("预设形状:"))
        
        self.preset_combo = QComboBox()
        self.preset_combo.addItems(["矩形", "梯形", "自定义"])
        self.preset_combo.currentIndexChanged.connect(self._on_preset_changed)
        preset_layout.addWidget(self.preset_combo)
        preset_layout.addStretch()
        shape_layout.addLayout(preset_layout)
        
        preset_params_group = QGroupBox("形状参数")
        preset_params_layout = QFormLayout(preset_params_group)
        
        self.width_spin = QDoubleSpinBox()
        self.width_spin.setRange(0.1, 1000)
        self.width_spin.setValue(20)
        self.width_spin.setSuffix(" cm")
        preset_params_layout.addRow("宽度:", self.width_spin)
        
        self.height_spin = QDoubleSpinBox()
        self.height_spin.setRange(0.1, 1000)
        self.height_spin.setValue(30)
        self.height_spin.setSuffix(" cm")
        preset_params_layout.addRow("高度:", self.height_spin)
        
        self.top_width_spin = QDoubleSpinBox()
        self.top_width_spin.setRange(0.1, 1000)
        self.top_width_spin.setValue(15)
        self.top_width_spin.setSuffix(" cm")
        self.top_width_spin.setEnabled(False)
        preset_params_layout.addRow("上宽:", self.top_width_spin)
        
        shape_layout.addWidget(preset_params_group)
        
        custom_group = QGroupBox("自定义坐标 (每行一个点: x,y)")
        custom_layout = QVBoxLayout(custom_group)
        
        self.custom_edit = QTextEdit()
        self.custom_edit.setPlaceholderText(
            "0,0\n"
            "20,0\n"
            "20,30\n"
            "0,30"
        )
        self.custom_edit.setEnabled(False)
        custom_layout.addWidget(self.custom_edit)
        
        shape_layout.addWidget(custom_group)
        
        layout.addWidget(shape_group)
        
        button_layout = QHBoxLayout()
        
        ok_button = QPushButton("确定")
        ok_button.clicked.connect(self.accept)
        button_layout.addWidget(ok_button)
        
        cancel_button = QPushButton("取消")
        cancel_button.clicked.connect(self.reject)
        button_layout.addWidget(cancel_button)
        
        layout.addLayout(button_layout)

    def _on_preset_changed(self, index):
        is_custom = (index == 2)
        is_trapezoid = (index == 1)
        
        self.top_width_spin.setEnabled(is_trapezoid)
        self.custom_edit.setEnabled(is_custom)
        
        self.width_spin.setEnabled(not is_custom)
        self.height_spin.setEnabled(not is_custom)

    def get_piece(self) -> Piece:
        from models.piece import Piece
        from geometry.point import Point
        
        piece = Piece()
        piece.name = self.name_edit.text() or "新裁片"
        piece.quantity = self.quantity_spin.value()
        piece.can_rotate = self.can_rotate_check.isChecked()
        piece.has_plaid_match = self.has_plaid_check.isChecked()
        
        preset_index = self.preset_combo.currentIndex()
        
        if preset_index == 0:
            w = self.width_spin.value()
            h = self.height_spin.value()
            piece.points = [
                Point(0, 0),
                Point(w, 0),
                Point(w, h),
                Point(0, h)
            ]
        elif preset_index == 1:
            w = self.width_spin.value()
            h = self.height_spin.value()
            top_w = self.top_width_spin.value()
            offset = (w - top_w) / 2
            piece.points = [
                Point(offset, 0),
                Point(w - offset, 0),
                Point(w, h),
                Point(0, h)
            ]
        else:
            points = []
            text = self.custom_edit.toPlainText().strip()
            for line in text.split('\n'):
                line = line.strip()
                if line:
                    parts = line.split(',')
                    if len(parts) >= 2:
                        try:
                            x = float(parts[0].strip())
                            y = float(parts[1].strip())
                            points.append(Point(x, y))
                        except ValueError:
                            pass
            piece.points = points
        
        colors = ['#4A90D9', '#D94A4A', '#4AD94A', '#D9D94A', '#D94AD9']
        import random
        piece.color = random.choice(colors)
        
        return piece


class FabricSettingsDialog(QDialog):
    def __init__(self, parent=None, settings: FabricSettings = None):
        super().__init__(parent)
        self.setWindowTitle("布料设置")
        self.setMinimumSize(400, 450)
        self._settings = settings
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.name_edit = QLineEdit(self._settings.name if self._settings else "默认布料")
        form_layout.addRow("布料名称:", self.name_edit)
        
        self.width_spin = QDoubleSpinBox()
        self.width_spin.setRange(10, 500)
        self.width_spin.setValue(self._settings.width if self._settings else 150)
        self.width_spin.setSuffix(" cm")
        form_layout.addRow("布幅宽度:", self.width_spin)
        
        self.shrink_x_spin = QDoubleSpinBox()
        self.shrink_x_spin.setRange(-50, 50)
        self.shrink_x_spin.setValue(self._settings.shrinkage_x if self._settings else 0)
        self.shrink_x_spin.setSuffix(" %")
        form_layout.addRow("缩水率 (横向):", self.shrink_x_spin)
        
        self.shrink_y_spin = QDoubleSpinBox()
        self.shrink_y_spin.setRange(-50, 50)
        self.shrink_y_spin.setValue(self._settings.shrinkage_y if self._settings else 0)
        self.shrink_y_spin.setSuffix(" %")
        form_layout.addRow("缩水率 (纵向):", self.shrink_y_spin)
        
        self.grain_combo = QComboBox()
        self.grain_combo.addItems(["经向 (0°)", "纬向 (90°)", "斜向 (45°)"])
        form_layout.addRow("纹向:", self.grain_combo)
        
        self.margin_spin = QDoubleSpinBox()
        self.margin_spin.setRange(0, 10)
        self.margin_spin.setSingleStep(0.1)
        self.margin_spin.setValue(self._settings.safety_margin if self._settings else 0.5)
        self.margin_spin.setSuffix(" cm")
        form_layout.addRow("安全边距:", self.margin_spin)
        
        layout.addLayout(form_layout)
        
        plaid_group = QGroupBox("格纹设置")
        plaid_layout = QFormLayout(plaid_group)
        
        self.has_plaid_check = QCheckBox("布料有格纹/条纹")
        self.has_plaid_check.setChecked(self._settings.has_plaid if self._settings else False)
        plaid_layout.addRow(self.has_plaid_check)
        
        self.plaid_x_spin = QDoubleSpinBox()
        self.plaid_x_spin.setRange(0.1, 100)
        self.plaid_x_spin.setValue(self._settings.plaid_width_x if self._settings else 10)
        self.plaid_x_spin.setSuffix(" cm")
        plaid_layout.addRow("格纹间距 (横向):", self.plaid_x_spin)
        
        self.plaid_y_spin = QDoubleSpinBox()
        self.plaid_y_spin.setRange(0.1, 100)
        self.plaid_y_spin.setValue(self._settings.plaid_width_y if self._settings else 10)
        self.plaid_y_spin.setSuffix(" cm")
        plaid_layout.addRow("格纹间距 (纵向):", self.plaid_y_spin)
        
        layout.addWidget(plaid_group)
        
        button_layout = QHBoxLayout()
        
        ok_button = QPushButton("确定")
        ok_button.clicked.connect(self.accept)
        button_layout.addWidget(ok_button)
        
        cancel_button = QPushButton("取消")
        cancel_button.clicked.connect(self.reject)
        button_layout.addWidget(cancel_button)
        
        layout.addLayout(button_layout)
        
        if self._settings:
            if abs(self._settings.grain_direction - 90) < 5:
                self.grain_combo.setCurrentIndex(1)
            elif abs(self._settings.grain_direction - 45) < 5:
                self.grain_combo.setCurrentIndex(2)
            else:
                self.grain_combo.setCurrentIndex(0)

    def update_settings(self, settings: FabricSettings):
        settings.name = self.name_edit.text()
        settings.width = self.width_spin.value()
        settings.shrinkage_x = self.shrink_x_spin.value()
        settings.shrinkage_y = self.shrink_y_spin.value()
        
        grain_index = self.grain_combo.currentIndex()
        if grain_index == 1:
            settings.grain_direction = 90.0
        elif grain_index == 2:
            settings.grain_direction = 45.0
        else:
            settings.grain_direction = 0.0
        
        settings.safety_margin = self.margin_spin.value()
        settings.has_plaid = self.has_plaid_check.isChecked()
        settings.plaid_width_x = self.plaid_x_spin.value()
        settings.plaid_width_y = self.plaid_y_spin.value()
