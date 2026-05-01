import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import threading
import time
from data_importer import load_show_data
from channel_mapper import ChannelMapper
from interpolator import Interpolator
from risk_detector import RiskDetector


class DMXPreviewApp:
    def __init__(self, root):
        self.root = root
        self.root.title("DMX 灯光预演工具")
        self.root.geometry("1200x800")

        self.show_data = None
        self.mapper = None
        self.interpolator = None
        self.risk_detector = None

        self.current_time = 0.0
        self.is_playing = False
        self.play_thread = None

        self._setup_ui()
        self._load_default_data()

    def _setup_ui(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)

        title_label = ttk.Label(main_frame, text="DMX 灯光预演工具", font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 10))

        control_frame = ttk.LabelFrame(main_frame, text="控制面板", padding="10")
        control_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)

        self.time_label = ttk.Label(control_frame, text="时间: 0.0s / 30.0s", font=("Arial", 12))
        self.time_label.grid(row=0, column=0, padx=5, pady=5)

        self.slider = ttk.Scale(
            control_frame,
            from_=0.0,
            to=30.0,
            value=0.0,
            command=self._on_slider_change,
            length=400
        )
        self.slider.grid(row=0, column=1, padx=5, pady=5, sticky=(tk.W, tk.E))

        self.play_button = ttk.Button(control_frame, text="播放", command=self._toggle_play)
        self.play_button.grid(row=0, column=2, padx=5, pady=5)

        self.stop_button = ttk.Button(control_frame, text="停止", command=self._stop_play)
        self.stop_button.grid(row=0, column=3, padx=5, pady=5)

        ttk.Separator(control_frame, orient=tk.VERTICAL).grid(row=0, column=4, sticky=tk.NS, padx=10, pady=5)

        ttk.Button(control_frame, text="加载数据", command=self._load_data).grid(row=0, column=5, padx=5, pady=5)
        ttk.Button(control_frame, text="导出 Risks", command=self._export_risks).grid(row=0, column=6, padx=5, pady=5)
        ttk.Button(control_frame, text="导出 Summary", command=self._export_summary).grid(row=0, column=7, padx=5, pady=5)

        control_frame.columnconfigure(1, weight=1)

        left_frame = ttk.Frame(main_frame)
        left_frame.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5))
        left_frame.rowconfigure(1, weight=1)
        left_frame.columnconfigure(0, weight=1)

        cue_frame = ttk.LabelFrame(left_frame, text="Cue 列表", padding="10")
        cue_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N), pady=(0, 5))
        cue_frame.columnconfigure(0, weight=1)

        self.cue_listbox = tk.Listbox(cue_frame, height=8)
        self.cue_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.cue_listbox.bind('<<ListboxSelect>>', self._on_cue_select)

        fixture_frame = ttk.LabelFrame(left_frame, text="灯具通道值", padding="10")
        fixture_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        fixture_frame.columnconfigure(0, weight=1)
        fixture_frame.rowconfigure(0, weight=1)

        self.fixture_tree = ttk.Treeview(fixture_frame, columns=("fixture", "channel", "dmx", "value"), show="headings")
        self.fixture_tree.heading("fixture", text="灯具")
        self.fixture_tree.heading("channel", text="通道名")
        self.fixture_tree.heading("dmx", text="DMX 通道")
        self.fixture_tree.heading("value", text="当前值")

        self.fixture_tree.column("fixture", width=100)
        self.fixture_tree.column("channel", width=100)
        self.fixture_tree.column("dmx", width=80)
        self.fixture_tree.column("value", width=80)

        fixture_scroll = ttk.Scrollbar(fixture_frame, orient=tk.VERTICAL, command=self.fixture_tree.yview)
        self.fixture_tree.configure(yscrollcommand=fixture_scroll.set)

        self.fixture_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        fixture_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))

        right_frame = ttk.Frame(main_frame)
        right_frame.grid(row=2, column=1, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(5, 0))
        right_frame.rowconfigure(0, weight=1)
        right_frame.columnconfigure(0, weight=1)

        risk_frame = ttk.LabelFrame(right_frame, text="风险提示", padding="10")
        risk_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        risk_frame.columnconfigure(0, weight=1)
        risk_frame.rowconfigure(0, weight=1)

        self.risk_text = tk.Text(risk_frame, wrap=tk.WORD, state=tk.DISABLED)
        risk_scroll = ttk.Scrollbar(risk_frame, orient=tk.VERTICAL, command=self.risk_text.yview)
        self.risk_text.configure(yscrollcommand=risk_scroll.set)

        self.risk_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        risk_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))

        self.risk_text.tag_config("HIGH", foreground="red", font=("Arial", 10, "bold"))
        self.risk_text.tag_config("MEDIUM", foreground="orange", font=("Arial", 10, "bold"))
        self.risk_text.tag_config("INFO", foreground="blue", font=("Arial", 10))
        self.risk_text.tag_config("normal", font=("Arial", 10))

    def _load_default_data(self):
        base_path = os.path.dirname(os.path.abspath(__file__))
        patch_path = os.path.join(base_path, "data", "patch.csv")
        cues_path = os.path.join(base_path, "data", "cues.yaml")
        timeline_path = os.path.join(base_path, "data", "timeline.json")

        if os.path.exists(patch_path) and os.path.exists(cues_path) and os.path.exists(timeline_path):
            try:
                self.show_data = load_show_data(patch_path, cues_path, timeline_path)
                self.mapper = ChannelMapper(self.show_data)
                self.interpolator = Interpolator(self.show_data, self.mapper)
                self.risk_detector = RiskDetector(self.show_data, self.mapper)
                self.slider.configure(to=self.show_data.total_duration)
                self._update_cue_list()
                self._update_display()
            except Exception as e:
                messagebox.showerror("错误", f"加载数据失败: {str(e)}")

    def _load_data(self):
        patch_path = filedialog.askopenfilename(title="选择 patch.csv", filetypes=[("CSV 文件", "*.csv")])
        if not patch_path:
            return

        cues_path = filedialog.askopenfilename(title="选择 cues.yaml", filetypes=[("YAML 文件", "*.yaml *.yml")])
        if not cues_path:
            return

        timeline_path = filedialog.askopenfilename(title="选择 timeline.json", filetypes=[("JSON 文件", "*.json")])
        if not timeline_path:
            return

        try:
            self.show_data = load_show_data(patch_path, cues_path, timeline_path)
            self.mapper = ChannelMapper(self.show_data)
            self.interpolator = Interpolator(self.show_data, self.mapper)
            self.risk_detector = RiskDetector(self.show_data, self.mapper)
            self.slider.configure(to=self.show_data.total_duration)
            self.current_time = 0.0
            self.slider.set(0.0)
            self._update_cue_list()
            self._update_display()
            messagebox.showinfo("成功", "数据加载成功！")
        except Exception as e:
            messagebox.showerror("错误", f"加载数据失败: {str(e)}")

    def _update_cue_list(self):
        self.cue_listbox.delete(0, tk.END)
        if self.show_data:
            for cue in self.show_data.cues:
                self.cue_listbox.insert(tk.END, f"{cue.cue_id} - {cue.name}")

    def _toggle_play(self):
        if not self.is_playing:
            self.is_playing = True
            self.play_button.configure(text="暂停")
            self.play_thread = threading.Thread(target=self._play_loop, daemon=True)
            self.play_thread.start()
        else:
            self.is_playing = False
            self.play_button.configure(text="播放")

    def _stop_play(self):
        self.is_playing = False
        self.current_time = 0.0
        self.slider.set(0.0)
        self._update_display()

    def _play_loop(self):
        while self.is_playing and self.show_data:
            self.current_time += 0.1
            if self.current_time >= self.show_data.total_duration:
                self.current_time = 0.0

            self.root.after(0, lambda: self.slider.set(self.current_time))
            self.root.after(0, self._update_display)
            time.sleep(0.1)

    def _on_slider_change(self, value):
        self.current_time = float(value)
        self._update_display()

    def _on_cue_select(self, event):
        selection = self.cue_listbox.curselection()
        if selection and self.show_data:
            index = selection[0]
            cue = self.show_data.cues[index]
            for item in self.show_data.timeline:
                if item.cue_id == cue.cue_id:
                    self.current_time = (item.start_time + item.end_time) / 2
                    self.slider.set(self.current_time)
                    self._update_display()
                    break

    def _update_display(self):
        if not self.show_data or not self.mapper or not self.interpolator or not self.risk_detector:
            return

        self.time_label.configure(text=f"时间: {self.current_time:.1f}s / {self.show_data.total_duration:.1f}s")
        self._update_fixture_values()
        self._update_risks()

    def _update_fixture_values(self):
        for item in self.fixture_tree.get_children():
            self.fixture_tree.delete(item)

        channel_values = self.interpolator.get_all_channel_values_at_time(self.current_time)

        for channel in self.show_data.patch:
            value = channel_values.get(channel.fixture_id, {}).get(channel.channel_name, 0)
            color = self._get_value_color(value)

            item_id = self.fixture_tree.insert(
                "",
                tk.END,
                values=(channel.fixture_name, channel.channel_name, channel.dmx_channel, value)
            )
            self.fixture_tree.item(item_id, tags=("normal",))

    def _get_value_color(self, value):
        if value == 0:
            return "gray"
        elif value < 85:
            return "lightblue"
        elif value < 170:
            return "yellow"
        else:
            return "red"

    def _update_risks(self):
        self.risk_text.configure(state=tk.NORMAL)
        self.risk_text.delete(1.0, tk.END)

        if not self.risk_detector:
            self.risk_text.configure(state=tk.DISABLED)
            return

        risks = self.risk_detector.get_risks_at_time(self.current_time)

        if not risks:
            self.risk_text.insert(tk.END, "当前无风险提示\n", "normal")
        else:
            for risk in risks:
                self.risk_text.insert(tk.END, f"[{risk.severity}] ", risk.severity)
                self.risk_text.insert(tk.END, f"{risk.type}\n", risk.severity)
                self.risk_text.insert(tk.END, f"{risk.message}\n\n", "normal")

        self.risk_text.configure(state=tk.DISABLED)

    def _export_risks(self):
        if not self.risk_detector:
            messagebox.showwarning("警告", "请先加载数据！")
            return

        file_path = filedialog.asksaveasfilename(
            title="保存 Risks CSV",
            defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv")]
        )
        if file_path:
            try:
                self.risk_detector.export_risks_csv(file_path)
                messagebox.showinfo("成功", f"Risks 已导出到 {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")

    def _export_summary(self):
        if not self.risk_detector:
            messagebox.showwarning("警告", "请先加载数据！")
            return

        file_path = filedialog.asksaveasfilename(
            title="保存 Summary Markdown",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md")]
        )
        if file_path:
            try:
                self.risk_detector.export_summary_md(file_path)
                messagebox.showinfo("成功", f"Summary 已导出到 {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")


def main():
    root = tk.Tk()
    app = DMXPreviewApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
