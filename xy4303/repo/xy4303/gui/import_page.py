import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from typing import Optional

from models.workbench import Workbench


class ImportPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self._create_ui()

        self.order_csv_path: Optional[str] = None
        self.status_csv_path: Optional[str] = None
        self.photo_dir_path: Optional[str] = None
        self.stl_dir_path: Optional[str] = None

    def _create_ui(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        title_frame = ttk.Frame(self)
        title_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)

        ttk.Label(
            title_frame,
            text="导入数据",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)

        ttk.Label(
            title_frame,
            text="导入订单CSV、加工状态CSV、照片目录和STL文件目录",
            style='Subtitle.TLabel'
        ).pack(side=tk.LEFT, padx=20)

        main_frame = ttk.LabelFrame(self, text="导入源")
        main_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        main_frame.columnconfigure(1, weight=1)

        row = 0

        ttk.Label(main_frame, text="订单CSV:").grid(row=row, column=0, sticky="w", padx=10, pady=10)
        self.order_csv_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.order_csv_var, state='readonly').grid(
            row=row, column=1, sticky="ew", padx=5, pady=10
        )
        ttk.Button(main_frame, text="选择文件", command=self._select_order_csv).grid(
            row=row, column=2, padx=5, pady=10
        )

        row += 1

        ttk.Label(main_frame, text="状态CSV:").grid(row=row, column=0, sticky="w", padx=10, pady=10)
        self.status_csv_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.status_csv_var, state='readonly').grid(
            row=row, column=1, sticky="ew", padx=5, pady=10
        )
        ttk.Button(main_frame, text="选择文件", command=self._select_status_csv).grid(
            row=row, column=2, padx=5, pady=10
        )

        row += 1

        ttk.Label(main_frame, text="照片目录:").grid(row=row, column=0, sticky="w", padx=10, pady=10)
        self.photo_dir_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.photo_dir_var, state='readonly').grid(
            row=row, column=1, sticky="ew", padx=5, pady=10
        )
        ttk.Button(main_frame, text="选择目录", command=self._select_photo_dir).grid(
            row=row, column=2, padx=5, pady=10
        )

        row += 1

        ttk.Label(main_frame, text="STL目录:").grid(row=row, column=0, sticky="w", padx=10, pady=10)
        self.stl_dir_var = tk.StringVar()
        ttk.Entry(main_frame, textvariable=self.stl_dir_var, state='readonly').grid(
            row=row, column=1, sticky="ew", padx=5, pady=10
        )
        ttk.Button(main_frame, text="选择目录", command=self._select_stl_dir).grid(
            row=row, column=2, padx=5, pady=10
        )

        row += 1

        info_frame = ttk.LabelFrame(main_frame, text="导入说明")
        info_frame.grid(row=row, column=0, columnspan=3, sticky="ew", padx=10, pady=20)

        info_text = (
            "1. 订单CSV必须包含列：订单编号、模型编号、医生姓名、患者姓名\n"
            "2. 状态CSV必须包含列：模型编号\n"
            "3. 照片目录中的照片文件名应包含模型编号（如：YZ2026001_咬合关系.jpg）\n"
            "4. STL目录中的STL文件名应包含模型编号\n"
            "5. 可以只选择部分数据源进行导入\n"
            "6. 新导入的数据会与现有数据合并"
        )
        ttk.Label(info_frame, text=info_text, style='Info.TLabel', justify=tk.LEFT).pack(
            anchor=tk.W, padx=10, pady=10
        )

        button_frame = ttk.Frame(self)
        button_frame.grid(row=2, column=0, sticky="e", padx=10, pady=10)

        ttk.Button(
            button_frame,
            text="取消",
            style='Action.TButton',
            command=self._cancel
        ).pack(side=tk.RIGHT, padx=5)

        ttk.Button(
            button_frame,
            text="预览导入",
            style='Action.TButton',
            command=self._preview_import
        ).pack(side=tk.RIGHT, padx=5)

        ttk.Button(
            button_frame,
            text="确认导入",
            style='Action.TButton',
            command=self._do_import
        ).pack(side=tk.RIGHT, padx=5)

    def _select_order_csv(self):
        file_path = filedialog.askopenfilename(
            title="选择订单CSV文件",
            filetypes=[("CSV/Excel文件", "*.csv *.xlsx *.xls"), ("所有文件", "*.*")]
        )
        if file_path:
            self.order_csv_path = file_path
            self.order_csv_var.set(file_path)

    def _select_status_csv(self):
        file_path = filedialog.askopenfilename(
            title="选择状态CSV文件",
            filetypes=[("CSV/Excel文件", "*.csv *.xlsx *.xls"), ("所有文件", "*.*")]
        )
        if file_path:
            self.status_csv_path = file_path
            self.status_csv_var.set(file_path)

    def _select_photo_dir(self):
        dir_path = filedialog.askdirectory(title="选择照片目录")
        if dir_path:
            self.photo_dir_path = dir_path
            self.photo_dir_var.set(dir_path)

    def _select_stl_dir(self):
        dir_path = filedialog.askdirectory(title="选择STL目录")
        if dir_path:
            self.stl_dir_path = dir_path
            self.stl_dir_var.set(dir_path)

    def _cancel(self):
        self.app._show_page("workbench")

    def _preview_import(self):
        if not any([self.order_csv_path, self.status_csv_path, self.photo_dir_path, self.stl_dir_path]):
            messagebox.showwarning("提示", "请至少选择一个数据源")
            return

        result = self.app.import_manager.import_from_files(
            order_csv=Path(self.order_csv_path) if self.order_csv_path else None,
            status_csv=Path(self.status_csv_path) if self.status_csv_path else None,
            photo_dir=Path(self.photo_dir_path) if self.photo_dir_path else None,
            stl_dir=Path(self.stl_dir_path) if self.stl_dir_path else None,
        )

        stats = result.stats
        preview_msg = f"导入预览：\n\n"
        preview_msg += f"订单数量: {stats.get('orders', 0)}\n"
        preview_msg += f"状态数量: {stats.get('statuses', 0)}\n"
        preview_msg += f"照片数量: {stats.get('photos', 0)}\n"
        preview_msg += f"STL文件数量: {stats.get('stl_files', 0)}\n"
        preview_msg += f"合并后模型数量: {stats.get('total_items', 0)}\n"

        if result.warnings:
            preview_msg += f"\n警告 ({len(result.warnings)}):\n"
            for warning in result.warnings[:5]:
                preview_msg += f"- {warning}\n"
            if len(result.warnings) > 5:
                preview_msg += f"... 还有 {len(result.warnings) - 5} 条警告\n"

        if result.errors:
            preview_msg += f"\n错误 ({len(result.errors)}):\n"
            for error in result.errors:
                preview_msg += f"- {error}\n"

        messagebox.showinfo("导入预览", preview_msg)

    def _do_import(self):
        if not any([self.order_csv_path, self.status_csv_path, self.photo_dir_path, self.stl_dir_path]):
            messagebox.showwarning("提示", "请至少选择一个数据源")
            return

        self.app._save_to_history("导入前状态")

        result = self.app.import_manager.import_from_files(
            order_csv=Path(self.order_csv_path) if self.order_csv_path else None,
            status_csv=Path(self.status_csv_path) if self.status_csv_path else None,
            photo_dir=Path(self.photo_dir_path) if self.photo_dir_path else None,
            stl_dir=Path(self.stl_dir_path) if self.stl_dir_path else None,
            existing_workbench=self.app.workbench,
        )

        if not result.success and result.errors:
            messagebox.showerror("导入失败", "\n".join(result.errors))
            return

        if result.workbench:
            self.app.workbench = result.workbench

        self.app._update_statusbar()
        self.app._update_undo_redo_buttons()

        stats = result.stats
        msg = f"导入成功！\n\n"
        msg += f"订单: {stats.get('orders', 0)}\n"
        msg += f"状态: {stats.get('statuses', 0)}\n"
        msg += f"照片: {stats.get('photos', 0)}\n"
        msg += f"STL: {stats.get('stl_files', 0)}\n"
        msg += f"总模型: {stats.get('total_items', 0)}"

        if result.warnings:
            msg += f"\n\n警告: {len(result.warnings)} 条"

        messagebox.showinfo("导入完成", msg)

        self.app._show_page("workbench")
