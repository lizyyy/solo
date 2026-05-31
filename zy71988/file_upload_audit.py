#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from typing import List

from models import MigrationItem, AlarmRecord, InterfaceDoc, AuditLog
from parsers import (
    MigrationListParser,
    AlarmLogParser,
    InterfaceDocParser,
    AuditLogParser,
)
from matcher import AuditMatcher
from report_generator import ReportGenerator


class FileUploadAudit:
    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or "."
        self.migrations: List[MigrationItem] = []
        self.alarms: List[AlarmRecord] = []
        self.docs: List[InterfaceDoc] = []
        self.audit_logs: List[AuditLog] = []
        self.data_sources: List[str] = []

    def load_migrations(self, file_path: str):
        parser = MigrationListParser(file_path)
        items = parser.parse()
        self.migrations.extend(items)
        self.data_sources.append(Path(file_path).name)
        print(f"  加载迁移清单: {len(items)} 条")

    def load_alarms(self, file_path: str):
        parser = AlarmLogParser(file_path)
        records = parser.parse()
        self.alarms.extend(records)
        self.data_sources.append(Path(file_path).name)
        print(f"  加载报警记录: {len(records)} 条")

    def load_docs(self, file_path: str):
        parser = InterfaceDocParser(file_path)
        docs = parser.parse()
        self.docs.extend(docs)
        self.data_sources.append(Path(file_path).name)
        print(f"  加载接口文档: {len(docs)} 条")

    def load_audit_logs(self, file_path: str):
        parser = AuditLogParser(file_path)
        logs = parser.parse()
        self.audit_logs.extend(logs)
        self.data_sources.append(Path(file_path).name)
        print(f"  加载审计日志: {len(logs)} 条")

    def auto_load(self, data_dir: str = None):
        target_dir = Path(data_dir) if data_dir else Path(self.data_dir)
        print(f"从目录自动加载数据: {target_dir}")

        patterns = [
            ('*migration*', '*迁移*', self.load_migrations),
            ('*alarm*', '*报警*', self.load_alarms),
            ('*doc*', '*文档*', self.load_docs),
            ('*audit*', '*审计*', self.load_audit_logs),
        ]

        for pattern1, pattern2, loader in patterns:
            for file_path in target_dir.glob(pattern1):
                if file_path.is_file() and file_path.suffix.lower() in ['.json', '.csv', '.txt', '.md', '.log']:
                    loader(str(file_path))
            for file_path in target_dir.glob(pattern2):
                if file_path.is_file() and file_path.suffix.lower() in ['.json', '.csv', '.txt', '.md', '.log']:
                    loader(str(file_path))

    def analyze(self):
        print("\n开始分析关联关系...")
        matcher = AuditMatcher()
        conclusions = matcher.analyze(
            self.migrations,
            self.alarms,
            self.docs,
            self.audit_logs
        )
        print(f"  生成审计结论: {len(conclusions)} 条")
        return conclusions

    def generate_reports(self, conclusions, output_dir: str = None):
        print("\n生成审计报告...")
        generator = ReportGenerator(conclusions, self.data_sources)
        outputs = generator.generate(output_dir or self.data_dir)

        print("\n生成的报告文件:")
        for name, path in outputs.items():
            print(f"  - [{name.upper()}] {path}")

        return outputs

    def run(self, output_dir: str = None):
        print("=" * 60)
        print("文件上传审计工具")
        print("=" * 60)

        conclusions = self.analyze()
        if not conclusions:
            print("警告: 未生成任何审计结论，请检查输入数据")
            return

        self.generate_reports(conclusions, output_dir)
        print("\n审计完成！")


def main():
    parser = argparse.ArgumentParser(description='文件上传审计工具 - 接口迁移审计追踪')
    parser.add_argument('--migrations', '-m', help='迁移清单文件路径')
    parser.add_argument('--alarms', '-a', help='报警日志文件路径')
    parser.add_argument('--docs', '-d', help='接口文档文件路径')
    parser.add_argument('--audit-logs', '-l', help='审计日志文件路径')
    parser.add_argument('--data-dir', '-D', help='数据目录，自动扫描匹配文件')
    parser.add_argument('--output-dir', '-o', help='输出目录')
    parser.add_argument('--example', action='store_true', help='生成示例数据并运行审计')

    args = parser.parse_args()

    if args.example:
        generate_example_data()
        audit = FileUploadAudit("./example_data")
        audit.auto_load("./example_data")
        audit.run("./example_output")
        return

    if not any([args.migrations, args.alarms, args.docs, args.audit_logs, args.data_dir]):
        parser.print_help()
        print("\n示例:")
        print("  python file_upload_audit.py --example")
        print("  python file_upload_audit.py -D ./data -o ./output")
        print("  python file_upload_audit.py -m migrations.json -a alarms.log")
        return

    audit = FileUploadAudit()

    if args.data_dir:
        audit.auto_load(args.data_dir)

    if args.migrations:
        audit.load_migrations(args.migrations)
    if args.alarms:
        audit.load_alarms(args.alarms)
    if args.docs:
        audit.load_docs(args.docs)
    if args.audit_logs:
        audit.load_audit_logs(args.audit_logs)

    audit.run(args.output_dir)


