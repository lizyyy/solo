import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Callable, List, Dict

from dao.package_template_dao import PackageTemplateDAO
from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO
from business.state_machine import PackageStatus, CycleStatus, IndicatorResult
from utils.csv_import_export import CSVImporter, CSVExporter
from utils.report_generator import ReportGenerator


class MainWindow:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title('器械包追踪台 - 口腔诊所消毒管理系统')
        self.root.geometry('1200x800')
        self.root.minsize(1000, 700)
        
        self._create_menu()
        self._create_notebook()
        self._create_status_bar()
        
        self.refresh_all()
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='文件', menu=file_menu)
        file_menu.add_command(label='导入器械包 (CSV)', command=self._import_packages)
        file_menu.add_separator()
        file_menu.add_command(label='导出库存', command=self._export_inventory)
        file_menu.add_command(label='导出锅次追溯', command=self._export_cycle_traceability)
        file_menu.add_separator()
        file_menu.add_command(label='退出', command=self.root.quit)
        
        report_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='报表', menu=report_menu)
        report_menu.add_command(label='库存报告', command=self._show_inventory_report)
        report_menu.add_command(label='失败锅次报告', command=self._show_failed_cycles_report)
        report_menu.add_command(label='每日汇总', command=self._show_daily_report)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='帮助', menu=help_menu)
        help_menu.add_command(label='关于', command=self._show_about)
    
    def _create_notebook(self):
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(expand=True, fill='both', padx=5, pady=5)
        
        self.packages_frame = PackagesFrame(self.notebook, self.refresh_all)
        self.notebook.add(self.packages_frame, text='器械包管理')
        
        self.cycles_frame = CyclesFrame(self.notebook, self.refresh_all)
        self.notebook.add(self.cycles_frame, text='锅次管理')
        
        self.trace_frame = TraceFrame(self.notebook)
        self.notebook.add(self.trace_frame, text='追溯查询')
    
    def _create_status_bar(self):
        self.status_var = tk.StringVar(value='就绪')
        self.status_bar = ttk.Label(
            self.root, 
            textvariable=self.status_var, 
            relief=tk.SUNKEN, 
            anchor=tk.W
        )
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self._update_status_counts()
    
    def _update_status_counts(self):
        counts = PackageDAO.count_by_status()
        total = sum(counts.values())
        status_text = f'总计: {total} 个器械包 | '
        status_parts = [f'{k}: {v}' for k, v in counts.items()]
        self.status_var.set(status_text + ' | '.join(status_parts))
    
    def refresh_all(self):
        self.packages_frame.refresh()
        self.cycles_frame.refresh()
        self._update_status_counts()
    
    def _import_packages(self):
        file_path = filedialog.askopenfilename(
            title='选择CSV文件',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        if not file_path:
            return
        
        try:
            imported, skipped, errors = CSVImporter.import_packages(file_path)
            
            if errors:
                error_msg = '\n'.join(errors[:10])
                if len(errors) > 10:
                    error_msg += f'\n... 还有 {len(errors) - 10} 个错误'
                messagebox.showwarning('导入完成', 
                    f'导入完成:\n成功: {imported} 个\n跳过: {skipped} 个\n\n错误详情:\n{error_msg}')
            else:
                messagebox.showinfo('导入成功', f'成功导入 {imported} 个器械包')
            
            self.refresh_all()
        except Exception as e:
            messagebox.showerror('导入失败', str(e))
    
    def _export_inventory(self):
        file_path = filedialog.asksaveasfilename(
            title='保存库存报告',
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        if not file_path:
            return
        
        try:
            count = CSVExporter.export_inventory(file_path)
            messagebox.showinfo('导出成功', f'成功导出 {count} 条记录到:\n{file_path}')
        except Exception as e:
            messagebox.showerror('导出失败', str(e))
    
    def _export_cycle_traceability(self):
        file_path = filedialog.asksaveasfilename(
            title='保存锅次追溯报告',
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        if not file_path:
            return
        
        try:
            count = CSVExporter.export_cycle_traceability(file_path)
            messagebox.showinfo('导出成功', f'成功导出 {count} 条记录到:\n{file_path}')
        except Exception as e:
            messagebox.showerror('导出失败', str(e))
    
    def _show_inventory_report(self):
        report = ReportGenerator.generate_inventory_report()
        text = ReportGenerator.format_report_text(report, '库存报告')
        self._show_report_window('库存报告', text)
    
    def _show_failed_cycles_report(self):
        report = ReportGenerator.generate_failed_cycles_report()
        text = ReportGenerator.format_report_text(report, '失败锅次报告')
        self._show_report_window('失败锅次报告', text)
    
    def _show_daily_report(self):
        report = ReportGenerator.generate_daily_summary_report()
        text = ReportGenerator.format_report_text(report, '每日汇总报告')
        self._show_report_window('每日汇总报告', text)
    
    def _show_report_window(self, title: str, content: str):
        window = tk.Toplevel(self.root)
        window.title(title)
        window.geometry('700x500')
        
        text_widget = tk.Text(window, wrap=tk.WORD, font=('Courier', 10))
        text_widget.pack(expand=True, fill='both', padx=5, pady=5)
        text_widget.insert(tk.END, content)
        text_widget.config(state=tk.DISABLED)
        
        scrollbar = ttk.Scrollbar(window, orient=tk.VERTICAL, command=text_widget.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        text_widget.config(yscrollcommand=scrollbar.set)
    
    def _show_about(self):
        messagebox.showinfo('关于', 
            '器械包追踪台 v1.0\n\n'
            '口腔诊所消毒管理系统\n\n'
            '功能:\n'
            '- 器械包模板管理\n'
            '- 器械包状态追踪\n'
            '- 灭菌锅次管理\n'
            '- 状态流转控制\n'
            '- CSV导入导出\n'
            '- 追溯报告生成'
        )


class PackagesFrame(ttk.Frame):
    def __init__(self, parent, refresh_callback: Callable):
        super().__init__(parent)
        self.refresh_callback = refresh_callback
        
        self._create_toolbar()
        self._create_treeview()
        self._create_details_panel()
    
    def _create_toolbar(self):
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, pady=5)
        
        ttk.Button(toolbar, text='新增器械包', command=self._add_package).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='领用', command=self._mark_used).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='报废', command=self._mark_discarded).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='查看历史', command=self._view_history).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='刷新', command=self.refresh).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(toolbar, text='状态筛选:').pack(side=tk.LEFT, padx=(20, 5))
        self.status_filter_var = tk.StringVar(value='全部')
        status_combo = ttk.Combobox(toolbar, textvariable=self.status_filter_var, width=12)
        status_combo['values'] = ['全部'] + [s.value for s in PackageStatus]
        status_combo.pack(side=tk.LEFT, padx=5)
        status_combo.bind('<<ComboboxSelected>>', lambda e: self.refresh())
        
        ttk.Label(toolbar, text='搜索:').pack(side=tk.LEFT, padx=(20, 5))
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=20)
        search_entry.pack(side=tk.LEFT, padx=5)
        search_entry.bind('<Return>', lambda e: self.refresh())
        ttk.Button(toolbar, text='搜索', command=self.refresh).pack(side=tk.LEFT, padx=5)
    
    def _create_treeview(self):
        columns = ('id', 'package_number', 'template_name', 'status', 'created_at')
        self.tree = ttk.Treeview(self, columns=columns, show='headings', selectmode='extended')
        
        self.tree.heading('id', text='ID')
        self.tree.heading('package_number', text='器械包编号')
        self.tree.heading('template_name', text='模板类型')
        self.tree.heading('status', text='状态')
        self.tree.heading('created_at', text='创建时间')
        
        self.tree.column('id', width=50)
        self.tree.column('package_number', width=150)
        self.tree.column('template_name', width=100)
        self.tree.column('status', width=100)
        self.tree.column('created_at', width=180)
        
        scrollbar_y = ttk.Scrollbar(self, orient=tk.VERTICAL, command=self.tree.yview)
        scrollbar_x = ttk.Scrollbar(self, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.tree.pack(side=tk.LEFT, expand=True, fill='both')
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.tree.bind('<<TreeviewSelect>>', self._on_select)
    
    def _create_details_panel(self):
        details_frame = ttk.LabelFrame(self, text='详细信息', padding=10)
        details_frame.pack(fill=tk.X, pady=10)
        
        self.details_text = tk.Text(details_frame, height=6, wrap=tk.WORD, state=tk.DISABLED)
        self.details_text.pack(fill=tk.BOTH, expand=True)
    
    def refresh(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        status_filter = self.status_filter_var.get()
        search_text = self.search_var.get().strip().lower()
        
        if status_filter == '全部':
            packages = PackageDAO.get_all()
        else:
            packages = PackageDAO.get_by_status(status_filter)
        
        if search_text:
            packages = [
                p for p in packages
                if search_text in p['package_number'].lower() or
                   search_text in p['template_name'].lower()
            ]
        
        for pkg in packages:
            self.tree.insert('', tk.END, values=(
                pkg['id'],
                pkg['package_number'],
                pkg['template_name'],
                pkg['status'],
                pkg['created_at']
            ), iid=str(pkg['id']))
        
        self._update_details(None)
    
    def _on_select(self, event):
        selected = self.tree.selection()
        if selected:
            pkg_id = int(selected[0])
            pkg = PackageDAO.get_by_id(pkg_id)
            self._update_details(pkg)
        else:
            self._update_details(None)
    
    def _update_details(self, pkg: Optional[Dict]):
        self.details_text.config(state=tk.NORMAL)
        self.details_text.delete(1.0, tk.END)
        
        if pkg:
            details = [
                f'ID: {pkg.get("id", "")}',
                f'编号: {pkg.get("package_number", "")}',
                f'模板: {pkg.get("template_name", "")}',
                f'状态: {pkg.get("status", "")}',
                f'当前锅次ID: {pkg.get("current_cycle_id", "无")}',
                f'创建时间: {pkg.get("created_at", "")}',
                f'更新时间: {pkg.get("updated_at", "")}',
            ]
            if pkg.get('notes'):
                details.append(f'备注: {pkg["notes"]}')
            
            self.details_text.insert(tk.END, '\n'.join(details))
        
        self.details_text.config(state=tk.DISABLED)
    
    def _get_selected_ids(self) -> List[int]:
        selected = self.tree.selection()
        return [int(s) for s in selected]
    
    def _add_package(self):
        dialog = AddPackageDialog(self)
        if dialog.result:
            self.refresh()
            self.refresh_callback()
    
    def _mark_used(self):
        ids = self._get_selected_ids()
        if not ids:
            messagebox.showwarning('提示', '请先选择器械包')
            return
        
        count = 0
        for pkg_id in ids:
            pkg = PackageDAO.get_by_id(pkg_id)
            if pkg and pkg['status'] == PackageStatus.RELEASED.value:
                if PackageDAO.mark_as_used(pkg_id):
                    count += 1
        
        messagebox.showinfo('完成', f'成功领用 {count} 个器械包')
        self.refresh()
        self.refresh_callback()
    
    def _mark_discarded(self):
        ids = self._get_selected_ids()
        if not ids:
            messagebox.showwarning('提示', '请先选择器械包')
            return
        
        reason = simpledialog.askstring('报废原因', '请输入报废原因:')
        if reason is None:
            return
        
        count = 0
        for pkg_id in ids:
            if PackageDAO.mark_as_discarded(pkg_id, reason=reason):
                count += 1
        
        messagebox.showinfo('完成', f'成功报废 {count} 个器械包')
        self.refresh()
        self.refresh_callback()
    
    def _view_history(self):
        ids = self._get_selected_ids()
        if len(ids) != 1:
            messagebox.showwarning('提示', '请选择一个器械包查看历史')
            return
        
        pkg_id = ids[0]
        pkg = PackageDAO.get_by_id(pkg_id)
        if not pkg:
            return
        
        history = PackageDAO.get_status_history(pkg_id)
        
        window = tk.Toplevel(self)
        window.title(f'状态历史 - {pkg["package_number"]}')
        window.geometry('800x400')
        
        columns = ('changed_at', 'from_status', 'to_status', 'operator', 'reason')
        tree = ttk.Treeview(window, columns=columns, show='headings')
        
        tree.heading('changed_at', text='时间')
        tree.heading('from_status', text='从状态')
        tree.heading('to_status', text='到状态')
        tree.heading('operator', text='操作人')
        tree.heading('reason', text='原因')
        
        tree.column('changed_at', width=150)
        tree.column('from_status', width=100)
        tree.column('to_status', width=100)
        tree.column('operator', width=80)
        tree.column('reason', width=300)
        
        for record in history:
            tree.insert('', tk.END, values=(
                record['changed_at'],
                record['from_status'] or '-',
                record['to_status'],
                record['operator'] or '-',
                record['reason'] or '-'
            ))
        
        tree.pack(expand=True, fill='both', padx=5, pady=5)


class CyclesFrame(ttk.Frame):
    def __init__(self, parent, refresh_callback: Callable):
        super().__init__(parent)
        self.refresh_callback = refresh_callback
        self.selected_cycle_id: Optional[int] = None
        
        self._create_toolbar()
        self._create_paned_window()
    
    def _create_toolbar(self):
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, pady=5)
        
        ttk.Button(toolbar, text='新建锅次', command=self._create_cycle).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='完成锅次', command=self._complete_cycle).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='放行', command=self._release_packages).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='标记失败', command=self._fail_cycle).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='刷新', command=self.refresh).pack(side=tk.LEFT, padx=5)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        ttk.Button(toolbar, text='添加器械包', command=self._add_package_to_cycle).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text='移除器械包', command=self._remove_package_from_cycle).pack(side=tk.LEFT, padx=5)
    
    def _create_paned_window(self):
        paned = ttk.PanedWindow(self, orient=tk.VERTICAL)
        paned.pack(expand=True, fill='both')
        
        top_frame = ttk.Frame(paned)
        paned.add(top_frame, weight=1)
        
        columns = ('id', 'cycle_number', 'autoclave_id', 'operator', 'status', 'start_time', 'end_time')
        self.cycle_tree = ttk.Treeview(top_frame, columns=columns, show='headings', selectmode='browse')
        
        self.cycle_tree.heading('id', text='ID')
        self.cycle_tree.heading('cycle_number', text='锅次编号')
        self.cycle_tree.heading('autoclave_id', text='灭菌锅号')
        self.cycle_tree.heading('operator', text='操作人')
        self.cycle_tree.heading('status', text='状态')
        self.cycle_tree.heading('start_time', text='开始时间')
        self.cycle_tree.heading('end_time', text='结束时间')
        
        self.cycle_tree.column('id', width=50)
        self.cycle_tree.column('cycle_number', width=120)
        self.cycle_tree.column('autoclave_id', width=80)
        self.cycle_tree.column('operator', width=80)
        self.cycle_tree.column('status', width=80)
        self.cycle_tree.column('start_time', width=150)
        self.cycle_tree.column('end_time', width=150)
        
        scrollbar_y = ttk.Scrollbar(top_frame, orient=tk.VERTICAL, command=self.cycle_tree.yview)
        self.cycle_tree.configure(yscrollcommand=scrollbar_y.set)
        
        self.cycle_tree.pack(side=tk.LEFT, expand=True, fill='both')
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.cycle_tree.bind('<<TreeviewSelect>>', self._on_cycle_select)
        
        bottom_frame = ttk.LabelFrame(paned, text='锅次内器械包', padding=5)
        paned.add(bottom_frame, weight=1)
        
        columns = ('id', 'package_number', 'template_name', 'status', 'added_at')
        self.package_tree = ttk.Treeview(bottom_frame, columns=columns, show='headings', selectmode='extended')
        
        self.package_tree.heading('id', text='ID')
        self.package_tree.heading('package_number', text='器械包编号')
        self.package_tree.heading('template_name', text='模板类型')
        self.package_tree.heading('status', text='状态')
        self.package_tree.heading('added_at', text='加入时间')
        
        self.package_tree.column('id', width=50)
        self.package_tree.column('package_number', width=150)
        self.package_tree.column('template_name', width=100)
        self.package_tree.column('status', width=100)
        self.package_tree.column('added_at', width=150)
        
        scrollbar_y2 = ttk.Scrollbar(bottom_frame, orient=tk.VERTICAL, command=self.package_tree.yview)
        self.package_tree.configure(yscrollcommand=scrollbar_y2.set)
        
        self.package_tree.pack(side=tk.LEFT, expand=True, fill='both')
        scrollbar_y2.pack(side=tk.RIGHT, fill=tk.Y)
    
    def refresh(self):
        for item in self.cycle_tree.get_children():
            self.cycle_tree.delete(item)
        
        cycles = CycleDAO.get_all()
        for cycle in cycles:
            self.cycle_tree.insert('', tk.END, values=(
                cycle['id'],
                cycle['cycle_number'],
                cycle['autoclave_id'],
                cycle['operator'],
                cycle['status'],
                cycle['start_time'] or '-',
                cycle['end_time'] or '-'
            ), iid=str(cycle['id']))
        
        self._refresh_packages()
    
    def _refresh_packages(self):
        for item in self.package_tree.get_children():
            self.package_tree.delete(item)
        
        if self.selected_cycle_id:
            packages = PackageDAO.get_by_cycle(self.selected_cycle_id)
            for pkg in packages:
                self.package_tree.insert('', tk.END, values=(
                    pkg['id'],
                    pkg['package_number'],
                    pkg['template_name'],
                    pkg['status'],
                    pkg['added_at']
                ), iid=str(pkg['id']))
    
    def _on_cycle_select(self, event):
        selected = self.cycle_tree.selection()
        if selected:
            self.selected_cycle_id = int(selected[0])
        else:
            self.selected_cycle_id = None
        self._refresh_packages()
    
    def _create_cycle(self):
        dialog = CreateCycleDialog(self)
        if dialog.result:
            self.refresh()
            self.refresh_callback()
    
    def _complete_cycle(self):
        if not self.selected_cycle_id:
            messagebox.showwarning('提示', '请先选择一个锅次')
            return
        
        cycle = CycleDAO.get_by_id(self.selected_cycle_id)
        if not cycle:
            return
        
        if cycle['status'] != CycleStatus.IN_PROGRESS.value:
            messagebox.showwarning('提示', '只有进行中的锅次可以完成')
            return
        
        dialog = CompleteCycleDialog(self, cycle)
        if dialog.result:
            self.refresh()
            self.refresh_callback()
    
    def _release_packages(self):
        if not self.selected_cycle_id:
            messagebox.showwarning('提示', '请先选择一个锅次')
            return
        
        cycle = CycleDAO.get_by_id(self.selected_cycle_id)
        if not cycle:
            return
        
        try:
            released = CycleDAO.release_packages(self.selected_cycle_id)
            messagebox.showinfo('完成', f'成功放行 {released} 个器械包')
            self.refresh()
            self.refresh_callback()
        except Exception as e:
            messagebox.showerror('错误', str(e))
    
    def _fail_cycle(self):
        if not self.selected_cycle_id:
            messagebox.showwarning('提示', '请先选择一个锅次')
            return
        
        from tkinter import simpledialog
        reason = simpledialog.askstring('失败原因', '请输入失败原因:')
        if reason is None or not reason.strip():
            return
        
        try:
            CycleDAO.fail_cycle(self.selected_cycle_id, reason.strip())
            messagebox.showinfo('完成', '锅次已标记为失败，相关器械包已隔离')
            self.refresh()
            self.refresh_callback()
        except Exception as e:
            messagebox.showerror('错误', str(e))
    
    def _add_package_to_cycle(self):
        if not self.selected_cycle_id:
            messagebox.showwarning('提示', '请先选择一个锅次')
            return
        
        cycle = CycleDAO.get_by_id(self.selected_cycle_id)
        if not cycle or cycle['status'] != CycleStatus.IN_PROGRESS.value:
            messagebox.showwarning('提示', '只能向进行中的锅次添加器械包')
            return
        
        dialog = AddPackageToCycleDialog(self, self.selected_cycle_id)
        if dialog.result:
            self._refresh_packages()
            self.refresh_callback()
    
    def _remove_package_from_cycle(self):
        if not self.selected_cycle_id:
            messagebox.showwarning('提示', '请先选择一个锅次')
            return
        
        selected = self.package_tree.selection()
        if not selected:
            messagebox.showwarning('提示', '请选择要移除的器械包')
            return
        
        from tkinter import simpledialog
        reason = simpledialog.askstring('移除原因', '请输入移除原因:')
        if reason is None:
            return
        
        count = 0
        for pkg_id_str in selected:
            pkg_id = int(pkg_id_str)
            try:
                PackageDAO.remove_from_cycle(pkg_id, self.selected_cycle_id, reason)
                count += 1
            except Exception as e:
                messagebox.showerror('错误', str(e))
        
        if count > 0:
            messagebox.showinfo('完成', f'成功移除 {count} 个器械包')
            self._refresh_packages()
            self.refresh_callback()


