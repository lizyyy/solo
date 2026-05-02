import json
import os
from datetime import datetime


class Exporter:
    def export_to_markdown(self, data, output_path):
        lines = []
        lines.append("# 直播导播单\n")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        lines.append("---\n")

        for i, segment in enumerate(data):
            lines.append(f"## 环节 {i + 1}: {segment.get('环节名称', '未命名')}\n")
            lines.append(f"- **开始时间**: {segment.get('开始时间', 'N/A')}\n")
            lines.append(f"- **结束时间**: {segment.get('结束时间', 'N/A')}\n")
            lines.append(f"- **提词卡**: {segment.get('提词卡', '无')}\n")

            if segment.get('备注'):
                lines.append(f"- **彩排备注**: {segment['备注']}\n")

            if segment.get('商品列表'):
                lines.append("\n### 商品列表\n")
                for prod in segment['商品列表']:
                    lines.append(f"- {prod.get('商品名称', '未知')}")
                    lines.append(f"  - 优惠价: {prod.get('优惠价', '未设置')}")
                    lines.append(f"  - 图片: {'有' if prod.get('图片路径') else '缺'}\n")

            if segment.get('问题列表'):
                lines.append("\n### ⚠️ 问题\n")
                for problem in segment['问题列表']:
                    lines.append(f"- {problem}\n")

            lines.append("---\n")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

    def export_problems_to_csv(self, data, output_path):
        import csv

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['环节名称', '开始时间', '结束时间', '问题类型', '问题描述'])

            for segment in data:
                if segment.get('问题列表'):
                    for problem in segment['问题列表']:
                        writer.writerow([
                            segment.get('环节名称', ''),
                            segment.get('开始时间', ''),
                            segment.get('结束时间', ''),
                            self._categorize_problem(problem),
                            problem
                        ])

    def _categorize_problem(self, problem):
        if '时间' in problem:
            return '时间重叠/格式错误'
        elif '缺图' in problem:
            return '商品缺图'
        elif '优惠价' in problem:
            return '优惠价缺失'
        elif '禁用词' in problem:
            return '口播踩禁用词'
        else:
            return '其他'