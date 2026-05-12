import os
import json
from pathlib import Path
from typing import Dict, Any


class SampleDataGenerator:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)

    def _create_version_file(self, project_dir: Path, data: Dict[str, Any]):
        version_file = project_dir / "version_info.json"
        version_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def create_passing_scenario(self):
        """创建通过检查的样例"""
        project_dir = self.base_dir / "sample_passing"
        project_dir.mkdir(parents=True, exist_ok=True)

        (project_dir / "投标报价单_v2.0.xlsx").touch()
        (project_dir / "报价汇总表_v2.0.xlsx").touch()
        (project_dir / "营业执照.pdf").touch()
        (project_dir / "资质证书_2024.pdf").touch()
        (project_dir / "法人授权委托书.pdf").touch()
        (project_dir / "投标文件盖章页_已盖章.pdf").touch()
        (project_dir / "版本说明文档.md").touch()
        (project_dir / "技术方案.docx").touch()

        self._create_version_file(project_dir, {
            "versions": [
                {
                    "version": "2.0",
                    "date": "2024-12-01",
                    "author": "张三",
                    "changes": [
                        "更新报价金额",
                        "补充资质证书"
                    ]
                },
                {
                    "version": "1.0",
                    "date": "2024-11-15",
                    "author": "李四",
                    "changes": [
                        "初稿完成"
                    ]
                }
            ]
        })

        return str(project_dir)

    def create_missing_scenario(self):
        """创建缺少材料的样例"""
        project_dir = self.base_dir / "sample_missing"
        project_dir.mkdir(parents=True, exist_ok=True)

        (project_dir / "投标报价单_v2.0.xlsx").touch()
        (project_dir / "报价汇总表_v2.0.xlsx").touch()
        (project_dir / "营业执照.pdf").touch()
        (project_dir / "资质证书_2024.pdf").touch()
        (project_dir / "技术方案.docx").touch()

        self._create_version_file(project_dir, {
            "versions": [
                {
                    "version": "1.0",
                    "date": "2024-11-15",
                    "author": "王五",
                    "changes": ["初稿"]
                }
            ]
        })

        return str(project_dir)

    def create_old_version_scenario(self):
        """创建包含旧版本文件的样例"""
        project_dir = self.base_dir / "sample_old_version"
        project_dir.mkdir(parents=True, exist_ok=True)

        (project_dir / "投标报价单_v2.0.xlsx").touch()
        (project_dir / "投标报价单_旧版_v1.0.xlsx").touch()
        (project_dir / "报价汇总表_v2.0.xlsx").touch()
        (project_dir / "营业执照.pdf").touch()
        (project_dir / "资质证书_2024.pdf").touch()
        (project_dir / "法人授权委托书.pdf").touch()
        (project_dir / "投标文件盖章页.pdf").touch()
        (project_dir / "版本说明文档.md").touch()

        self._create_version_file(project_dir, {
            "versions": [
                {
                    "version": "2.0",
                    "date": "2024-12-01",
                    "author": "赵六",
                    "changes": ["更新报价"]
                }
            ]
        })

        return str(project_dir)

    def create_amount_mismatch_scenario(self):
        """创建金额不一致的样例"""
        project_dir = self.base_dir / "sample_amount_mismatch"
        project_dir.mkdir(parents=True, exist_ok=True)

        try:
            from openpyxl import Workbook

            wb1 = Workbook()
            ws1 = wb1.active
            ws1['A1'] = "投标报价单"
            ws1['A2'] = "合计金额"
            ws1['B2'] = "￥500,000.00 元"
            wb1.save(project_dir / "投标报价单_v2.0.xlsx")

            wb2 = Workbook()
            ws2 = wb2.active
            ws2['A1'] = "报价汇总表"
            ws2['A2'] = "总计"
            ws2['B2'] = "￥480,000.00 元"
            wb2.save(project_dir / "报价汇总表_v2.0.xlsx")
        except ImportError:
            (project_dir / "投标报价单_v2.0.xlsx").touch()
            (project_dir / "报价汇总表_v2.0.xlsx").touch()

        (project_dir / "营业执照.pdf").touch()
        (project_dir / "资质证书_2024.pdf").touch()
        (project_dir / "法人授权委托书.pdf").touch()
        (project_dir / "投标文件盖章页_已盖章.pdf").touch()
        (project_dir / "版本说明文档.md").touch()

        self._create_version_file(project_dir, {
            "versions": [
                {
                    "version": "2.0",
                    "date": "2024-12-01",
                    "author": "钱七",
                    "changes": ["价格调整"]
                }
            ]
        })

        return str(project_dir)

    def create_all_samples(self):
        """创建所有样例"""
        return {
            "passing": self.create_passing_scenario(),
            "missing": self.create_missing_scenario(),
            "old_version": self.create_old_version_scenario(),
            "amount_mismatch": self.create_amount_mismatch_scenario()
        }
