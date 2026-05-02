import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
import csv
from datetime import datetime
import json

from data_loader import load_prescription, load_frame, load_scan, load_tolerance, merge_order_data
from validator import validate_order
from database import init_db, save_review, load_review, load_all_reviews

class LensReviewApp:
    def __init__(self, root):
        self.root = root
        self.root.title("配镜加工单复核工具")
        self.root.geometry("1200x800")

        self.orders = {}
        self.duplicates = {}
        self.current_order_id = None
        self.status_colors = {
            "待复核": "#FFA500",
            "可交付": "#32CD32",
            "需返工": "#FF4500"
        }

        init_db()

        self.setup_ui()
        self.bind_shortcuts()

    def setup_ui(self):
        menubar = tk.Menu(self.root)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="导入数据...", command=self.import_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出Markdown报告", command=lambda: self.export_report("md"))
        file_menu.add_command(label="导出CSV报告", command=lambda: self.export_report("csv"))
        menubar.add_cascade(label="文件", menu=file_menu)
        self.root.config(menu=menubar)

        left_frame = tk.Frame(self.root, width=300)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, padx=5, pady=5)

        tk.Label(left_frame, text="订单列表", font=("Arial", 12, "bold")).pack(pady=5)

        filter_frame = tk.Frame(left_frame)
        filter_frame.pack(fill=tk.X, pady=5)
        tk.Label(filter_frame, text="筛选:").pack(side=tk.LEFT)
        self.filter_var = tk.StringVar(value="全部")
        filter_combo = ttk.Combobox(filter_frame, textvariable=self.filter_var, values=["全部", "待复核", "可交付", "需返工"], state="readonly", width=10)
        filter_combo.pack(side=tk.LEFT, padx=5)
        filter_combo.bind("<<ComboboxSelected>>", lambda e: self.refresh_order_list())

        tree_frame = tk.Frame(left_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        scrollbar = ttk.Scrollbar(tree_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.order_tree = ttk.Treeview(tree_frame, yscrollcommand=scrollbar.set, selectmode="browse")
        self.order_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.order_tree.yview)
        self.order_tree.column("#0", width=280)
        self.order_tree.heading("#0", text="订单号 / 患者 / 状态")
        self.order_tree.bind("<<TreeviewSelect>>", self.on_order_select)

        right_frame = tk.Frame(self.root)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.notebook = ttk.Notebook(right_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)

        self.prescription_tab = tk.Frame(self.notebook)
        self.scan_tab = tk.Frame(self.notebook)
        self.review_tab = tk.Frame(self.notebook)

        self.notebook.add(self.prescription_tab, text="验光处方")
        self.notebook.add(self.scan_tab, text="加工扫码")
        self.notebook.add(self.review_tab, text="复核操作")

        self.setup_prescription_tab()
        self.setup_scan_tab()
        self.setup_review_tab()

        self.status_bar = tk.Label(self.root, text="未加载数据", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def setup_prescription_tab(self):
        labels = ["订单号", "患者姓名", "右眼SPH", "右眼CYL", "右眼AXIS", "左眼SPH", "左眼CYL", "左眼AXIS", "瞳距", "右眼ADD", "左眼ADD", "镜架型号", "镜架宽度", "鼻梁宽度", "镜腿长度"]
        self.prescription_widgets = {}
        for i, label in enumerate(labels):
            tk.Label(self.prescription_tab, text=label + ":", anchor=tk.W, width=15).grid(row=i, column=0, sticky=tk.W, padx=5, pady=3)
            val_label = tk.Label(self.prescription_tab, text="", anchor=tk.W, width=30, bg="#f0f0f0")
            val_label.grid(row=i, column=1, sticky=tk.W, padx=5, pady=3)
            self.prescription_widgets[label.lower().replace(" ", "_").replace("_", "")] = val_label

    def setup_scan_tab(self):
        labels = ["扫码时间", "右眼SPH", "右眼CYL", "右眼AXIS", "左眼SPH", "左眼CYL", "左眼AXIS", "瞳距", "加工检验", "终检"]
        self.scan_widgets = {}
        for i, label in enumerate(labels):
            tk.Label(self.scan_tab, text=label + ":", anchor=tk.W, width=15).grid(row=i, column=0, sticky=tk.W, padx=5, pady=3)
            val_label = tk.Label(self.scan_tab, text="", anchor=tk.W, width=30, bg="#f0f0f0")
            val_label.grid(row=i, column=1, sticky=tk.W, padx=5, pady=3)
            self.scan_widgets[label.lower().replace(" ", "_").replace("_", "")] = val_label
        self.duplicate_label = tk.Label(self.scan_tab, text="", anchor=tk.W, fg="red", wraplength=400)
        self.duplicate_label.grid(row=len(labels), column=0, columnspan=2, sticky=tk.W, padx=5, pady=10)

    def setup_review_tab(self):
        tk.Label(self.review_tab, text="复核状态:", anchor=tk.W).grid(row=0, column=0, sticky=tk.W, padx=5, pady=10)
        self.review_status_var = tk.StringVar(value="待复核")
        for i, status in enumerate(["待复核", "可交付", "需返工"]):
            rb = tk.Radiobutton(self.review_tab, text=status, variable=self.review_status_var, value=status, fg=self.status_colors[status])
            rb.grid(row=0, column=i+1, sticky=tk.W, padx=5, pady=10)

        tk.Label(self.review_tab, text="复核备注:", anchor=tk.W).grid(row=1, column=0, sticky=tk.NW, padx=5, pady=5)
        self.notes_text = tk.Text(self.review_tab, height=8, width=50)
        self.notes_text.grid(row=1, column=1, columnspan=3, sticky=tk.W, padx=5, pady=5)

        tk.Label(self.review_tab, text="自动检测问题:", anchor=tk.W).grid(row=2, column=0, sticky=tk.NW, padx=5, pady=5)
        self.issues_text = tk.Text(self.review_tab, height=8, width=50, fg="red")
        self.issues_text.grid(row=2, column=1, columnspan=3, sticky=tk.W, padx=5, pady=5)

        btn_frame = tk.Frame(self.review_tab)
        btn_frame.grid(row=3, column=0, columnspan=4, pady=20)
        tk.Button(btn_frame, text="保存复核", command=self.save_current_review, width=15, bg="#4CAF50", fg="white").pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="标记可交付", command=lambda: self.quick_set_status("可交付"), width=15, bg="#32CD32", fg="white").pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="标记需返工", command=lambda: self.quick_set_status("需返工"), width=15, bg="#FF4500", fg="white").pack(side=tk.LEFT, padx=5)

    def bind_shortcuts(self):
        self.root.bind("<Control-s>", lambda e: self.save_current_review())
        self.root.bind("<Control-o>", lambda e: self.import_data())

    def import_data(self):
        data_dir = filedialog.askdirectory(title="选择数据文件夹(含 prescription.csv, frame.json, scan.jsonl, tolerance_rules.yaml)")
        if not data_dir:
            return

        prescription_path = os.path.join(data_dir, "prescription.csv")
        frame_path = os.path.join(data_dir, "frame.json")
        scan_path = os.path.join(data_dir, "scan.jsonl")
        tolerance_path = os.path.join(data_dir, "tolerance_rules.yaml")

        if not os.path.exists(prescription_path):
            messagebox.showerror("错误", f"未找到验光处方文件: {prescription_path}")
            return
        if not os.path.exists(frame_path):
            messagebox.showerror("错误", f"未找到镜架参数文件: {frame_path}")
            return
        if not os.path.exists(scan_path):
            messagebox.showerror("错误", f"未找到加工扫码文件: {scan_path}")
            return
        if not os.path.exists(tolerance_path):
            messagebox.showerror("错误", f"未找到公差规则文件: {tolerance_path}")
            return

        prescriptions = load_prescription(prescription_path)
        frames = load_frame(frame_path)
        scans, self.duplicates = load_scan(scan_path)
        tolerance = load_tolerance(tolerance_path)
        self.orders = merge_order_data(prescriptions, frames, scans, tolerance)

        saved_reviews = {r['order_id']: r for r in load_all_reviews()}
        for oid, order in self.orders.items():
            if oid in saved_reviews:
                order['saved_status'] = saved_reviews[oid]['status']
                order['saved_notes'] = saved_reviews[oid]['notes']
                order['saved_issues'] = saved_reviews[oid]['issues']
            else:
                dup_times = self.duplicates.get(oid, [])
                status, issues = validate_order(order, dup_times)
                order['saved_status'] = status
                order['saved_notes'] = ""
                order['saved_issues'] = issues

        self.refresh_order_list()
        self.update_status_bar()
        messagebox.showinfo("成功", f"已加载 {len(self.orders)} 个订单")

    def refresh_order_list(self):
        self.order_tree.delete(*self.order_tree.get_children())
        filter_status = self.filter_var.get()

        for oid in sorted(self.orders.keys()):
            order = self.orders[oid]
            patient = order.get('prescription', {}).get('patient_name', '未知')
            status = order.get('saved_status', '待复核')

            if filter_status != "全部" and status != filter_status:
                continue

            tag = status
            self.order_tree.insert("", tk.END, iid=oid, text=f"{oid} | {patient} | {status}", tags=(tag,))

        self.order_tree.tag_configure("待复核", foreground=self.status_colors["待复核"])
        self.order_tree.tag_configure("可交付", foreground=self.status_colors["可交付"])
        self.order_tree.tag_configure("需返工", foreground=self.status_colors["需返工"])

    def on_order_select(self, event):
        selected = self.order_tree.selection()
        if not selected:
            return
        self.current_order_id = selected[0]
        self.display_order_details()

    def display_order_details(self):
        if not self.current_order_id:
            return
        order = self.orders.get(self.current_order_id, {})
        prescription = order.get('prescription', {})
        scan = order.get('scan', {})
        frame = order.get('frame', {})

        self.prescription_widgets["订单号"].config(text=self.current_order_id)
        self.prescription_widgets["患者姓名"].config(text=prescription.get('patient_name', ''))
        self.prescription_widgets["右眼sph"].config(text=str(prescription.get('right_sph', '')))
        self.prescription_widgets["右眼cyl"].config(text=str(prescription.get('right_cyl', '')))
        self.prescription_widgets["右眼axis"].config(text=str(prescription.get('right_axis', '')))
        self.prescription_widgets["左眼sph"].config(text=str(prescription.get('left_sph', '')))
        self.prescription_widgets["左眼cyl"].config(text=str(prescription.get('left_cyl', '')))
        self.prescription_widgets["左眼axis"].config(text=str(prescription.get('left_axis', '')))
        self.prescription_widgets["瞳距"].config(text=str(prescription.get('pupil_distance', '')))
        self.prescription_widgets["右眼add"].config(text=str(prescription.get('right_add', '')))
        self.prescription_widgets["左眼add"].config(text=str(prescription.get('left_add', '')))
        self.prescription_widgets["镜架型号"].config(text=frame.get('frame_model', ''))
        self.prescription_widgets["镜架宽度"].config(text=str(frame.get('frame_width', '')))
        self.prescription_widgets["鼻梁宽度"].config(text=str(frame.get('bridge_width', '')))
        self.prescription_widgets["镜腿长度"].config(text=str(frame.get('temple_length', '')))

        self.scan_widgets["扫码时间"].config(text=scan.get('scan_time', ''))
        self.scan_widgets["右眼sph"].config(text=str(scan.get('right_sph', '')))
        self.scan_widgets["右眼cyl"].config(text=str(scan.get('right_cyl', '')))
        self.scan_widgets["右眼axis"].config(text=str(scan.get('right_axis', '')))
        self.scan_widgets["左眼sph"].config(text=str(scan.get('left_sph', '')))
        self.scan_widgets["左眼cyl"].config(text=str(scan.get('left_cyl', '')))
        self.scan_widgets["左眼axis"].config(text=str(scan.get('left_axis', '')))
        self.scan_widgets["瞳距"].config(text=str(scan.get('pupil_distance', '')))
        self.scan_widgets["加工检验"].config(text="通过" if scan.get('inspection_passed') else "未通过", fg="green" if scan.get('inspection_passed') else "red")
        self.scan_widgets["终检"].config(text="已终检" if scan.get('final_inspection') else "未终检", fg="green" if scan.get('final_inspection') else "red")

        dup_times = self.duplicates.get(self.current_order_id, [])
        if dup_times:
            self.duplicate_label.config(text=f"⚠ 重复扫码记录: {len(dup_times)} 次 (已使用最新记录)")
        else:
            self.duplicate_label.config(text="")

        dup_info = self.duplicates.get(self.current_order_id, [])
        _, issues = validate_order(order, dup_info)

        self.review_status_var.set(order.get('saved_status', '待复核'))
        self.notes_text.delete("1.0", tk.END)
        self.notes_text.insert("1.0", order.get('saved_notes', ''))

        self.issues_text.delete("1.0", tk.END)
        if issues:
            for issue in issues:
                self.issues_text.insert(tk.END, f"• {issue}\n")
        else:
            self.issues_text.insert(tk.END, "（无自动检测问题）")

    def save_current_review(self):
        if not self.current_order_id:
            messagebox.showwarning("警告", "请先选择一个订单")
            return

        status = self.review_status_var.get()
        notes = self.notes_text.get("1.0", tk.END).strip()
        dup_info = self.duplicates.get(self.current_order_id, [])
        _, issues = validate_order(self.orders[self.current_order_id], dup_info)

        review_time = datetime.now().isoformat()
        save_review(self.current_order_id, status, review_time, notes, issues)

        self.orders[self.current_order_id]['saved_status'] = status
        self.orders[self.current_order_id]['saved_notes'] = notes
        self.orders[self.current_order_id]['saved_issues'] = issues

        self.refresh_order_list()
        messagebox.showinfo("成功", f"订单 {self.current_order_id} 复核结果已保存")

    def quick_set_status(self, status):
        self.review_status_var.set(status)
        self.save_current_review()

    def update_status_bar(self):
        total = len(self.orders)
        pending = sum(1 for o in self.orders.values() if o.get('saved_status') == '待复核')
        deliverable = sum(1 for o in self.orders.values() if o.get('saved_status') == '可交付')
        rework = sum(1 for o in self.orders.values() if o.get('saved_status') == '需返工')
        self.status_bar.config(text=f"总订单: {total} | 待复核: {pending} | 可交付: {deliverable} | 需返工: {rework}")

    def export_report(self, fmt):
        if not self.orders:
            messagebox.showwarning("警告", "没有可导出的数据，请先导入数据")
            return

        file_path = filedialog.asksaveasfilename(
            title="导出报告",
            defaultextension=f".{fmt}",
            filetypes=[(f"{fmt.upper()} 文件", f"*.{fmt}"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        if fmt == "md":
            self.export_markdown(file_path)
        else:
            self.export_csv(file_path)

        messagebox.showinfo("成功", f"报告已导出至: {file_path}")

    def export_markdown(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("# 配镜加工单复核报告\n")
            f.write(f"生成时间: {datetime.now().isoformat()}\n\n")
            total = len(self.orders)
            pending = sum(1 for o in self.orders.values() if o.get('saved_status') == '待复核')
            deliverable = sum(1 for o in self.orders.values() if o.get('saved_status') == '可交付')
            rework = sum(1 for o in self.orders.values() if o.get('saved_status') == '需返工')
            f.write("## 汇总\n")
            f.write(f"- 待复核: {pending}\n")
            f.write(f"- 可交付: {deliverable}\n")
            f.write(f"- 需返工: {rework}\n\n")
            f.write("## 订单明细\n")
            for oid in sorted(self.orders.keys()):
                order = self.orders[oid]
                prescription = order.get('prescription', {})
                status = order.get('saved_status', '待复核')
                notes = order.get('saved_notes', '')
                issues = order.get('saved_issues', [])
                f.write(f"### {oid}\n")
                f.write(f"- 患者: {prescription.get('patient_name', '未知')}\n")
                f.write(f"- 状态: {status}\n")
                if notes:
                    f.write(f"- 备注: {notes}\n")
                if issues:
                    f.write(f"- 问题: {', '.join(issues)}\n")
                f.write("\n")

    def export_csv(self, path):
        with open(path, "w", encoding="utf-8", newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["订单号", "患者姓名", "状态", "复核时间", "备注", "问题"])
            for oid in sorted(self.orders.keys()):
                order = self.orders[oid]
                prescription = order.get('prescription', {})
                status = order.get('saved_status', '待复核')
                notes = order.get('saved_notes', '')
                issues = ",".join(order.get('saved_issues', []))
                writer.writerow([oid, prescription.get('patient_name', ''), status, '', notes, issues])

def main():
    import csv
    root = tk.Tk()
    app = LensReviewApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()