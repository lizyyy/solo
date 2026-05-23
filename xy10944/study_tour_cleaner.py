#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
from datetime import datetime
from pathlib import Path
import pandas as pd


class ColumnMapper:
    STANDARD_FIELDS = {
        'student_name': ['姓名', '学生姓名', '名字', '学员姓名', 'Student Name'],
        'passport': ['护照号', '护照号码', '证件号', '护照', 'Passport', 'passport', '证件号码'],
        'guardian_phone': ['监护人电话', '家长电话', '监护人手机', '联系电话', '家长手机', '联系方式', '电话'],
        'dietary_restriction': ['饮食禁忌', '忌口', '饮食偏好', '过敏食物', '饮食注意', '忌口食物'],
        'age': ['年龄', 'Age'],
        'gender': ['性别', 'Gender'],
        'grade': ['年级', '班级', 'Grade'],
        'school': ['学校', 'School'],
        'guardian_name': ['监护人姓名', '家长姓名', '监护人'],
        'registration_date': ['报名日期', '注册日期', '日期'],
        'tour_program': ['游学项目', '项目', '线路', 'Program'],
        'teacher': ['负责老师', '提交老师', '老师', 'Teacher']
    }

    @classmethod
    def map_columns(cls, df_columns):
        mapping = {}
        for col in df_columns:
            col_str = str(col).strip()
            best_match = None
            best_match_len = 0
            for std_field, possible_names in cls.STANDARD_FIELDS.items():
                if col_str in possible_names:
                    mapping[col] = std_field
                    break
                for pn in possible_names:
                    if pn in col_str and len(pn) > best_match_len:
                        best_match = std_field
                        best_match_len = len(pn)
            else:
                if best_match and col not in mapping:
                    mapping[col] = best_match
        return mapping

    @classmethod
    def get_missing_fields(cls, used_fields):
        required = ['student_name', 'passport', 'guardian_phone']
        return [f for f in required if f not in used_fields]


class DataCleaner:
    @staticmethod
    def clean_passport(value):
        if pd.isna(value) or value is None:
            return '', '空值'
        s = str(value).strip().upper()
        s = re.sub(r'[\s\-_]+', '', s)
        if not s:
            return '', '空值'
        if re.match(r'^[A-Z][0-9]{8}$', s):
            return s, '正常'
        elif re.match(r'^[A-Z0-9]{6,12}$', s):
            return s, '格式可疑'
        else:
            return s, '格式异常'

    @staticmethod
    def clean_phone(value):
        if pd.isna(value) or value is None:
            return '', '空值'
        s = str(value).strip()
        s = re.sub(r'[\s\-\(\)\+]+', '', s)
        if not s:
            return '', '空值'
        if s.startswith('86'):
            s = s[2:]
        if s.startswith('+86'):
            s = s[3:]
        if re.match(r'^1[3-9]\d{9}$', s):
            return s, '正常'
        elif re.match(r'^\d{7,15}$', s):
            return s, '格式可疑'
        else:
            return s, '格式异常'

    @staticmethod
    def clean_dietary(value):
        if pd.isna(value) or value is None or str(value).strip() in ['', '无', '没有', 'none', 'None', '無']:
            return '无', '正常'
        s = str(value).strip()
        items = re.split(r'[，,、；;/\n]+', s)
        items = [item.strip() for item in items if item.strip()]
        standardized = []
        allergy_map = {
            '海鲜': ['虾', '蟹', '海鲜', '海鮮', 'shellfish', 'seafood'],
            '花生': ['花生', 'peanut'],
            '坚果': ['坚果', '核桃', '杏仁', '腰果', 'nut'],
            '牛奶': ['牛奶', '奶', 'milk', ' dairy'],
            '鸡蛋': ['鸡蛋', '蛋', 'egg'],
            '麸质': ['麸质', '面筋', 'gluten', '小麦'],
            '辛辣': ['辣', '辛辣', 'spicy'],
            '猪肉': ['猪肉', 'pork'],
            '牛肉': ['牛肉', 'beef'],
            '羊肉': ['羊肉', 'lamb', '羊肉'],
            '素食': ['素食', '素', 'vegetarian', 'vegan']
        }
        for item in items:
            item_lower = item.lower()
            matched = False
            for std_name, keywords in allergy_map.items():
                if any(kw in item_lower or kw in item for kw in keywords):
                    if std_name not in standardized:
                        standardized.append(std_name)
                    matched = True
                    break
            if not matched and item not in standardized:
                standardized.append(item)
        if standardized:
            return '、'.join(standardized), '标准化'
        return '无', '正常'


