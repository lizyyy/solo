#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站复核台 - 主程序入口
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
from datetime import datetime
from models import DataStore
from rules_engine import RulesEngine
from data_importer import DataImporter
from data_exporter import DataExporter
from storage import LocalStorage


class FuneralReviewApp:
    def __init__(self, root):
        self.root = root
        self.root.title("殡仪服务站复核台 v1.0")
        self.root.geometry("1400x900")
        
        self.data_store = DataStore()
        self.rules_engine = RulesEngine(self.data_store)
        self.storage = LocalStorage()
        
        self.setup_ui()
        self.load_saved_data()
    
    def setup_ui(self):
        self.main_frame = ttk.Frame(self.root, padding="10")
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        self.create_menu_bar()
        self.create_toolbar()
        self.create_main_content()
        self.create_status_bar()
    
    def create_menu_bar(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入数据...", command=self.import_data)
        file_menu.add_separator()
        file_menu.add_command(label="保存当前状态", command=self.save_current_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出Markdown交接单", command=self.export_markdown)
        file_menu.add_command(label="导出JSON审计包", command=self.export_json_audit)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        rules_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="规则", menu=rules_menu)
        rules_menu.add_command(label="重新计算所有规则", command=self.recalculate_rules)
        rules_menu.add_command(label="查看规则配置", command=self.show_rules_config)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self.show_about)
    
    def create_toolbar(self):
        toolbar = ttk.Frame(self.main_frame)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="导入数据", command=self.import_data).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="重新计算", command=self.recalculate_rules).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="保存状态", command=self.save_current_data).pack(side=tk.LEFT, padx=5)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        ttk.Button(toolbar, text="导出Markdown", command=self.export_markdown).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="导出JSON审计包", command=self.export_json_audit).pack(side=tk.LEFT, padx=5)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        self.summary_label = ttk.Label(toolbar, text="就绪 - 无数据")
        self.summary_label.pack(side=tk.RIGHT, padx=5)
    
    def create_main_content(self):
        self.paned_window = ttk.PanedWindow(self.main_frame, orient=tk.VERTICAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True)
        
        self.top_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(self.top_frame, weight=2)
        
        self.bottom_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(self.bottom_frame, weight=1)
        
        self.create_top_content()
        self.create_bottom_content()
    
    def create_top_content(self):
        self.notebook = ttk.Notebook(self.top_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        self.create_risk_analysis_tab()
        self.create_cabinet_view_tab()
        self.create_schedule_view_tab()
    
    def create_risk_analysis_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="风险分析")
        
        columns = ("风险类型", "逝者姓名", "相关信息", "风险级别", "状态", "复核意见")
        self.risk_tree = ttk.Treeview(frame, columns=columns, show="headings", height=15)
        
        for col in columns:
            self.risk_tree.heading(col, text=col)
            self.risk_tree.column(col, width=120)
        
        self.risk_tree.column("风险类型", width=100)
        self.risk_tree.column("逝者姓名", width=80)
        self.risk_tree.column("相关信息", width=200)
        self.risk_tree.column("风险级别", width=80)
        self.risk_tree.column("状态", width=80)
        self.risk_tree.column("复核意见", width=200)
        
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.risk_tree.yview)
        self.risk_tree.configure(yscrollcommand=scrollbar.set)
        
        self.risk_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.risk_tree.bind("<Double-1>", self.on_risk_double_click)
    
    def create_cabinet_view_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="柜位视图")
        
        columns = ("柜位编号", "逝者姓名", "冷藏开始时间", "预计结束时间", "温度状态", "证件状态")
        self.cabinet_tree = ttk.Treeview(frame, columns=columns, show="headings", height=15)
        
        for col in columns:
            self.cabinet_tree.heading(col, text=col)
            self.cabinet_tree.column(col, width=120)
        
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.cabinet_tree.yview)
        self.cabinet_tree.configure(yscrollcommand=scrollbar.set)
        
        self.cabinet_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_schedule_view_tab(self):
        frame = ttk.Frame(self.notebook)
        self.notebook.add(frame, text="排期视图")
        
        columns = ("日期", "时段", "逝者姓名", "服务类型", "厅/炉号", "状态")
        self.schedule_tree = ttk.Treeview(frame, columns=columns, show="headings", height=15)
        
        for col in columns:
            self.schedule_tree.heading(col, text=col)
            self.schedule_tree.column(col, width=120)
        
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.schedule_tree.yview)
        self.schedule_tree.configure(yscrollcommand=scrollbar.set)
        
        self.schedule_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_bottom_content(self):
        self.bottom_notebook = ttk.Notebook(self.bottom_frame)
        self.bottom_notebook.pack(fill=tk.BOTH, expand=True)
        
        self.create_detail_tab()
        self.create_review_tab()
    
    def create_detail_tab(self):
        frame = ttk.Frame(self.bottom_notebook)
        self.bottom_notebook.add(frame, text="详细信息")
        
        self.detail_text = tk.Text(frame, wrap=tk.WORD, height=8)
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.detail_text.yview)
        self.detail_text.configure(yscrollcommand=scrollbar.set)
        
        self.detail_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_review_tab(self):
        frame = ttk.Frame(self.bottom_notebook)
        self.bottom_notebook.add(frame, text="复核记录")
        
        columns = ("时间", "操作人员", "风险项", "复核意见", "处理状态")
        self.review_tree = ttk.Treeview(frame, columns=columns, show="headings", height=8)
        
        for col in columns:
            self.review_tree.heading(col, text=col)
            self.review_tree.column(col, width=120)
        
        self.review_tree.column("时间", width=150)
        self.review_tree.column("复核意见", width=250)
        
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.review_tree.yview)
        self.review_tree.configure(yscrollcommand=scrollbar.set)
        
        self.review_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_status_bar(self):
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪")
        self.status_label.pack(side=tk.LEFT, padx=5)
        
        self.time_label = ttk.Label(self.status_bar, text=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.time_label.pack(side=tk.RIGHT, padx=5)
        
        self.update_time()
    
    def update_time(self):
        self.time_label.config(text=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.root.after(1000, self.update_time)
    
    def load_saved_data(self):
        saved_data = self.storage.load()
        if saved_data:
            try:
                self.data_store.from_dict(saved_data.get('data_store', {}))
                reviews = saved_data.get('reviews', [])
                for review in reviews:
                    self.data_store.add_review(review)
                self.update_display()
                self.set_status("已加载保存的数据")
            except Exception as e:
                self.set_status(f"加载数据失败: {str(e)}")
    
    def import_data(self):
        file_path = filedialog.askopenfilename(
            title="选择数据文件",
            filetypes=[("CSV文件", "*.csv"), ("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                importer = DataImporter(self.data_store)
                if file_path.endswith('.csv'):
                    importer.import_csv(file_path)
                elif file_path.endswith('.json'):
                    importer.import_json(file_path)
                else:
                    messagebox.showerror("错误", "不支持的文件格式")
                    return
                
                self.recalculate_rules()
                self.update_display()
                self.set_status(f"已导入: {file_path}")
                messagebox.showinfo("成功", "数据导入成功！规则已重新计算。")
            except Exception as e:
                messagebox.showerror("导入错误", f"导入失败: {str(e)}")
    
    def recalculate_rules(self):
        self.rules_engine.reset()
        self.rules_engine.check_all()
        self.update_display()
        self.set_status("规则重新计算完成")
    
    def save_current_data(self):
        try:
            data = {
                'data_store': self.data_store.to_dict(),
                'reviews': self.data_store.get_reviews()
            }
            self.storage.save(data)
            self.set_status("数据已保存")
            messagebox.showinfo("成功", "当前状态已保存！")
        except Exception as e:
            messagebox.showerror("保存错误", f"保存失败: {str(e)}")
    
    def export_markdown(self):
        file_path = filedialog.asksaveasfilename(
            title="保存Markdown交接单",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = DataExporter(self.data_store)
                exporter.export_markdown(file_path)
                self.set_status(f"已导出: {file_path}")
                messagebox.showinfo("成功", "Markdown交接单导出成功！")
            except Exception as e:
                messagebox.showerror("导出错误", f"导出失败: {str(e)}")
    
    def export_json_audit(self):
        file_path = filedialog.asksaveasfilename(
            title="保存JSON审计包",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = DataExporter(self.data_store)
                exporter.export_json_audit(file_path)
                self.set_status(f"已导出: {file_path}")
                messagebox.showinfo("成功", "JSON审计包导出成功！")
            except Exception as e:
                messagebox.showerror("导出错误", f"导出失败: {str(e)}")
    
    def update_display(self):
        self.update_risk_tree()
        self.update_cabinet_tree()
        self.update_schedule_tree()
        self.update_review_tree()
        self.update_summary()
    
    def update_risk_tree(self):
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        risks = self.rules_engine.get_risks()
        for risk in risks:
            values = (
                risk['type'],
                risk['deceased_name'],
                risk['info'],
                risk['level'],
                risk.get('status', '待处理'),
                risk.get('review_note', '')
            )
            self.risk_tree.insert("", tk.END, values=values, iid=risk['id'])
    
    def update_cabinet_tree(self):
        for item in self.cabinet_tree.get_children():
            self.cabinet_tree.delete(item)
        
        cabinets = self.data_store.get_cabinet_data()
        for cabinet in cabinets:
            values = (
                cabinet['cabinet_id'],
                cabinet['deceased_name'],
                cabinet['start_time'],
                cabinet['expected_end_time'],
                cabinet['temp_status'],
                cabinet['document_status']
            )
            self.cabinet_tree.insert("", tk.END, values=values)
    
    def update_schedule_tree(self):
        for item in self.schedule_tree.get_children():
            self.schedule_tree.delete(item)
        
        schedules = self.data_store.get_schedule_data()
        for schedule in schedules:
            values = (
                schedule['date'],
                schedule['time_slot'],
                schedule['deceased_name'],
                schedule['service_type'],
                schedule['location'],
                schedule['status']
            )
            self.schedule_tree.insert("", tk.END, values=values)
    
    def update_review_tree(self):
        for item in self.review_tree.get_children():
            self.review_tree.delete(item)
        
        reviews = self.data_store.get_reviews()
        for review in reviews:
            values = (
                review['time'],
                review.get('operator', '系统'),
                review['risk_type'],
                review['note'],
                review['status']
            )
            self.review_tree.insert("", tk.END, values=values)
    
    def update_summary(self):
        risks = self.rules_engine.get_risks()
        high_risk = sum(1 for r in risks if r['level'] == '高')
        medium_risk = sum(1 for r in risks if r['level'] == '中')
        low_risk = sum(1 for r in risks if r['level'] == '低')
        
        summary = f"风险统计: 高{high_risk} | 中{medium_risk} | 低{low_risk}"
        self.summary_label.config(text=summary)
    
    def on_risk_double_click(self, event):
        selection = self.risk_tree.selection()
        if not selection:
            return
        
        risk_id = selection[0]
        risk = self.rules_engine.get_risk_by_id(risk_id)
        
        if risk:
            self.show_risk_detail(risk)
            self.show_review_dialog(risk)
    
    def show_risk_detail(self, risk):
        detail = f"""风险详情
================

风险类型: {risk['type']}
风险级别: {risk['level']}
逝者姓名: {risk['deceased_name']}
相关信息: {risk['info']}

详细描述:
{risk.get('description', '无')}

当前状态: {risk.get('status', '待处理')}
复核意见: {risk.get('review_note', '无')}
"""
        self.detail_text.delete(1.0, tk.END)
        self.detail_text.insert(tk.END, detail)
    
    def show_review_dialog(self, risk):
        dialog = tk.Toplevel(self.root)
        dialog.title("复核意见")
        dialog.geometry("500x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        frame = ttk.Frame(dialog, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text=f"风险项: {risk['type']} - {risk['deceased_name']}").pack(anchor=tk.W)
        ttk.Label(frame, text=f"风险级别: {risk['level']}").pack(anchor=tk.W)
        ttk.Separator(frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        ttk.Label(frame, text="复核意见:").pack(anchor=tk.W)
        review_text = tk.Text(frame, height=8, wrap=tk.WORD)
        review_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        if risk.get('review_note'):
            review_text.insert(tk.END, risk['review_note'])
        
        ttk.Label(frame, text="处理状态:").pack(anchor=tk.W)
        status_var = tk.StringVar(value=risk.get('status', '待处理'))
        status_combo = ttk.Combobox(frame, textvariable=status_var, 
                                      values=['待处理', '处理中', '已处理', '无需处理'])
        status_combo.pack(anchor=tk.W, pady=5)
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(fill=tk.X, pady=10)
        
        def save_review():
            note = review_text.get(1.0, tk.END).strip()
            status = status_var.get()
            
            review_data = {
                'time': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'operator': '复核员',
                'risk_type': risk['type'],
                'risk_id': risk['id'],
                'deceased_name': risk['deceased_name'],
                'note': note,
                'status': status
            }
            
            self.data_store.add_review(review_data)
            self.rules_engine.update_risk_review(risk['id'], note, status)
            
            self.update_display()
            self.save_current_data()
            dialog.destroy()
        
        ttk.Button(button_frame, text="保存", command=save_review).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.RIGHT, padx=5)
    
    def show_rules_config(self):
        config = self.rules_engine.get_config()
        config_text = "规则引擎配置\n\n"
        for key, value in config.items():
            config_text += f"{key}: {value}\n"
        
        messagebox.showinfo("规则配置", config_text)
    
    def show_about(self):
        about_text = """
殡仪服务站复核台 v1.0

功能:
- 数据导入 (CSV/JSON)
- 风险分析 (冷藏超时、证件缺失、排期冲突、交接漏签)
- 本地数据持久化
- 导出 Markdown交接单 / JSON审计包
        """
        messagebox.showinfo("关于", about_text)
    
    def set_status(self, message):
        self.status_label.config(text=message)


def main():
    root = tk.Tk()
    app = FuneralReviewApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
