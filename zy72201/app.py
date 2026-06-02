#!/usr/bin/env python3
import json
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os
import sys

from storage import Storage
from core import ReminderManager
from models import RecordStatus


def reminder_to_dict(reminder):
    sup = reminder.supplementary_records[-1] if reminder.supplementary_records else None
    return {
        "id": reminder.id,
        "bond_code": reminder.bond_code,
        "bond_name": reminder.bond_name,
        "institution_full_name": reminder.institution_full_name,
        "institution_alias": reminder.institution_alias,
        "redemption_date": reminder.redemption_date,
        "original_redemption_date": reminder.original_redemption_date,
        "exercise_amount": reminder.exercise_amount,
        "coupon_rate": reminder.coupon_rate,
        "status": reminder.status.value,
        "source": reminder.source,
        "import_batch": reminder.import_batch,
        "has_alias_mismatch": reminder.has_alias_mismatch,
        "alias_mismatch_note": reminder.alias_mismatch_note,
        "detected_alias": reminder.detected_alias,
        "has_holiday_adjustment": reminder.has_holiday_adjustment,
        "holiday_adjustment_note": reminder.holiday_adjustment_note,
        "has_tail_adjustment": reminder.has_tail_adjustment,
        "tail_adjustments": [
            {
                "id": t.id,
                "amount_diff": t.amount_diff,
                "adjustment_reason": t.adjustment_reason,
                "remark": t.remark,
                "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "created_by": t.created_by,
            }
            for t in reminder.tail_adjustments
        ],
        "supplementary": {
            "why_kept": sup.why_kept if sup else "",
            "missing_materials": sup.missing_materials if sup else "",
            "next_step": sup.next_step.value if sup else "",
            "notes": sup.notes if sup else "",
            "created_at": sup.created_at.strftime("%Y-%m-%d %H:%M:%S") if sup else "",
            "updated_at": sup.updated_at.strftime("%Y-%m-%d %H:%M:%S") if sup else "",
        } if sup else None,
        "audit_logs": [
            {
                "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "operator": a.operator,
                "action": a.action,
                "field_changed": a.field_changed,
                "old_value": str(a.old_value),
                "new_value": str(a.new_value),
                "reason": a.reason,
                "affected_results": a.affected_results,
            }
            for a in reminder.audit_logs
        ],
        "raw_data": reminder.raw_data,
        "import_count": reminder.import_count,
        "last_rerun_at": reminder.last_rerun_at.strftime("%Y-%m-%d %H:%M:%S") if reminder.last_rerun_at else None,
        "created_at": reminder.created_at.strftime("%Y-%m-%d %H:%M:%S"),
    }


