import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from tkinter.font import Font
import os
import threading
from datetime import datetime
from typing import Optional, Dict, Any

from import_service import ImportService, ImportProgress
from export_service import ExportService
from database import BatchManager, FailedRowManager, LogManager, ProductManager


class ProductImporterApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title('供应商商品/库存导入工具')
        self.root.geometry('1200x800')
        self.root.minsize(1000, 700)

        self.current_file: Optional[str] = None
        self.validation_results: Optional[Dict[str, Any]] = None
        self.current_batch_id: Optional[int] = None
        self.import_service = ImportService()
        self.import_service.set_progress_callback(self.update_progress)

        self._setup_styles()
        self._create_menu()
        self._create_main_content()
        self._refresh_batches()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')

        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Header.TLabel', font=('Microsoft YaHei', 11, 'bold'))
        style.configure('Info.TLabel', font=('Microsoft YaHei', 10))
        style.configure('Success.TLabel', foreground='green', font=('Microsoft YaHei', 10))
        style.configure('Error.TLabel', foreground='red', font=('Microsoft YaHei', 10))
        style.configure('Warning.TLabel', foreground='orange', font=('Microsoft YaHei', 10))

        style.configure('Action.TButton', font=('Microsoft YaHei', 10), padding=5)
        style.configure('Primary.TButton', font=('Microsoft YaHei', 10, 'bold'), padding=8)

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='文件', menu=file_menu)
        file_menu.add_command(label='选择导入文件...', command=self.select_file)
        file_menu.add_separator()
        file_menu.add_command(label='打开样例文件夹', command=self.open_samples_folder)
        file_menu.add_separator()
        file_menu.add_command(label='退出', command=self.root.quit)

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='帮助', menu=help_menu)
        help_menu.add_command(label='关于', command=self.show_about)

    def _create_main_content(self):
        main_paned = ttk.PanedWindow(self.root, orient=tk.VERTICAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        top_frame = ttk.Frame(main_paned)
        main_paned.add(top_frame, weight=3)

        notebook = ttk.Notebook(top_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        import_tab = ttk.Frame(notebook)
        notebook.add(import_tab, text='  导入操作  ')
        self._create_import_tab(import_tab)

        batches_tab = ttk.Frame(notebook)
        notebook.add(batches_tab, text='  批次历史  ')
        self._create_batches_tab(batches_tab)

        products_tab = ttk.Frame(notebook)
        notebook.add(products_tab, text='  已导入商品  ')
        self._create_products_tab(products_tab)

        bottom_frame = ttk.Frame(main_paned)
        main_paned.add(bottom_frame, weight=2)

        self._create_bottom_panel(bottom_frame)

    def _create_import_tab(self, parent):
        main_frame = ttk.Frame(parent)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        file_frame = ttk.LabelFrame(main_frame, text='文件选择', padding=10)
        file_frame.pack(fill=tk.X, pady=(0, 10))

        self.file_path_var = tk.StringVar()
        ttk.Entry(file_frame, textvariable=self.file_path_var, width=80).pack(side=tk.LEFT, padx=(0, 10), expand=True, fill=tk.X)

        btn_frame = ttk.Frame(file_frame)
        btn_frame.pack(side=tk.RIGHT)

        ttk.Button(btn_frame, text='浏览...', command=self.select_file, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text='预检', command=self.pre_validate_file, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        self.import_btn = ttk.Button(btn_frame, text='开始导入', command=self.start_import, style='Primary.TButton', state=tk.DISABLED)
        self.import_btn.pack(side=tk.LEFT, padx=2)

        info_frame = ttk.Frame(main_frame)
        info_frame.pack(fill=tk.X, pady=(0, 10))

        self.file_info_label = ttk.Label(info_frame, text='请选择CSV或XLSX文件进行导入', style='Info.TLabel')
        self.file_info_label.pack(side=tk.LEFT)

        self.stats_frame = ttk.Frame(info_frame)
        self.stats_frame.pack(side=tk.RIGHT)

        self.valid_label = ttk.Label(self.stats_frame, text='有效: 0', style='Success.TLabel')
        self.valid_label.pack(side=tk.LEFT, padx=10)
        self.invalid_label = ttk.Label(self.stats_frame, text='无效: 0', style='Error.TLabel')
        self.invalid_label.pack(side=tk.LEFT, padx=10)

        progress_frame = ttk.LabelFrame(main_frame, text='导入进度', padding=10)
        progress_frame.pack(fill=tk.X, pady=(0, 10))

        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X, pady=(0, 5))

        self.progress_label = ttk.Label(progress_frame, text='就绪', style='Info.TLabel')
        self.progress_label.pack(side=tk.LEFT)

        self.progress_stats_label = ttk.Label(progress_frame, text='', style='Info.TLabel')
        self.progress_stats_label.pack(side=tk.RIGHT)

        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        preview_frame = ttk.Frame(notebook)
        notebook.add(preview_frame, text='  数据预览  ')
        self._create_preview_table(preview_frame)

        errors_frame = ttk.Frame(notebook)
        notebook.add(errors_frame, text='  错误预览  ')
        self._create_errors_table(errors_frame)

    def _create_preview_table(self, parent):
        columns = ('row_num', 'product_code', 'product_name', 'category', 'cost_price', 'sale_price', 'stock_quantity')
        self.preview_tree = ttk.Treeview(parent, columns=columns, show='headings', height=10)

        self.preview_tree.heading('row_num', text='行号')
        self.preview_tree.heading('product_code', text='商品编码')
        self.preview_tree.heading('product_name', text='商品名称')
        self.preview_tree.heading('category', text='分类')
        self.preview_tree.heading('cost_price', text='成本价')
        self.preview_tree.heading('sale_price', text='售价')
        self.preview_tree.heading('stock_quantity', text='库存数量')

        self.preview_tree.column('row_num', width=60)
        self.preview_tree.column('product_code', width=120)
        self.preview_tree.column('product_name', width=150)
        self.preview_tree.column('category', width=100)
        self.preview_tree.column('cost_price', width=80)
        self.preview_tree.column('sale_price', width=80)
        self.preview_tree.column('stock_quantity', width=80)

        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.preview_tree.yview)
        self.preview_tree.configure(yscrollcommand=scrollbar.set)

        self.preview_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_errors_table(self, parent):
        columns = ('row_num', 'field_name', 'original_value', 'error_type', 'error_message', 'fix_suggestion')
        self.errors_tree = ttk.Treeview(parent, columns=columns, show='headings', height=10)

        self.errors_tree.heading('row_num', text='行号')
        self.errors_tree.heading('field_name', text='字段')
        self.errors_tree.heading('original_value', text='原值')
        self.errors_tree.heading('error_type', text='错误类型')
        self.errors_tree.heading('error_message', text='错误信息')
        self.errors_tree.heading('fix_suggestion', text='修复建议')

        self.errors_tree.column('row_num', width=60)
        self.errors_tree.column('field_name', width=100)
        self.errors_tree.column('original_value', width=100)
        self.errors_tree.column('error_type', width=100)
        self.errors_tree.column('error_message', width=200)
        self.errors_tree.column('fix_suggestion', width=300)

        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.errors_tree.yview)
        self.errors_tree.configure(yscrollcommand=scrollbar.set)

        self.errors_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_batches_tab(self, parent):
        main_frame = ttk.Frame(parent)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        toolbar = ttk.Frame(main_frame)
        toolbar.pack(fill=tk.X, pady=(0, 5))

        ttk.Button(toolbar, text='刷新列表', command=self._refresh_batches, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text='查看详情', command=self._view_batch_details, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text='重试失败行', command=self._retry_failed_rows, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, padx=10, fill=tk.Y)
        ttk.Button(toolbar, text='导出错误报告', command=self._export_error_report, style='Action.TButton').pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text='导出导入摘要', command=self._export_import_summary, style='Action.TButton').pack(side=tk.LEFT, padx=2)

        columns = ('batch_number', 'file_name', 'total_rows', 'success_count', 'failed_count', 'status', 'created_at')
        self.batches_tree = ttk.Treeview(main_frame, columns=columns, show='headings', height=10)

        self.batches_tree.heading('batch_number', text='批次号')
        self.batches_tree.heading('file_name', text='文件名')
        self.batches_tree.heading('total_rows', text='总行数')
        self.batches_tree.heading('success_count', text='成功')
        self.batches_tree.heading('failed_count', text='失败')
        self.batches_tree.heading('status', text='状态')
        self.batches_tree.heading('created_at', text='创建时间')

        self.batches_tree.column('batch_number', width=140)
        self.batches_tree.column('file_name', width=200)
        self.batches_tree.column('total_rows', width=70)
        self.batches_tree.column('success_count', width=60)
        self.batches_tree.column('failed_count', width=60)
        self.batches_tree.column('status', width=120)
        self.batches_tree.column('created_at', width=160)

        scrollbar = ttk.Scrollbar(main_frame, orient=tk.VERTICAL, command=self.batches_tree.yview)
        self.batches_tree.configure(yscrollcommand=scrollbar.set)

        self.batches_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.batches_tree.bind('<<TreeviewSelect>>', self._on_batch_select)

    def _create_products_tab(self, parent):
        main_frame = ttk.Frame(parent)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        toolbar = ttk.Frame(main_frame)
        toolbar.pack(fill=tk.X, pady=(0, 5))

        ttk.Button(toolbar, text='刷新列表', command=self._refresh_products, style='Action.TButton').pack(side=tk.LEFT, padx=2)

        columns = ('product_code', 'product_name', 'category', 'cost_price', 'sale_price', 'stock_quantity', 'unit', 'supplier', 'created_at')
        self.products_tree = ttk.Treeview(main_frame, columns=columns, show='headings', height=10)

        self.products_tree.heading('product_code', text='商品编码')
        self.products_tree.heading('product_name', text='商品名称')
        self.products_tree.heading('category', text='分类')
        self.products_tree.heading('cost_price', text='成本价')
        self.products_tree.heading('sale_price', text='售价')
        self.products_tree.heading('stock_quantity', text='库存数量')
        self.products_tree.heading('unit', text='单位')
        self.products_tree.heading('supplier', text='供应商')
        self.products_tree.heading('created_at', text='创建时间')

        self.products_tree.column('product_code', width=100)
        self.products_tree.column('product_name', width=150)
        self.products_tree.column('category', width=100)
        self.products_tree.column('cost_price', width=80)
        self.products_tree.column('sale_price', width=80)
        self.products_tree.column('stock_quantity', width=80)
        self.products_tree.column('unit', width=60)
        self.products_tree.column('supplier', width=100)
        self.products_tree.column('created_at', width=160)

        scrollbar = ttk.Scrollbar(main_frame, orient=tk.VERTICAL, command=self.products_tree.yview)
        self.products_tree.configure(yscrollcommand=scrollbar.set)

        self.products_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_bottom_panel(self, parent):
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)

        logs_frame = ttk.LabelFrame(paned, text='操作日志', padding=5)
        paned.add(logs_frame, weight=1)

        self.logs_text = scrolledtext.ScrolledText(logs_frame, wrap=tk.WORD, font=('Consolas', 9))
        self.logs_text.pack(fill=tk.BOTH, expand=True)

        details_frame = ttk.LabelFrame(paned, text='选中批次详情', padding=5)
        paned.add(details_frame, weight=1)

        self.details_text = scrolledtext.ScrolledText(details_frame, wrap=tk.WORD, font=('Consolas', 9))
        self.details_text.pack(fill=tk.BOTH, expand=True)

    def select_file(self):
        file_path = filedialog.askopenfilename(
            title='选择导入文件',
            filetypes=[
                ('Excel文件', '*.xlsx *.xls'),
                ('CSV文件', '*.csv'),
                ('所有文件', '*.*')
            ]
        )

        if file_path:
            self.current_file = file_path
            self.file_path_var.set(file_path)
            self.file_info_label.config(text=f'已选择: {os.path.basename(file_path)}')
            self.import_btn.config(state=tk.DISABLED)
            self._clear_previews()

    def pre_validate_file(self):
        if not self.current_file:
            messagebox.showwarning('警告', '请先选择一个文件')
            return

        try:
            self.validation_results = self.import_service.pre_validate_file(self.current_file)

            valid_count = len(self.validation_results['valid_rows'])
            invalid_count = len(self.validation_results['invalid_rows'])
            total_count = self.validation_results['total_rows']

            self.valid_label.config(text=f'有效: {valid_count}')
            self.invalid_label.config(text=f'无效: {invalid_count}')
            self.file_info_label.config(text=f'预检完成: 共 {total_count} 行数据')

            self._update_preview_tables()

            if total_count > 0:
                self.import_btn.config(state=tk.NORMAL)

            self._add_log('info', f'文件预检完成: 有效 {valid_count} 行, 无效 {invalid_count} 行')

        except Exception as e:
            messagebox.showerror('错误', f'预检失败: {str(e)}')
            self._add_log('error', f'预检失败: {str(e)}')

    def _clear_previews(self):
        for item in self.preview_tree.get_children():
            self.preview_tree.delete(item)
        for item in self.errors_tree.get_children():
            self.errors_tree.delete(item)
        self.valid_label.config(text='有效: 0')
        self.invalid_label.config(text='无效: 0')

    def _update_preview_tables(self):
        for item in self.preview_tree.get_children():
            self.preview_tree.delete(item)

        for row in self.validation_results['valid_rows'][:100]:
            parsed = row['parsed_data']
            self.preview_tree.insert('', tk.END, values=(
                row['row_number'],
                parsed.get('product_code', ''),
                parsed.get('product_name', ''),
                parsed.get('category', ''),
                parsed.get('cost_price', ''),
                parsed.get('sale_price', ''),
                parsed.get('stock_quantity', '')
            ))

        for item in self.errors_tree.get_children():
            self.errors_tree.delete(item)

        for row in self.validation_results['invalid_rows']:
            error = row['error']
            self.errors_tree.insert('', tk.END, values=(
                row['row_number'],
                error.get('field_name', ''),
                error.get('original_value', ''),
                self._get_error_type_display(error.get('error_type', '')),
                error.get('error_message', ''),
                error.get('fix_suggestion', '')
            ))

    def start_import(self):
        if not self.validation_results:
            messagebox.showwarning('警告', '请先进行文件预检')
            return

        if messagebox.askyesno('确认', '确定要开始导入吗？\n合法行将被写入数据库。'):
            self.import_btn.config(state=tk.DISABLED)
            self._add_log('info', '开始导入...')

            thread = threading.Thread(target=self._do_import, daemon=True)
            thread.start()

    def _do_import(self):
        try:
            self.current_batch_id = self.import_service.import_file(
                self.current_file,
                self.validation_results
            )

            self.root.after(0, self._import_completed)

        except Exception as e:
            self.root.after(0, lambda: self._import_failed(str(e)))

    def _import_completed(self):
        self._add_log('success', f'导入完成! 批次号: {self.current_batch_id}')
        messagebox.showinfo('成功', '导入完成！\n请查看"批次历史"标签页了解详情。')
        self._refresh_batches()
        self._refresh_products()
        self.import_btn.config(state=tk.NORMAL)

    def _import_failed(self, error_msg):
        self._add_log('error', f'导入失败: {error_msg}')
        messagebox.showerror('错误', f'导入失败: {error_msg}')
        self.import_btn.config(state=tk.NORMAL)

    def update_progress(self, progress: ImportProgress):
        def _update():
            if progress.total > 0:
                percent = (progress.current / progress.total) * 100
                self.progress_var.set(percent)

            status_text = f'处理中... ({progress.current}/{progress.total})' if progress.current_message else '就绪'
            self.progress_label.config(text=progress.current_message or status_text)
            self.progress_stats_label.config(text=f'成功: {progress.success_count} | 失败: {progress.failed_count}')

            self.root.update_idletasks()

        self.root.after(0, _update)

    def _refresh_batches(self):
        for item in self.batches_tree.get_children():
            self.batches_tree.delete(item)

        batches = BatchManager.get_all_batches()

        for batch in batches:
            status_display = self._get_status_display(batch['status'])
            self.batches_tree.insert('', tk.END, iid=str(batch['id']), values=(
                batch['batch_number'],
                batch['file_name'],
                batch['total_rows'],
                batch['success_count'],
                batch['failed_count'],
                status_display,
                batch['created_at']
            ))

    def _refresh_products(self):
        for item in self.products_tree.get_children():
            self.products_tree.delete(item)

        products = ProductManager.get_all_products()

        for product in products:
            self.products_tree.insert('', tk.END, values=(
                product['product_code'],
                product['product_name'],
                product.get('category', ''),
                product.get('cost_price', ''),
                product.get('sale_price', ''),
                product.get('stock_quantity', ''),
                product.get('unit', ''),
                product.get('supplier', ''),
                product.get('created_at', '')
            ))

    def _on_batch_select(self, event):
        selection = self.batches_tree.selection()
        if selection:
            batch_id = int(selection[0])
            self._show_batch_details(batch_id)

    def _show_batch_details(self, batch_id: int):
        batch = BatchManager.get_batch_by_id(batch_id)
        if not batch:
            return

        failed_rows = FailedRowManager.get_failed_rows(batch_id)
        logs = LogManager.get_logs(batch_id=batch_id, limit=50)

        details = f'''批次详情
{'='*60}
批次号: {batch['batch_number']}
文件名: {batch['file_name']}
文件路径: {batch['file_path']}
状态: {self._get_status_display(batch['status'])}
创建时间: {batch['created_at']}
更新时间: {batch['updated_at']}

统计信息:
  总行数: {batch['total_rows']}
  成功数: {batch['success_count']}
  失败数: {batch['failed_count']}
  成功率: {(batch['success_count']/batch['total_rows']*100) if batch['total_rows']>0 else 0:.2f}%

失败行信息:
  待处理失败行数: {len(failed_rows)}
'''

        if failed_rows:
            details += '\n失败明细:\n'
            details += '-' * 60 + '\n'
            for fr in failed_rows[:10]:
                details += f'''
行号: {fr['row_number']}
  字段: {fr['field_name']}
  原值: {fr['original_value']}
  错误类型: {self._get_error_type_display(fr['error_type'])}
  错误信息: {fr['error_message']}
  修复建议: {fr['fix_suggestion']}
'''
            if len(failed_rows) > 10:
                details += f'\n... 还有 {len(failed_rows) - 10} 行失败记录\n'

        self.details_text.delete(1.0, tk.END)
        self.details_text.insert(tk.END, details)

    def _view_batch_details(self):
        selection = self.batches_tree.selection()
        if not selection:
            messagebox.showinfo('提示', '请先选择一个批次')
            return

        batch_id = int(selection[0])
        self._show_batch_details(batch_id)

    def _retry_failed_rows(self):
        selection = self.batches_tree.selection()
        if not selection:
            messagebox.showinfo('提示', '请先选择一个批次')
            return

        batch_id = int(selection[0])

        failed_rows = FailedRowManager.get_failed_rows(batch_id)
        if not failed_rows:
            messagebox.showinfo('提示', '该批次没有需要重试的失败行')
            return

        if messagebox.askyesno('确认', f'确定要重试该批次的 {len(failed_rows)} 个失败行吗？'):
            self._add_log('info', f'开始重试批次 {batch_id} 的失败行...')

            thread = threading.Thread(target=self._do_retry, args=(batch_id,), daemon=True)
            thread.start()

    def _do_retry(self, batch_id: int):
        try:
            result = self.import_service.retry_failed_rows(batch_id)

            def _callback():
                self._add_log('success', f'重试完成: 成功 {result["success_count"]} 行, 失败 {result["failed_count"]} 行')
                messagebox.showinfo('完成', result['message'])
                self._refresh_batches()
                self._refresh_products()

            self.root.after(0, _callback)

        except Exception as e:
            def _error_callback():
                self._add_log('error', f'重试失败: {str(e)}')
                messagebox.showerror('错误', f'重试失败: {str(e)}')

            self.root.after(0, _error_callback)

    def _export_error_report(self):
        selection = self.batches_tree.selection()
        if not selection:
            messagebox.showinfo('提示', '请先选择一个批次')
            return

        batch_id = int(selection[0])
        batch = BatchManager.get_batch_by_id(batch_id)

        file_path = filedialog.asksaveasfilename(
            title='保存错误报告',
            defaultextension='.csv',
            initialfile=f'错误报告_{batch["batch_number"]}.csv',
            filetypes=[
                ('CSV文件', '*.csv'),
                ('JSON文件', '*.json')
            ]
        )

        if file_path:
            try:
                format_ext = os.path.splitext(file_path)[1].lower()[1:]
                if format_ext not in ['csv', 'json']:
                    format_ext = 'csv'

                saved_path = ExportService.export_error_report(batch_id, file_path, format=format_ext)
                self._add_log('success', f'错误报告已导出: {saved_path}')
                messagebox.showinfo('成功', f'错误报告已导出到:\n{saved_path}')
            except Exception as e:
                self._add_log('error', f'导出错误报告失败: {str(e)}')
                messagebox.showerror('错误', f'导出失败: {str(e)}')

    def _export_import_summary(self):
        selection = self.batches_tree.selection()
        if not selection:
            messagebox.showinfo('提示', '请先选择一个批次')
            return

        batch_id = int(selection[0])
        batch = BatchManager.get_batch_by_id(batch_id)

        file_path = filedialog.asksaveasfilename(
            title='保存导入摘要',
            defaultextension='.csv',
            initialfile=f'导入摘要_{batch["batch_number"]}.csv',
            filetypes=[
                ('CSV文件', '*.csv'),
                ('JSON文件', '*.json')
            ]
        )

        if file_path:
            try:
                format_ext = os.path.splitext(file_path)[1].lower()[1:]
                if format_ext not in ['csv', 'json']:
                    format_ext = 'csv'

                saved_path = ExportService.export_import_summary(batch_id, file_path, format=format_ext)
                self._add_log('success', f'导入摘要已导出: {saved_path}')
                messagebox.showinfo('成功', f'导入摘要已导出到:\n{saved_path}')
            except Exception as e:
                self._add_log('error', f'导出导入摘要失败: {str(e)}')
                messagebox.showerror('错误', f'导出失败: {str(e)}')

    def _get_error_type_display(self, error_type: str) -> str:
        mapping = {
            'required_missing': '必填缺失',
            'price_format_error': '价格格式',
            'numeric_format_error': '数字格式',
            'duplicate_in_file': '文件内重复',
            'duplicate_in_database': '数据库重复',
            'database_error': '数据库错误',
            'exception': '异常错误'
        }
        return mapping.get(error_type, error_type)

    def _get_status_display(self, status: str) -> str:
        mapping = {
            'pending': '等待处理',
            'running': '处理中...',
            'completed': '已完成',
            'completed_with_errors': '完成(有错误)',
            'failed': '失败'
        }
        return mapping.get(status, status)

    def _add_log(self, log_type: str, message: str):
        timestamp = datetime.now().strftime('%H:%M:%S')
        prefix = {'info': '[INFO]', 'success': '[SUCCESS]', 'error': '[ERROR]', 'warning': '[WARNING]'}
        log_message = f'{timestamp} {prefix.get(log_type, "[INFO]")} {message}\n'

        self.logs_text.insert(tk.END, log_message)
        self.logs_text.see(tk.END)

    def open_samples_folder(self):
        samples_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'samples')
        if os.path.exists(samples_dir):
            os.system(f'open "{samples_dir}"')
        else:
            messagebox.showinfo('提示', '样例文件夹不存在')

    def show_about(self):
        messagebox.showinfo(
            '关于',
            '供应商商品/库存导入工具 v1.0\n\n'
            '功能说明:\n'
            '- 支持CSV和XLSX格式文件导入\n'
            '- 自动字段检测和验证\n'
            '- 失败行标记和重试机制\n'
            '- 导入历史和进度追踪\n'
            '- 错误报告和摘要导出'
        )


def main():
    root = tk.Tk()
    app = ProductImporterApp(root)
    root.mainloop()


if __name__ == '__main__':
    main()
