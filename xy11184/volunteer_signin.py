#!/usr/bin/env python3
import argparse
import csv
import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional


class SigninRecord:
    def __init__(self, volunteer_id: str, name: str, station: str,
                 signin_time: Optional[datetime] = None,
                 signout_time: Optional[datetime] = None,
                 id_card: Optional[str] = None,
                 phone: Optional[str] = None):
        self.volunteer_id = volunteer_id
        self.name = name
        self.station = station
        self.signin_time = signin_time
        self.signout_time = signout_time
        self.id_card = id_card
        self.phone = phone
        self.issues: List[Dict] = []
        self.valid = True

    def add_issue(self, issue_type: str, reason: str):
        self.issues.append({
            "type": issue_type,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        })
        self.valid = False


class RuleEngine:
    def __init__(self, rules: Dict):
        self.rules = rules

    def check_late(self, record: SigninRecord) -> bool:
        if not record.signin_time:
            return False
        schedule_time = self.rules.get("schedule_time", "08:00")
        schedule_dt = datetime.strptime(schedule_time, "%H:%M").time()
        grace_minutes = self.rules.get("grace_minutes", 15)
        deadline = (datetime.combine(record.signin_time.date(), schedule_dt) + 
                   timedelta(minutes=grace_minutes))
        return record.signin_time > deadline

    def check_early_leave(self, record: SigninRecord) -> bool:
        if not record.signout_time or not record.signin_time:
            return False
        min_hours = self.rules.get("min_service_hours", 4)
        service_time = record.signout_time - record.signin_time
        return service_time.total_seconds() < min_hours * 3600

    def check_proxy_signin(self, record: SigninRecord, all_records: List[SigninRecord]) -> bool:
        if not record.signin_time:
            return False
        for other in all_records:
            if (other.volunteer_id != record.volunteer_id and
                other.signin_time and
                abs((other.signin_time - record.signin_time).total_seconds()) < 60 and
                other.station != record.station):
                return True
        return False

    def apply_rules(self, record: SigninRecord, all_records: List[SigninRecord]):
        if self.check_late(record):
            schedule_time = self.rules.get("schedule_time", "08:00")
            record.add_issue("迟到", f"签到时间 {record.signin_time.strftime('%H:%M')} 晚于规定时间 {schedule_time}")
        if self.check_early_leave(record):
            min_hours = self.rules.get("min_service_hours", 4)
            service_hours = (record.signout_time - record.signin_time).total_seconds() / 3600
            record.add_issue("提前离场", f"服务时长 {service_hours:.1f}小时 少于规定时长 {min_hours}小时")
        if self.check_proxy_signin(record, all_records):
            record.add_issue("代签嫌疑", "同一时间不同签到点有签到记录，可能存在代签")


