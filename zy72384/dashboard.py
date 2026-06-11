#!/usr/bin/env python3
import json
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from models import ShockDataPoint, TempUnit, WorkflowStage
from workflow import WorkflowEngine
from visualizer import Chart3D
from report_renderer import ReportRenderer

def create_fresh_shock_data():
    return [
        ShockDataPoint(time_ms=0, acceleration_g=1.0, altitude_m=1000.0, velocity_m_s=0.0),
        ShockDataPoint(time_ms=50, acceleration_g=2.3, altitude_m=980.0, velocity_m_s=15.2),
        ShockDataPoint(time_ms=100, acceleration_g=5.8, altitude_m=920.0, velocity_m_s=35.6),
        ShockDataPoint(time_ms=150, acceleration_g=12.4, altitude_m=850.0, velocity_m_s=55.2),
        ShockDataPoint(time_ms=200, acceleration_g=18.7, altitude_m=760.0, velocity_m_s=68.9),
        ShockDataPoint(time_ms=250, acceleration_g=16.2, altitude_m=680.0, velocity_m_s=62.1),
        ShockDataPoint(time_ms=300, acceleration_g=8.5, altitude_m=600.0, velocity_m_s=48.3),
        ShockDataPoint(time_ms=350, acceleration_g=4.2, altitude_m=530.0, velocity_m_s=32.8),
        ShockDataPoint(time_ms=400, acceleration_g=2.1, altitude_m=480.0, velocity_m_s=18.5),
        ShockDataPoint(time_ms=450, acceleration_g=1.2, altitude_m=450.0, velocity_m_s=8.2),
    ]


engine = WorkflowEngine()


def init_demo_data():
    with open("sample_data/sampling_spec.txt", "r", encoding="utf-8") as f:
        content = f.read()
    engine.step1_import_sampling_spec(content, "sample_data/sampling_spec.txt")
    engine.step1_import_shock_data(create_fresh_shock_data())


def load_template():
    template_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "templates", "dashboard.html"
    )
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


def safe_template_render(template: str, context: dict) -> str:
    def replace_match(m):
        key = m.group(1)
        if key in context:
            return str(context[key])
        return m.group(0)

    pattern = re.compile(r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}')
    return pattern.sub(replace_match, template)