class TraceFrame(ttk.Frame):
    def __init__(self, parent):
        super().__init__(parent)
        
        self._create_search_panel()
        self._create_result_panel()
    
    def _create_search_panel(self):
        search_frame = ttk.LabelFrame(self, text='追溯查询', padding=10)
        search_frame.pack(fill=tk.X, pady=10)
        
        ttk.Label(search_frame, text='器械包编号:').pack(side=tk.LEFT, padx=5)
        self.search_var = tk.StringVar()
        ttk.Entry(search_frame, textvariable=self.search_var, width=30).pack(side=tk.LEFT, padx=5)
        ttk.Button(search_frame, text='查询', command=self._search).pack(side=tk.LEFT, padx=5)
        ttk.Button(search_frame, text='导出历史', command=self._export_history).pack(side=tk.LEFT, padx=5)
    
    def _create_result_panel(self):
        notebook = ttk.Notebook(self)
        notebook.pack(expand=True, fill='both')
        
        info_frame = ttk.Frame(notebook, padding=10)
        notebook.add(info_frame, text='基本信息')
        
        self.info_text = tk.Text(info_frame, wrap=tk.WORD, state=tk.DISABLED)
        self.info_text.pack(expand=True, fill='both')
        
        history_frame = ttk.Frame(notebook, padding=10)
        notebook.add(history_frame, text='状态历史')
        
        columns = ('changed_at', 'from_status', 'to_status', 'cycle_number', 'operator', 'reason')
        self.history_tree = ttk.Treeview(history_frame, columns=columns, show='headings')
        
        self.history_tree.heading('changed_at', text='时间')
        self.history_tree.heading('from_status', text='从状态')
        self.history_tree.heading('to_status', text='到状态')
        self.history_tree.heading('cycle_number', text='关联锅次')
        self.history_tree.heading('operator', text='操作人')
        self.history_tree.heading('reason', text='原因')
        
        self.history_tree.column('changed_at', width=150)
        self.history_tree.column('from_status', width=100)
        self.history_tree.column('to_status', width=100)
        self.history_tree.column('cycle_number', width=100)
        self.history_tree.column('operator', width=80)
        self.history_tree.column('reason', width=250)
        
        self.history_tree.pack(expand=True, fill='both')
    
    def _search(self):
        package_number = self.search_var.get().strip()
        if not package_number:
            messagebox.showwarning('提示', '请输入器械包编号')
            return
        
        pkg = PackageDAO.get_by_number(package_number)
        if not pkg:
            messagebox.showwarning('提示', f'未找到器械包: {package_number}')
            return
        
        self.info_text.config(state=tk.NORMAL)
        self.info_text.delete(1.0, tk.END)
        
        info_lines = [
            f'器械包编号: {pkg["package_number"]}',
            f'模板类型: {pkg["template_name"]}',
            f'当前状态: {pkg["status"]}',
            f'创建时间: {pkg["created_at"]}',
            f'更新时间: {pkg["updated_at"]}',
        ]
        if pkg['current_cycle_id']:
            cycle = CycleDAO.get_by_id(pkg['current_cycle_id'])
            if cycle:
                info_lines.append(f'当前锅次: {cycle["cycle_number"]} ({cycle["status"]})')
        
        self.info_text.insert(tk.END, '\n'.join(info_lines))
        self.info_text.config(state=tk.DISABLED)
        
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)
        
        history = PackageDAO.get_status_history(pkg['id'])
        for record in history:
            self.history_tree.insert('', tk.END, values=(
                record['changed_at'],
                record['from_status'] or '-',
                record['to_status'],
                record['cycle_number'] or '-',
                record['operator'] or '-',
                record['reason'] or '-'
            ))
    
    def _export_history(self):
        package_number = self.search_var.get().strip()
        if not package_number:
            messagebox.showwarning('提示', '请先查询器械包')
            return
        
        pkg = PackageDAO.get_by_number(package_number)
        if not pkg:
            return
        
        file_path = filedialog.asksaveasfilename(
            title='保存历史记录',
            defaultextension='.csv',
            initialfile=f'{package_number}_history.csv',
            filetypes=[('CSV文件', '*.csv')]
        )
        if file_path:
            try:
                count = CSVExporter.export_package_history(file_path, pkg['id'])
                messagebox.showinfo('导出成功', f'成功导出 {count} 条记录')
            except Exception as e:
                messagebox.showerror('导出失败', str(e))


