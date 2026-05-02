import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

import customtkinter as ctk

from config import CONFIG, TaskStatus
from database import DatabaseManager, init_db
from core import StateMachine
from utils import ImportExportManager, ReportGenerator, AttachmentManager
from .left_panel import LeftPanel
from .center_panel import CenterPanel
from .right_panel import RightPanel
from .dialogs import MessageDialog, ImportDialog


class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        
        self.title(CONFIG.app_name)
        self.geometry("1600x900")
        self.minsize(1200, 700)
        
        CONFIG.ensure_directories()
        
        self.db = DatabaseManager(CONFIG.db_path)
        init_db(self.db)
        
        self.state_machine = StateMachine(self.db)
        self.import_export = ImportExportManager(self.db)
        self.report_generator = ReportGenerator(self.db)
        self.attachment_manager = AttachmentManager(self.db)
        
        self._create_menu()
        self._create_main_layout()
        self._create_status_bar()
        
        self.protocol("WM_DELETE_WINDOW", self._on_closing)
        
        self._check_first_run()
    
    def _create_menu(self):
        menubar = tk.Menu(self)
        self.configure(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入温度CSV", command=self._import_temperature_csv)
        file_menu.add_command(label="导入药房任务", command=self._import_pharmacy_tasks)
        file_menu.add_separator()
        file_menu.add_command(label="导出超温风险清单", command=self._export_overtemp_risk)
        file_menu.add_command(label="打开数据目录", command=self._open_data_dir)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._on_closing)
        
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="初始化示例数据", command=self._init_sample_data)
        tools_menu.add_command(label="清空所有数据", command=self._clear_all_data)
        tools_menu.add_separator()
        tools_menu.add_command(label="重新加载", command=self._refresh_all)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
        help_menu.add_command(label="使用说明", command=self._show_help)
    
    def _create_main_layout(self):
        self.paned_window = ctk.CTkPanedWindow(self, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ctk.CTkFrame(self.paned_window, width=350)
        self.left_panel = LeftPanel(
            left_frame, 
            self.db,
            on_data_changed=self._on_left_data_changed
        )
        self.left_panel.pack(fill=tk.BOTH, expand=True)
        self.paned_window.add(left_frame, weight=1)
        
        center_frame = ctk.CTkFrame(self.paned_window, width=500)
        self.center_panel = CenterPanel(
            center_frame,
            self.db,
            on_task_selected=self._on_task_selected,
            on_data_changed=self._on_center_data_changed
        )
        self.center_panel.pack(fill=tk.BOTH, expand=True)
        self.paned_window.add(center_frame, weight=2)
        
        right_frame = ctk.CTkFrame(self.paned_window, width=600)
        self.right_panel = RightPanel(
            right_frame,
            self.db,
            on_data_changed=self._on_right_data_changed
        )
        self.right_panel.pack(fill=tk.BOTH, expand=True)
        self.paned_window.add(right_frame, weight=3)
    
    def _create_status_bar(self):
        self.status_frame = ctk.CTkFrame(self, fg_color=("gray85", "gray25"), height=30)
        self.status_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ctk.CTkLabel(
            self.status_frame, 
            text=f"{CONFIG.app_name} v{CONFIG.version} - 就绪",
            anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, padx=10, pady=5)
        
        self.db_status_label = ctk.CTkLabel(
            self.status_frame,
            text=f"数据库: {CONFIG.db_path.name}",
            anchor=tk.E
        )
        self.db_status_label.pack(side=tk.RIGHT, padx=10, pady=5)
    
    def _set_status(self, message: str):
        self.status_label.configure(text=f"{CONFIG.app_name} v{CONFIG.version} - {message}")
        self.update_idletasks()
    
    def _on_task_selected(self, task_id: int):
        self.right_panel.load_task(task_id)
        self._set_status(f"已选择任务 ID: {task_id}")
    
    def _on_left_data_changed(self):
        self._set_status("基础数据已更新")
    
    def _on_center_data_changed(self):
        self._refresh_all()
        self._set_status("任务数据已更新")
    
    def _on_right_data_changed(self):
        self.center_panel.refresh()
        self._set_status("数据已更新")
    
    def _refresh_all(self):
        self.left_panel.refresh()
        self.center_panel.refresh()
        self.right_panel.refresh()
        self._set_status("数据已刷新")
    
    def _import_temperature_csv(self):
        dialog = ImportDialog(self, self.db, "temperature")
        dialog.wait_window()
        
        if dialog.result and hasattr(dialog, 'import_result'):
            try:
                self._set_status("正在导入温度数据...")
                
                result = self.import_export.import_temperature_csv(
                    dialog.import_result['file_path']
                )
                
                if result.success:
                    msg = f"成功导入 {result.imported_count} 条记录"
                    if result.warnings:
                        msg += f"\n警告: {len(result.warnings)} 条"
                    if result.errors:
                        msg += f"\n错误: {len(result.errors)} 条 (已放入隔离区)"
                    
                    MessageDialog(self, "导入完成", msg, "success" if not result.errors else "warning")
                    
                    self._refresh_all()
                else:
                    MessageDialog(self, "导入失败", f"错误: {result.errors}", "error")
                    
            except Exception as e:
                MessageDialog(self, "导入错误", str(e), "error")
    
    def _import_pharmacy_tasks(self):
        dialog = ImportDialog(self, self.db, "pharmacy")
        dialog.wait_window()
        
        if dialog.result and hasattr(dialog, 'import_result'):
            try:
                self._set_status("正在导入药房任务...")
                
                result = self.import_export.import_pharmacy_tasks(
                    dialog.import_result['file_path']
                )
                
                if result.success:
                    MessageDialog(
                        self, 
                        "导入完成", 
                        f"成功导入 {result.imported_count} 个任务",
                        "success"
                    )
                    self._refresh_all()
                else:
                    MessageDialog(self, "导入失败", f"错误: {result.errors}", "error")
                    
            except Exception as e:
                MessageDialog(self, "导入错误", str(e), "error")
    
    def _export_overtemp_risk(self):
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = CONFIG.exports_dir / f"overtemp_risk_{timestamp}.csv"
            
            count = self.import_export.export_overtemperature_risk_csv(output_path)
            
            if count > 0:
                MessageDialog(
                    self,
                    "导出成功",
                    f"已导出 {count} 条超温风险记录\n文件: {output_path}",
                    "success"
                )
            else:
                MessageDialog(self, "提示", "当前没有超温风险记录", "info")
                
        except Exception as e:
            MessageDialog(self, "导出错误", str(e), "error")
    
    def _open_data_dir(self):
        import subprocess
        import platform
        
        data_dir = CONFIG.data_dir
        
        if platform.system() == "Windows":
            os.startfile(data_dir)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", str(data_dir)])
        else:
            subprocess.Popen(["xdg-open", str(data_dir)])
    
    def _check_first_run(self):
        from database import CoolerBox, DrugBatch, DeliveryTask
        
        boxes = self.db.get_all(CoolerBox)
        drugs = self.db.get_all(DrugBatch)
        tasks = self.db.get_all(DeliveryTask)
        
        if not boxes and not drugs and not tasks:
            if messagebox.askyesno(
                "首次运行检测",
                "检测到这是首次运行应用。\n\n是否需要初始化示例数据？\n\n示例数据包含：冷藏箱、药品批号、配送路线、收货点和演示任务。"
            ):
                self._init_sample_data()
    
    def _init_sample_data(self):
        try:
            self._set_status("正在初始化示例数据...")
            
            from samples.sample_data import create_sample_data
            create_sample_data(self.db)
            
            self._refresh_all()
            MessageDialog(
                self,
                "成功",
                "示例数据已初始化完成！\n\n包括：\n- 3个冷藏箱\n- 5个药品批号\n- 2条配送路线\n- 4个收货点\n- 3个演示任务",
                "success"
            )
            
        except ImportError:
            MessageDialog(
                self,
                "提示",
                "示例数据模块尚未创建，请先创建 samples/sample_data.py",
                "info"
            )
        except Exception as e:
            MessageDialog(self, "错误", f"初始化示例数据失败: {str(e)}", "error")
    
    def _clear_all_data(self):
        if not messagebox.askyesno(
            "确认清空",
            "警告：此操作将删除所有数据！\n\n包括：任务、装箱清单、温度记录、附件、基础数据等。\n\n此操作不可撤销，确定继续吗？",
            icon="warning"
        ):
            return
        
        try:
            self._set_status("正在清空数据...")
            
            tables = [
                "audit_logs",
                "audit_packages",
                "exception_records",
                "quarantine_records",
                "temperature_readings",
                "attachments",
                "packing_items",
                "delivery_tasks",
                "delivery_points",
                "delivery_routes",
                "drug_batches",
                "cooler_boxes",
            ]
            
            for table in tables:
                self.db.execute(f"DELETE FROM {table}")
                self.db.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
            
            self._refresh_all()
            MessageDialog(self, "完成", "所有数据已清空", "success")
            
        except Exception as e:
            MessageDialog(self, "错误", f"清空数据失败: {str(e)}", "error")
    
    def _show_about(self):
        about_text = f"""
{CONFIG.app_name}

版本: {CONFIG.version}

功能说明:
- 冷藏药品交接温控追溯管理
- 温度记录仪CSV导入与校验
- 任务状态流转管理
- 超温自动检测与复核
- 附件归档与完整性校验
- 审计包生成与导出

技术栈:
- Python 3.x
- customtkinter (GUI)
- SQLite (数据存储)
- matplotlib (温度曲线)
- pandas (数据处理)
        """
        
        MessageDialog(self, "关于", about_text.strip(), "info")
    
    def _show_help(self):
        help_text = """
使用说明:

1. 基础数据维护 (左侧面板)
   - 冷藏箱: 管理冷藏箱编号和设备号
   - 药品批号: 管理药品信息
   - 配送路线: 定义配送路线
   - 收货点: 管理收货地点

2. 任务管理 (中间面板)
   - 新建任务: 创建新的配送任务
   - 装箱清单: 添加药品到任务
   - 状态流转: 待装箱 → 运输中 → 待签收 → 已归档

3. 任务详情 (右侧面板)
   - 温度曲线: 查看温度变化图
   - 装箱清单: 确认药品列表
   - 签收附件: 上传签收单照片
   - 异常记录: 查看超温等异常
   - 审计日志: 查看操作历史

4. 导入温度CSV
   - 点击"导入温度"按钮
   - 选择温度记录仪导出的CSV
   - 系统自动校验并导入

5. 导出功能
   - Markdown复盘报告
   - JSON审计包
   - CSV超温风险清单
        """
        
        MessageDialog(self, "使用说明", help_text.strip(), "info")
    
    def _on_closing(self):
        self.db.close()
        self.destroy()


def main():
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