class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.storage = Storage()
        self.manager = ReminderManager(self.storage)
        super().__init__(*args, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            self.serve_html()
        elif parsed.path == "/api/reminders":
            self.list_reminders(parsed)
        elif parsed.path.startswith("/api/reminders/"):
            reminder_id = parsed.path.split("/")[-1]
            self.get_reminder(reminder_id)
        elif parsed.path == "/api/stats":
            self.get_stats()
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")

        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}

        if parsed.path == "/api/reminders":
            self.import_reminder(data)
        elif parsed.path.startswith("/api/reminders/") and parsed.path.endswith("/tail"):
            reminder_id = parsed.path.split("/")[-2]
            self.add_tail_adjustment(reminder_id, data)
        elif parsed.path.startswith("/api/reminders/") and parsed.path.endswith("/resolve-alias"):
            reminder_id = parsed.path.split("/")[-2]
            self.resolve_alias(reminder_id, data)
        elif parsed.path.startswith("/api/reminders/") and parsed.path.endswith("/send-to-linjie"):
            reminder_id = parsed.path.split("/")[-2]
            self.send_to_linjie(reminder_id, data)
        elif parsed.path.startswith("/api/reminders/") and parsed.path.endswith("/linjie-confirm"):
            reminder_id = parsed.path.split("/")[-2]
            self.linjie_confirm(reminder_id, data)
        elif parsed.path.startswith("/api/reminders/") and parsed.path.endswith("/rerun"):
            reminder_id = parsed.path.split("/")[-2]
            self.rerun_reminder(reminder_id, data)
        elif parsed.path == "/api/report":
            self.generate_report()
        elif parsed.path == "/api/init-demo":
            self.init_demo()
        else:
            self.send_error(404)

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def serve_html(self):
        html_file = os.path.join(os.path.dirname(__file__), "templates", "dashboard.html")
        if os.path.exists(html_file):
            with open(html_file, "r", encoding="utf-8") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(content.encode("utf-8"))
        else:
            self.send_error(404, "Dashboard template not found")

    def list_reminders(self, parsed):
        params = parse_qs(parsed.query)
        status_filter = params.get("status", [None])[0]

        reminders = self.manager.get_all_reminders()

        if status_filter:
            try:
                status = RecordStatus(status_filter)
                reminders = [r for r in reminders if r.status == status]
            except ValueError:
                pass

        result = [reminder_to_dict(r) for r in reminders]
        self.send_json_response(result)

    def get_reminder(self, reminder_id):
        reminder = self.manager.get_reminder_by_id(reminder_id)
        if not reminder:
            self.send_json_response({"error": "Record not found"}, 404)
            return
        self.send_json_response(reminder_to_dict(reminder))

    def get_stats(self):
        reminders = self.manager.get_all_reminders()
        status_counts = {}
        for r in reminders:
            status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1

        stats = {
            "total": len(reminders),
            "by_status": status_counts,
            "pending_review": len([r for r in reminders if r.has_alias_mismatch]),
            "has_tail_adjustment": len([r for r in reminders if r.has_tail_adjustment]),
            "has_holiday_adjustment": len([r for r in reminders if r.has_holiday_adjustment]),
        }
        self.send_json_response(stats)

    def import_reminder(self, data):
        try:
            reminder = self.manager.import_reminder(
                bond_code=data["bond_code"],
                bond_name=data["bond_name"],
                institution_full_name=data["institution_full_name"],
                institution_alias=data["institution_alias"],
                redemption_date=data["redemption_date"],
                exercise_amount=float(data["exercise_amount"]),
                coupon_rate=float(data["coupon_rate"]),
                source=data.get("source", "Web导入"),
                import_batch=data.get("import_batch", f"BATCH-{datetime.now().strftime('%Y%m%d')}"),
                raw_data=data.get("raw_data", {}),
                operator=data.get("operator", "system"),
            )
            self.send_json_response(reminder_to_dict(reminder), 201)
        except KeyError as e:
            self.send_json_response({"error": f"Missing required field: {e}"}, 400)

    def add_tail_adjustment(self, reminder_id, data):
        tail = self.manager.add_tail_adjustment(
            reminder_id=reminder_id,
            amount_diff=float(data["amount_diff"]),
            adjustment_reason=data["reason"],
            remark=data["remark"],
            operator=data.get("operator", "system"),
        )
        if not tail:
            self.send_json_response({"error": "Record not found"}, 404)
            return

        reminder = self.manager.get_reminder_by_id(reminder_id)
        self.send_json_response(reminder_to_dict(reminder))

    def resolve_alias(self, reminder_id, data):
        reminder = self.manager.resolve_alias_mismatch(
            reminder_id=reminder_id,
            use_standard=data.get("use_standard", True),
            confirmed_alias=data.get("confirmed_alias"),
            reason=data["reason"],
            operator=data.get("operator", "system"),
        )
        if not reminder:
            self.send_json_response({"error": "Record not found or no alias mismatch"}, 404)
            return
        self.send_json_response(reminder_to_dict(reminder))

    def send_to_linjie(self, reminder_id, data):
        reminder = self.manager.send_to_linjie(
            reminder_id=reminder_id,
            message=data["message"],
            operator=data.get("operator", "system"),
        )
        if not reminder:
            self.send_json_response({"error": "Record not found"}, 404)
            return
        self.send_json_response(reminder_to_dict(reminder))

    def linjie_confirm(self, reminder_id, data):
        reminder = self.manager.linjie_confirm(
            reminder_id=reminder_id,
            confirmation=data["confirmation"],
            operator=data.get("operator", "基金会计林姐"),
        )
        if not reminder:
            self.send_json_response({"error": "Record not found"}, 404)
            return
        self.send_json_response(reminder_to_dict(reminder))

    def rerun_reminder(self, reminder_id, data):
        reminder = self.manager.rerun_reminder(
            reminder_id=reminder_id,
            reason=data.get("reason", "人工重跑"),
            operator=data.get("operator", "system"),
        )
        if not reminder:
            self.send_json_response({"error": "Record not found"}, 404)
            return
        self.send_json_response(reminder_to_dict(reminder))

    def generate_report(self):
        report = self.manager.generate_report()
        self.send_json_response({"report": report})

    def init_demo(self):
        from demo_data import setup_demo_data
        setup_demo_data()
        self.send_json_response({"status": "success", "message": "Demo data initialized"})

    def log_message(self, format, *args):
        pass


def main():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), RequestHandler)
    print(f"债券回售提醒核对系统 - Web小看板")
    print(f"服务已启动: http://localhost:{port}")
    print(f"\n可用API:")
    print(f"  GET  /api/reminders          - 列出所有记录")
    print(f"  GET  /api/reminders/<id>     - 查看记录详情")
    print(f"  GET  /api/stats              - 获取统计信息")
    print(f"  POST /api/reminders          - 导入新记录")
    print(f"  POST /api/reminders/<id>/tail - 添加尾差调整")
    print(f"  POST /api/reminders/<id>/resolve-alias - 复核机构简称")
    print(f"  POST /api/init-demo          - 初始化演示数据")
    print(f"\n按 Ctrl+C 停止服务")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()
        sys.exit(0)


if __name__ == "__main__":
    main()
