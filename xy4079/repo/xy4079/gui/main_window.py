# -*- coding: utf-8 -*-
"""
主窗口GUI
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import threading
import sys
import os

# 添加父目录到路径以便导入模块
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    QualityReport,
    IssueType,
    IssueSeverity
)
from importer import CSVParser, PhotoImporter, ParseResult, ImportResult
from validator import (
    QualityValidator,
    FullValidationResult,
    PointValidator,
    TimeValidator,
    DuplicateValidator,
    NamingValidator,
    PairValidator
)
from archiver import PhotoArchiver, ArchiveResult, RenameRule
from reporter import ReportExporter, ExportResult


class MainWindow:
    """主窗口"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("维保照片归档质检台")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        # 应用状态
        self._work_order: Optional[WorkOrder] = None
        self._photos: List[Photo] = []
        self._validation_result: Optional[FullValidationResult] = None
        self._quality_report: Optional[QualityReport] = None
        self._csv_path: Optional[Path] = None
        self._photo_dir: Optional[Path] = None
        
        # 创建UI
        self._create_menu()
        self._create_main_layout()
        
        # 初始化提示
        self._log("系统就绪。请先导入工单CSV和照片目录。")
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入工单CSV", command=self._import_csv)
        file_menu.add_command(label="导入照片目录", command=self._import_photos)
        file_menu.add_separator()
        file_menu.add_command(label="导出Markdown报告", command=self._export_markdown)
        file_menu.add_command(label="导出CSV问题清单", command=self._export_csv)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 操作菜单
        action_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="操作", menu=action_menu)
        action_menu.add_command(label="执行质检", command=self._run_validation)
        action_menu.add_command(label="预览重命名", command=self._preview_rename)
        action_menu.add_command(label="执行归档", command=self._run_archive)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主布局"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="5")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置网格权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)
        main_frame.rowconfigure(4, weight=1)
        
        # 顶部：导入区域
        import_frame = ttk.LabelFrame(main_frame, text="数据导入", padding="5")
        import_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        import_frame.columnconfigure(1, weight=1)
        import_frame.columnconfigure(4, weight=1)
        
        # CSV导入
        ttk.Label(import_frame, text="工单CSV:").grid(row=0, column=0, sticky=tk.W, padx=5)
        self._csv_path_var = tk.StringVar()
        ttk.Entry(import_frame, textvariable=self._csv_path_var, state='readonly').grid(
            row=0, column=1, sticky=(tk.W, tk.E), padx=5
        )
        ttk.Button(import_frame, text="选择文件", command=self._import_csv).grid(
            row=0, column=2, padx=5
        )
        
        # 照片目录导入
        ttk.Label(import_frame, text="照片目录:").grid(row=0, column=3, sticky=tk.W, padx=5)
        self._photo_dir_var = tk.StringVar()
        ttk.Entry(import_frame, textvariable=self._photo_dir_var, state='readonly').grid(
            row=0, column=4, sticky=(tk.W, tk.E), padx=5
        )
        ttk.Button(import_frame, text="选择目录", command=self._import_photos).grid(
            row=0, column=5, padx=5
        )
        
        # 操作按钮区
        action_frame = ttk.Frame(import_frame)
        action_frame.grid(row=1, column=0, columnspan=6, pady=10)
        
        ttk.Button(action_frame, text="📊 执行质检", command=self._run_validation, width=15).pack(
            side=tk.LEFT, padx=5
        )
        ttk.Button(action_frame, text="📋 预览重命名", command=self._preview_rename, width=15).pack(
            side=tk.LEFT, padx=5
        )
        ttk.Button(action_frame, text="📁 执行归档", command=self._run_archive, width=15).pack(
            side=tk.LEFT, padx=5
        )
        ttk.Button(action_frame, text="📄 导出报告", command=self._export_all, width=15).pack(
            side=tk.LEFT, padx=5
        )
        
        # 统计信息区
        stats_frame = ttk.LabelFrame(main_frame, text="统计信息", padding="5")
        stats_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        self._stats_labels = {}
        stats_items = [
            ("工单", "无"),
            ("照片数", "0"),
            ("严重问题", "0"),
            ("警告问题", "0"),
            ("提示问题", "0"),
            ("质检状态", "未执行")
        ]
        
        for i, (label, default) in enumerate(stats_items):
            frame = ttk.Frame(stats_frame)
            frame.pack(side=tk.LEFT, padx=20)
            ttk.Label(frame, text=f"{label}:", font=('Arial', 9, 'bold')).pack(side=tk.LEFT)
            var = tk.StringVar(value=default)
            self._stats_labels[label] = var
            ttk.Label(frame, textvariable=var, font=('Arial', 10)).pack(side=tk.LEFT, padx=5)
        
        # 左侧：照片列表
        left_frame = ttk.LabelFrame(main_frame, text="照片列表", padding="5")
        left_frame.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5), pady=5)
        left_frame.columnconfigure(0, weight=1)
        left_frame.rowconfigure(0, weight=1)
        
        # 照片表格
        photo_columns = ('文件名', '点位', '拍摄时间', '状态')
        self._photo_tree = ttk.Treeview(left_frame, columns=photo_columns, show='headings', height=15)
        
        for col in photo_columns:
            self._photo_tree.heading(col, text=col)
            self._photo_tree.column(col, width=100)
        
        self._photo_tree.column('文件名', width=200)
        self._photo_tree.column('拍摄时间', width=150)
        
        photo_scroll = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self._photo_tree.yview)
        self._photo_tree.configure(yscrollcommand=photo_scroll.set)
        
        self._photo_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        photo_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 右侧：问题列表
        right_frame = ttk.LabelFrame(main_frame, text="问题列表 (待复核)", padding="5")
        right_frame.grid(row=2, column=1, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(5, 0), pady=5)
        right_frame.columnconfigure(0, weight=1)
        right_frame.rowconfigure(0, weight=1)
        
        # 问题表格
        issue_columns = ('严重程度', '问题类型', '描述', '状态')
        self._issue_tree = ttk.Treeview(right_frame, columns=issue_columns, show='headings', height=15)
        
        for col in issue_columns:
            self._issue_tree.heading(col, text=col)
            self._issue_tree.column(col, width=100)
        
        self._issue_tree.column('描述', width=300)
        
        issue_scroll = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self._issue_tree.yview)
        self._issue_tree.configure(yscrollcommand=issue_scroll.set)
        
        self._issue_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        issue_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 问题操作按钮
        issue_btn_frame = ttk.Frame(right_frame)
        issue_btn_frame.grid(row=1, column=0, columnspan=2, pady=5)
        
        ttk.Button(issue_btn_frame, text="✅ 确认问题", command=self._confirm_issue).pack(side=tk.LEFT, padx=5)
        ttk.Button(issue_btn_frame, text="❌ 忽略问题", command=self._dismiss_issue).pack(side=tk.LEFT, padx=5)
        ttk.Button(issue_btn_frame, text="🔄 标记已解决", command=self._resolve_issue).pack(side=tk.LEFT, padx=5)
        
        # 底部：日志区域
        log_frame = ttk.LabelFrame(main_frame, text="操作日志", padding="5")
        log_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        
        self._log_text = scrolledtext.ScrolledText(log_frame, height=8, wrap=tk.WORD, state='disabled')
        self._log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置标签颜色
        self._log_text.tag_configure('INFO', foreground='blue')
        self._log_text.tag_configure('WARNING', foreground='orange')
        self._log_text.tag_configure('ERROR', foreground='red')
        self._log_text.tag_configure('SUCCESS', foreground='green')
    
    def _log(self, message: str, level: str = 'INFO'):
        """添加日志"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        full_message = f"[{timestamp}] {message}\n"
        
        self._log_text.configure(state='normal')
        self._log_text.insert(tk.END, full_message, level)
        self._log_text.see(tk.END)
        self._log_text.configure(state='disabled')
    
    def _import_csv(self):
        """导入工单CSV"""
        file_path = filedialog.askopenfilename(
            title="选择工单CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        self._csv_path = Path(file_path)
        self._csv_path_var.set(file_path)
        
        # 解析CSV
        self._log(f"正在解析CSV文件: {file_path}")
        
        try:
            parser = CSVParser()
            result = parser.parse(self._csv_path)
            
            if not result.success:
                self._log(f"解析失败: {', '.join(result.errors)}", 'ERROR')
                messagebox.showerror("解析错误", "\n".join(result.errors))
                return
            
            if result.warnings:
                for warning in result.warnings:
                    self._log(f"警告: {warning}", 'WARNING')
            
            if result.work_orders:
                # 暂时只使用第一个工单
                self._work_order = result.work_orders[0]
                self._log(f"成功导入工单: {self._work_order.order_id}")
                self._log(f"  电梯: {self._work_order.elevator_no}, 位置: {self._work_order.location}")
                self._log(f"  维保日期: {self._work_order.maintenance_date.strftime('%Y-%m-%d')}")
                self._log(f"  维保人员: {self._work_order.technician}")
                self._log(f"  必拍点位: {', '.join(self._work_order.required_points)}")
                
                if self._work_order.has_rectification:
                    self._log(f"  包含整改项: {', '.join(self._work_order.rectification_items)}")
                
                self._update_stats()
                messagebox.showinfo("导入成功", f"成功导入工单 {self._work_order.order_id}")
            else:
                self._log("CSV文件中没有找到有效的工单数据", 'WARNING')
                messagebox.showwarning("警告", "CSV文件中没有找到有效的工单数据")
                
        except Exception as e:
            self._log(f"导入CSV时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"导入CSV时出错: {str(e)}")
    
    def _import_photos(self):
        """导入照片目录"""
        dir_path = filedialog.askdirectory(
            title="选择照片目录"
        )
        
        if not dir_path:
            return
        
        self._photo_dir = Path(dir_path)
        self._photo_dir_var.set(dir_path)
        
        # 导入照片
        self._log(f"正在扫描照片目录: {dir_path}")
        
        try:
            importer = PhotoImporter()
            result = importer.import_from_directory(self._photo_dir)
            
            if not result.success:
                self._log(f"导入失败: {', '.join(result.errors)}", 'ERROR')
                messagebox.showerror("导入错误", "\n".join(result.errors))
                return
            
            if result.warnings:
                for warning in result.warnings:
                    self._log(f"警告: {warning}", 'WARNING')
            
            self._photos = result.photos
            self._log(f"成功导入 {result.imported_count} 张照片")
            self._log(f"  总计发现 {result.total_count} 个文件")
            
            if result.skipped_count > 0:
                self._log(f"  跳过 {result.skipped_count} 个文件", 'WARNING')
            
            # 更新照片列表
            self._update_photo_list()
            self._update_stats()
            
            messagebox.showinfo("导入成功", f"成功导入 {len(self._photos)} 张照片")
                
        except Exception as e:
            self._log(f"导入照片时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"导入照片时出错: {str(e)}")
    
    def _update_photo_list(self):
        """更新照片列表"""
        # 清空现有内容
        for item in self._photo_tree.get_children():
            self._photo_tree.delete(item)
        
        # 添加照片
        for photo in self._photos:
            point_type = photo.point_type or "未识别"
            capture_time = photo.capture_time.strftime('%Y-%m-%d %H:%M:%S') if photo.capture_time else "未知"
            
            # 确定状态
            status = "正常"
            if photo.issues:
                has_critical = any(i.severity == IssueSeverity.CRITICAL for i in photo.issues)
                has_warning = any(i.severity == IssueSeverity.WARNING for i in photo.issues)
                if has_critical:
                    status = "🔴 有问题"
                elif has_warning:
                    status = "🟡 警告"
            
            self._photo_tree.insert('', tk.END, values=(
                photo.file_name,
                point_type,
                capture_time,
                status
            ))
    
    def _update_issue_list(self):
        """更新问题列表"""
        # 清空现有内容
        for item in self._issue_tree.get_children():
            self._issue_tree.delete(item)
        
        if not self._validation_result:
            return
        
        # 添加待复核的问题
        for issue in self._validation_result.pending_review_issues:
            if issue.resolved:
                continue
            
            severity_icon = "🔴" if issue.severity == IssueSeverity.CRITICAL else "🟡"
            status = "已确认" if issue.confirmed else "待确认"
            
            self._issue_tree.insert('', tk.END, values=(
                f"{severity_icon} {issue.severity.value}",
                issue.issue_type.value,
                issue.description[:50] + ("..." if len(issue.description) > 50 else ""),
                status
            ), iid=id(issue))
    
    def _update_stats(self):
        """更新统计信息"""
        # 工单信息
        if self._work_order:
            self._stats_labels["工单"].set(self._work_order.order_id)
        else:
            self._stats_labels["工单"].set("无")
        
        # 照片数
        self._stats_labels["照片数"].set(str(len(self._photos)))
        
        # 问题统计
        if self._validation_result:
            self._stats_labels["严重问题"].set(str(self._validation_result.critical_count))
            self._stats_labels["警告问题"].set(str(self._validation_result.warning_count))
            self._stats_labels["提示问题"].set(str(self._validation_result.info_count))
            
            if self._validation_result.passed:
                self._stats_labels["质检状态"].set("✅ 通过")
            else:
                self._stats_labels["质检状态"].set("❌ 不通过")
        else:
            self._stats_labels["严重问题"].set("0")
            self._stats_labels["警告问题"].set("0")
            self._stats_labels["提示问题"].set("0")
            self._stats_labels["质检状态"].set("未执行")
    
    def _run_validation(self):
        """执行质检"""
        if not self._photos:
            self._log("请先导入照片目录", 'WARNING')
            messagebox.showwarning("警告", "请先导入照片目录")
            return
        
        self._log("开始执行质检...")
        
        try:
            validator = QualityValidator()
            self._validation_result = validator.validate(self._work_order, self._photos)
            
            # 创建质检报告
            self._quality_report = validator.create_quality_report(
                self._work_order, self._photos, self._validation_result
            )
            
            # 更新UI
            self._update_issue_list()
            self._update_photo_list()
            self._update_stats()
            
            # 输出结果
            self._log(f"质检完成! 共发现 {self._validation_result.summary['total_issues']} 个问题", 
                      'SUCCESS' if self._validation_result.passed else 'WARNING')
            self._log(f"  严重问题: {self._validation_result.critical_count}")
            self._log(f"  警告问题: {self._validation_result.warning_count}")
            self._log(f"  提示问题: {self._validation_result.info_count}")
            self._log(f"  质检状态: {'通过' if self._validation_result.passed else '不通过'}")
            
            if self._validation_result.pending_review_issues:
                self._log(f"  待复核问题: {len(self._validation_result.pending_review_issues)}")
            
            messagebox.showinfo(
                "质检完成",
                f"质检完成!\n\n"
                f"照片数: {len(self._photos)}\n"
                f"问题数: {self._validation_result.summary['total_issues']}\n"
                f"  严重: {self._validation_result.critical_count}\n"
                f"  警告: {self._validation_result.warning_count}\n"
                f"  提示: {self._validation_result.info_count}\n\n"
                f"结论: {'✅ 通过' if self._validation_result.passed else '❌ 不通过'}"
            )
            
        except Exception as e:
            self._log(f"执行质检时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"执行质检时出错: {str(e)}")
    
    def _get_selected_issue(self) -> Optional[QualityIssue]:
        """获取选中的问题"""
        selection = self._issue_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个问题")
            return None
        
        # 查找对应的问题对象
        issue_id = selection[0]
        for issue in self._validation_result.pending_review_issues:
            if str(id(issue)) == issue_id:
                return issue
        
        return None
    
    def _confirm_issue(self):
        """确认问题"""
        issue = self._get_selected_issue()
        if not issue:
            return
        
        issue.confirmed = True
        issue.confirmation_note = "人工确认"
        
        self._log(f"已确认问题: {issue.issue_type.value}", 'INFO')
        self._update_issue_list()
    
    def _dismiss_issue(self):
        """忽略问题"""
        issue = self._get_selected_issue()
        if not issue:
            return
        
        # 标记为已解决（忽略）
        issue.resolved = True
        issue.confirmation_note = "人工忽略"
        
        self._log(f"已忽略问题: {issue.issue_type.value}", 'INFO')
        self._update_issue_list()
    
    def _resolve_issue(self):
        """标记已解决"""
        issue = self._get_selected_issue()
        if not issue:
            return
        
        issue.resolved = True
        issue.confirmed = True
        issue.confirmation_note = "已解决"
        
        self._log(f"已标记问题为已解决: {issue.issue_type.value}", 'INFO')
        self._update_issue_list()
    
    def _preview_rename(self):
        """预览重命名"""
        if not self._photos:
            self._log("请先导入照片目录", 'WARNING')
            messagebox.showwarning("警告", "请先导入照片目录")
            return
        
        self._log("生成重命名预览...")
        
        try:
            archiver = PhotoArchiver(rename_rule=RenameRule.BY_POINT_AND_SEQUENCE)
            preview = archiver.suggest_rename_preview(self._photos, self._work_order)
            
            # 显示预览对话框
            self._show_rename_preview(preview)
            
        except Exception as e:
            self._log(f"生成预览时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"生成预览时出错: {str(e)}")
    
    def _show_rename_preview(self, preview: List[Dict]):
        """显示重命名预览对话框"""
        preview_window = tk.Toplevel(self.root)
        preview_window.title("重命名预览")
        preview_window.geometry("800x500")
        preview_window.transient(self.root)
        
        # 创建表格
        columns = ('原文件名', '新文件名', '是否变更')
        tree = ttk.Treeview(preview_window, columns=columns, show='headings', height=20)
        
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=250)
        
        scroll = ttk.Scrollbar(preview_window, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scroll.pack(side=tk.RIGHT, fill=tk.Y, padx=5, pady=5)
        
        # 填充数据
        changed_count = 0
        for item in preview:
            changed = "是" if item['changed'] else "否"
            if item['changed']:
                changed_count += 1
            tree.insert('', tk.END, values=(
                item['original'],
                item['suggested'],
                changed
            ))
        
        # 统计信息
        info_frame = ttk.Frame(preview_window)
        info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(info_frame, text=f"总计: {len(preview)} 张照片", font=('Arial', 10, 'bold')).pack(side=tk.LEFT)
        ttk.Label(info_frame, text=f"  将变更: {changed_count} 张", foreground='blue').pack(side=tk.LEFT)
        
        ttk.Button(info_frame, text="关闭", command=preview_window.destroy).pack(side=tk.RIGHT, padx=5)
        
        self._log(f"预览完成: {changed_count}/{len(preview)} 张照片将被重命名")
    
    def _run_archive(self):
        """执行归档"""
        if not self._photos:
            self._log("请先导入照片目录", 'WARNING')
            messagebox.showwarning("警告", "请先导入照片目录")
            return
        
        # 选择目标目录
        target_dir = filedialog.askdirectory(title="选择归档目标目录")
        if not target_dir:
            return
        
        target_path = Path(target_dir)
        
        self._log(f"开始归档到: {target_dir}")
        
        try:
            archiver = PhotoArchiver(
                rename_rule=RenameRule.BY_POINT_AND_SEQUENCE,
                create_subdirectories=True,
                copy_instead_of_move=True  # 默认复制，不删除原文件
            )
            
            result = archiver.archive(
                photos=self._photos,
                target_directory=target_path,
                work_order=self._work_order,
                skip_issues=False  # 不跳过有问题的照片
            )
            
            if result.success:
                self._log(f"归档成功!", 'SUCCESS')
                self._log(f"  成功: {result.success_count} 张")
                self._log(f"  跳过: {result.skipped_count} 张")
                self._log(f"  目标目录: {target_dir}")
                
                if result.renamed_files:
                    self._log(f"  重命名了 {len(result.renamed_files)} 个文件")
                
                messagebox.showinfo(
                    "归档成功",
                    f"归档完成!\n\n"
                    f"成功: {result.success_count} 张\n"
                    f"跳过: {result.skipped_count} 张\n"
                    f"目标目录: {target_dir}"
                )
            else:
                self._log(f"归档完成但有错误", 'WARNING')
                for error in result.errors:
                    self._log(f"  错误: {error}", 'ERROR')
                
                messagebox.showwarning(
                    "归档完成",
                    f"归档完成但有错误:\n" + "\n".join(result.errors[:5])
                )
            
        except Exception as e:
            self._log(f"归档时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"归档时出错: {str(e)}")
    
    def _export_markdown(self):
        """导出Markdown报告"""
        if not self._quality_report:
            self._log("请先执行质检", 'WARNING')
            messagebox.showwarning("警告", "请先执行质检")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存Markdown报告",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        self._log(f"正在导出Markdown报告: {file_path}")
        
        try:
            exporter = ReportExporter()
            result = exporter.export_markdown(
                self._quality_report,
                Path(file_path),
                self._photos,
                self._work_order
            )
            
            if result.success:
                self._log(f"Markdown报告导出成功!", 'SUCCESS')
                messagebox.showinfo("导出成功", f"报告已保存到:\n{file_path}")
            else:
                self._log(f"导出失败: {', '.join(result.errors)}", 'ERROR')
                messagebox.showerror("导出错误", "\n".join(result.errors))
                
        except Exception as e:
            self._log(f"导出报告时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"导出报告时出错: {str(e)}")
    
    def _export_csv(self):
        """导出CSV问题清单"""
        if not self._validation_result:
            self._log("请先执行质检", 'WARNING')
            messagebox.showwarning("警告", "请先执行质检")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存CSV问题清单",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        self._log(f"正在导出CSV问题清单: {file_path}")
        
        try:
            exporter = ReportExporter()
            result = exporter.export_csv(
                self._validation_result.all_issues,
                Path(file_path),
                include_resolved=False
            )
            
            if result.success:
                self._log(f"CSV问题清单导出成功!", 'SUCCESS')
                messagebox.showinfo("导出成功", f"清单已保存到:\n{file_path}")
            else:
                self._log(f"导出失败: {', '.join(result.errors)}", 'ERROR')
                messagebox.showerror("导出错误", "\n".join(result.errors))
                
        except Exception as e:
            self._log(f"导出CSV时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"导出CSV时出错: {str(e)}")
    
    def _export_all(self):
        """导出所有报告"""
        if not self._quality_report or not self._validation_result:
            self._log("请先执行质检", 'WARNING')
            messagebox.showwarning("警告", "请先执行质检")
            return
        
        # 选择目录
        output_dir = filedialog.askdirectory(title="选择导出目录")
        if not output_dir:
            return
        
        output_path = Path(output_dir)
        base_name = f"质检报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        self._log(f"正在导出报告到: {output_dir}")
        
        try:
            exporter = ReportExporter()
            result = exporter.export_all(
                self._quality_report,
                self._validation_result.all_issues,
                output_path,
                base_name,
                self._photos,
                self._work_order
            )
            
            if result.success:
                self._log(f"报告导出成功!", 'SUCCESS')
                if result.markdown_path:
                    self._log(f"  Markdown: {result.markdown_path}")
                if result.csv_path:
                    self._log(f"  CSV清单: {result.csv_path}")
                
                messagebox.showinfo(
                    "导出成功",
                    f"报告已导出到:\n{output_dir}\n\n"
                    f"生成的文件:\n"
                    f"- {base_name}.md\n"
                    f"- {base_name}_问题清单.csv"
                )
            else:
                self._log(f"导出部分失败", 'WARNING')
                for error in result.errors:
                    self._log(f"  错误: {error}", 'ERROR')
                
        except Exception as e:
            self._log(f"导出报告时出错: {str(e)}", 'ERROR')
            messagebox.showerror("错误", f"导出报告时出错: {str(e)}")
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            "维保照片归档质检台 v1.0\n\n"
            "电梯维保班组用本地桌面工具\n\n"
            "功能:\n"
            "- 导入照片目录和工单CSV\n"
            "- 按规则校验: 点位、时间、重复、命名、配对\n"
            "- 人工确认问题\n"
            "- 批量重命名归档\n"
            "- 导出Markdown报告和CSV清单"
        )
