import sys
import os
import csv
import json
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QTableWidget, QTableWidgetItem, QHeaderView,
    QFileDialog, QMessageBox, QTabWidget, QGroupBox, QTextEdit,
    QComboBox, QSplitter, QFrame, QDateEdit, QCheckBox
)
from PyQt5.QtCore import Qt, QDate
from PyQt5.QtGui import QColor, QFont

from data_models import (
    InspectionRecord, SensorRecord, EmptyingRecord, ComplaintRecord,
    ToiletInfo, RiskItem, RiskType, RiskLevel, ActionType
)
from risk_engine import RiskEngine


class ToiletRiskManager(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.inspections: List[InspectionRecord] = []
        self.sensors: List[SensorRecord] = []
        self.emptyings: List[EmptyingRecord] = []
        self.complaints: List[ComplaintRecord] = []
        self.risks: List[RiskItem] = []
        self.filtered_risks: List[RiskItem] = []
        
        self.toilets: Dict[str, ToiletInfo] = self._load_default_toilets()
        self.local_storage_path = os.path.join(os.path.dirname(__file__), "local_data.json")
        self._load_local_storage()
        
        self._init_ui()
    
    def _load_default_toilets(self) -> Dict[str, ToiletInfo]:
        return {
            "T001": ToiletInfo(
                toilet_id="T001",
                name="东门入口公厕",
                location="景区东门入口处",
                total_stalls=12,
                inspection_interval_minutes=60,
                emptying_cycle_days=30,
                ammonia_threshold=25.0,
                peak_flow_threshold=50
            ),
            "T002": ToiletInfo(
                toilet_id="T002",
                name="中心广场公厕",
                location="景区中心广场东侧",
                total_stalls=20,
                inspection_interval_minutes=45,
                emptying_cycle_days=20,
                ammonia_threshold=25.0,
                peak_flow_threshold=80
            ),
            "T003": ToiletInfo(
                toilet_id="T003",
                name="北门停车场公厕",
                location="景区北门停车场",
                total_stalls=15,
                inspection_interval_minutes=60,
                emptying_cycle_days=30,
                ammonia_threshold=25.0,
                peak_flow_threshold=60
            ),
            "T004": ToiletInfo(
                toilet_id="T004",
                name="山顶观景台公厕",
                location="景区山顶观景台",
                total_stalls=8,
                inspection_interval_minutes=90,
                emptying_cycle_days=45,
                ammonia_threshold=25.0,
                peak_flow_threshold=30
            )
        }
    
    def _init_ui(self):
        self.setWindowTitle("景区公厕保洁风险管控系统 v1.0")
        self.setGeometry(100, 100, 1400, 900)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(10)
        main_layout.setContentsMargins(10, 10, 10, 10)
        
        toolbar_group = QGroupBox("数据导入与分析")
        toolbar_layout = QHBoxLayout(toolbar_group)
        
        import_buttons = [
            ("导入巡检记录 (CSV)", self._import_inspections),
            ("导入传感器数据 (JSONL)", self._import_sensors),
            ("导入清掏记录 (JSON)", self._import_emptyings),
            ("导入投诉记录 (JSON)", self._import_complaints),
        ]
        
        for label, func in import_buttons:
            btn = QPushButton(label)
            btn.clicked.connect(func)
            toolbar_layout.addWidget(btn)
        
        toolbar_layout.addWidget(QLabel("分析日期:"))
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDate(QDate.currentDate())
        toolbar_layout.addWidget(self.date_edit)
        
        analyze_btn = QPushButton("开始风险分析")
        analyze_btn.setStyleSheet("background-color: #4CAF50; color: white; font-weight: bold;")
        analyze_btn.clicked.connect(self._analyze_risks)
        toolbar_layout.addWidget(analyze_btn)
        
        toolbar_layout.addStretch()
        
        export_buttons = [
            ("导出 Markdown 交接单", self._export_markdown),
            ("导出 JSON 审计明细", self._export_json),
            ("加载示例数据", self._load_sample_data),
        ]
        
        for label, func in export_buttons:
            btn = QPushButton(label)
            btn.clicked.connect(func)
            toolbar_layout.addWidget(btn)
        
        main_layout.addWidget(toolbar_group)
        
        filter_group = QGroupBox("筛选条件")
        filter_layout = QHBoxLayout(filter_group)
        
        filter_layout.addWidget(QLabel("公厕:"))
        self.toilet_filter = QComboBox()
        self.toilet_filter.addItem("全部公厕")
        for toilet in self.toilets.values():
            self.toilet_filter.addItem(toilet.name, toilet.toilet_id)
        self.toilet_filter.currentIndexChanged.connect(self._apply_filters)
        filter_layout.addWidget(self.toilet_filter)
        
        filter_layout.addWidget(QLabel("风险类型:"))
        self.risk_type_filter = QComboBox()
        self.risk_type_filter.addItem("全部类型")
        for risk_type in RiskType:
            self.risk_type_filter.addItem(risk_type.value, risk_type.name)
        self.risk_type_filter.currentIndexChanged.connect(self._apply_filters)
        filter_layout.addWidget(self.risk_type_filter)
        
        filter_layout.addWidget(QLabel("风险等级:"))
        self.risk_level_filter = QComboBox()
        self.risk_level_filter.addItem("全部等级")
        for level in RiskLevel:
            self.risk_level_filter.addItem(level.value, level.name)
        self.risk_level_filter.currentIndexChanged.connect(self._apply_filters)
        filter_layout.addWidget(self.risk_level_filter)
        
        filter_layout.addWidget(QLabel("处理状态:"))
        self.status_filter = QComboBox()
        self.status_filter.addItem("全部状态")
        self.status_filter.addItem("待处理", False)
        self.status_filter.addItem("已处理", True)
        self.status_filter.currentIndexChanged.connect(self._apply_filters)
        filter_layout.addWidget(self.status_filter)
        
        filter_layout.addStretch()
        
        main_layout.addWidget(filter_group)
        
        splitter = QSplitter(Qt.Horizontal)
        
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        table_group = QGroupBox("风险列表")
        table_layout = QVBoxLayout(table_group)
        
        self.risk_table = QTableWidget()
        self.risk_table.setColumnCount(8)
        self.risk_table.setHorizontalHeaderLabels([
            "风险ID", "公厕名称", "时段", "风险类型", "风险等级", 
            "描述", "建议措施", "最终措施"
        ])
        self.risk_table.horizontalHeader().setStretchLastSection(True)
        self.risk_table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.risk_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.risk_table.setSelectionMode(QTableWidget.SingleSelection)
        self.risk_table.itemSelectionChanged.connect(self._on_risk_selected)
        
        table_layout.addWidget(self.risk_table)
        left_layout.addWidget(table_group)
        
        splitter.addWidget(left_panel)
        
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        detail_group = QGroupBox("风险详情与处理")
        detail_layout = QVBoxLayout(detail_group)
        
        self.detail_text = QTextEdit()
        self.detail_text.setReadOnly(True)
        detail_layout.addWidget(self.detail_text)
        
        action_group = QGroupBox("人工改判")
        action_layout = QHBoxLayout(action_group)
        
        action_layout.addWidget(QLabel("改判措施:"))
        self.action_combo = QComboBox()
        self.action_combo.addItem("保持建议", None)
        for action in ActionType:
            self.action_combo.addItem(action.value, action.name)
        action_layout.addWidget(self.action_combo)
        
        action_layout.addWidget(QLabel("备注:"))
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(60)
        action_layout.addWidget(self.notes_edit)
        
        save_btn = QPushButton("保存改判")
        save_btn.clicked.connect(self._save_override)
        action_layout.addWidget(save_btn)
        
        resolve_btn = QPushButton("标记已处理")
        resolve_btn.clicked.connect(self._mark_resolved)
        action_layout.addWidget(resolve_btn)
        
        detail_layout.addWidget(action_group)
        right_layout.addWidget(detail_group)
        
        stats_group = QGroupBox("统计概览")
        stats_layout = QVBoxLayout(stats_group)
        
        self.stats_label = QLabel("加载数据后查看统计信息")
        stats_label_font = QFont()
        stats_label_font.setPointSize(11)
        self.stats_label.setFont(stats_label_font)
        stats_layout.addWidget(self.stats_label)
        
        right_layout.addWidget(stats_group)
        
        splitter.addWidget(right_panel)
        
        splitter.setSizes([800, 600])
        main_layout.addWidget(splitter)
        
        self._update_stats()
    
    def _import_inspections(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择巡检记录文件", "", "CSV Files (*.csv)"
        )
        if not file_path:
            return
        
        try:
            new_inspections = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        record = InspectionRecord.from_csv_row(row)
                        new_inspections.append(record)
                    except Exception as e:
                        continue
            
            self.inspections.extend(new_inspections)
            QMessageBox.information(
                self, "导入成功", 
                f"成功导入 {len(new_inspections)} 条巡检记录"
            )
            self._update_stats()
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入巡检记录失败: {str(e)}")
    
    def _import_sensors(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择传感器数据文件", "", "JSONL Files (*.jsonl)"
        )
        if not file_path:
            return
        
        try:
            new_sensors = []
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            record = SensorRecord.from_jsonl(line)
                            new_sensors.append(record)
                        except Exception as e:
                            continue
            
            self.sensors.extend(new_sensors)
            QMessageBox.information(
                self, "导入成功", 
                f"成功导入 {len(new_sensors)} 条传感器记录"
            )
            self._update_stats()
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入传感器数据失败: {str(e)}")
    
    def _import_emptyings(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择清掏记录文件", "", "JSON Files (*.json)"
        )
        if not file_path:
            return
        
        try:
            new_emptyings = []
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        try:
                            record = EmptyingRecord.from_dict(item)
                            new_emptyings.append(record)
                        except Exception as e:
                            continue
            
            self.emptyings.extend(new_emptyings)
            QMessageBox.information(
                self, "导入成功", 
                f"成功导入 {len(new_emptyings)} 条清掏记录"
            )
            self._update_stats()
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入清掏记录失败: {str(e)}")
    
    def _import_complaints(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择投诉记录文件", "", "JSON Files (*.json)"
        )
        if not file_path:
            return
        
        try:
            new_complaints = []
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        try:
                            record = ComplaintRecord.from_dict(item)
                            new_complaints.append(record)
                        except Exception as e:
                            continue
            
            self.complaints.extend(new_complaints)
            QMessageBox.information(
                self, "导入成功", 
                f"成功导入 {len(new_complaints)} 条投诉记录"
            )
            self._update_stats()
        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"导入投诉记录失败: {str(e)}")
    
    def _load_sample_data(self):
        sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")
        if not os.path.exists(sample_dir):
            QMessageBox.warning(self, "提示", "示例数据目录不存在")
            return
        
        try:
            insp_path = os.path.join(sample_dir, "inspections.csv")
            if os.path.exists(insp_path):
                with open(insp_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        try:
                            record = InspectionRecord.from_csv_row(row)
                            self.inspections.append(record)
                        except:
                            pass
            
            sensor_path = os.path.join(sample_dir, "sensors.jsonl")
            if os.path.exists(sensor_path):
                with open(sensor_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                record = SensorRecord.from_jsonl(line)
                                self.sensors.append(record)
                            except:
                                pass
            
            emptying_path = os.path.join(sample_dir, "emptyings.json")
            if os.path.exists(emptying_path):
                with open(emptying_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for item in data:
                            try:
                                record = EmptyingRecord.from_dict(item)
                                self.emptyings.append(record)
                            except:
                                pass
            
            complaint_path = os.path.join(sample_dir, "complaints.json")
            if os.path.exists(complaint_path):
                with open(complaint_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for item in data:
                            try:
                                record = ComplaintRecord.from_dict(item)
                                self.complaints.append(record)
                            except:
                                pass
            
            QMessageBox.information(self, "加载成功", "示例数据已加载，请点击'开始风险分析'")
            self._update_stats()
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载示例数据失败: {str(e)}")
    
    def _analyze_risks(self):
        if not any([self.inspections, self.sensors, self.emptyings, self.complaints]):
            QMessageBox.warning(self, "提示", "请先导入数据或加载示例数据")
            return
        
        try:
            analysis_date = self.date_edit.date().toPyDate()
            analysis_datetime = datetime.combine(analysis_date, datetime.min.time())
            
            engine = RiskEngine(self.toilets)
            engine.set_analysis_date(analysis_datetime)
            
            new_risks = engine.analyze_all(
                self.inspections,
                self.sensors,
                self.emptyings,
                self.complaints
            )
            
            for risk in new_risks:
                existing = next((r for r in self.risks if r.risk_id == risk.risk_id), None)
                if existing:
                    if existing.manual_override:
                        risk.manual_override = existing.manual_override
                    if existing.notes:
                        risk.notes = existing.notes
                    if existing.is_resolved:
                        risk.is_resolved = existing.is_resolved
            
            self.risks = new_risks
            self.filtered_risks = self.risks.copy()
            
            self._refresh_table()
            self._update_stats()
            self._save_local_storage()
            
            QMessageBox.information(
                self, "分析完成", 
                f"共检测到 {len(self.risks)} 个风险点"
            )
        except Exception as e:
            QMessageBox.critical(self, "分析失败", f"风险分析失败: {str(e)}")
            import traceback
            traceback.print_exc()
    
    def _refresh_table(self):
        self.risk_table.setRowCount(len(self.filtered_risks))
        
        for row, risk in enumerate(self.filtered_risks):
            items = [
                QTableWidgetItem(risk.risk_id),
                QTableWidgetItem(risk.toilet_name),
                QTableWidgetItem(risk.time_slot),
                QTableWidgetItem(risk.risk_type.value),
                QTableWidgetItem(risk.risk_level.value),
                QTableWidgetItem(risk.description[:50] + "..." if len(risk.description) > 50 else risk.description),
                QTableWidgetItem(risk.suggested_action.value),
                QTableWidgetItem(risk.final_action.value)
            ]
            
            if risk.is_resolved:
                for item in items:
                    item.setForeground(QColor(128, 128, 128))
                    item.setFont(QFont("Sans", 9, QFont.StyleItalic))
            
            if risk.risk_level == RiskLevel.HIGH:
                color = QColor(255, 200, 200)
            elif risk.risk_level == RiskLevel.MEDIUM:
                color = QColor(255, 240, 200)
            else:
                color = QColor(230, 255, 230)
            
            for col, item in enumerate(items):
                if not risk.is_resolved:
                    item.setBackground(color)
                self.risk_table.setItem(row, col, item)
    
    def _apply_filters(self):
        toilet_id = self.toilet_filter.currentData()
        risk_type_name = self.risk_type_filter.currentData()
        risk_level_name = self.risk_level_filter.currentData()
        is_resolved = self.status_filter.currentData()
        
        self.filtered_risks = []
        for risk in self.risks:
            if toilet_id is not None and risk.toilet_id != toilet_id:
                continue
            
            if risk_type_name is not None and risk.risk_type.name != risk_type_name:
                continue
            
            if risk_level_name is not None and risk.risk_level.name != risk_level_name:
                continue
            
            if is_resolved is not None and risk.is_resolved != is_resolved:
                continue
            
            self.filtered_risks.append(risk)
        
        self._refresh_table()
    
    def _on_risk_selected(self):
        selected_rows = self.risk_table.selectedItems()
        if not selected_rows:
            return
        
        row = selected_rows[0].row()
        if row >= len(self.filtered_risks):
            return
        
        risk = self.filtered_risks[row]
        
        detail_text = f"""【风险基本信息】
风险ID: {risk.risk_id}
公厕名称: {risk.toilet_name}
公厕ID: {risk.toilet_id}
时段: {risk.time_slot}
风险类型: {risk.risk_type.value}
风险等级: {risk.risk_level.value}
发生时间: {risk.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
处理状态: {'已处理' if risk.is_resolved else '待处理'}

【风险描述】
{risk.description}

【措施信息】
系统建议措施: {risk.suggested_action.value}
人工改判措施: {risk.manual_override.value if risk.manual_override else '无'}
最终措施: {risk.final_action.value}

【备注】
{risk.notes if risk.notes else '无'}

【原始数据摘要】
"""
        import json
        detail_text += json.dumps(risk.raw_data, ensure_ascii=False, indent=2)
        
        self.detail_text.setPlainText(detail_text)
        
        if risk.manual_override:
            idx = self.action_combo.findData(risk.manual_override.name)
            if idx >= 0:
                self.action_combo.setCurrentIndex(idx)
        else:
            self.action_combo.setCurrentIndex(0)
        
        self.notes_edit.setPlainText(risk.notes)
    
    def _save_override(self):
        selected_rows = self.risk_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "提示", "请先选择一条风险记录")
            return
        
        row = selected_rows[0].row()
        if row >= len(self.filtered_risks):
            return
        
        risk = self.filtered_risks[row]
        
        action_name = self.action_combo.currentData()
        if action_name:
            risk.manual_override = ActionType[action_name]
        else:
            risk.manual_override = None
        
        risk.notes = self.notes_edit.toPlainText()
        
        self._refresh_table()
        self._save_local_storage()
        self._on_risk_selected()
        
        QMessageBox.information(self, "保存成功", "改判信息已保存")
    
    def _mark_resolved(self):
        selected_rows = self.risk_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "提示", "请先选择一条风险记录")
            return
        
        row = selected_rows[0].row()
        if row >= len(self.filtered_risks):
            return
        
        risk = self.filtered_risks[row]
        risk.is_resolved = True
        
        self._refresh_table()
        self._save_local_storage()
        self._on_risk_selected()
        
        QMessageBox.information(self, "标记成功", "已标记为已处理")
    
    def _update_stats(self):
        stats = f"""已加载数据:
  - 巡检记录: {len(self.inspections)} 条
  - 传感器记录: {len(self.sensors)} 条
  - 清掏记录: {len(self.emptyings)} 条
  - 投诉记录: {len(self.complaints)} 条

风险分析结果:
  - 总风险数: {len(self.risks)} 个
"""
        
        if self.risks:
            by_type = defaultdict(int)
            by_level = defaultdict(int)
            by_action = defaultdict(int)
            resolved = 0
            
            for risk in self.risks:
                by_type[risk.risk_type.value] += 1
                by_level[risk.risk_level.value] += 1
                by_action[risk.final_action.value] += 1
                if risk.is_resolved:
                    resolved += 1
            
            stats += f"""
按风险类型分布:
"""
            for typ, count in by_type.items():
                stats += f"  - {typ}: {count} 个\n"
            
            stats += f"""
按风险等级分布:
"""
            for level, count in by_level.items():
                stats += f"  - {level}: {count} 个\n"
            
            stats += f"""
处理状态:
  - 已处理: {resolved} 个
  - 待处理: {len(self.risks) - resolved} 个

最终措施分布:
"""
            for action, count in by_action.items():
                stats += f"  - {action}: {count} 个\n"
        
        self.stats_label.setText(stats)
    
    def _export_markdown(self):
        if not self.risks:
            QMessageBox.warning(self, "提示", "没有可导出的风险数据")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存交接单", "", "Markdown Files (*.md)"
        )
        if not file_path:
            return
        
        try:
            md_content = self._generate_markdown_report()
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            
            QMessageBox.information(self, "导出成功", f"交接单已导出到: {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出失败: {str(e)}")
    
    def _generate_markdown_report(self) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        high_risks = [r for r in self.risks if r.risk_level == RiskLevel.HIGH and not r.is_resolved]
        medium_risks = [r for r in self.risks if r.risk_level == RiskLevel.MEDIUM and not r.is_resolved]
        low_risks = [r for r in self.risks if r.risk_level == RiskLevel.LOW and not r.is_resolved]
        resolved = [r for r in self.risks if r.is_resolved]
        
        md = f"""# 景区公厕保洁风险管控交接单

生成时间: {now}

## 风险概览

| 指标 | 数量 |
|------|------|
| 总风险数 | {len(self.risks)} |
| 高风险（待处理） | {len(high_risks)} |
| 中风险（待处理） | {len(medium_risks)} |
| 低风险（待处理） | {len(low_risks)} |
| 已处理 | {len(resolved)} |

"""
        
        if high_risks:
            md += """## 高风险（紧急处理）

"""
            for i, risk in enumerate(high_risks, 1):
                md += f"""### {i}. {risk.toilet_name} - {risk.risk_type.value}

- **风险ID**: {risk.risk_id}
- **时段**: {risk.time_slot}
- **发生时间**: {risk.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
- **描述**: {risk.description}
- **建议措施**: {risk.suggested_action.value}
- **最终措施**: {risk.final_action.value}
"""
                if risk.notes:
                    md += f"- **备注**: {risk.notes}\n"
                md += "\n"
        
        if medium_risks:
            md += """## 中风险（优先处理）

"""
            for i, risk in enumerate(medium_risks, 1):
                md += f"""### {i}. {risk.toilet_name} - {risk.risk_type.value}

- **风险ID**: {risk.risk_id}
- **时段**: {risk.time_slot}
- **发生时间**: {risk.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
- **描述**: {risk.description}
- **建议措施**: {risk.suggested_action.value}
- **最终措施**: {risk.final_action.value}
"""
                if risk.notes:
                    md += f"- **备注**: {risk.notes}\n"
                md += "\n"
        
        if low_risks:
            md += """## 低风险（关注处理）

"""
            for i, risk in enumerate(low_risks, 1):
                md += f"""### {i}. {risk.toilet_name} - {risk.risk_type.value}

- **风险ID**: {risk.risk_id}
- **时段**: {risk.time_slot}
- **描述**: {risk.description}
- **建议措施**: {risk.suggested_action.value}
- **最终措施**: {risk.final_action.value}
"""
                if risk.notes:
                    md += f"- **备注**: {risk.notes}\n"
                md += "\n"
        
        md += """## 交接说明

请根据以上风险分析结果，安排相应的保洁人员进行处理。

- 高风险: 立即处理，必要时暂停开放
- 中风险: 当日处理，加派保洁人员
- 低风险: 纳入日常巡检关注

---
*此报告由景区公厕保洁风险管控系统自动生成*
"""
        
        return md
    
    def _export_json(self):
        if not self.risks:
            QMessageBox.warning(self, "提示", "没有可导出的风险数据")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存审计明细", "", "JSON Files (*.json)"
        )
        if not file_path:
            return
        
        try:
            export_data = {
                "export_time": datetime.now().isoformat(),
                "data_sources": {
                    "inspections_count": len(self.inspections),
                    "sensors_count": len(self.sensors),
                    "emptyings_count": len(self.emptyings),
                    "complaints_count": len(self.complaints)
                },
                "risks": [risk.to_dict() for risk in self.risks],
                "statistics": {
                    "total_risks": len(self.risks),
                    "by_type": {},
                    "by_level": {},
                    "resolved_count": len([r for r in self.risks if r.is_resolved])
                }
            }
            
            from collections import defaultdict
            by_type = defaultdict(int)
            by_level = defaultdict(int)
            for risk in self.risks:
                by_type[risk.risk_type.value] += 1
                by_level[risk.risk_level.value] += 1
            
            export_data["statistics"]["by_type"] = dict(by_type)
            export_data["statistics"]["by_level"] = dict(by_level)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            
            QMessageBox.information(self, "导出成功", f"审计明细已导出到: {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出失败: {str(e)}")
    
    def _load_local_storage(self):
        if not os.path.exists(self.local_storage_path):
            return
        
        try:
            with open(self.local_storage_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            saved_risks = data.get("risks", [])
            self.risks = [RiskItem.from_dict(r) for r in saved_risks]
            self.filtered_risks = self.risks.copy()
        except Exception as e:
            print(f"加载本地存储失败: {e}")
    
    def _save_local_storage(self):
        try:
            data = {
                "save_time": datetime.now().isoformat(),
                "risks": [risk.to_dict() for risk in self.risks]
            }
            
            with open(self.local_storage_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存本地存储失败: {e}")


def main():
    app = QApplication(sys.argv)
    
    app.setStyle("Fusion")
    
    window = ToiletRiskManager()
    window.show()
    
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
