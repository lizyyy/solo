from pathlib import Path
from datetime import datetime, timedelta
import random
import json
from .config import DATA_DIR


class DemoDataGenerator:
    def __init__(self):
        self.approvers = ["张三", "李四", "王五", "赵六", "钱七", "孙八"]
        self.departments = ["技术部", "产品部", "运营部", "市场部", "财务部", "人事部"]
        self.request_types = ["报销申请", "请假申请", "采购申请", "出差申请", "合同审批", "预算审批"]

    def generate_approval_reminder(self, index: int, is_dirty: bool = False) -> dict:
        days_overdue = random.randint(1, 30)
        submit_date = datetime.now() - timedelta(days=days_overdue + random.randint(1, 5))
        due_date = submit_date + timedelta(days=random.randint(1, 3))

        data = {
            "approval_id": f"AP{2024:04d}{index:05d}",
            "title": f"{random.choice(self.request_types)}-{random.choice(self.departments)}",
            "applicant": random.choice(self.approvers),
            "department": random.choice(self.departments),
            "current_approver": random.choice(self.approvers),
            "submit_time": submit_date.strftime("%Y-%m-%d %H:%M:%S"),
            "due_time": due_date.strftime("%Y-%m-%d %H:%M:%S"),
            "days_overdue": days_overdue,
            "priority": random.choice(["高", "中", "低"]),
            "amount": round(random.uniform(100, 50000), 2) if random.random() > 0.3 else None,
            "status": "待审批"
        }

        if is_dirty:
            data = self._inject_anomaly(data, index)

        return data

    def _inject_anomaly(self, data: dict, index: int) -> dict:
        anomaly_type = index % 5

        if anomaly_type == 0:
            data["merge_error"] = True
            data["merged_from"] = [f"AP{2024:04d}{index + i:05d}" for i in range(3)]
            data["status"] = "异常-合并错误"
            data["title"] = data["title"] + " [被错误合并]"
            data["error_note"] = "多条审批记录被系统错误合并为一条"

        elif anomaly_type == 1:
            data["encoding_corrupted"] = True
            data["current_approver"] = "�����"
            data["applicant"] = "����"
            data["error_note"] = "人员姓名显示为乱码，疑似编码错误"

        elif anomaly_type == 2:
            data["duplicate_record"] = True
            data["original_id"] = f"AP{2024:04d}{index - 5:05d}"
            data["status"] = "异常-重复记录"
            data["error_note"] = "与历史审批记录重复，可能是数据迁移时重复导入"

        elif anomaly_type == 3:
            data["field_mismatch"] = True
            data["submit_time"] = "2024-13-45 25:70:99"
            data["days_overdue"] = -999
            data["error_note"] = "日期字段格式异常，逾期天数为负数"

        elif anomaly_type == 4:
            data["missing_fields"] = True
            data["current_approver"] = None
            data["department"] = ""
            data["status"] = "异常-信息缺失"
            data["error_note"] = "关键审批信息缺失，无法继续流转"

        return data

    def generate_demo_files(self, count: int = 50):
        normal_count = int(count * 0.7)
        dirty_count = count - normal_count

        normal_data = []
        dirty_data = []

        for i in range(normal_count):
            normal_data.append(self.generate_approval_reminder(i, is_dirty=False))

        for i in range(normal_count, count):
            dirty_data.append(self.generate_approval_reminder(i, is_dirty=True))

        all_data = normal_data + dirty_data
        random.shuffle(all_data)

        self._save_as_utf8(DATA_DIR / "approval_reminder_utf8.txt", normal_data[:20])
        self._save_as_gbk(DATA_DIR / "approval_reminder_gbk.txt", normal_data[20:35])
        self._save_with_mixed_encoding(DATA_DIR / "approval_reminder_mixed.txt", all_data[:15])
        self._save_as_gbk_with_errors(DATA_DIR / "approval_reminder_dirty.txt", dirty_data)
        self._save_as_latin1_corrupted(DATA_DIR / "approval_reminder_corrupted.txt", dirty_data[:5])

        return {
            "total_files": 5,
            "normal_count": normal_count,
            "dirty_count": dirty_count,
            "files": [
                {"name": "approval_reminder_utf8.txt", "encoding": "utf-8", "count": 20},
                {"name": "approval_reminder_gbk.txt", "encoding": "gbk", "count": 15},
                {"name": "approval_reminder_mixed.txt", "encoding": "mixed", "count": 15, "note": "混合编码样本"},
                {"name": "approval_reminder_dirty.txt", "encoding": "gbk", "count": dirty_count, "note": "含异常数据"},
                {"name": "approval_reminder_corrupted.txt", "encoding": "latin1", "count": 5, "note": "编码损坏样本"}
            ]
        }

    def _save_as_utf8(self, file_path: Path, data: list):
        content = "过期审批催办列表\n"
        content += "=" * 80 + "\n"
        content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        content += f"记录数: {len(data)}\n\n"

        for item in data:
            content += self._format_record(item) + "\n"

        file_path.write_text(content, encoding="utf-8")

    def _save_as_gbk(self, file_path: Path, data: list):
        content = "过期审批催办列表\n"
        content += "=" * 80 + "\n"
        content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        content += f"记录数: {len(data)}\n\n"

        for item in data:
            content += self._format_record(item) + "\n"

        file_path.write_text(content, encoding="gbk", errors="replace")

    def _save_with_mixed_encoding(self, file_path: Path, data: list):
        content = "过期审批催办列表\n"
        content += "=" * 80 + "\n"
        content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        with open(file_path, "wb") as f:
            f.write(content.encode("utf-8"))

            for i, item in enumerate(data):
                record = self._format_record(item) + "\n"
                if i % 2 == 0:
                    f.write(record.encode("utf-8"))
                else:
                    f.write(record.encode("gbk", errors="replace"))

    def _save_as_gbk_with_errors(self, file_path: Path, data: list):
        content = "过期审批催办列表（含异常数据）\n"
        content += "=" * 80 + "\n"
        content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        content += f"异常记录数: {len(data)}\n\n"

        for item in data:
            content += self._format_record(item) + "\n"
            if "error_note" in item:
                content += f"  异常说明: {item['error_note']}\n"

        file_path.write_text(content, encoding="gbk", errors="replace")

    def _save_as_latin1_corrupted(self, file_path: Path, data: list):
        content = "过期审批催办列表\n"
        for item in data:
            content += json.dumps(item, ensure_ascii=False) + "\n"

        content_bytes = content.encode("utf-8")
        corrupted = bytes([b ^ 0xFF if i % 10 == 0 else b for i, b in enumerate(content_bytes)])
        file_path.write_bytes(corrupted)

    def _format_record(self, record: dict) -> str:
        lines = [
            f"审批ID: {record['approval_id']}",
            f"标题: {record['title']}",
            f"申请人: {record['applicant']}",
            f"部门: {record['department']}",
            f"当前审批人: {record['current_approver']}",
            f"提交时间: {record['submit_time']}",
            f"应完成时间: {record['due_time']}",
            f"逾期天数: {record['days_overdue']}天",
            f"优先级: {record['priority']}",
            f"状态: {record['status']}"
        ]
        if record.get('amount'):
            lines.append(f"金额: RMB{record['amount']:,.2f}")
        return " | ".join(lines)
