import logging
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import pandas as pd

logger = logging.getLogger(__name__)


class ReportGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
    
    def generate_all_reports(self, results: List[Dict[str, Any]], stats: Dict[str, int], errors: List[Dict[str, Any]]):
        """生成所有报告"""
        df_all = pd.DataFrame(results)
        
        self.generate_excel_output(df_all)
        self.generate_class_rename_report(df_all[df_all["处理类型"] == "班级改名"])
        self.generate_set_split_report(df_all[df_all["处理类型"] == "套装拆分"])
        self.generate_format_error_report(errors)
        self.generate_text_report(stats, errors)
        
        logger.info("所有报告已生成")
    
    def generate_excel_output(self, df: pd.DataFrame):
        """生成主输出 Excel 文件"""
        output_path = self.output_dir / "处理结果.xlsx"
        
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="全部记录", index=False)
            
            df_normal = df[df["处理类型"].isin(["正常", "班级改名", "套装拆分"])]
            df_normal.to_excel(writer, sheet_name="有效记录", index=False)
            
            pivot = pd.pivot_table(
                df_normal,
                values="缺料数量",
                index=["班级", "画材名称"],
                aggfunc="count",
                fill_value=0
            )
            pivot.to_excel(writer, sheet_name="缺料汇总")
        
        logger.info(f"  主输出文件: {output_path.name}")
    
    def generate_class_rename_report(self, df: pd.DataFrame):
        """生成班级改名报告"""
        output_path = self.output_dir / "班级改名记录.xlsx"
        
        if len(df) > 0:
            df_rename = df[["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]]
            df_rename.to_excel(output_path, index=False)
            logger.info(f"  班级改名报告: {output_path.name} ({len(df)} 条)")
        else:
            pd.DataFrame(columns=["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]).to_excel(output_path, index=False)
            logger.info(f"  班级改名报告: {output_path.name} (无记录)")
    
    def generate_set_split_report(self, df: pd.DataFrame):
        """生成套装拆分报告"""
        output_path = self.output_dir / "套装拆分记录.xlsx"
        
        if len(df) > 0:
            df_split = df[["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]]
            df_split.to_excel(output_path, index=False)
            logger.info(f"  套装拆分报告: {output_path.name} ({len(df)} 条)")
        else:
            pd.DataFrame(columns=["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]).to_excel(output_path, index=False)
            logger.info(f"  套装拆分报告: {output_path.name} (无记录)")
    
    def generate_format_error_report(self, errors: List[Dict[str, Any]]):
        """生成格式错误报告"""
        output_path = self.output_dir / "格式错误记录.xlsx"
        
        if errors:
            df_errors = pd.DataFrame(errors)
            df_errors = df_errors[["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]]
            df_errors.to_excel(output_path, index=False)
            logger.info(f"  格式错误报告: {output_path.name} ({len(errors)} 条)")
        else:
            pd.DataFrame(columns=["来源文件", "学生姓名", "班级", "画材名称", "缺料数量", "备注"]).to_excel(output_path, index=False)
            logger.info(f"  格式错误报告: {output_path.name} (无记录)")
    
    def generate_text_report(self, stats: Dict[str, int], errors: List[Dict[str, Any]]):
        """生成文本统计报告"""
        output_path = self.output_dir / "统计报告.txt"
        
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        content = [
            "=" * 60,
            "美术培训室画材缺料统计报告",
            "=" * 60,
            "",
            f"统计时间: {now}",
            "",
            "-" * 40,
            "一、总体统计",
            "-" * 40,
            f"总记录数: {stats['total_records']}",
            f"正常记录: {stats['normal_records']}",
            f"班级改名记录: {stats['class_renamed']}",
            f"套装拆分记录: {stats['set_split']}",
            f"格式错误记录: {stats['format_errors']}",
            "",
        ]
        
        if errors:
            content.extend([
                "-" * 40,
                "二、格式错误详情",
                "-" * 40,
            ])
            
            for i, err in enumerate(errors, 1):
                content.append(f"{i}. 文件: {err['来源文件']}")
                content.append(f"   学生: {err['学生姓名']}")
                content.append(f"   班级: {err['班级']}")
                content.append(f"   画材: {err['画材名称']}")
                content.append(f"   错误: {err['备注']}")
                content.append("")
        
        content.extend([
            "-" * 40,
            "三、输出文件说明",
            "-" * 40,
            "1. 处理结果.xlsx - 完整处理结果，包含全部记录",
            "2. 班级改名记录.xlsx - 班级改名的记录明细",
            "3. 套装拆分记录.xlsx - 套装拆分的记录明细",
            "4. 格式错误记录.xlsx - 格式错误的记录明细",
            "5. 统计报告.txt - 本统计报告",
            "",
            "=" * 60,
            "报告结束",
            "=" * 60,
        ])
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content))
        
        logger.info(f"  文本统计报告: {output_path.name}")
