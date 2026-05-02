import sys
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTableWidget, QTableWidgetItem, QPushButton, QLabel,
    QLineEdit, QComboBox, QGroupBox, QMessageBox, QFileDialog,
    QSplitter, QHeaderView, QProgressBar, QStatusBar, QToolBar,
    QDialog, QDialogButtonBox, QTextEdit, QSpinBox, QDoubleSpinBox,
    QCheckBox, QFormLayout, QFrame, QScrollArea, QSizePolicy
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal
from PyQt5.QtGui import QFont, QIcon, QPixmap

from src.storage.database import DAOFactory
from src.storage.undo_manager import UndoManager, EntityType, get_undo_manager
from src.rules.rules_engine import RulesEngine, get_rules_engine, RuleResult
from src.io.importer import CSVImporter, JSONLImporter, ImportResult, get_csv_importer, get_jsonl_importer
from src.io.exporter import MarkdownExporter, CSVExporter, JSONExporter, ExportResult, get_markdown_exporter, get_csv_exporter, get_json_exporter
from src.models.models import (
    Team, Material, BorrowRecord, BorrowItem,
    ReturnRecord, ReturnItem, DamageRecord, AnomalyRecord,
    MaterialStatus, ReturnStatus
)


class ReturnRegistrationDialog(QDialog):
    def __init__(self, borrow_record: BorrowRecord, parent=None):
        super().__init__(parent)
        self.borrow_record = borrow_record
        self.dao_factory = DAOFactory
        self.rules_engine = get_rules_engine()
        self.return_items: List[Dict[str, Any]] = []
        self.anomalies: List[RuleResult] = []
        
        self.setWindowTitle(f"归还登记 - 借出编号: {borrow_record.borrow_code}")
        self.setMinimumSize(800, 600)
        self._init_ui()
        self._load_borrowed_materials()
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        info_group = QGroupBox("借出信息")
        info_layout = QFormLayout(info_group)
        
        team_dao = self.dao_factory.get_team_dao()
        team = team_dao.get_by_id(self.borrow_record.team_id)
        
        info_layout.addRow("队伍:", QLabel(f"{team.team_code} - {team.team_name}" if team else "-"))
        info_layout.addRow("借出时间:", QLabel(self.borrow_record.borrow_date.strftime("%Y-%m-%d %H:%M")))
        info_layout.addRow("预计归还:", QLabel(
            self.borrow_record.expected_return_date.strftime("%Y-%m-%d %H:%M") 
            if self.borrow_record.expected_return_date else "-"
        ))
        info_layout.addRow("押金金额:", QLabel(f"¥{self.borrow_record.deposit_amount:.2f}"))
        layout.addWidget(info_group)
        
        input_group = QGroupBox("扫码/手工登记")
        input_layout = QHBoxLayout(input_group)
        
        input_layout.addWidget(QLabel("条形码:"))
        self.barcode_edit = QLineEdit()
        self.barcode_edit.setPlaceholderText("扫码枪扫描或手动输入条形码...")
        self.barcode_edit.returnPressed.connect(self._add_by_barcode)
        input_layout.addWidget(self.barcode_edit)
        
        self.add_btn = QPushButton("添加")
        self.add_btn.clicked.connect(self._add_by_barcode)
        input_layout.addWidget(self.add_btn)
        
        input_layout.addStretch()
        
        layout.addWidget(input_group)
        
        table_group = QGroupBox("已登记物资")
        table_layout = QVBoxLayout(table_group)
        
        self.return_table = QTableWidget()
        self.return_table.setColumnCount(6)
        self.return_table.setHorizontalHeaderLabels([
            "条形码", "物资名称", "类型", "重量(kg)", "破损", "操作"
        ])
        self.return_table.horizontalHeader().setStretchLastSection(False)
        self.return_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Fixed)
        self.return_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.return_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Fixed)
        self.return_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Fixed)
        self.return_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.Fixed)
        self.return_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.Fixed)
        self.return_table.setColumnWidth(0, 120)
        self.return_table.setColumnWidth(2, 100)
        self.return_table.setColumnWidth(3, 100)
        self.return_table.setColumnWidth(4, 80)
        self.return_table.setColumnWidth(5, 100)
        table_layout.addWidget(self.return_table)
        
        layout.addWidget(table_group)
        
        settle_group = QGroupBox("结算信息")
        settle_layout = QFormLayout(settle_group)
        
        self.total_weight_label = QLabel("0.00 kg")
        settle_layout.addRow("总重量:", self.total_weight_label)
        
        self.deposit_spin = QDoubleSpinBox()
        self.deposit_spin.setRange(0, 1000000)
        self.deposit_spin.setDecimals(2)
        self.deposit_spin.setValue(self.borrow_record.deposit_amount or 0.0)
        settle_layout.addRow("实退押金(¥):", self.deposit_spin)
        
        self.receiver_edit = QLineEdit()
        self.receiver_edit.setPlaceholderText("接收人姓名")
        settle_layout.addRow("接收人:", self.receiver_edit)
        
        self.remarks_edit = QTextEdit()
        self.remarks_edit.setMaximumHeight(80)
        self.remarks_edit.setPlaceholderText("备注信息...")
        settle_layout.addRow("备注:", self.remarks_edit)
        
        layout.addWidget(settle_group)
        
        anomaly_group = QGroupBox("异常检测")
        anomaly_layout = QVBoxLayout(anomaly_group)
        
        self.anomaly_list = QTextEdit()
        self.anomaly_list.setReadOnly(True)
        self.anomaly_list.setMaximumHeight(100)
        self.anomaly_list.setPlaceholderText("暂无异常...")
        anomaly_layout.addWidget(self.anomaly_list)
        
        layout.addWidget(anomaly_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        buttons.button(QDialogButtonBox.Ok).setText("确认归还")
        buttons.button(QDialogButtonBox.Cancel).setText("取消")
        buttons.accepted.connect(self._confirm_return)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _load_borrowed_materials(self):
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        material_dao = self.dao_factory.get_material_dao()
        
        self.borrowed_materials: Dict[str, Dict[str, Any]] = {}
        items = borrow_item_dao.get_by_borrow_record(self.borrow_record.id)
        
        for item in items:
            if not item.is_returned:
                material = material_dao.get_by_id(item.material_id)
                if material:
                    self.borrowed_materials[material.barcode] = {
                        'material': material,
                        'borrow_item': item,
                        'quantity': item.quantity - item.returned_quantity
                    }
    
    def _add_by_barcode(self):
        barcode = self.barcode_edit.text().strip()
        if not barcode:
            return
        
        material_dao = self.dao_factory.get_material_dao()
        material = material_dao.get_by_barcode(barcode)
        
        if not material:
            QMessageBox.warning(self, "警告", f"未找到条形码 {barcode} 对应的物资")
            return
        
        for item in self.return_items:
            if item.get('barcode') == barcode:
                QMessageBox.warning(self, "警告", f"条形码 {barcode} 已在归还列表中")
                return
        
        duplicate_check = self.rules_engine.check_duplicate_return(
            barcode=barcode,
            borrow_record_id=self.borrow_record.id
        )
        
        if not duplicate_check.passed:
            QMessageBox.warning(self, "重复归还", duplicate_check.message)
            return
        
        return_item = {
            'barcode': barcode,
            'material': material,
            'weight_kg': material.weight_kg,
            'has_damage': False,
            'damage_description': '',
            'remarks': ''
        }
        
        self.return_items.append(return_item)
        self._refresh_table()
        self._run_anomaly_check()
        
        self.barcode_edit.clear()
        self.barcode_edit.setFocus()
    
    def _refresh_table(self):
        self.return_table.setRowCount(len(self.return_items))
        
        for row, item in enumerate(self.return_items):
            material = item['material']
            
            self.return_table.setItem(row, 0, QTableWidgetItem(item['barcode']))
            self.return_table.setItem(row, 1, QTableWidgetItem(material.material_name))
            self.return_table.setItem(row, 2, QTableWidgetItem(material.material_type))
            
            weight_item = QTableWidgetItem(f"{item['weight_kg']:.2f}")
            weight_item.setFlags(weight_item.flags() | Qt.ItemIsEditable)
            self.return_table.setItem(row, 3, weight_item)
            
            damage_cb = QCheckBox()
            damage_cb.setChecked(item.get('has_damage', False))
            damage_cb.stateChanged.connect(
                lambda state, r=row: self._on_damage_changed(r, state)
            )
            cell_widget = QWidget()
            cb_layout = QHBoxLayout(cell_widget)
            cb_layout.addWidget(damage_cb)
            cb_layout.setAlignment(Qt.AlignCenter)
            cb_layout.setContentsMargins(0, 0, 0, 0)
            self.return_table.setCellWidget(row, 4, cell_widget)
            
            remove_btn = QPushButton("删除")
            remove_btn.clicked.connect(lambda checked, r=row: self._remove_item(r))
            self.return_table.setCellWidget(row, 5, remove_btn)
        
        total_weight = sum(item.get('weight_kg', 0) for item in self.return_items)
        self.total_weight_label.setText(f"{total_weight:.2f} kg")
    
    def _on_damage_changed(self, row: int, state: int):
        self.return_items[row]['has_damage'] = (state == Qt.Checked)
        
        if state == Qt.Checked:
            dialog = DamageDialog(self)
            if dialog.exec_() == QDialog.Accepted:
                self.return_items[row]['damage_description'] = dialog.get_damage_description()
                self.return_items[row]['damage_type'] = dialog.get_damage_type()
                self.return_items[row]['photo_path'] = dialog.get_photo_path()
            else:
                self.return_items[row]['has_damage'] = False
                self._refresh_table()
    
    def _remove_item(self, row: int):
        if 0 <= row < len(self.return_items):
            del self.return_items[row]
            self._refresh_table()
            self._run_anomaly_check()
    
    def _run_anomaly_check(self):
        if not self.return_items:
            self.anomaly_list.clear()
            self.anomalies = []
            return
        
        barcodes = [item['barcode'] for item in self.return_items]
        measured_weights = {item['barcode']: item['weight_kg'] for item in self.return_items}
        deposit_returned = self.deposit_spin.value()
        
        anomalies = self.rules_engine.check_all_return_rules(
            borrow_record_id=self.borrow_record.id,
            barcodes=barcodes,
            measured_weights=measured_weights,
            deposit_returned=deposit_returned,
            return_date=datetime.now()
        )
        
        self.anomalies = anomalies
        
        if anomalies:
            text = "\n".join([f"[{a.anomaly_type.value if a.anomaly_type else '异常'}] {a.message}" for a in anomalies])
            self.anomaly_list.setPlainText(text)
        else:
            self.anomaly_list.setPlainText("所有检查通过，无异常")
    
    def _confirm_return(self):
        if not self.return_items:
            QMessageBox.warning(self, "警告", "请先添加要归还的物资")
            return
        
        reply = QMessageBox.question(
            self, "确认",
            f"确认归还 {len(self.return_items)} 件物资？\n实退押金: ¥{self.deposit_spin.value():.2f}",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        try:
            self._save_return()
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"保存失败: {str(e)}")
    
    def _save_return(self):
        return_dao = self.dao_factory.get_return_record_dao()
        return_item_dao = self.dao_factory.get_return_item_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        damage_dao = self.dao_factory.get_damage_record_dao()
        material_dao = self.dao_factory.get_material_dao()
        undo_manager = get_undo_manager()
        
        return_code = f"RT{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        total_weight = sum(item.get('weight_kg', 0) for item in self.return_items)
        
        return_record = return_dao.create(
            return_code=return_code,
            borrow_record_id=self.borrow_record.id,
            team_id=self.borrow_record.team_id,
            return_date=datetime.now(),
            total_weight_kg=total_weight,
            deposit_returned=self.deposit_spin.value(),
            is_deposit_settled=True,
            receiver_name=self.receiver_edit.text() or None,
            status=ReturnStatus.COMPLETED,
            remarks=self.remarks_edit.toPlainText() or None
        )
        
        saved_items = []
        for item in self.return_items:
            material = item['material']
            
            return_item = return_item_dao.create(
                return_record_id=return_record.id,
                material_id=material.id,
                quantity=1,
                weight_kg=item['weight_kg'],
                has_damage=item.get('has_damage', False),
                remarks=item.get('remarks', '')
            )
            saved_items.append(return_item)
            
            material_dao.update_status(material.id, MaterialStatus.RETURNED)
            
            if barcode := item.get('barcode'):
                for barcode_info in self.borrowed_materials.values():
                    borrow_item = barcode_info.get('borrow_item')
                    if borrow_item and barcode_info.get('material', {}).id == material.id:
                        new_returned = borrow_item.returned_quantity + 1
                        borrow_item_dao.update(
                            borrow_item.id,
                            returned_quantity=new_returned,
                            is_returned=new_returned >= borrow_item.quantity
                        )
                        break
            
            if item.get('has_damage'):
                damage_dao.create(
                    return_record_id=return_record.id,
                    material_id=material.id,
                    damage_type=item.get('damage_type', ''),
                    damage_description=item.get('damage_description', ''),
                    photo_path=item.get('photo_path', ''),
                    responsible_person=None,
                    estimated_cost=0.0,
                    is_approved=False
                )
        
        borrow_items = borrow_item_dao.get_by_borrow_record(self.borrow_record.id)
        all_returned = all(item.is_returned or item.returned_quantity >= item.quantity for item in borrow_items)
        
        borrow_dao.update(
            self.borrow_record.id,
            status=ReturnStatus.COMPLETED if all_returned else ReturnStatus.PARTIAL
        )
        
        for anomaly in self.anomalies:
            self.rules_engine.create_anomaly_record(
                anomaly,
                borrow_record_id=self.borrow_record.id,
                return_record_id=return_record.id,
                team_id=self.borrow_record.team_id
            )
        
        updated_borrow = borrow_dao.get_by_id(self.borrow_record.id)
        undo_manager.log_return_creation(
            return_record=return_record,
            return_items=saved_items,
            borrow_record=updated_borrow
        )


class DamageDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("破损登记")
        self.setMinimumWidth(400)
        self.photo_path = ""
        self._init_ui()
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        form_layout = QFormLayout()
        
        self.type_combo = QComboBox()
        self.type_combo.addItems(["轻微磨损", "明显损坏", "严重损坏", "丢失", "其他"])
        form_layout.addRow("破损类型:", self.type_combo)
        
        self.description_edit = QTextEdit()
        self.description_edit.setMaximumHeight(100)
        self.description_edit.setPlaceholderText("请详细描述破损情况...")
        form_layout.addRow("破损描述:", self.description_edit)
        
        photo_group = QGroupBox("照片上传")
        photo_layout = QVBoxLayout(photo_group)
        
        self.photo_label = QLabel("尚未选择照片")
        self.photo_label.setAlignment(Qt.AlignCenter)
        self.photo_label.setMinimumHeight(100)
        self.photo_label.setStyleSheet("border: 1px dashed gray;")
        photo_layout.addWidget(self.photo_label)
        
        photo_btn = QPushButton("选择照片")
        photo_btn.clicked.connect(self._select_photo)
        photo_layout.addWidget(photo_btn)
        
        layout.addLayout(form_layout)
        layout.addWidget(photo_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _select_photo(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择照片", "",
            "图片文件 (*.jpg *.jpeg *.png *.bmp)"
        )
        
        if file_path:
            self.photo_path = file_path
            self.photo_label.setText(f"已选择: {file_path}")
    
    def get_damage_type(self) -> str:
        return self.type_combo.currentText()
    
    def get_damage_description(self) -> str:
        return self.description_edit.toPlainText()
    
    def get_photo_path(self) -> str:
        return self.photo_path


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.dao_factory = DAOFactory
        self.undo_manager = get_undo_manager()
        self.rules_engine = get_rules_engine()
        
        self.setWindowTitle("可复用物资回收称重台")
        self.setMinimumSize(1200, 800)
        
        self._init_menu_bar()
        self._init_tool_bar()
        self._init_central_widget()
        self._init_status_bar()
        
        self._refresh_data()
    
    def _init_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        import_menu = file_menu.addMenu("导入(&I)")
        import_menu.addAction("导入物资清单 CSV", self._import_materials)
        import_menu.addAction("导入队伍/摊位 CSV", self._import_teams)
        import_menu.addAction("导入借出记录 CSV", self._import_borrow_records)
        import_menu.addAction("导入现场回收 JSONL", self._import_field_records)
        file_menu.addSeparator()
        
        export_menu = file_menu.addMenu("导出(&E)")
        export_menu.addAction("导出 Markdown 结算单", self._export_settlement)
        export_menu.addAction("导出 CSV 异常表", self._export_anomalies)
        export_menu.addAction("导出 JSON 审计包", self._export_audit_package)
        file_menu.addSeparator()
        
        exit_action = file_menu.addAction("退出(&X)", self.close)
        exit_action.setShortcut("Ctrl+Q")
        
        edit_menu = menubar.addMenu("编辑(&E)")
        self.undo_action = edit_menu.addAction("撤销(&U)", self._undo_last)
        self.undo_action.setShortcut("Ctrl+Z")
        
        help_menu = menubar.addMenu("帮助(&H)")
        help_menu.addAction("关于(&A)", self._show_about)
    
    def _init_tool_bar(self):
        toolbar = self.addToolBar("主工具栏")
        
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self._refresh_data)
        toolbar.addWidget(refresh_btn)
        
        toolbar.addSeparator()
        
        register_btn = QPushButton("归还登记")
        register_btn.clicked.connect(self._show_return_registration)
        toolbar.addWidget(register_btn)
        
        toolbar.addSeparator()
        
        undo_btn = QPushButton("撤销")
        undo_btn.clicked.connect(self._undo_last)
        toolbar.addWidget(undo_btn)
    
    def _init_central_widget(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        splitter = QSplitter(Qt.Horizontal)
        
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        
        progress_group = QGroupBox("回收进度 - 按队伍/摊位")
        progress_layout = QVBoxLayout(progress_group)
        
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("筛选:"))
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("搜索队伍/摊位...")
        self.search_edit.textChanged.connect(self._filter_teams)
        filter_layout.addWidget(self.search_edit)
        
        self.status_filter = QComboBox()
        self.status_filter.addItems(["全部", "待归还", "部分归还", "已完成", "已超时"])
        self.status_filter.currentIndexChanged.connect(self._filter_teams)
        filter_layout.addWidget(self.status_filter)
        
        progress_layout.addLayout(filter_layout)
        
        self.team_table = QTableWidget()
        self.team_table.setColumnCount(5)
        self.team_table.setHorizontalHeaderLabels([
            "队伍编号", "队伍名称", "摊位号", "借出/归还", "状态"
        ])
        self.team_table.horizontalHeader().setStretchLastSection(True)
        self.team_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.team_table.itemSelectionChanged.connect(self._on_team_selected)
        progress_layout.addWidget(self.team_table)
        
        left_layout.addWidget(progress_group)
        
        splitter.addWidget(left_panel)
        
        right_panel = QTabWidget()
        
        detail_tab = QWidget()
        detail_layout = QVBoxLayout(detail_tab)
        
        detail_group = QGroupBox("借出详情")
        detail_table_layout = QVBoxLayout(detail_group)
        
        self.detail_table = QTableWidget()
        self.detail_table.setColumnCount(5)
        self.detail_table.setHorizontalHeaderLabels([
            "借出编号", "借出时间", "物资数量", "已归还", "押金"
        ])
        self.detail_table.horizontalHeader().setStretchLastSection(True)
        detail_table_layout.addWidget(self.detail_table)
        
        detail_layout.addWidget(detail_group)
        
        material_group = QGroupBox("借出物资")
        material_layout = QVBoxLayout(material_group)
        
        self.material_table = QTableWidget()
        self.material_table.setColumnCount(6)
        self.material_table.setHorizontalHeaderLabels([
            "条形码", "物资名称", "类型", "规格", "重量(kg)", "状态"
        ])
        self.material_table.horizontalHeader().setStretchLastSection(True)
        material_layout.addWidget(self.material_table)
        
        detail_layout.addWidget(material_group)
        
        right_panel.addTab(detail_tab, "详情")
        
        anomaly_tab = QWidget()
        anomaly_layout = QVBoxLayout(anomaly_tab)
        
        self.anomaly_table = QTableWidget()
        self.anomaly_table.setColumnCount(6)
        self.anomaly_table.setHorizontalHeaderLabels([
            "类型", "队伍", "描述", "状态", "创建时间", "备注"
        ])
        self.anomaly_table.horizontalHeader().setStretchLastSection(True)
        anomaly_layout.addWidget(self.anomaly_table)
        
        right_panel.addTab(anomaly_tab, "异常记录")
        
        operation_tab = QWidget()
        operation_layout = QVBoxLayout(operation_tab)
        
        log_group = QGroupBox("操作日志(可撤销)")
        log_layout = QVBoxLayout(log_group)
        
        self.log_table = QTableWidget()
        self.log_table.setColumnCount(5)
        self.log_table.setHorizontalHeaderLabels([
            "操作类型", "实体类型", "实体ID", "操作时间", "状态"
        ])
        self.log_table.horizontalHeader().setStretchLastSection(True)
        log_layout.addWidget(self.log_table)
        
        operation_layout.addWidget(log_group)
        
        right_panel.addTab(operation_tab, "操作日志")
        
        splitter.addWidget(right_panel)
        splitter.setSizes([400, 800])
        
        main_layout.addWidget(splitter)
    
    def _init_status_bar(self):
        self.statusbar = self.statusBar()
        self.statusbar.showMessage("就绪")
        
        self.total_teams_label = QLabel("队伍: 0")
        self.total_materials_label = QLabel("物资: 0")
        self.pending_label = QLabel("待归还: 0")
        
        self.statusbar.addPermanentWidget(self.total_teams_label)
        self.statusbar.addPermanentWidget(self.total_materials_label)
        self.statusbar.addPermanentWidget(self.pending_label)
    
    def _refresh_data(self):
        self._refresh_team_table()
        self._refresh_anomaly_table()
        self._refresh_log_table()
        self._update_status_bar()
    
    def _refresh_team_table(self):
        team_dao = self.dao_factory.get_team_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        
        teams = team_dao.get_all()
        
        self.team_table.setRowCount(0)
        
        for team in teams:
            borrow_records = borrow_dao.get_by_team(team.id)
            
            total_borrowed = 0
            total_returned = 0
            overall_status = ReturnStatus.PENDING
            
            for br in borrow_records:
                items = borrow_item_dao.get_by_borrow_record(br.id)
                for item in items:
                    total_borrowed += item.quantity
                    total_returned += item.returned_quantity
                
                if br.status == ReturnStatus.OVERDUE:
                    overall_status = ReturnStatus.OVERDUE
                elif br.status == ReturnStatus.PENDING and overall_status != ReturnStatus.OVERDUE:
                    overall_status = ReturnStatus.PENDING
                elif br.status == ReturnStatus.PARTIAL and overall_status not in [ReturnStatus.OVERDUE, ReturnStatus.PENDING]:
                    overall_status = ReturnStatus.PARTIAL
                elif br.status == ReturnStatus.COMPLETED and overall_status == ReturnStatus.COMPLETED:
                    overall_status = ReturnStatus.COMPLETED
            
            row = self.team_table.rowCount()
            self.team_table.insertRow(row)
            
            self.team_table.setItem(row, 0, QTableWidgetItem(team.team_code))
            self.team_table.setItem(row, 1, QTableWidgetItem(team.team_name))
            self.team_table.setItem(row, 2, QTableWidgetItem(team.booth_number or "-"))
            self.team_table.setItem(row, 3, QTableWidgetItem(f"{total_returned}/{total_borrowed}"))
            self.team_table.setItem(row, 4, QTableWidgetItem(overall_status.value))
            
            self.team_table.item(row, 0).setData(Qt.UserRole, team.id)
        
        self.team_table.resizeColumnsToContents()
    
    def _refresh_anomaly_table(self):
        anomaly_dao = self.dao_factory.get_anomaly_record_dao()
        team_dao = self.dao_factory.get_team_dao()
        
        anomalies = anomaly_dao.get_all()
        
        self.anomaly_table.setRowCount(0)
        
        for anomaly in anomalies:
            row = self.anomaly_table.rowCount()
            self.anomaly_table.insertRow(row)
            
            team = team_dao.get_by_id(anomaly.team_id) if anomaly.team_id else None
            
            self.anomaly_table.setItem(row, 0, QTableWidgetItem(anomaly.anomaly_type))
            self.anomaly_table.setItem(row, 1, QTableWidgetItem(team.team_name if team else "-"))
            self.anomaly_table.setItem(row, 2, QTableWidgetItem(anomaly.description))
            self.anomaly_table.setItem(row, 3, QTableWidgetItem("已解决" if anomaly.is_resolved else "未解决"))
            self.anomaly_table.setItem(row, 4, QTableWidgetItem(
                anomaly.created_at.strftime("%Y-%m-%d %H:%M") if anomaly.created_at else "-"
            ))
            self.anomaly_table.setItem(row, 5, QTableWidgetItem(anomaly.remarks or "-"))
        
        self.anomaly_table.resizeColumnsToContents()
    
    def _refresh_log_table(self):
        logs = self.undo_manager.get_undoable_operations()
        
        self.log_table.setRowCount(0)
        
        for log in logs[:50]:
            row = self.log_table.rowCount()
            self.log_table.insertRow(row)
            
            self.log_table.setItem(row, 0, QTableWidgetItem(log.operation_type))
            self.log_table.setItem(row, 1, QTableWidgetItem(log.entity_type))
            self.log_table.setItem(row, 2, QTableWidgetItem(str(log.entity_id)))
            self.log_table.setItem(row, 3, QTableWidgetItem(
                log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "-"
            ))
            self.log_table.setItem(row, 4, QTableWidgetItem("已撤销" if log.is_undone else "可撤销"))
        
        self.log_table.resizeColumnsToContents()
    
    def _update_status_bar(self):
        team_dao = self.dao_factory.get_team_dao()
        material_dao = self.dao_factory.get_material_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        
        teams = team_dao.get_all()
        materials = material_dao.get_all()
        pending = borrow_dao.get_by_status(ReturnStatus.PENDING)
        
        self.total_teams_label.setText(f"队伍: {len(teams)}")
        self.total_materials_label.setText(f"物资: {len(materials)}")
        self.pending_label.setText(f"待归还: {len(pending)}")
    
    def _filter_teams(self):
        search_text = self.search_edit.text().lower()
        status_filter = self.status_filter.currentText()
        
        for row in range(self.team_table.rowCount()):
            show = True
            
            if search_text:
                team_code = self.team_table.item(row, 0).text().lower()
                team_name = self.team_table.item(row, 1).text().lower()
                booth = self.team_table.item(row, 2).text().lower()
                
                if search_text not in team_code and search_text not in team_name and search_text not in booth:
                    show = False
            
            if show and status_filter != "全部":
                status = self.team_table.item(row, 4).text()
                if status != status_filter:
                    show = False
            
            self.team_table.setRowHidden(row, not show)
    
    def _on_team_selected(self):
        selected_rows = self.team_table.selectedItems()
        if not selected_rows:
            return
        
        row = selected_rows[0].row()
        team_id = self.team_table.item(row, 0).data(Qt.UserRole)
        
        if team_id:
            self._load_team_details(team_id)
    
    def _load_team_details(self, team_id: int):
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        material_dao = self.dao_factory.get_material_dao()
        
        borrow_records = borrow_dao.get_by_team(team_id)
        
        self.detail_table.setRowCount(0)
        self.material_table.setRowCount(0)
        
        for br in borrow_records:
            row = self.detail_table.rowCount()
            self.detail_table.insertRow(row)
            
            items = borrow_item_dao.get_by_borrow_record(br.id)
            total_qty = sum(i.quantity for i in items)
            returned_qty = sum(i.returned_quantity for i in items)
            
            self.detail_table.setItem(row, 0, QTableWidgetItem(br.borrow_code))
            self.detail_table.setItem(row, 1, QTableWidgetItem(
                br.borrow_date.strftime("%Y-%m-%d %H:%M") if br.borrow_date else "-"
            ))
            self.detail_table.setItem(row, 2, QTableWidgetItem(str(total_qty)))
            self.detail_table.setItem(row, 3, QTableWidgetItem(str(returned_qty)))
            self.detail_table.setItem(row, 4, QTableWidgetItem(f"¥{br.deposit_amount:.2f}"))
            
            self.detail_table.item(row, 0).setData(Qt.UserRole, br.id)
            
            for item in items:
                material = material_dao.get_by_id(item.material_id)
                if material:
                    m_row = self.material_table.rowCount()
                    self.material_table.insertRow(m_row)
                    
                    status = "已归还" if item.is_returned else "未归还"
                    
                    self.material_table.setItem(m_row, 0, QTableWidgetItem(material.barcode))
                    self.material_table.setItem(m_row, 1, QTableWidgetItem(material.material_name))
                    self.material_table.setItem(m_row, 2, QTableWidgetItem(material.material_type))
                    self.material_table.setItem(m_row, 3, QTableWidgetItem(material.specification or "-"))
                    self.material_table.setItem(m_row, 4, QTableWidgetItem(str(material.weight_kg)))
                    self.material_table.setItem(m_row, 5, QTableWidgetItem(status))
        
        self.detail_table.resizeColumnsToContents()
        self.material_table.resizeColumnsToContents()
    
    def _import_materials(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择物资清单 CSV", "", "CSV 文件 (*.csv)"
        )
        
        if file_path:
            importer = get_csv_importer()
            result = importer.import_materials(file_path)
            self._show_import_result(result, "物资清单")
    
    def _import_teams(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择队伍 CSV", "", "CSV 文件 (*.csv)"
        )
        
        if file_path:
            importer = get_csv_importer()
            result = importer.import_teams(file_path)
            self._show_import_result(result, "队伍/摊位")
    
    def _import_borrow_records(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择借出记录 CSV", "", "CSV 文件 (*.csv)"
        )
        
        if file_path:
            importer = get_csv_importer()
            result = importer.import_borrow_records(file_path)
            self._show_import_result(result, "借出记录")
    
    def _import_field_records(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择现场回收 JSONL", "", "JSONL 文件 (*.jsonl)"
        )
        
        if file_path:
            importer = get_jsonl_importer()
            result = importer.import_field_records(file_path)
            self._show_import_result(result, "现场回收记录")
    
    def _show_import_result(self, result: ImportResult, data_type: str):
        if result.success:
            QMessageBox.information(
                self, "导入成功",
                f"{data_type}导入完成\n\n"
                f"总计: {result.total_count} 条\n"
                f"成功: {result.imported_count} 条\n"
                f"跳过: {result.skipped_count} 条\n"
                f"警告: {len(result.warnings)} 个"
            )
            self._refresh_data()
        else:
            error_text = "\n".join(result.errors[:10])
            QMessageBox.critical(
                self, "导入失败",
                f"{data_type}导入失败\n\n错误:\n{error_text}"
            )
    
    def _export_settlement(self):
        selected_rows = self.team_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "提示", "请先选择一个队伍")
            return
        
        row = selected_rows[0].row()
        team_id = self.team_table.item(row, 0).data(Qt.UserRole)
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存结算单", "", "Markdown 文件 (*.md)"
        )
        
        if file_path:
            exporter = get_markdown_exporter()
            result = exporter.export_settlement_by_team(team_id, file_path)
            self._show_export_result(result, "结算单")
    
    def _export_anomalies(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存异常表", "", "CSV 文件 (*.csv)"
        )
        
        if file_path:
            exporter = get_csv_exporter()
            result = exporter.export_anomalies(file_path, only_unresolved=False)
            self._show_export_result(result, "异常表")
    
    def _export_audit_package(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存审计包", "", "JSON 文件 (*.json)"
        )
        
        if file_path:
            exporter = get_json_exporter()
            result = exporter.export_audit_package(file_path)
            self._show_export_result(result, "审计包")
    
    def _show_export_result(self, result: ExportResult, data_type: str):
        if result.success:
            QMessageBox.information(
                self, "导出成功",
                f"{data_type}导出成功\n\n"
                f"文件: {result.output_path}\n"
                f"记录数: {result.records_count}"
            )
        else:
            error_text = "\n".join(result.errors)
            QMessageBox.critical(
                self, "导出失败",
                f"{data_type}导出失败\n\n错误:\n{error_text}"
            )
    
    def _show_return_registration(self):
        selected_rows = self.detail_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "提示", "请先在右侧详情表中选择一个借出记录")
            return
        
        row = selected_rows[0].row()
        borrow_id = self.detail_table.item(row, 0).data(Qt.UserRole)
        
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_record = borrow_dao.get_by_id(borrow_id)
        
        if not borrow_record:
            QMessageBox.warning(self, "错误", "找不到借出记录")
            return
        
        if borrow_record.status == ReturnStatus.COMPLETED:
            QMessageBox.warning(self, "提示", "该借出记录已完成归还")
            return
        
        dialog = ReturnRegistrationDialog(borrow_record, self)
        if dialog.exec_() == QDialog.Accepted:
            QMessageBox.information(self, "成功", "归还登记完成")
            self._refresh_data()
    
    def _undo_last(self):
        undoable = self.undo_manager.get_undoable_operations()
        if not undoable:
            QMessageBox.information(self, "提示", "没有可撤销的操作")
            return
        
        last_op = undoable[0]
        reply = QMessageBox.question(
            self, "确认撤销",
            f"是否撤销以下操作?\n\n"
            f"操作类型: {last_op.operation_type}\n"
            f"实体类型: {last_op.entity_type}\n"
            f"操作时间: {last_op.created_at}",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            if self.undo_manager.undo_last_operation():
                QMessageBox.information(self, "成功", "操作已撤销")
                self._refresh_data()
            else:
                QMessageBox.critical(self, "错误", "撤销失败")
    
    def _show_about(self):
        QMessageBox.about(
            self, "关于",
            "可复用物资回收称重台 v1.0.0\n\n"
            "用于大型志愿活动后勤组的物资回收管理工具\n\n"
            "功能:\n"
            "- 物资清单 CSV 导入\n"
            "- 借出记录导入\n"
            "- 扫码/手工登记归还\n"
            "- 称重校验\n"
            "- 破损拍照备注\n"
            "- 规则引擎检测异常\n"
            "- 撤销操作\n"
            "- 导出结算单/异常表/审计包"
        )
