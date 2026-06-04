#!/usr/bin/env python3
"""
热泵除霜能耗复盘 - API服务器

REST API接口列表：

GET  /api/summary                  获取汇总信息
GET  /api/records                  获取所有记录
GET  /api/record/<record_id>       获取单条记录详情
GET  /api/unit-note                获取单位换算说明
GET  /api/pending                  获取待复核记录
GET  /api/calibrations             获取温度校准记录
GET  /api/reviews                  获取复核历史
GET  /api/replay-runs              获取重跑历史

POST /api/import/interval          导入采样间隔说明
POST /api/import/records           导入除霜记录
POST /api/supplement-calibration   补录温度校准记录
POST /api/manual-correction        人工修正
POST /api/rerun                    重跑
POST /api/review/<record_id>       复核记录
POST /api/reset                    重置
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime
from replay_engine import DefrostReplayEngine
from demo_data import (
    create_demo_sampling_interval,
    create_demo_defrost_records_initial,
    create_demo_temperature_calibrations,
    create_demo_manual_correction
)
from models import (
    ManualCorrection,
    TemperatureCalibration,
    UnitCaliber,
    SamplingInterval,
    DefrostEnergyRecord,
    RecordStatus
)


def create_engine_with_demo():
    engine = DefrostReplayEngine()
    engine.import_sampling_interval(create_demo_sampling_interval())
    engine.import_defrost_records(create_demo_defrost_records_initial())
    return engine


engine = create_engine_with_demo()


class APIHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

    def read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode('utf-8')
        return json.loads(body) if body else {}

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        global engine
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            if path == "/api/summary":
                self.send_json(self.get_summary())
            elif path == "/api/records":
                self.send_json(self.get_records())
            elif path.startswith("/api/record/"):
                record_id = path.split("/")[-1]
                self.send_json(self.get_record(record_id))
            elif path == "/api/unit-note":
                self.send_json(self.get_unit_note())
            elif path == "/api/pending":
                self.send_json(self.get_pending())
            elif path == "/api/calibrations":
                self.send_json(self.get_calibrations())
            elif path == "/api/reviews":
                self.send_json(self.get_reviews())
            elif path == "/api/replay-runs":
                self.send_json(self.get_replay_runs())
            else:
                self.send_json({"error": "Not Found"}, 404)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def do_POST(self):
        global engine
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            data = self.read_body()

            if path == "/api/import/interval":
                result = self.import_interval(data)
                self.send_json(result)
            elif path == "/api/import/records":
                result = self.import_records(data)
                self.send_json(result)
            elif path == "/api/supplement-calibration":
                result = self.supplement_calibration(data)
                self.send_json(result)
            elif path == "/api/manual-correction":
                result = self.manual_correction(data)
                self.send_json(result)
            elif path == "/api/rerun":
                result = self.rerun(data)
                self.send_json(result)
            elif path.startswith("/api/review/"):
                record_id = path.split("/")[-1]
                result = self.review_record(record_id, data)
                self.send_json(result)
            elif path == "/api/reset":
                engine = create_engine_with_demo()
                self.send_json({"message": "已重置为初始状态", "success": True})
            elif path == "/api/load-demo":
                engine = create_engine_with_demo()
                if data.get("include_calibration"):
                    cals = create_demo_temperature_calibrations()
                    engine.supplement_from_calibration(cals)
                if data.get("include_correction"):
                    corr = create_demo_manual_correction()
                    engine.apply_manual_correction(corr)
                self.send_json({"message": "已加载演示数据", "success": True})
            else:
                self.send_json({"error": "Not Found"}, 404)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({"error": str(e)}, 500)

    def get_summary(self):
        status_counts = {}
        for record in engine.records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1

        total_energy = sum(r.energy_consumption_kwh for r in engine.records)
        masked_energy = sum(
            r.original_value or r.energy_consumption_kwh
            for r in engine.records
            if r.status == RecordStatus.MASKED_BY_AVERAGE
        )

        return {
            "total_records": len(engine.records),
            "total_energy": round(total_energy, 1),
            "masked_energy": round(masked_energy, 1),
            "threshold": engine.threshold_kwh,
            "status_counts": {k.value: v for k, v in status_counts.items()},
            "sampling_interval": {
                "description": engine.sampling_interval.description if engine.sampling_interval else "",
                "import_note": engine.sampling_interval.import_note if engine.sampling_interval else "",
                "start_time": engine.sampling_interval.start_time if engine.sampling_interval else None,
                "end_time": engine.sampling_interval.end_time if engine.sampling_interval else None,
                "interval_minutes": engine.sampling_interval.interval_minutes if engine.sampling_interval else None
            },
            "unit_note": engine.unit_conversion.get_conversion_text(),
            "current_caliber": engine.unit_conversion.current_caliber.value
        }

    def get_records(self):
        return [
            {
                "id": r.id,
                "start_time": r.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": r.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "duration_minutes": r.duration_minutes,
                "energy_consumption_kwh": r.energy_consumption_kwh,
                "ambient_temp": r.ambient_temp,
                "coil_temp": r.coil_temp,
                "status": r.status.value,
                "status_label": engine._get_status_label(r.status),
                "status_note": r.status_note,
                "threshold_exceeded": r.threshold_exceeded,
                "original_value": r.original_value,
                "masked_value": r.masked_value,
                "supplemented_from": r.supplemented_from,
                "caliber": r.caliber.value,
                "caliber_note": r.caliber_note,
                "reviewed_by": r.reviewed_by,
                "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if r.reviewed_at else None,
                "run_id": r.run_id
            }
            for r in sorted(engine.records, key=lambda x: x.start_time)
        ]

    def get_record(self, record_id):
        r = engine._find_record(record_id)
        if not r:
            return {"error": "未找到记录"}
        return {
            "id": r.id,
            "start_time": r.start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": r.end_time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_minutes": r.duration_minutes,
            "energy_consumption_kwh": r.energy_consumption_kwh,
            "ambient_temp": r.ambient_temp,
            "coil_temp": r.coil_temp,
            "status": r.status.value,
            "status_label": engine._get_status_label(r.status),
            "status_note": r.status_note,
            "threshold_exceeded": r.threshold_exceeded,
            "original_value": r.original_value,
            "masked_value": r.masked_value,
            "supplemented_from": r.supplemented_from,
            "caliber": r.caliber.value,
            "caliber_note": r.caliber_note,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if r.reviewed_at else None,
            "run_id": r.run_id
        }

    def get_unit_note(self):
        return {
            "current_caliber": engine.unit_conversion.current_caliber.value,
            "old_to_new_coefficient": engine.unit_conversion.old_to_new_coefficient,
            "new_to_old_coefficient": engine.unit_conversion.new_to_old_coefficient,
            "conversion_text": engine.unit_conversion.get_conversion_text(),
            "last_updated_at": engine.unit_conversion.last_updated_at.strftime("%Y-%m-%d %H:%M:%S") if engine.unit_conversion.last_updated_at else None,
            "updated_by": engine.unit_conversion.updated_by,
            "update_reason": engine.unit_conversion.update_reason,
            "history": engine.unit_conversion.history
        }

    def get_pending(self):
        pending = engine.get_pending_review_records()
        return [
            {
                "id": r.id,
                "start_time": r.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "energy_consumption_kwh": r.energy_consumption_kwh,
                "status": r.status.value,
                "status_label": engine._get_status_label(r.status),
                "original_value": r.original_value,
                "masked_value": r.masked_value
            }
            for r in sorted(pending, key=lambda x: x.start_time)
        ]

    def get_calibrations(self):
        return [
            {
                "record_time": c.record_time.strftime("%Y-%m-%d %H:%M:%S"),
                "sensor_id": c.sensor_id,
                "raw_temperature": c.raw_temperature,
                "calibrated_temperature": c.calibrated_temperature,
                "calibration_offset": c.calibration_offset,
                "calibration_note": c.calibration_note,
                "recorded_by": c.recorded_by,
                "caliber": c.caliber.value,
                "caliber_note": c.caliber_note
            }
            for c in sorted(engine.calibrations, key=lambda x: x.record_time)
        ]

    def get_reviews(self):
        return [
            {
                "record_id": r.record_id,
                "reviewed_by": r.reviewed_by,
                "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "original_status": r.original_status.value,
                "new_status": r.new_status.value,
                "review_note": r.review_note
            }
            for r in sorted(engine.reviews, key=lambda x: x.reviewed_at)
        ]

    def get_replay_runs(self):
        return [
            {
                "run_id": r.run_id,
                "run_time": r.run_time.strftime("%Y-%m-%d %H:%M:%S"),
                "run_by": r.run_by,
                "description": r.description,
                "previous_records_count": r.previous_records_count,
                "new_records_count": r.new_records_count,
                "changes": r.changes
            }
            for r in sorted(engine.replay_runs, key=lambda x: x.run_time)
        ]

    def import_interval(self, data):
        if data.get("use_demo", True):
            interval = create_demo_sampling_interval()
        else:
            interval = SamplingInterval(
                start_time=datetime.fromisoformat(data["start_time"]),
                end_time=datetime.fromisoformat(data["end_time"]),
                interval_minutes=data["interval_minutes"],
                description=data.get("description", ""),
                import_note=data.get("import_note", "")
            )
        message = engine.import_sampling_interval(interval)
        return {"message": message, "success": True}

    def import_records(self, data):
        if data.get("use_demo", True):
            records = create_demo_defrost_records_initial()
        else:
            records = []
            for item in data.get("records", []):
                records.append(DefrostEnergyRecord(
                    id=item["id"],
                    start_time=datetime.fromisoformat(item["start_time"]),
                    end_time=datetime.fromisoformat(item["end_time"]),
                    duration_minutes=item["duration_minutes"],
                    energy_consumption_kwh=item["energy_consumption_kwh"],
                    ambient_temp=item["ambient_temp"],
                    coil_temp=item["coil_temp"]
                ))
        message = engine.import_defrost_records(records)
        return {"message": message, "success": True, "count": len(records)}

    def supplement_calibration(self, data):
        if data.get("use_demo", True):
            calibrations = create_demo_temperature_calibrations()
        else:
            calibrations = []
            for item in data.get("calibrations", []):
                calibrations.append(TemperatureCalibration(
                    record_time=datetime.fromisoformat(item["record_time"]),
                    sensor_id=item["sensor_id"],
                    raw_temperature=item["raw_temperature"],
                    calibrated_temperature=item["calibrated_temperature"],
                    calibration_offset=item["calibration_offset"],
                    calibration_note=item.get("calibration_note", ""),
                    recorded_by=item.get("recorded_by", ""),
                    caliber=UnitCaliber(item.get("caliber", "old")),
                    caliber_note=item.get("caliber_note", "")
                ))
        message = engine.supplement_from_calibration(calibrations)
        return {"message": message, "success": True, "count": len(calibrations)}

    def manual_correction(self, data):
        if data.get("use_demo", True):
            correction = create_demo_manual_correction()
        else:
            correction = ManualCorrection(
                correction_id=data.get("correction_id", f"CORR-{datetime.now().strftime('%Y%m%d-%H%M%S')}"),
                record_id=data["record_id"],
                corrected_by=data.get("corrected_by", "老岑"),
                corrected_at=datetime.fromisoformat(data["corrected_at"]) if data.get("corrected_at") else datetime.now(),
                original_value=float(data["original_value"]),
                corrected_value=float(data["corrected_value"]),
                correction_note=data.get("correction_note", "人工修正")
            )
        message = engine.apply_manual_correction(correction)
        return {"message": message, "success": True}

    def rerun(self, data):
        message = engine.rerun(
            data.get("run_by", "老岑"),
            data.get("description", "补录温度校准记录后的重跑")
        )
        return {"message": message, "success": True, "run_id": engine.current_run_id}

    def review_record(self, record_id, data):
        message = engine.review_record(
            record_id,
            data.get("reviewed_by", "老岑"),
            data.get("is_normal", False),
            data.get("note", "")
        )
        return {"message": message, "success": True}

    def log_message(self, format, *args):
        pass


def run_server(port: int = 8081):
    print(f"🚀 热泵除霜能耗复盘 API 服务器已启动")
    print(f"📡 API 地址：http://localhost:{port}/api")
    print(f"📖 API 文档：")
    print(f"   GET  /api/summary                  获取汇总信息")
    print(f"   GET  /api/records                  获取所有记录")
    print(f"   GET  /api/record/<id>              获取单条记录详情")
    print(f"   GET  /api/unit-note                获取单位换算说明")
    print(f"   GET  /api/pending                  获取待复核记录")
    print(f"   GET  /api/calibrations             获取温度校准记录")
    print(f"   GET  /api/reviews                  获取复核历史")
    print(f"   GET  /api/replay-runs              获取重跑历史")
    print(f"   POST /api/import/interval          导入采样间隔说明")
    print(f"   POST /api/import/records           导入除霜记录")
    print(f"   POST /api/supplement-calibration   补录温度校准记录")
    print(f"   POST /api/manual-correction        人工修正")
    print(f"   POST /api/rerun                    重跑")
    print(f"   POST /api/review/<id>              复核记录")
    print(f"   POST /api/reset                    重置")
    print(f"   POST /api/load-demo                加载演示数据")
    print(f"\n👷 老岑师傅说：API 已经准备好了，随便调！\n")

    server = HTTPServer(('0.0.0.0', port), APIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 已停止 API 服务器")
        server.server_close()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
    run_server(port)