class RegistrationCleaner:
    def __init__(self, input_path, output_dir, config=None):
        self.input_path = Path(input_path)
        self.output_dir = Path(output_dir)
        self.config = config or {}
        self.df_raw = None
        self.df_cleaned = None
        self.df_errors = None
        self.report = {
            'input_file': str(input_path),
            'start_time': datetime.now().isoformat(),
            'summary': {},
            'field_issues': {},
            'duplicates': [],
            'error_rows': []
        }
        self.column_mapping = {}
        self.row_mapping = {}

    def validate_input(self):
        if not self.input_path.exists():
            raise FileNotFoundError(f"输入文件不存在: {self.input_path}")
        suffix = self.input_path.suffix.lower()
        if suffix not in ['.xlsx', '.xls', '.csv']:
            raise ValueError(f"不支持的文件格式: {suffix}，仅支持 Excel (.xlsx, .xls) 和 CSV (.csv)")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        return True

    def load_data(self):
        suffix = self.input_path.suffix.lower()
        if suffix in ['.xlsx', '.xls']:
            self.df_raw = pd.read_excel(self.input_path, dtype=str)
        else:
            self.df_raw = pd.read_csv(self.input_path, dtype=str, encoding='utf-8-sig')
        self.report['summary']['total_rows'] = len(self.df_raw)
        self.report['summary']['columns'] = list(self.df_raw.columns.tolist())
        return True

    def map_columns(self):
        self.column_mapping = ColumnMapper.map_columns(self.df_raw.columns)
        mapped_fields = list(set(self.column_mapping.values()))
        missing = ColumnMapper.get_missing_fields(mapped_fields)
        self.report['summary']['mapped_columns'] = self.column_mapping
        self.report['summary']['missing_required_fields'] = missing
        return missing

    def process_rows(self):
        cleaned_rows = []
        error_rows = []
        for idx, row in self.df_raw.iterrows():
            original_row_num = idx + 2
            cleaned = {
                '_original_row': original_row_num,
                '_source_file': self.input_path.name
            }
            issues = []
            for orig_col, std_field in self.column_mapping.items():
                value = row.get(orig_col, '')
                if std_field == 'passport':
                    cleaned_val, status = DataCleaner.clean_passport(value)
                    cleaned['passport'] = cleaned_val
                    cleaned['passport_status'] = status
                    if status != '正常':
                        issues.append(f"护照号: {status}")
                elif std_field == 'guardian_phone':
                    cleaned_val, status = DataCleaner.clean_phone(value)
                    cleaned['guardian_phone'] = cleaned_val
                    cleaned['phone_status'] = status
                    if status != '正常':
                        issues.append(f"监护人电话: {status}")
                elif std_field == 'dietary_restriction':
                    cleaned_val, status = DataCleaner.clean_dietary(value)
                    cleaned['dietary_restriction'] = cleaned_val
                    cleaned['dietary_status'] = status
                else:
                    cleaned[std_field] = str(value).strip() if pd.notna(value) else ''
            if not cleaned.get('student_name'):
                issues.append("学生姓名为空")
            if not cleaned.get('passport'):
                issues.append("护照号为空")
            if not cleaned.get('guardian_phone'):
                issues.append("监护人电话为空")
            cleaned['_issues'] = '; '.join(issues)
            cleaned['_issue_count'] = len(issues)
            if issues:
                for col in self.df_raw.columns:
                    cleaned[f'orig_{col}'] = str(row.get(col, ''))
                error_rows.append(cleaned)
                self.report['error_rows'].append({
                    'row': original_row_num,
                    'issues': issues
                })
            cleaned_rows.append(cleaned)
        self.df_cleaned = pd.DataFrame(cleaned_rows)
        self.df_errors = pd.DataFrame(error_rows) if error_rows else pd.DataFrame()
        self.report['summary']['cleaned_rows'] = len(cleaned_rows) - len(error_rows)
        self.report['summary']['error_rows'] = len(error_rows)
        return True

    def detect_duplicates(self):
        if 'passport' not in self.df_cleaned.columns:
            return []
        dup_groups = self.df_cleaned.groupby('passport')
        duplicates = []
        for passport, group in dup_groups:
            if len(group) > 1 and passport and passport.strip():
                rows = group['_original_row'].tolist()
                duplicates.append({
                    'passport': passport,
                    'student_names': group['student_name'].tolist(),
                    'original_rows': rows,
                    'count': len(group)
                })
        self.report['duplicates'] = duplicates
        self.report['summary']['duplicate_count'] = len(duplicates)
        return duplicates

    def save_outputs(self):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        base_name = self.input_path.stem
        cleaned_path = self.output_dir / f'{base_name}_cleaned_{timestamp}.xlsx'
        self.df_cleaned.to_excel(cleaned_path, index=False)
        self.report['output_files'] = {'cleaned': str(cleaned_path)}
        if len(self.df_errors) > 0:
            error_path = self.output_dir / f'{base_name}_errors_{timestamp}.xlsx'
            self.df_errors.to_excel(error_path, index=False)
            self.report['output_files']['errors'] = str(error_path)
        report_path = self.output_dir / f'{base_name}_report_{timestamp}.md'
        self._save_markdown_report(report_path)
        self.report['output_files']['report'] = str(report_path)
        json_path = self.output_dir / f'{base_name}_summary_{timestamp}.json'
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.report, f, ensure_ascii=False, indent=2)
        self.report['output_files']['json_summary'] = str(json_path)
        return True

    def _save_markdown_report(self, path):
        with open(path, 'w', encoding='utf-8') as f:
            f.write('# 游学报名表清洗报告\n\n')
            f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"**源文件**: {self.input_path.name}\n\n")
            f.write('## 一、处理摘要\n\n')
            f.write(f"- 总行数: {self.report['summary']['total_rows']}\n")
            f.write(f"- 成功清洗: {self.report['summary']['cleaned_rows']}\n")
            f.write(f"- 异常行数: {self.report['summary']['error_rows']}\n")
            f.write(f"- 重复报名: {self.report['summary'].get('duplicate_count', 0)} 组\n\n")
            f.write('## 二、字段映射情况\n\n')
            f.write('| 原始列名 | 标准字段 |\n')
            f.write('|----------|----------|\n')
            for orig, std in self.report['summary']['mapped_columns'].items():
                f.write(f"| {orig} | {std} |\n")
            missing = self.report['summary'].get('missing_required_fields', [])
            if missing:
                f.write(f"\n**缺失的必填字段**: {', '.join(missing)}\n\n")
            if self.report['duplicates']:
                f.write('## 三、重复报名记录\n\n')
                for dup in self.report['duplicates']:
                    f.write(f"- 护照号 `{dup['passport']}` 在第 {', '.join(map(str, dup['original_rows']))} 行重复出现 ({dup['count']} 次)\n")
                    names = '、'.join(set(dup['student_names']))
                    f.write(f"  - 学生姓名: {names}\n\n")
            if self.report['error_rows']:
                f.write('## 四、异常行详情\n\n')
                for err in self.report['error_rows'][:20]:
                    f.write(f"- 第 {err['row']} 行: {'; '.join(err['issues'])}\n")
                if len(self.report['error_rows']) > 20:
                    f.write(f"\n  ... 还有 {len(self.report['error_rows']) - 20} 条异常记录请查看异常文件\n\n")
            f.write('## 五、输出文件\n\n')
            for name, fpath in self.report['output_files'].items():
                f.write(f"- {name}: `{fpath}`\n")

    def print_summary(self):
        print('\n' + '='*50)
        print('游学报名表清洗完成！')
        print('='*50)
        print(f"\n输入文件: {self.input_path.name}")
        print(f"总行数: {self.report['summary']['total_rows']}")
        print(f"成功清洗: {self.report['summary']['cleaned_rows']}")
        print(f"异常行数: {self.report['summary']['error_rows']}")
        print(f"重复报名: {self.report['summary'].get('duplicate_count', 0)} 组")
        print('\n输出文件:')
        for name, path in self.report['output_files'].items():
            print(f"  - {name}: {os.path.basename(path)}")
        if self.report['summary'].get('missing_required_fields'):
            print(f"\n警告: 缺失必填字段: {', '.join(self.report['summary']['missing_required_fields'])}")
        print('='*50 + '\n')

    def run(self):
        self.validate_input()
        self.load_data()
        missing = self.map_columns()
        self.process_rows()
        self.detect_duplicates()
        self.save_outputs()
        self.print_summary()
        return self.report


def main():
    parser = argparse.ArgumentParser(
        description='游学报名表数据清洗工具 - 标准化护照号、监护人电话和饮食禁忌字段',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python study_tour_cleaner.py -i 报名表.xlsx -o ./output
  python study_tour_cleaner.py -i data/*.csv -o ./output
        """
    )
    parser.add_argument('-i', '--input', required=True, help='输入文件路径 (Excel 或 CSV)')
    parser.add_argument('-o', '--output', required=True, help='输出目录路径')
    parser.add_argument('-c', '--config', help='可选配置文件路径 (JSON)')
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细输出')
    args = parser.parse_args()
    try:
        config = None
        if args.config:
            with open(args.config, 'r', encoding='utf-8') as f:
                config = json.load(f)
        cleaner = RegistrationCleaner(args.input, args.output, config)
        cleaner.run()
    except Exception as e:
        print(f'错误: {str(e)}')
        exit(1)


if __name__ == '__main__':
    main()