class AddPackageDialog(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.result = False
        self.title('新增器械包')
        self.geometry('400x250')
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
        self.wait_window(self)
    
    def _create_widgets(self):
        templates = PackageTemplateDAO.get_all()
        template_names = [t['name'] for t in templates]
        self.template_map = {t['name']: t['id'] for t in templates}
        
        frame = ttk.Frame(self, padding=20)
        frame.pack(expand=True, fill='both')
        
        ttk.Label(frame, text='模板类型:').grid(row=0, column=0, sticky=tk.W, pady=5)
        self.template_var = tk.StringVar()
        template_combo = ttk.Combobox(frame, textvariable=self.template_var, values=template_names, width=25)
        template_combo.grid(row=0, column=1, pady=5)
        if template_names:
            template_combo.current(0)
        
        ttk.Label(frame, text='器械包编号:').grid(row=1, column=0, sticky=tk.W, pady=5)
        self.number_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.number_var, width=30).grid(row=1, column=1, pady=5)
        
        ttk.Label(frame, text='备注:').grid(row=2, column=0, sticky=tk.W, pady=5)
        self.notes_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.notes_var, width=30).grid(row=2, column=1, pady=5)
        
        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=3, column=0, columnspan=2, pady=20)
        
        ttk.Button(btn_frame, text='确定', command=self._ok).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text='取消', command=self.destroy).pack(side=tk.LEFT, padx=10)
    
    def _ok(self):
        template_name = self.template_var.get()
        package_number = self.number_var.get().strip()
        notes = self.notes_var.get().strip() or None
        
        if not template_name:
            messagebox.showwarning('提示', '请选择模板类型')
            return
        
        if not package_number:
            messagebox.showwarning('提示', '请输入器械包编号')
            return
        
        template_id = self.template_map.get(template_name)
        if not template_id:
            messagebox.showerror('错误', '模板类型无效')
            return
        
        try:
            PackageDAO.create(template_id, package_number, notes)
            self.result = True
            self.destroy()
        except Exception as e:
            messagebox.showerror('错误', str(e))


