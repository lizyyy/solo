#!/usr/bin/env python3
import argparse
import os
import re
import shutil
import json
import hashlib
from datetime import datetime
from pathlib import Path
import pandas as pd


class InvoiceRenamer:
    def __init__(self, args):
        self.image_dir = Path(args.image_dir).resolve()
        self.excel_path = Path(args.excel_file).resolve() if args.excel_file else None
        self.output_dir = Path(args.output_dir).resolve() if args.output_dir else self.image_dir / "output"
        self.dry_run = args.dry_run
        self.verbose = args.verbose
        
        self.results = {
            "summary": {},
            "files": [],
            "errors": [],
            "duplicates": [],
            "missing": []
        }
        
        self._validate_inputs()
        self._setup_output_dirs()

    def _validate_inputs(self):
        if not self.image_dir.exists():
            raise ValueError(f"影像目录不存在: {self.image_dir}")
        
        if self.excel_path and not self.excel_path.exists():
            raise ValueError(f"Excel文件不存在: {self.excel_path}")
        
        image_files = list(self.image_dir.glob("*.*"))
        if not image_files:
            raise ValueError(f"影像目录中没有找到文件: {self.image_dir}")

    def _setup_output_dirs(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.archived_dir = self.output_dir / "archived"
        self.errors_dir = self.output_dir / "errors"
        self.reports_dir = self.output_dir / "reports"
        
        self.archived_dir.mkdir(exist_ok=True)
        self.errors_dir.mkdir(exist_ok=True)
        self.reports_dir.mkdir(exist_ok=True)

    def _parse_filename(self, filename):
        info = {
            "original_name": filename,
            "reimbursement_id": None,
            "invoice_code": None,
            "amount": None,
            "parsed": False
        }
        
        reimburse_pattern = r'(BX\d{8,12})'
        reimburse_matches = re.findall(reimburse_pattern, filename, re.IGNORECASE)
        for match in reimburse_matches:
            match_str = str(match).strip()
            if match_str.startswith(('BX', 'bx', '报销')):
                info["reimbursement_id"] = match_str.upper()
                break
        
        invoice_pattern = r'(\d{10,20})'
        invoice_matches = re.findall(invoice_pattern, filename)
        for match in invoice_matches:
            match_str = str(match).strip()
            if match_str.isdigit() and len(match_str) >= 10:
                info["invoice_code"] = match_str
                break
        
        amount_pattern = r'(?<![0-9])(\d{1,5}[.,]\d{2}|\d{2,4})(?![0-9])'
        amount_matches = re.findall(amount_pattern, filename)
        for match in amount_matches:
            match_str = str(match).strip()
            is_decimal = re.match(r'^\d{1,5}[.,]\d{2}$', match_str)
            is_integer = re.match(r'^\d{2,4}$', match_str) and not re.match(r'^0\d+$', match_str)
            
            if is_decimal or is_integer:
                try:
                    amount = float(match_str.replace(',', ''))
                    if amount > 9 and amount < 100000:
                        info["amount"] = amount
                        break
                except:
                    pass
        
        info["parsed"] = any([info["reimbursement_id"], info["invoice_code"], info["amount"] is not None])
        return info

    def _load_excel_data(self):
        if not self.excel_path:
            return None
            
        try:
            df = pd.read_excel(self.excel_path)
            df.columns = [str(col).strip() for col in df.columns]
            
            column_mapping = {}
            for col in df.columns:
                col_lower = col.lower()
                if any(key in col_lower for key in ['报销', 'reimburse', '单号', 'id', '编号']):
                    column_mapping['reimbursement_id'] = col
                elif any(key in col_lower for key in ['发票', 'invoice', '代码', 'code']):
                    column_mapping['invoice_code'] = col
                elif any(key in col_lower for key in ['金额', 'amount', '钱', 'price']):
                    column_mapping['amount'] = col
            
            if not column_mapping:
                raise ValueError("Excel中未识别到报销单号、发票代码或金额列")
            
            records = []
            for _, row in df.iterrows():
                record = {}
                for key, col in column_mapping.items():
                    val = row.get(col)
                    if pd.notna(val):
                        if key == 'amount':
                            try:
                                record[key] = float(val)
                            except:
                                record[key] = None
                        else:
                            record[key] = str(val).strip()
                    else:
                        record[key] = None
                records.append(record)
            
            return records
        except Exception as e:
            raise ValueError(f"读取Excel失败: {str(e)}")

    def _calculate_file_hash(self, filepath):
        hasher = hashlib.md5()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _detect_duplicates(self, files_info):
        hash_map = {}
        duplicates = []
        
        for file_info in files_info:
            filepath = self.image_dir / file_info["original_name"]
            file_hash = self._calculate_file_hash(filepath)
            
            if file_hash in hash_map:
                duplicates.append({
                    "file1": hash_map[file_hash],
                    "file2": file_info["original_name"],
                    "hash": file_hash
                })
            else:
                hash_map[file_hash] = file_info["original_name"]
        
        return duplicates

    def _normalize_invoice_code(self, code):
        if code is None:
            return None
        return str(code).strip().lstrip('0')
    
    def _match_with_excel(self, file_info, excel_data):
        if not excel_data:
            return None, None
        
        best_match = None
        match_score = 0
        
        file_reimburse = file_info.get("reimbursement_id")
        file_invoice = self._normalize_invoice_code(file_info.get("invoice_code"))
        file_amount = file_info.get("amount")
        
        for record in excel_data:
            score = 0
            rec_reimburse = record.get("reimbursement_id")
            rec_invoice = self._normalize_invoice_code(record.get("invoice_code"))
            rec_amount = record.get("amount")
            
            if file_reimburse and rec_reimburse:
                if file_reimburse == rec_reimburse:
                    score += 3
            if file_invoice and rec_invoice:
                if file_invoice == rec_invoice:
                    score += 2
            if file_amount is not None and rec_amount is not None:
                if abs(file_amount - rec_amount) < 0.01:
                    score += 2
            
            if score > match_score:
                match_score = score
                best_match = record
        
        return best_match, match_score

    def _generate_new_filename(self, file_info, matched_record):
        parts = []
        
        if matched_record and matched_record.get("reimbursement_id"):
            parts.append(matched_record["reimbursement_id"])
        elif file_info.get("reimbursement_id"):
            parts.append(file_info["reimbursement_id"])
        
        if matched_record and matched_record.get("invoice_code"):
            parts.append(matched_record["invoice_code"])
        elif file_info.get("invoice_code"):
            parts.append(file_info["invoice_code"])
        
        if matched_record and matched_record.get("amount") is not None:
            parts.append(f"{matched_record['amount']:.2f}")
        elif file_info.get("amount") is not None:
            parts.append(f"{file_info['amount']:.2f}")
        
        if not parts:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            parts.append(f"UNMATCHED_{timestamp}")
        
        ext = Path(file_info["original_name"]).suffix
        return "_".join(parts) + ext

    def process(self):
        print("\n" + "="*60)
        print("票据影像命名工具 - 开始处理")
        print("="*60)
        
        image_files = [f for f in self.image_dir.iterdir() if f.is_file()]
        print(f"\n找到影像文件: {len(image_files)} 个")
        
        files_info = []
        for f in image_files:
            info = self._parse_filename(f.name)
            info["path"] = str(f)
            files_info.append(info)
        
        parsed_count = sum(1 for fi in files_info if fi["parsed"])
        print(f"成功解析文件名: {parsed_count}/{len(files_info)}")
        
        excel_data = None
        if self.excel_path:
            print(f"\n加载Excel数据...")
            excel_data = self._load_excel_data()
            print(f"Excel记录数: {len(excel_data)}")
        
        print(f"\n检测重复文件...")
        duplicates = self._detect_duplicates(files_info)
        print(f"发现重复文件: {len(duplicates)} 组")
        
        print(f"\n开始匹配与归档...")
        archived = []
        errors = []
        missing_info = []
        
        for file_info in files_info:
            matched_record, score = self._match_with_excel(file_info, excel_data)
            
            result = {
                "original": file_info["original_name"],
                "parsed_info": {k: v for k, v in file_info.items() if k != "path"},
                "matched": matched_record is not None and score > 0,
                "match_score": score,
                "matched_record": matched_record
            }
            
            if matched_record and score >= 2:
                new_filename = self._generate_new_filename(file_info, matched_record)
                result["new_filename"] = new_filename
                
                if not self.dry_run:
                    src = self.image_dir / file_info["original_name"]
                    dst = self.archived_dir / new_filename
                    
                    if dst.exists():
                        base, ext = os.path.splitext(new_filename)
                        counter = 1
                        while dst.exists():
                            dst = self.archived_dir / f"{base}_{counter}{ext}"
                            counter += 1
                    
                    shutil.copy2(src, dst)
                
                archived.append(result)
            elif not file_info["parsed"]:
                result["error"] = "无法从文件名解析任何信息"
                errors.append(result)
                
                if not self.dry_run:
                    src = self.image_dir / file_info["original_name"]
                    dst = self.errors_dir / file_info["original_name"]
                    shutil.copy2(src, dst)
            else:
                missing_info.append(result)
        
        self.results = {
            "summary": {
                "total_files": len(files_info),
                "parsed": parsed_count,
                "archived": len(archived),
                "errors": len(errors),
                "missing_matches": len(missing_info),
                "duplicates": len(duplicates),
                "process_time": datetime.now().isoformat()
            },
            "archived": archived,
            "duplicates": duplicates,
            "errors": errors,
            "missing_matches": missing_info
        }
        
        self._print_summary()
        self._save_json_report()
        self._save_human_report()
        
        print(f"\n处理完成！输出目录: {self.output_dir}")
        print("="*60 + "\n")

    def _print_summary(self):
        print("\n" + "-"*60)
        print("处理摘要")
        print("-"*60)
        print(f"总文件数:     {self.results['summary']['total_files']}")
        print(f"已归档:       {self.results['summary']['archived']}")
        print(f"解析失败:     {self.results['summary']['errors']}")
        print(f"未匹配到Excel:{self.results['summary']['missing_matches']}")
        print(f"重复文件组:   {self.results['summary']['duplicates']}")
        
        if self.results['errors']:
            print("\n解析失败的文件:")
            for err in self.results['errors'][:5]:
                print(f"  - {err['original']}")
            if len(self.results['errors']) > 5:
                print(f"  ... 还有 {len(self.results['errors']) - 5} 个")
        
        if self.results['duplicates']:
            print("\n重复文件:")
            for dup in self.results['duplicates'][:3]:
                print(f"  - {dup['file1']} <-> {dup['file2']}")
            if len(self.results['duplicates']) > 3:
                print(f"  ... 还有 {len(self.results['duplicates']) - 3} 组")

    def _save_json_report(self):
        json_path = self.reports_dir / "results.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"\n机器可读结果已保存: {json_path.name}")

    def _save_human_report(self):
        report_path = self.reports_dir / "归档报告.md"
        
        content = f"""# 票据影像归档报告

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 处理摘要

| 项目 | 数量 |
|------|------|
| 总文件数 | {self.results['summary']['total_files']} |
| 成功归档 | {self.results['summary']['archived']} |
| 解析失败 | {self.results['summary']['errors']} |
| 未匹配记录 | {self.results['summary']['missing_matches']} |
| 重复文件组 | {self.results['summary']['duplicates']} |

---

## 已归档文件清单

"""
        if self.results['archived']:
            content += "| 原文件名 | 新文件名 | 匹配得分 | 匹配信息 |\n"
            content += "|----------|----------|----------|----------|\n"
            for item in self.results['archived']:
                match_info = ""
                if item.get('matched_record'):
                    parts = []
                    if item['matched_record'].get('reimbursement_id'):
                        parts.append(f"报销:{item['matched_record']['reimbursement_id']}")
                    if item['matched_record'].get('amount'):
                        parts.append(f"金额:{item['matched_record']['amount']}")
                    match_info = " ".join(parts)
                
                content += f"| {item['original']} | {item.get('new_filename', '')} | {item['match_score']} | {match_info} |\n"
        else:
            content += "无\n"

        content += "\n---\n\n## 解析失败的文件（保留在 errors 目录）\n\n"
        if self.results['errors']:
            for err in self.results['errors']:
                content += f"- `{err['original']}`: {err.get('error', '未知错误')}\n"
        else:
            content += "无\n"

        content += "\n---\n\n## 未匹配到Excel记录的文件\n\n"
        if self.results['missing_matches']:
            for item in self.results['missing_matches']:
                parts = []
                if item['parsed_info'].get('reimbursement_id'):
                    parts.append(f"报销:{item['parsed_info']['reimbursement_id']}")
                if item['parsed_info'].get('invoice_code'):
                    parts.append(f"发票:{item['parsed_info']['invoice_code']}")
                if item['parsed_info'].get('amount'):
                    parts.append(f"金额:{item['parsed_info']['amount']}")
                info = ", ".join(parts) if parts else "无解析信息"
                content += f"- `{item['original']}`: {info}\n"
        else:
            content += "无\n"

        content += "\n---\n\n## 重复文件检测\n\n"
        if self.results['duplicates']:
            for i, dup in enumerate(self.results['duplicates'], 1):
                content += f"### 第 {i} 组 (MD5: {dup['hash'][:8]}...)\n"
                content += f"- `{dup['file1']}`\n"
                content += f"- `{dup['file2']}`\n\n"
        else:
            content += "无\n"

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"归档报告已保存: {report_path.name}")


