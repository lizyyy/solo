import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from .core import WebhookSignatureManager, KeyStatus


class WebhookAPIHandler(BaseHTTPRequestHandler):
    manager = None

    def _send_response(self, status_code: int, data: dict):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))

    def _parse_request(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        if body:
            try:
                return json.loads(body)
            except json.JSONDecodeError:
                return {}
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/health':
            self._send_response(200, {"status": "ok", "message": "Webhook 签名服务运行中"})
            return

        if path == '/keys':
            keys = self.manager.list_keys()
            self._send_response(200, {
                "success": True,
                "message": f"共 {len(keys)} 个密钥",
                "keys": keys
            })
            return

        if path == '/report':
            report = self.manager.generate_developer_report()
            self._send_response(200, {
                "success": True,
                "message": "开发者报告生成成功",
                "report": {
                    "总请求数": report.total_requests,
                    "有效签名": report.valid_signatures,
                    "无效签名": report.invalid_signatures,
                    "重放攻击": report.replay_attacks,
                    "幂等冲突": report.idempotent_conflicts,
                    "轮换密钥使用": report.rotated_key_usage,
                    "废弃密钥使用": report.deprecated_key_usage,
                    "最近审计": [
                        {
                            "时间": a.timestamp.isoformat(),
                            "操作": a.action,
                            "状态": a.status,
                            "消息": a.message
                        }
                        for a in report.recent_audits[-10:]
                    ]
                }
            })
            return

        self._send_response(404, {"success": False, "message": "路径不存在"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        data = self._parse_request()

        manager = self.manager

        if path == '/keys/add':
            secret = data.get('secret')
            if not secret:
                self._send_response(400, {"success": False, "message": "缺少 secret 参数"})
                return

            status_map = {
                "active": KeyStatus.ACTIVE,
                "rotating": KeyStatus.ROTATING,
                "deprecated": KeyStatus.DEPRECATED,
                "revoked": KeyStatus.REVOKED
            }
            status = status_map.get(data.get('status', 'active'), KeyStatus.ACTIVE)
            key_id = manager.add_key(secret, status=status, key_id=data.get('key_id'))

            self._send_response(200, {
                "success": True,
                "message": "密钥添加成功",
                "key_id": key_id,
                "status": status.value
            })
            return

        if path == '/keys/rotate':
            old_key_id = data.get('old_key_id')
            new_secret = data.get('new_secret')
            if not old_key_id or not new_secret:
                self._send_response(400, {"success": False, "message": "缺少 old_key_id 或 new_secret 参数"})
                return

            try:
                new_key_id = manager.rotate_key(old_key_id, new_secret)
                self._send_response(200, {
                    "success": True,
                    "message": "密钥轮换成功",
                    "旧密钥": old_key_id,
                    "新密钥": new_key_id,
                    "过渡期（秒）": manager.rotation_grace_seconds
                })
                return
            except ValueError as e:
                self._send_response(400, {"success": False, "message": str(e)})
                return

        if path == '/keys/deprecate':
            key_id = data.get('key_id')
            if not key_id:
                self._send_response(400, {"success": False, "message": "缺少 key_id 参数"})
                return
            try:
                manager.deprecate_key(key_id)
                self._send_response(200, {"success": True, "message": f"密钥 {key_id} 已标记为废弃"})
                return
            except ValueError as e:
                self._send_response(400, {"success": False, "message": str(e)})
                return

        if path == '/keys/revoke':
            key_id = data.get('key_id')
            if not key_id:
                self._send_response(400, {"success": False, "message": "缺少 key_id 参数"})
                return
            try:
                manager.revoke_key(key_id)
                self._send_response(200, {"success": True, "message": f"密钥 {key_id} 已吊销"})
                return
            except ValueError as e:
                self._send_response(400, {"success": False, "message": str(e)})
                return

        if path == '/sign':
            payload = data.get('payload', '')
            key_id = data.get('key_id')
            try:
                result = manager.sign(payload, key_id=key_id)
                self._send_response(200, {
                    "success": True,
                    "message": "签名生成成功",
                    "签名": result['signature'],
                    "时间戳": result['timestamp'],
                    "随机数": result['nonce'],
                    "密钥ID": result['key_id']
                })
                return
            except ValueError as e:
                self._send_response(400, {"success": False, "message": str(e)})
                return

        if path == '/verify':
            signature = data.get('signature')
            payload = data.get('payload', '')
            timestamp = data.get('timestamp')
            nonce = data.get('nonce')

            if not all([signature, timestamp, nonce]):
                self._send_response(400, {"success": False, "message": "缺少必需参数: signature, timestamp, nonce"})
                return

            result = manager.verify(
                signature=signature,
                payload=payload,
                timestamp=timestamp,
                nonce=nonce,
                key_id=data.get('key_id'),
                idempotency_key=data.get('idempotency_key'),
                amount=data.get('amount'),
                quantity=data.get('quantity'),
                slots=data.get('slots')
            )

            status_code = 200 if result.success else 401
            self._send_response(status_code, {
                "success": result.success,
                "状态": result.status.value,
                "密钥ID": result.key_id,
                "业务消息": result.message,
                "详细信息": result.details
            })
            return

        self._send_response(404, {"success": False, "message": "路径不存在"})

    def log_message(self, format, *args):
        pass


def run_server(host: str = 'localhost', port: int = 8080, replay_window: int = 300, rotation_grace: int = 3600):
    manager = WebhookSignatureManager(
        replay_window_seconds=replay_window,
        rotation_grace_seconds=rotation_grace
    )
    WebhookAPIHandler.manager = manager

    server = HTTPServer((host, port), WebhookAPIHandler)
    print(f"🚀 Webhook 签名服务启动中...")
    print(f"📍 地址: http://{host}:{port}")
    print(f"⏱️ 重放窗口: {replay_window} 秒")
    print(f"🔄 轮换过渡期: {rotation_grace} 秒")
    print("")
    print("可用接口:")
    print("  GET  /health       - 健康检查")
    print("  GET  /keys         - 列出所有密钥")
    print("  GET  /report       - 开发者报告")
    print("  POST /keys/add     - 添加密钥")
    print("  POST /keys/rotate  - 密钥轮换")
    print("  POST /keys/deprecate - 废弃密钥")
    print("  POST /keys/revoke  - 吊销密钥")
    print("  POST /sign         - 生成签名")
    print("  POST /verify       - 验证签名")
    print("")
    print("按 Ctrl+C 停止服务")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 服务已停止")
        server.server_close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Webhook 签名轮换 API 服务")
    parser.add_argument("--host", default="localhost", help="监听地址")
    parser.add_argument("--port", type=int, default=8080, help="监听端口")
    parser.add_argument("--replay-window", type=int, default=300, help="重放窗口（秒）")
    parser.add_argument("--rotation-grace", type=int, default=3600, help="轮换过渡期（秒）")

    args = parser.parse_args()
    run_server(args.host, args.port, args.replay_window, args.rotation_grace)
