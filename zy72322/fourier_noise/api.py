from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from typing import Dict, Any
from fourier_noise.workflow import WorkflowEngine, WorkflowStep
from fourier_noise.demo_data import (
    get_demo_records,
    get_demo_teacher_annotations,
    get_demo_sampling_list,
    get_demo_manual_correction,
    get_demo_rerun_config,
)
from fourier_noise.models import Record, RecordType, ReviewStatus


_engine = WorkflowEngine()


def _build_engine_from_scratch() -> WorkflowEngine:
    eng = WorkflowEngine()
    records = get_demo_records()
    annotations = get_demo_teacher_annotations()
    eng.import_teacher_annotations(records, annotations)
    return eng


class FourierNoiseAPIHandler(BaseHTTPRequestHandler):

    def _send_json(self, data: Any, status: int = 200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        global _engine

        if self.path == "/api/status":
            self._send_json(_engine.get_status())

        elif self.path == "/api/demo-data":
            data = {
                "records": [r.to_dict() for r in get_demo_records()],
                "annotations": [a.to_dict() for a in get_demo_teacher_annotations()],
                "sampling_list": get_demo_sampling_list(),
                "manual_correction": get_demo_manual_correction(),
                "rerun_config": get_demo_rerun_config(),
            }
            self._send_json(data)

        elif self.path == "/api/report":
            report = _engine.update_boundary_report()
            self._send_json(report.to_dict())

        elif self.path == "/api/records":
            self._send_json([r.to_dict() for r in _engine.records])

        elif self.path == "/api/annotations":
            self._send_json([a.to_dict() for a in _engine.annotations])

        else:
            self._send_json({"error": "未知路径", "path": self.path}, 404)

    def do_POST(self):
        global _engine

        if self.path == "/api/import-annotations":
            records = get_demo_records()
            annotations = get_demo_teacher_annotations()
            result = _engine.import_teacher_annotations(records, annotations)
            self._send_json(result)

        elif self.path == "/api/supplement-sampling":
            body = self._read_body()
            sampling = body.get("entries", get_demo_sampling_list())
            result = _engine.supplement_from_sampling(sampling)
            self._send_json(result)

        elif self.path == "/api/correct":
            body = self._read_body()
            record_id = body.get("record_id")
            corrected_value = body.get("corrected_value")
            if not record_id or corrected_value is None:
                self._send_json({"error": "需要 record_id 和 corrected_value"}, 400)
                return
            result = _engine.manual_correct(record_id, corrected_value)
            self._send_json(result)

        elif self.path == "/api/rerun":
            result = _engine.rerun()
            self._send_json(result)

        elif self.path == "/api/demo-full":
            engine = WorkflowEngine()
            records = get_demo_records()
            annotations = get_demo_teacher_annotations()
            sampling = get_demo_sampling_list()
            correction = get_demo_manual_correction()

            step1 = engine.import_teacher_annotations(records, annotations)
            step2 = engine.supplement_from_sampling(sampling)
            engine.manual_correct(correction["record_id"], correction["corrected_value"])
            step4 = engine.rerun()
            report = engine.update_boundary_report()

            self._send_json({
                "step1_import_annotations": step1,
                "step2_supplement_sampling": step2,
                "step3_manual_correct": correction,
                "step4_rerun": step4,
                "boundary_report": report.to_dict(),
            })

        elif self.path == "/api/reset":
            _engine = WorkflowEngine()
            self._send_json({"status": "reset", "message": "引擎已重置"})

        else:
            self._send_json({"error": "未知路径", "path": self.path}, 404)

    def log_message(self, format, *args):
        print(f"[API] {args[0]}")


def run_api(host: str = "127.0.0.1", port: int = 8765):
    server = HTTPServer((host, port), FourierNoiseAPIHandler)
    print(f"傅里叶周期噪声拆解 API 已启动: http://{host}:{port}")
    print(f"  GET  /api/status           — 流程状态")
    print(f"  GET  /api/demo-data        — 演示数据")
    print(f"  GET  /api/report           — 边界样本报告")
    print(f"  GET  /api/records          — 当前记录")
    print(f"  POST /api/import-annotations  — ①导入老师批注")
    print(f"  POST /api/supplement-sampling — ②补看抽样名单")
    print(f"  POST /api/correct             — 人工修正")
    print(f"  POST /api/rerun               — 重跑")
    print(f"  POST /api/demo-full           — 完整演示一键跑")
    print(f"  POST /api/reset               — 重置引擎")
    server.serve_forever()


if __name__ == "__main__":
    run_api()