class VolunteerSigninProcessor:
    def __init__(self, input_dir: str, rules_file: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.rules_file = Path(rules_file)
        self.output_dir = Path(output_dir)
        self.error_log = []
        self.stats = {
            "total_files": 0,
            "processed_files": 0,
            "total_records": 0,
            "valid_records": 0,
            "issues_found": 0
        }

    def load_rules(self) -> Dict:
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def parse_datetime(self, dt_str: str) -> Optional[datetime]:
        if not dt_str or dt_str.strip() == "":
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        return None

    def process_file(self, file_path: Path, rule_engine: RuleEngine) -> List[SigninRecord]:
        records = []
        filename = file_path.name
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                if file_path.suffix == '.csv':
                    reader = csv.DictReader(f)
                    for row_num, row in enumerate(reader, start=2):
                        try:
                            record = SigninRecord(
                                volunteer_id=row.get("志愿者ID", "").strip(),
                                name=row.get("姓名", "").strip(),
                                station=row.get("服务站", "").strip(),
                                signin_time=self.parse_datetime(row.get("签到时间", "")),
                                signout_time=self.parse_datetime(row.get("签退时间", "")),
                                id_card=row.get("身份证号", "").strip(),
                                phone=row.get("联系电话", "").strip()
                            )
                            if not record.volunteer_id or not record.name:
                                raise ValueError("缺少必要字段：志愿者ID或姓名")
                            records.append(record)
                            self.stats["total_records"] += 1
                        except Exception as e:
                            self.error_log.append({
                                "file": filename,
                                "row": row_num,
                                "error": "坏行",
                                "reason": str(e),
                                "data": str(row)
                            })
                else:
                    self.error_log.append({
                        "file": filename,
                        "row": 0,
                        "error": "不支持的文件格式",
                        "reason": f"仅支持CSV文件，跳过 {filename}"
                    })
        except Exception as e:
            self.error_log.append({
                "file": filename,
                "row": 0,
                "error": "文件读取错误",
                "reason": str(e)
            })

        for record in records:
            rule_engine.apply_rules(record, records)
            if record.issues:
                self.stats["issues_found"] += len(record.issues)
            else:
                self.stats["valid_records"] += 1

        return records

    def save_results(self, records: List[SigninRecord]):
        self.output_dir.mkdir(parents=True, exist_ok=True)

        valid_records = [r for r in records if not r.issues]
        invalid_records = [r for r in records if r.issues]

        with open(self.output_dir / "valid_records.csv", 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["志愿者ID", "姓名", "服务站", "签到时间", "签退时间", "身份证号", "联系电话"])
            for r in valid_records:
                writer.writerow([
                    r.volunteer_id, r.name, r.station,
                    r.signin_time.strftime("%Y-%m-%d %H:%M:%S") if r.signin_time else "",
                    r.signout_time.strftime("%Y-%m-%d %H:%M:%S") if r.signout_time else "",
                    r.id_card, r.phone
                ])

        with open(self.output_dir / "issue_records.csv", 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["志愿者ID", "姓名", "服务站", "签到时间", "问题类型", "问题原因"])
            for r in invalid_records:
                for issue in r.issues:
                    writer.writerow([
                        r.volunteer_id, r.name, r.station,
                        r.signin_time.strftime("%Y-%m-%d %H:%M:%S") if r.signin_time else "",
                        issue["type"], issue["reason"]
                    ])

    def save_report(self):
        report = {
            "处理时间": datetime.now().isoformat(),
            "输入目录": str(self.input_dir),
            "输出目录": str(self.output_dir),
            "统计信息": self.stats,
            "错误日志": self.error_log
        }
        
        with open(self.output_dir / "processing_report.json", 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        with open(self.output_dir / "processing_report.txt", 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("      社区志愿者站志愿签到公示处理报告\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"输入目录: {self.input_dir}\n")
            f.write(f"输出目录: {self.output_dir}\n\n")
            f.write("-" * 60 + "\n")
            f.write("统计信息\n")
            f.write("-" * 60 + "\n")
            f.write(f"处理文件数: {self.stats['processed_files']}/{self.stats['total_files']}\n")
            f.write(f"总记录数: {self.stats['total_records']}\n")
            f.write(f"有效记录数: {self.stats['valid_records']}\n")
            f.write(f"发现问题数: {self.stats['issues_found']}\n\n")
            
            if self.error_log:
                f.write("-" * 60 + "\n")
                f.write("错误日志\n")
                f.write("-" * 60 + "\n")
                for err in self.error_log:
                    f.write(f"\n文件: {err['file']}\n")
                    f.write(f"行号: {err['row']}\n")
                    f.write(f"错误: {err['error']}\n")
                    f.write(f"原因: {err['reason']}\n")
            f.write("\n" + "=" * 60 + "\n")

    def run(self, preview: bool = False):
        if preview:
            print("[预览模式] 仅展示将要处理的文件，不生成输出")
            print("=" * 60)

        if not self.input_dir.exists():
            print(f"错误: 输入目录 {self.input_dir} 不存在")
            return

        if not self.rules_file.exists():
            print(f"错误: 规则文件 {self.rules_file} 不存在")
            return

        rules = self.load_rules()
        rule_engine = RuleEngine(rules)

        files = list(self.input_dir.glob("*.csv"))
        self.stats["total_files"] = len(files)

        if not files:
            print("警告: 输入目录为空，没有CSV文件需要处理")
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.save_report()
            return

        all_records = []
        for file_path in files:
            if preview:
                print(f"  - {file_path.name}")
                continue
            print(f"处理中: {file_path.name}")
            records = self.process_file(file_path, rule_engine)
            all_records.extend(records)
            self.stats["processed_files"] += 1

        if not preview:
            self.save_results(all_records)
            self.save_report()
            print(f"\n处理完成！结果已保存到: {self.output_dir}")
            print(f"有效记录: {self.stats['valid_records']}, 问题记录: {len([r for r in all_records if r.issues])}")


def main():
    parser = argparse.ArgumentParser(
        description="社区志愿者站志愿签到公示 CLI - 签到数据审核与公示工具"
    )
    parser.add_argument("-i", "--input", required=True, help="输入目录路径")
    parser.add_argument("-r", "--rules", required=True, help="规则文件路径")
    parser.add_argument("-o", "--output", required=True, help="输出目录路径")
    parser.add_argument("-p", "--preview", action="store_true", help="预览模式，不生成输出")
    
    args = parser.parse_args()
    
    processor = VolunteerSigninProcessor(args.input, args.rules, args.output)
    processor.run(preview=args.preview)


if __name__ == "__main__":
    main()
