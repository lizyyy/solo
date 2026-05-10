import argparse
import json
import sys
from typing import Optional

from .core import WebhookSignatureManager, KeyStatus, SignatureStatus


def _format_result(result, show_details: bool = True) -> str:
    lines = []
    lines.append(f"状态: {'✅ 成功' if result.success else '❌ 失败'}")
    lines.append(f"结果类型: {result.status.value}")
    lines.append(f"密钥ID: {result.key_id or '无'}")
    lines.append(f"业务消息: {result.message}")
    
    if show_details and result.details:
        lines.append("详细信息:")
        for key, value in result.details.items():
            lines.append(f"  - {key}: {value}")
    
    return "\n".join(lines)


def _format_report(report) -> str:
    lines = []
    lines.append("=" * 50)
    lines.append("           📊 开发者报告")
    lines.append("=" * 50)
    lines.append(f"总请求数: {report.total_requests}")
    lines.append(f"有效签名: {report.valid_signatures}")
    lines.append(f"无效签名: {report.invalid_signatures}")
    lines.append(f"重放攻击: {report.replay_attacks}")
    lines.append(f"幂等冲突: {report.idempotent_conflicts}")
    lines.append(f"轮换密钥使用: {report.rotated_key_usage}")
    lines.append(f"废弃密钥使用: {report.deprecated_key_usage}")
    
    if report.recent_audits:
        lines.append("")
        lines.append("最近审计日志:")
        lines.append("-" * 50)
        for audit in report.recent_audits[-5:]:
            status_icon = "✅" if audit.status == "success" else ("⚠️" if audit.status == "warning" else "❌")
            lines.append(f"{status_icon} [{audit.timestamp.strftime('%H:%M:%S')}] {audit.action}: {audit.message}")
    
    return "\n".join(lines)


def _format_keys(keys) -> str:
    if not keys:
        return "暂无密钥"
    
    lines = []
    lines.append("=" * 50)
    lines.append("           🔑 密钥列表")
    lines.append("=" * 50)
    
    status_icons = {
        "active": "🟢",
        "rotating": "🟡",
        "deprecated": "🟠",
        "revoked": "🔴"
    }
    
    for key in keys:
        icon = status_icons.get(key["status"], "⚪")
        lines.append(f"{icon} 密钥ID: {key['key_id']}")
        lines.append(f"   状态: {key['status']}")
        lines.append(f"   创建时间: {key['created_at']}")
        if key['expires_at']:
            lines.append(f"   过期时间: {key['expires_at']}")
        lines.append("")
    
    return "\n".join(lines)


def cmd_add_key(args, manager: WebhookSignatureManager):
    status_map = {
        "active": KeyStatus.ACTIVE,
        "rotating": KeyStatus.ROTATING,
        "deprecated": KeyStatus.DEPRECATED,
        "revoked": KeyStatus.REVOKED
    }
    status = status_map.get(args.status, KeyStatus.ACTIVE)
    key_id = manager.add_key(args.secret, status=status, key_id=args.key_id)
    print(f"✅ 密钥添加成功")
    print(f"密钥ID: {key_id}")
    print(f"状态: {status.value}")


def cmd_rotate_key(args, manager: WebhookSignatureManager):
    new_key_id = manager.rotate_key(args.old_key_id, args.new_secret)
    print(f"✅ 密钥轮换成功")
    print(f"旧密钥: {args.old_key_id} → 状态: 轮换中")
    print(f"新密钥: {new_key_id} → 状态: 激活")
    print(f"过渡期: {manager.rotation_grace_seconds} 秒")


def cmd_deprecate_key(args, manager: WebhookSignatureManager):
    manager.deprecate_key(args.key_id)
    print(f"✅ 密钥 {args.key_id} 已标记为废弃")


def cmd_revoke_key(args, manager: WebhookSignatureManager):
    manager.revoke_key(args.key_id)
    print(f"✅ 密钥 {args.key_id} 已吊销")


def cmd_list_keys(args, manager: WebhookSignatureManager):
    keys = manager.list_keys()
    print(_format_keys(keys))


def cmd_sign(args, manager: WebhookSignatureManager):
    payload = args.payload
    if args.payload_file:
        with open(args.payload_file, 'r', encoding='utf-8') as f:
            payload = f.read()
    
    result = manager.sign(payload, key_id=args.key_id)
    
    print("✅ 签名生成成功")
    print(f"密钥ID: {result['key_id']}")
    print(f"时间戳: {result['timestamp']}")
    print(f"随机数: {result['nonce']}")
    print(f"签名: {result['signature']}")
    
    if args.output_json:
        print("\nJSON 输出:")
        print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_verify(args, manager: WebhookSignatureManager):
    payload = args.payload
    if args.payload_file:
        with open(args.payload_file, 'r', encoding='utf-8') as f:
            payload = f.read()
    
    result = manager.verify(
        signature=args.signature,
        payload=payload,
        timestamp=args.timestamp,
        nonce=args.nonce,
        key_id=args.key_id,
        idempotency_key=args.idempotency_key,
        amount=args.amount,
        quantity=args.quantity,
        slots=args.slots
    )
    
    print(_format_result(result))
    
    if args.output_json:
        output = {
            "success": result.success,
            "status": result.status.value,
            "key_id": result.key_id,
            "message": result.message,
            "details": result.details
        }
        print("\nJSON 输出:")
        print(json.dumps(output, ensure_ascii=False, indent=2))