class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/dashboard":
            self._render_dashboard()
        elif path == "/api/state":
            self._api_state()
        elif path == "/api/chart":
            self._api_chart()
        elif path == "/api/report":
            self._api_report()
        elif path == "/api/click":
            params = parse_qs(parsed.query)
            idx = int(params.get("idx", ["0"])[0])
            self._api_click(idx)
        elif path == "/api/stage":
            self._api_stage()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/calibrate":
            length = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(length))
            self._api_calibrate(body)
        elif path == "/api/update":
            length = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(length))
            self._api_update(body)
        elif path == "/api/import":
            self._api_import()
        elif path == "/api/reset":
            global engine
            engine = WorkflowEngine()
            init_demo_data()
            self._api_state()

    def _get_step_classes(self):
        stage = engine.state.current_stage.value
        step1_class = "completed"
        step2_class = ""
        step3_class = ""

        if "第二步" in stage or "第三步" in stage:
            step2_class = "completed"
        elif "待训练教练复核" in stage:
            step2_class = "active"
        else:
            step2_class = "active"

        if "第三步" in stage:
            step3_class = "completed"
        elif step2_class == "completed":
            step3_class = "active"

        if "第一步" in stage:
            step1_class = "active"

        return step1_class, step2_class, step3_class

    def _render_dashboard(self):
        chart = Chart3D(engine.state)
        renderer = ReportRenderer(engine.state)
        template = load_template()

        clickable = chart.list_clickable_points()

        chart_rows = ""
        for i, p in enumerate(engine.state.shock_data):
            temp_info = ""
            if p.temperature_reading:
                temp_info = "{}{}".format(
                    p.temperature_reading.value,
                    p.temperature_reading.unit.value
                )
            row_class = "point-mixed" if p.has_mixed_units else "point-normal"
            marker = "⚠️" if p.has_mixed_units else "●"
            cal_status = "✓" if p.linked_calibration_id else ("❌" if p.has_mixed_units else "-")

            chart_rows += (
                '<tr class="{}" onclick="clickPoint({})">'
                '<td>{}</td><td>{}</td><td>{:.1f}</td><td>{:.2f}</td>'
                '<td>{:.1f}</td><td>{:.1f}</td><td>{}</td><td>{}</td>'
                '</tr>'
            ).format(row_class, i, i, marker, p.time_ms, p.acceleration_g,
                     p.altitude_m, p.velocity_m_s, temp_info, cal_status)

        retention_items = ""
        if engine.state.handover_report:
            for note in engine.state.handover_report.retention_notes:
                missing_html = ""
                if note.missing_materials:
                    missing_html = '<div class="missing">❌ 缺失: {}</div>'.format(
                        ", ".join(note.missing_materials)
                    )
                retention_items += (
                    '<div class="retention-item {}">'
                    '<div class="point-id">数据点 {} | 优先级: {}</div>'
                    '<div class="reason">{}</div>'
                    '{}'
                    '<div class="next">👉 下一步对接: {}</div>'
                    '</div>'
                ).format(
                    note.priority.lower(),
                    note.data_point_id,
                    note.priority,
                    note.reason_kept,
                    missing_html,
                    note.next_contact.value
                )

        banner_text = renderer.render_stage_banner()
        for ch in ['┌', '┐', '└', '┘', '│', '─']:
            banner_text = banner_text.replace(ch, '')
        banner_text = banner_text.strip()

        banner_class = "warning" if "待训练教练复核" in engine.state.current_stage.value else "success"

        step1_class, step2_class, step3_class = self._get_step_classes()

        summary_coach = engine.state.handover_report.summary_for_coach if engine.state.handover_report else "暂无"
        summary_lin = engine.state.handover_report.summary_for_lin if engine.state.handover_report else "暂无"

        html = safe_template_render(template, {
            "step1_class": step1_class,
            "step2_class": step2_class,
            "step3_class": step3_class,
            "banner_class": banner_class,
            "banner_text": banner_text,
            "total_points": len(engine.state.shock_data),
            "mixed_count": len(clickable),
            "cal_count": len(engine.state.calibration_records),
            "current_stage_text": engine.state.current_stage.value.split('：')[0],
            "chart_rows": chart_rows,
            "retention_items": retention_items,
            "summary_coach": summary_coach,
            "summary_lin": summary_lin
        })

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def _api_state(self):
        data = {
            "current_stage": engine.state.current_stage.value,
            "total_points": len(engine.state.shock_data),
            "mixed_count": engine.state.handover_report.mixed_unit_count if engine.state.handover_report else 0,
            "calibration_count": len(engine.state.calibration_records),
            "has_sampling_spec": engine.state.sampling_spec is not None
        }
        self._send_json(data)

    def _api_chart(self):
        chart = Chart3D(engine.state)
        result = {
            "clickable_points": chart.list_clickable_points(),
            "render_3d": chart.render_text_3d(),
            "render_2d": chart._render_2d_chart()
        }
        self._send_json(result)

    def _api_report(self):
        renderer = ReportRenderer(engine.state)
        self._send_json({"full_report": renderer.render_full_report()})

    def _api_click(self, idx):
        chart = Chart3D(engine.state)
        result = chart.click_point(idx)
        self._send_json(result)

    def _api_stage(self):
        renderer = ReportRenderer(engine.state)
        self._send_json({"banner": renderer.render_stage_banner()})

    def _api_calibrate(self, body):
        unit = TempUnit.KELVIN if body.get("calibration_unit", "°C").upper() == "K" else TempUnit.CELSIUS
        engine.step2_lin_add_calibration(
            data_point_ids=body.get("point_ids", []),
            instrument_id=body.get("instrument_id", "INS-2026-001"),
            calibration_temp=body.get("calibration_temp", 25.0),
            calibration_unit=unit,
            remarks=body.get("remarks", "")
        )
        self._api_state()

    def _api_update(self, body):
        engine.step3_update_report(body.get("coach_notes", ""))
        self._api_state()

    def _api_import(self):
        with open("sample_data/sampling_spec.txt", "r", encoding="utf-8") as f:
            content = f.read()
        engine.step1_import_sampling_spec(content, "sample_data/sampling_spec.txt")
        engine.step1_import_shock_data(create_fresh_shock_data())
        self._api_state()

    def _send_json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))


def main():
    init_demo_data()
    port = 8082
    print("🪂 降落伞开伞冲击 小看板已启动")
    print("📊 访问地址: http://localhost:{}/dashboard".format(port))
    print("🚀 运行命令行演示: python3 cli.py demo")
    print("=" * 60)
    server = HTTPServer(("0.0.0.0", port), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 再见")
        server.server_close()


if __name__ == "__main__":
    main()