class CreateCycleDialog(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.result = False
        self.title('新建锅次')
        self.geometry('450x350')
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
        self.wait_window(self)
    
    def _create_widgets(self):
        frame = ttk.Frame(self, padding=20)
        frame.pack(expand=True, fill='both')
        
        default_number = CycleDAO.generate_cycle_number()
        
        ttk.Label(frame, text='锅次编号:').grid(row=0, column=0, sticky=tk.W, pady=5)
        self.cycle_number_var = tk.StringVar(value=default_number)
        ttk.Entry(frame, textvariable=self.cycle_number_var, width=30).grid(row=0, column=1, pady=5)
        
        ttk.Label(frame, text='灭菌锅号:').grid(row=1, column=0, sticky=tk.W, pady=5)
        self.autoclave_var = tk.StringVar(value='A1')
        autoclave_combo = ttk.Combobox(frame, textvariable=self.autoclave_var, values=['A1', 'A2', 'A3', 'B1', 'B2'], width=27)
        autoclave_combo.grid(row=1, column=1, pady=5)
        
        ttk.Label(frame, text='操作人:').grid(row=2, column=0, sticky=tk.W, pady=5)
        self.operator_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.operator_var, width=30).grid(row=2, column=1, pady=5)
        
        ttk.Label(frame, text='温度 (℃):').grid(row=3, column=0, sticky=tk.W, pady=5)
        self.temp_var = tk.StringVar(value='121')
        ttk.Entry(frame, textvariable=self.temp_var, width=30).grid(row=3, column=1, pady=5)
        
        ttk.Label(frame, text='压力 (kPa):').grid(row=4, column=0, sticky=tk.W, pady=5)
        self.pressure_var = tk.StringVar(value='103')
        ttk.Entry(frame, textvariable=self.pressure_var, width=30).grid(row=4, column=1, pady=5)
        
        ttk.Label(frame, text='备注:').grid(row=5, column=0, sticky=tk.W, pady=5)
        self.notes_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.notes_var, width=30).grid(row=5, column=1, pady=5)
        
        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=6, column=0, columnspan=2, pady=20)
        
        ttk.Button(btn_frame, text='确定', command=self._ok).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text='取消', command=self.destroy).pack(side=tk.LEFT, padx=10)
    
    def _ok(self):
        cycle_number = self.cycle_number_var.get().strip()
        autoclave_id = self.autoclave_var.get().strip()
        operator = self.operator_var.get().strip()
        
        if not cycle_number:
            messagebox.showwarning('提示', '请输入锅次编号')
            return
        
        if not autoclave_id:
            messagebox.showwarning('提示', '请输入灭菌锅号')
            return
        
        if not operator:
            messagebox.showwarning('提示', '请输入操作人')
            return
        
        try:
            temperature = float(self.temp_var.get()) if self.temp_var.get().strip() else None
        except ValueError:
            temperature = None
        
        try:
            pressure = float(self.pressure_var.get()) if self.pressure_var.get().strip() else None
        except ValueError:
            pressure = None
        
        notes = self.notes_var.get().strip() or None
        
        try:
            CycleDAO.create(
                cycle_number=cycle_number,
                autoclave_id=autoclave_id,
                operator=operator,
                temperature=temperature,
                pressure=pressure,
                notes=notes
            )
            self.result = True
            self.destroy()
        except Exception as e:
            messagebox.showerror('错误', str(e))