def generate_example_data():
    import json
    from datetime import datetime, timedelta

    example_dir = Path("./example_data")
    example_dir.mkdir(exist_ok=True)

    migrations = [
        {
            "id": "MIG-001",
            "interface_name": "file_upload_v1",
            "old_endpoint": "/api/v1/upload",
            "new_endpoint": "/api/v2/upload",
            "migration_date": "2024-01-15",
            "status": "已完成",
            "owner": "张三",
            "remarks": "补充迁移文档，完善参数说明"
        },
        {
            "id": "MIG-002",
            "interface_name": "file_download",
            "old_endpoint": "/api/v1/download",
            "new_endpoint": "/api/v2/download",
            "migration_date": "2024-01-16",
            "status": "进行中",
            "owner": "李四",
            "remarks": "修改返回格式，修复编码问题 request_id=abc-123-def"
        },
        {
            "id": "MIG-003",
            "interface_name": "file_delete",
            "old_endpoint": "/api/v1/delete",
            "new_endpoint": "/api/v2/delete",
            "migration_date": "2024-01-17",
            "status": "待审核",
            "owner": "王五",
            "remarks": "幂等键问题待确认 idempotency_key=idemp-999-xyz"
        }
    ]

    with open(example_dir / "migrations.json", 'w', encoding='utf-8') as f:
        json.dump(migrations, f, ensure_ascii=False, indent=2)

    alarms = [
        {
            "timestamp": "2024-01-15T10:30:00",
            "interface_name": "file_upload_v1",
            "error_type": "WARN",
            "message": "Deprecated API usage, please upgrade to v2",
            "request_id": "req-001-abc",
            "idempotency_key": "idemp-001-aaa"
        },
        {
            "timestamp": "2024-01-15T10:35:00",
            "interface_name": "file_upload_v1",
            "error_type": "WARN",
            "message": "Deprecated API usage, please upgrade to v2",
            "request_id": "req-002-abc",
            "idempotency_key": "idemp-999-xyz"
        },
        {
            "timestamp": "2024-01-16T14:20:00",
            "interface_name": "file_download",
            "error_type": "ERROR",
            "message": "Encoding error in response",
            "request_id": "abc-123-def",
            "idempotency_key": "idemp-002-bbb"
        },
        {
            "timestamp": "2024-01-17T09:10:00",
            "interface_name": "file_delete",
            "error_type": "ERROR",
            "message": "Idempotency key validation failed",
            "request_id": "req-003-xyz",
            "idempotency_key": "idemp-999-xyz"
        },
        {
            "timestamp": "2024-01-17T09:15:00",
            "interface_name": "file_delete",
            "error_type": "ERROR",
            "message": "Duplicate request detected",
            "request_id": "req-004-xyz",
            "idempotency_key": "idemp-999-xyz"
        }
    ]

    with open(example_dir / "alarms.json", 'w', encoding='utf-8') as f:
        json.dump(alarms, f, ensure_ascii=False, indent=2)

    docs = """
## file_upload_v1

版本: v1.2
修改时间: 2024-01-14
修改人: 张三
变更说明: 补充参数校验说明，完善文档
端点: /api/v1/upload
手工改动: 是

## file_download

版本: v2.0
修改时间: 2024-01-16
修改人: 李四
变更说明: 修改响应格式，修复编码问题
端点: /api/v2/download

## file_delete

版本: v1.1
修改时间: 2024-01-17
修改人: 王五
变更说明: 修正幂等键处理逻辑
端点: /api/v2/delete
手工改动: 是
"""

    with open(example_dir / "interface_docs.md", 'w', encoding='utf-8') as f:
        f.write(docs)

    audit_logs = [
        {
            "timestamp": "2024-01-15 10:30:00",
            "operation": "file_upload_v1",
            "operator": "system",
            "file_name": "report.pdf",
            "file_size": 1024000,
            "status": "success",
            "request_id": "req-001-abc",
            "idempotency_key": "idemp-001-aaa"
        },
        {
            "timestamp": "2024-01-17 09:10:00",
            "operation": "file_delete",
            "operator": "user001",
            "file_name": "old_data.zip",
            "file_size": 52428800,
            "status": "failed",
            "request_id": "req-003-xyz",
            "idempotency_key": "idemp-999-xyz"
        }
    ]

    with open(example_dir / "audit_logs.json", 'w', encoding='utf-8') as f:
        json.dump(audit_logs, f, ensure_ascii=False, indent=2)

    print(f"示例数据已生成到: {example_dir.absolute()}")


if __name__ == "__main__":
    main()
