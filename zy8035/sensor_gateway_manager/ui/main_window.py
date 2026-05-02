import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json
import threading
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..adapters.serial_adapter import MockSerialAdapter
from ..config_parser.yaml_parser import YamlConfigParser
from ..engine.diff_engine import DiffEngine
from ..persistence.sqlite_store import SQLiteStore
import yaml


class SensorGatewayApp:
    COLOR_MATCH = "#90EE90"
    COLOR_MISMATCH = "#FFFF00"
    COLOR_ERROR = "#FFB6C1"
    COLOR_READONLY = "#D3D3D3"

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Sensor Gateway Config Manager")
        self.root.geometry("1000x700")

        self.parser = YamlConfigParser()
        self.store = SQLiteStore()
        self.devices: Dict[str, MockSerialAdapter] = {}
        self.current_device_id: Optional[str] = None
        self.current_snapshot: Optional[Dict[str, Any]] = None
        self.current_target: Optional[Dict[str, Any]] = None
        self.current_diff: List[Dict[str, Any]] = []
        self.engine: Optional[DiffEngine] = None

        self._setup_styles()
        self._build_ui()

    def _setup_styles(self):
        style = ttk.Style()
        style.configure("Match.TLabel", background=self.COLOR_MATCH)
        style.configure("Mismatch.TLabel", background=self.COLOR_MISMATCH)
        style.configure("Error.TLabel", background=self.COLOR_ERROR)
        style.configure("Readonly.TLabel", background=self.COLOR_READONLY)

    def _build_ui(self):
        toolbar = ttk.Frame(self.root)
        toolbar.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        ttk.Label(toolbar, text="Device:").grid(row=0, column=0, padx=5)
        self.device_var = tk.StringVar()
        self.device_combo = ttk.Combobox(toolbar, textvariable=self.device_var, state="readonly", width=20)
        self.device_combo.grid(row=0, column=1, padx=5)
        self.device_combo.bind("<<ComboboxSelected>>", self._on_device_selected)

        ttk.Button(toolbar, text="Add Mock Device", command=self._add_mock_device).grid(row=0, column=2, padx=5)
        ttk.Button(toolbar, text="Set Offline", command=self._toggle_offline).grid(row=0, column=3, padx=5)

        config_frame = ttk.LabelFrame(self.root, text="Target Config", padding=10)
        config_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=5)

        ttk.Button(config_frame, text="Import YAML", command=self._import_yaml).pack(side=tk.LEFT, padx=5)
        self.yaml_path_var = tk.StringVar(value="No file selected")
        ttk.Label(config_frame, textvariable=self.yaml_path_var).pack(side=tk.LEFT, padx=5)

        action_frame = ttk.Frame(self.root)
        action_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=5)

        self.snapshot_btn = ttk.Button(action_frame, text="Take Snapshot", command=self._take_snapshot)
        self.snapshot_btn.pack(side=tk.LEFT, padx=5)
        self.snapshot_label = ttk.Label(action_frame, text="No snapshot")
        self.snapshot_label.pack(side=tk.LEFT, padx=5)

        ttk.Separator(action_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)

        self.diff_btn = ttk.Button(action_frame, text="Compute Diff", command=self._compute_diff, state="disabled")
        self.diff_btn.pack(side=tk.LEFT, padx=5)

        self.write_btn = ttk.Button(action_frame, text="Write Selected", command=self._write_selected, state="disabled")
        self.write_btn.pack(side=tk.LEFT, padx=5)

        ttk.Separator(action_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)

        self.rollback_btn = ttk.Button(action_frame, text="Rollback to Snapshot", command=self._rollback, state="disabled")
        self.rollback_btn.pack(side=tk.LEFT, padx=5)

        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        diff_frame = ttk.LabelFrame(main_paned, text="Diff View", padding=5)
        main_paned.add(diff_frame)

        diff_scroll = ttk.Scrollbar(diff_frame)
        diff_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.diff_canvas = tk.Canvas(diff_frame, bg="white", yscrollcommand=diff_scroll.set)
        self.diff_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        diff_scroll.config(command=self.diff_canvas.yview)

        self.diff_inner = ttk.Frame(self.diff_canvas)
        self.diff_canvas.create_window((0, 0), window=self.diff_inner, anchor="nw")

        history_frame = ttk.LabelFrame(main_paned, text="History", padding=5)
        main_paned.add(history_frame)

        history_scroll = ttk.Scrollbar(history_frame)
        history_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        columns = ("id", "timestamp", "diff")
        self.history_tree = ttk.Treeview(history_frame, columns=columns, show="headings",
                                          yscrollcommand=history_scroll.set, height=15)
        self.history_tree.heading("id", text="ID")
        self.history_tree.heading("timestamp", text="Timestamp")
        self.history_tree.heading("diff", text="Diff Summary")
        self.history_tree.column("id", width=50)
        self.history_tree.column("timestamp", width=150)
        self.history_tree.column("diff", width=200)
        self.history_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        history_scroll.config(command=self.history_tree.yview)

        self.history_tree.bind("<Double-Button-1>", self._on_history_select)

        status_frame = ttk.Frame(self.root, relief=tk.SUNKEN)
        status_frame.pack(side=tk.BOTTOM, fill=tk.X)
        self.status_var = tk.StringVar(value="Ready")
        ttk.Label(status_frame, textvariable=self.status_var).pack(side=tk.LEFT, padx=5)

        self.log_text = scrolledtext.ScrolledText(self.root, height=8, state="disabled")
        self.log_text.pack(fill=tk.X, padx=10, pady=5)

    def _log(self, msg: str):
        self.log_text.config(state="normal")
        self.log_text.insert(tk.END, msg + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state="disabled")

    def _set_status(self, msg: str):
        self.status_var.set(msg)

    def _add_mock_device(self):
        device_id = f"GW-{len(self.devices) + 1:03d}"
        adapter = MockSerialAdapter(device_id=device_id)
        self.devices[device_id] = adapter
        self.device_combo["values"] = list(self.devices.keys())
        self.device_var.set(device_id)
        self._on_device_selected()
        self._log(f"Added mock device: {device_id}")
        self._set_status(f"Device {device_id} created")

    def _toggle_offline(self):
        if not self.current_device_id:
            return
        adapter = self.devices[self.current_device_id]
        adapter.set_offline(not adapter.offline)
        status = "OFFLINE" if adapter.offline else "ONLINE"
        self._log(f"Device {self.current_device_id} set to {status}")
        self._set_status(f"Device {status}")

    def _on_device_selected(self, event=None):
        self.current_device_id = self.device_var.get()
        if self.current_device_id and self.current_device_id in self.devices:
            self.engine = DiffEngine(self.devices[self.current_device_id])
            self._refresh_history()
            self._clear_diff_view()

    def _import_yaml(self):
        path = filedialog.askopenfilename(filetypes=[("YAML files", "*.yaml *.yml"), ("All files", "*.*")])
        if not path:
            return
        try:
            self.current_target = self.parser.parse(path)
            self.yaml_path_var.set(Path(path).name)
            self.diff_btn.config(state="normal")
            self._log(f"Imported YAML: {path}")
            self._set_status(f"Config loaded: {self.current_target['name']}")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _take_snapshot(self):
        if not self.current_device_id:
            messagebox.showwarning("Warning", "Please select a device first")
            return
        try:
            self.current_snapshot = self.engine.take_snapshot()
            self.snapshot_label.config(text=self.current_snapshot['timestamp'])
            self.write_btn.config(state="normal")
            self.rollback_btn.config(state="normal")
            self._log(f"Snapshot taken at {self.current_snapshot['timestamp']}")
            self._set_status("Snapshot captured")
            self._refresh_history()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to take snapshot: {e}")

    def _compute_diff(self):
        if not self.current_snapshot or not self.current_target:
            messagebox.showwarning("Warning", "Take a snapshot and import a target config first")
            return
        try:
            self.current_diff = self.engine.compute_diff(self.current_snapshot, self.current_target)
            self._render_diff_view()
            self._set_status(f"Diff computed: {len(self.current_diff)} registers")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to compute diff: {e}")

    def _render_diff_view(self):
        for widget in self.diff_inner.winfo_children():
            widget.destroy()

        if not self.current_diff:
            return

        headers = ttk.Frame(self.diff_inner)
        headers.pack(fill=tk.X)
        ttk.Label(headers, text="Addr", width=8, anchor=tk.W).pack(side=tk.LEFT)
        ttk.Label(headers, text="Name", width=20, anchor=tk.W).pack(side=tk.LEFT)
        ttk.Label(headers, text="Current", width=15, anchor=tk.W).pack(side=tk.LEFT)
        ttk.Label(headers, text="Target", width=15, anchor=tk.W).pack(side=tk.LEFT)
        ttk.Label(headers, text="Status", width=12, anchor=tk.W).pack(side=tk.LEFT)
        ttk.Label(headers, text="Write", width=6, anchor=tk.CENTER).pack(side=tk.LEFT)

        self.diff_checkboxes: Dict[int, tk.BooleanVar] = {}

        for idx, d in enumerate(self.current_diff):
            row = ttk.Frame(self.diff_inner)
            row.pack(fill=tk.X)

            addr_str = f"0x{d['address']:02X}"
            bg_color = self._get_row_color(d)

            frame = tk.Frame(row, bg=bg_color)
            frame.pack(fill=tk.X, pady=0.5)

            ttk.Label(frame, text=addr_str, width=8, anchor=tk.W, background=bg_color).pack(side=tk.LEFT)
            ttk.Label(frame, text=d['name'], width=20, anchor=tk.W, background=bg_color).pack(side=tk.LEFT)

            curr_val = str(d.get('current_value', ''))[:15]
            ttk.Label(frame, text=curr_val, width=15, anchor=tk.W, background=bg_color).pack(side=tk.LEFT)

            tgt_val = str(d.get('target_value', ''))[:15]
            ttk.Label(frame, text=tgt_val, width=15, anchor=tk.W, background=bg_color).pack(side=tk.LEFT)

            status = d.get('diff_type', 'unknown')
            ttk.Label(frame, text=status, width=12, anchor=tk.W, background=bg_color).pack(side=tk.LEFT)

            var = tk.BooleanVar(value=False)
            self.diff_checkboxes[d['address']] = var
            cb = ttk.Checkbutton(frame, variable=var)
            if not d.get('writable', False) or d.get('diff_type') == DiffEngine.DIFF_MATCH:
                cb.config(state="disabled")
            cb.pack(side=tk.LEFT)

        self.diff_canvas.update_idletasks()
        self.diff_canvas.config(scrollregion=self.diff_canvas.bbox("all"))

    def _get_row_color(self, d: Dict[str, Any]) -> str:
        diff_type = d.get('diff_type', '')
        if diff_type == DiffEngine.DIFF_MATCH:
            return self.COLOR_MATCH
        elif diff_type == DiffEngine.DIFF_MISMATCH:
            return self.COLOR_MISMATCH
        elif diff_type in (DiffEngine.DIFF_READONLY, DiffEngine.DIFF_TYPE_ERR):
            return self.COLOR_ERROR
        else:
            return self.COLOR_READONLY

    def _clear_diff_view(self):
        for widget in self.diff_inner.winfo_children():
            widget.destroy()
        self.diff_canvas.update_idletasks()
        self.diff_canvas.config(scrollregion=self.diff_canvas.bbox("all"))

    def _write_selected(self):
        if not self.current_diff:
            return
        selected = [addr for addr, var in self.diff_checkboxes.items() if var.get()]
        if not selected:
            messagebox.showinfo("Info", "No registers selected for write")
            return

        def do_write():
            self._set_status("Writing...")
            result = self.engine.selective_write(self.current_diff, selected)
            self._log(f"Write result - Success: {len(result.success)}, Failed: {len(result.failed)}, Skipped: {len(result.skipped)}")
            for f in result.failed:
                self._log(f"  FAILED: addr 0x{f['address']:02X} - {f.get('error', 'unknown')}")
            for s in result.skipped:
                self._log(f"  SKIPPED: addr 0x{s['address']:02X} - {s.get('reason', 'unknown')}")
            self._set_status("Write complete")
            self._take_snapshot()
            self._compute_diff()
            self._save_history()

        threading.Thread(target=do_write, daemon=True).start()

    def _rollback(self):
        if not self.current_snapshot:
            return
        if messagebox.askyesno("Confirm", "Rollback to current snapshot?"):
            try:
                self.engine.rollback(self.current_snapshot)
                self._log("Rollback complete")
                self._set_status("Rollback complete")
                self._compute_diff()
            except Exception as e:
                messagebox.showerror("Error", f"Rollback failed: {e}")

    def _save_history(self):
        if not self.current_device_id or not self.current_snapshot:
            return
        diff_summary = json.dumps([
            {"address": d['address'], "type": d.get('diff_type')} for d in self.current_diff
        ])
        self.store.save_snapshot(
            device_id=self.current_device_id,
            snapshot=self.current_snapshot,
            target_yaml=yaml.dump(self.current_target) if self.current_target else None,
            diff_summary=diff_summary
        )
        self._refresh_history()

    def _refresh_history(self):
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)
        if not self.current_device_id:
            return
        records = self.store.get_snapshots(self.current_device_id)
        for rec in records:
            self.history_tree.insert("", tk.END, iid=rec.id,
                                     values=(rec.id, rec.timestamp, rec.diff_summary[:50] if rec.diff_summary else ""))

    def _on_history_select(self, event):
        selection = self.history_tree.selection()
        if not selection:
            return
        rec = self.store.get_snapshot_by_id(int(selection[0]))
        if rec:
            snapshot = json.loads(rec.snapshot_json)
            self.current_snapshot = snapshot
            self.snapshot_label.config(text=snapshot['timestamp'])
            self._log(f"Loaded snapshot from history: ID={rec.id}")
            self._set_status(f"Loaded snapshot {rec.id}")

    def run(self):
        self.root.mainloop()