def cmd_report(args, manager: WebhookSignatureManager):
    report = manager.generate_developer_report()
    print(_format_report(report))


def main():
    parser = argparse.ArgumentParser(
        description="🔐 Webhook 签名轮换 API 工具 - 安全的签名验证与密钥轮换管理",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 添加密钥
  webhook-signer add-key --secret "my_secret_123" --key-id "key_2024"
  
  # 签名
  webhook-signer sign --payload '{"amount": 100}'
  
  # 验证签名
  webhook-signer verify --signature "xxx" --payload '{"amount": 100}' --timestamp "1234567890" --nonce "abc123"
  
  # 密钥轮换
  webhook-signer rotate-key --old-key-id "key_2024" --new-secret "new_secret_456"
  
  # 生成开发者报告
  webhook-signer report
        """
    )
    
    parser.add_argument(
        "--replay-window",
        type=int,
        default=300,
        help="重放攻击检测窗口（秒），默认 300 秒"
    )
    parser.add_argument(
        "--rotation-grace",
        type=int,
        default=3600,
        help="密钥轮换过渡期（秒），默认 3600 秒（1小时）"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    add_parser = subparsers.add_parser("add-key", help="添加新的签名密钥")
    add_parser.add_argument("--secret", required=True, help="密钥内容")
    add_parser.add_argument("--key-id", help="指定密钥ID（不指定则自动生成）")
    add_parser.add_argument("--status", default="active", choices=["active", "rotating", "deprecated", "revoked"], help="密钥状态")
    add_parser.set_defaults(func=cmd_add_key)
    
    rotate_parser = subparsers.add_parser("rotate-key", help="执行密钥轮换")
    rotate_parser.add_argument("--old-key-id", required=True, help="旧密钥ID")
    rotate_parser.add_argument("--new-secret", required=True, help="新密钥内容")
    rotate_parser.set_defaults(func=cmd_rotate_key)
    
    deprecate_parser = subparsers.add_parser("deprecate-key", help="标记密钥为废弃")
    deprecate_parser.add_argument("--key-id", required=True, help="密钥ID")
    deprecate_parser.set_defaults(func=cmd_deprecate_key)
    
    revoke_parser = subparsers.add_parser("revoke-key", help="立即吊销密钥")
    revoke_parser.add_argument("--key-id", required=True, help="密钥ID")
    revoke_parser.set_defaults(func=cmd_revoke_key)
    
    list_parser = subparsers.add_parser("list-keys", help="列出所有密钥")
    list_parser.set_defaults(func=cmd_list_keys)
    
    sign_parser = subparsers.add_parser("sign", help="生成签名")
    sign_parser.add_argument("--payload", default="", help="请求体内容")
    sign_parser.add_argument("--payload-file", help="从文件读取请求体")
    sign_parser.add_argument("--key-id", help="指定使用的密钥ID")
    sign_parser.add_argument("--output-json", action="store_true", help="输出JSON格式")
    sign_parser.set_defaults(func=cmd_sign)
    
    verify_parser = subparsers.add_parser("verify", help="验证签名")
    verify_parser.add_argument("--signature", required=True, help="待验证的签名")
    verify_parser.add_argument("--payload", default="", help="请求体内容")
    verify_parser.add_argument("--payload-file", help="从文件读取请求体")
    verify_parser.add_argument("--timestamp", required=True, help="请求时间戳")
    verify_parser.add_argument("--nonce", required=True, help="请求随机数")
    verify_parser.add_argument("--key-id", help="指定验证的密钥ID")
    verify_parser.add_argument("--idempotency-key", help="幂等键（用于重复请求检测）")
    verify_parser.add_argument("--amount", type=float, help="交易金额（用于幂等口径校验）")
    verify_parser.add_argument("--quantity", type=int, help="商品数量（用于幂等口径校验）")
    verify_parser.add_argument("--slots", type=int, help="名额数量（用于幂等口径校验）")
    verify_parser.add_argument("--output-json", action="store_true", help="输出JSON格式")
    verify_parser.set_defaults(func=cmd_verify)
    
    report_parser = subparsers.add_parser("report", help="生成开发者报告")
    report_parser.set_defaults(func=cmd_report)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    manager = WebhookSignatureManager(
        replay_window_seconds=args.replay_window,
        rotation_grace_seconds=args.rotation_grace
    )
    
    if hasattr(args, 'func'):
        args.func(args, manager)


if __name__ == "__main__":
    main()