class CompleteCycleDialog(tk.Toplevel):
    def __init__(self, parent, cycle: Dict):
        super().__init__(parent)
        self.cycle = cycle
        self.result = False
        self.title('完成锅次')
        self.geometry('400x300')
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
        self.wait_window(self)
    
    def _create_widgets(self):
        frame = ttk.Frame(self, padding=20)
        frame.pack(expand=True, fill='both')
        
        ttk.Label(frame, text=f'锅次: {self.cycle["cycle_number"]}').grid(row=0, column=0, columnspan=2, pady=5)
        
        ttk.Label(frame, text='生物指示结果:').grid(row=1, column=0, sticky=tk.W, pady=5)
        self.bio_var = tk.StringVar(value=IndicatorResult.PENDING.value)
        bio_combo = ttk.Combobox(frame, textvariable=self.bio_var, 
                                   values=[r.value for r in IndicatorResult], width=25)
        bio_combo.grid(row=1, column=1, pady=5)
        
        ttk.Label(frame, text='化学指示结果:').grid(row=2, column=0, sticky=tk.W, pady=5)
        self.chem_var = tk.StringVar(value=IndicatorResult.PENDING.value)
        chem_combo = ttk.Combobox(frame, textvariable=self.chem_var, 
                                    values=[r.value for r in IndicatorResult], width=25)
        chem_combo.grid(row=2, column=1, pady=5)
        
        ttk.Label(frame, text='操作人:').grid(row=3, column=0, sticky=tk.W, pady=5)
        self.operator_var = tk.StringVar(value=self.cycle.get('operator', ''))
        ttk.Entry(frame, textvariable=self.operator_var, width=30).grid(row=3, column=1, pady=5)
        
        ttk.Label(frame, text='温度 (℃):').grid(row=4, column=0, sticky=tk.W, pady=5)
        self.temp_var = tk.StringVar(value=str(self.cycle.get('temperature') or ''))
        ttk.Entry(frame, textvariable=self.temp_var, width=30).grid(row=4, column=1, pady=5)
        
        ttk.Label(frame, text='压力 (kPa):').grid(row=5, column=0, sticky=tk.W, pady=5)
        self.pressure_var = tk.StringVar(value=str(self.cycle.get('pressure') or ''))
        ttk.Entry(frame, textvariable=self.pressure_var, width=30).grid(row=5, column=1, pady=5)
        
        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=6, column=0, columnspan=2, pady=20)
        
        ttk.Button(btn_frame, text='确定', command=self._ok).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text='取消', command=self.destroy).pack(side=tk.LEFT, padx=10)
    
    def _ok(self):
        bio_result = self.bio_var.get()
        chem_result = self.chem_var.get()
        operator = self.operator_var.get().strip()
        
        try:
            temperature = float(self.temp_var.get()) if self.temp_var.get().strip() else None
        except ValueError:
            temperature = None
        
        try:
            pressure = float(self.pressure_var.get()) if self.pressure_var.get().strip() else None
        except ValueError:
            pressure = None
        
        if temperature is not None or pressure is not None:
            CycleDAO.update(
                self.cycle['id'],
                temperature=temperature,
                pressure=pressure
            )
        
        try:
            CycleDAO.complete_cycle(
                cycle_id=self.cycle['id'],
                biological_indicator=bio_result,
                chemical_indicator=chem_result,
                operator=operator or None
            )
            self.result = True
            self.destroy()
        except Exception as e:
            messagebox.showerror('错误', str(e))