def main():
    parser = argparse.ArgumentParser(
        description="票据影像命名工具 - 自动解析文件名、比对Excel、归档整理",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python invoice_renamer.py --image-dir ./scans --excel-file 报销单.xlsx
  python invoice_renamer.py --image-dir ./scans --output-dir ./result --dry-run
  python invoice_renamer.py -i ./scans -e 报销记录.xlsx -v
        """
    )
    
    parser.add_argument(
        "-i", "--image-dir",
        required=True,
        help="影像文件所在目录（必填）"
    )
    
    parser.add_argument(
        "-e", "--excel-file",
        help="报销单Excel文件路径（含报销单号、发票代码、金额列）"
    )
    
    parser.add_argument(
        "-o", "--output-dir",
        help="输出目录（默认: 影像目录/output）"
    )
    
    parser.add_argument(
        "-n", "--dry-run",
        action="store_true",
        help="试运行模式，不实际复制文件"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="显示详细处理信息"
    )
    
    args = parser.parse_args()
    
    try:
        renamer = InvoiceRenamer(args)
        renamer.process()
    except ValueError as e:
        print(f"\n❌ 错误: {e}")
        print("\n请检查输入参数后重试。使用 -h 查看帮助信息。")
        exit(1)
    except Exception as e:
        print(f"\n❌ 发生未知错误: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    main()