class AddPackageToCycleDialog(tk.Toplevel):
    def __init__(self, parent, cycle_id: int):
        super().__init__(parent)
        self.cycle_id = cycle_id
        self.result = False
        self.title('添加器械包到锅次')
        self.geometry('600x500')
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
        self._load_available_packages()
        self.wait_window(self)
    
    def _create_widgets(self):
        frame = ttk.Frame(self, padding=10)
        frame.pack(expand=True, fill='both')
        
        search_frame = ttk.Frame(frame)
        search_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(search_frame, text='搜索:').pack(side=tk.LEFT, padx=5)
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=30)
        search_entry.pack(side=tk.LEFT, padx=5)
        search_entry.bind('<Return>', lambda e: self._load_available_packages())
        ttk.Button(search_frame, text='搜索', command=self._load_available_packages).pack(side=tk.LEFT, padx=5)
        
        columns = ('id', 'package_number', 'template_name', 'status')
        self.tree = ttk.Treeview(frame, columns=columns, show='headings', selectmode='extended')
        
        self.tree.heading('id', text='ID')
        self.tree.heading('package_number', text='器械包编号')
        self.tree.heading('template_name', text='模板类型')
        self.tree.heading('status', text='状态')
        
        self.tree.column('id', width=50)
        self.tree.column('package_number', width=200)
        self.tree.column('template_name', width=150)
        self.tree.column('status', width=100)
        
        self.tree.pack(expand=True, fill='both', pady=5)
        
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(btn_frame, text='全选', command=self._select_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text='添加选中', command=self._add_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text='取消', command=self.destroy).pack(side=tk.RIGHT, padx=5)
    
    def _load_available_packages(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        search_text = self.search_var.get().strip().lower()
        
        all_packages = PackageDAO.get_all()
        available = [
            p for p in all_packages
            if p['status'] in [PackageStatus.PENDING_STERILIZATION.value, PackageStatus.ISOLATED.value]
        ]
        
        if search_text:
            available = [
                p for p in available
                if search_text in p['package_number'].lower() or
                   search_text in p['template_name'].lower()
            ]
        
        for pkg in available:
            self.tree.insert('', tk.END, values=(
                pkg['id'],
                pkg['package_number'],
                pkg['template_name'],
                pkg['status']
            ), iid=str(pkg['id']))
    
    def _select_all(self):
        for item in self.tree.get_children():
            self.tree.selection_add(item)
    
    def _add_selected(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning('提示', '请选择要添加的器械包')
            return
        
        count = 0
        errors = []
        
        for pkg_id_str in selected:
            pkg_id = int(pkg_id_str)
            try:
                PackageDAO.add_to_cycle(pkg_id, self.cycle_id)
                count += 1
            except Exception as e:
                errors.append(str(e))
        
        if count > 0:
            self.result = True
        
        if errors:
            messagebox.showwarning('完成', f'成功添加 {count} 个器械包\n错误: {len(errors)} 个')
        else:
            messagebox.showinfo('完成', f'成功添加 {count} 个器械包')
        
        if count > 0:
            self.destroy()


from tkinter import simpledialog
