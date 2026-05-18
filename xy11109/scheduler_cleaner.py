#!/usr/bin/env python3
import click
import pandas as pd
from pathlib import Path
from datetime import datetime, time
import json
from typing import List, Dict, Tuple
import warnings
warnings.filterwarnings('ignore')

COLUMN_ORDER = [
    '排班日期',
    '车辆编号',
    '车主姓名',
    '联系电话',
    '车型',
    '车牌号',
    '施工项目',
    '施工项目编码',
    '预计时长(分钟)',
    '技师姓名',
    '技师编号',
    '工位号',
    '预计开始时间',
    '预计结束时间',
    '优先级',
    '车辆状态',
    '备注'
]

LUNCH_START = time(12, 0)
LUNCH_END = time(13, 30)
MORNING_START = time(8, 30)
EVENING_END = time(18, 0)

VALID_PROJECTS = {
    'P001': '精细洗车',
    'P002': '内饰深度清洁',
    'P003': '漆面抛光',
    'P004': '镀晶施工',
    'P005': '贴膜服务',
    'P006': '发动机舱清洁',
    'P007': '轮毂翻新',
    'P008': '玻璃镀膜'
}

VALID_STATUSES = ['待施工', '施工中', '已完成', '已取消', '延期']


class ScheduleCleaner:
    def __init__(self):
        self.summary = {
            'total_files': 0,
            'files_processed': 0,
            'files_skipped': 0,
            'files_failed': 0,
            'total_records': 0,
            'records_success': 0,
            'records_skipped': 0,
            'records_failed': 0,
            'file_details': [],
            'skip_reasons': [],
            'fail_reasons': []
        }

    def parse_time(self, time_str):
        if pd.isna(time_str) or time_str == '':
            return None
        if isinstance(time_str, time):
            return time_str
        try:
            if isinstance(time_str, str):
                time_str = time_str.strip()
                for fmt in ['%H:%M', '%H:%M:%S', '%I:%M %p', '%H点%M分']:
                    try:
                        return datetime.strptime(time_str, fmt).time()
                    except ValueError:
                        continue
        except:
            pass
        return None

    def time_overlaps_lunch(self, start_time, end_time):
        if not start_time or not end_time:
            return False
        start_dt = datetime.combine(datetime.today(), start_time)
        end_dt = datetime.combine(datetime.today(), end_time)
        lunch_start_dt = datetime.combine(datetime.today(), LUNCH_START)
        lunch_end_dt = datetime.combine(datetime.today(), LUNCH_END)
        
        return not (end_dt <= lunch_start_dt or start_dt >= lunch_end_dt)

    def validate_record(self, record, row_idx, file_name):
        issues = []
        warnings = []
        
        if pd.isna(record.get('车辆编号')) or str(record.get('车辆编号', '')).strip() == '':
            issues.append('车辆编号为空')
        
        if pd.isna(record.get('车主姓名')) or str(record.get('车主姓名', '')).strip() == '':
            issues.append('车主姓名为空')
        
        phone = str(record.get('联系电话', ''))
        if phone and len(phone) < 11 and not pd.isna(record.get('联系电话')):
            warnings.append('联系电话格式可能不正确')
        
        project_code = str(record.get('施工项目编码', '')).strip().upper()
        if project_code and project_code not in VALID_PROJECTS:
            issues.append(f'无效的施工项目编码: {project_code}')
        
        start_time = self.parse_time(record.get('预计开始时间'))
        end_time = self.parse_time(record.get('预计结束时间'))
        
        if start_time and end_time:
            if start_time >= end_time:
                issues.append('预计开始时间晚于或等于预计结束时间')
            
            if self.time_overlaps_lunch(start_time, end_time):
                warnings.append('施工时间跨午休时段')
            
            if start_time < MORNING_START:
                warnings.append('施工开始时间早于营业时间')
            if end_time > EVENING_END:
                warnings.append('施工结束时间晚于营业时间')
        
        status = str(record.get('车辆状态', '')).strip()
        if status and status not in VALID_STATUSES:
            warnings.append(f'未知的车辆状态: {status}')
        
        technician = str(record.get('技师姓名', '')).strip()
        if '请假' in technician or '休假' in technician:
            warnings.append(f'技师可能处于请假状态: {technician}')
        
        return issues, warnings

    def clean_record(self, record):
        cleaned = {}
        
        for col in COLUMN_ORDER:
            val = record.get(col)
            if pd.isna(val):
                cleaned[col] = ''
            else:
                if isinstance(val, str):
                    cleaned[col] = val.strip()
                else:
                    cleaned[col] = val
        
        project_code = str(cleaned.get('施工项目编码', '')).strip().upper()
        if project_code in VALID_PROJECTS:
            if not cleaned.get('施工项目'):
                cleaned['施工项目'] = VALID_PROJECTS[project_code]
        
        return cleaned

    def process_file(self, file_path: Path) -> Tuple[List[Dict], Dict]:
        file_result = {
            'file_name': file_path.name,
            'file_path': str(file_path),
            'status': 'success',
            'total_records': 0,
            'success_records': 0,
            'skipped_records': 0,
            'failed_records': 0,
            'reasons': []
        }
        
        cleaned_records = []
        
        try:
            if file_path.suffix.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            elif file_path.suffix.lower() == '.csv':
                df = pd.read_csv(file_path)
            else:
                file_result['status'] = 'failed'
                file_result['reasons'].append(f'不支持的文件格式: {file_path.suffix}')
                return [], file_result
            
            file_result['total_records'] = len(df)
            
            for idx, row in df.iterrows():
                issues, warnings = self.validate_record(row, idx, file_path.name)
                
                if issues:
                    file_result['failed_records'] += 1
                    reason = f'第{idx+2}行: ' + '; '.join(issues)
                    file_result['reasons'].append(reason)
                    continue
                
                cleaned = self.clean_record(row.to_dict())
                
                if warnings:
                    for warning in warnings:
                        if '跨午休' in warning:
                            cleaned['备注'] = str(cleaned.get('备注', '')) + ' [注意:跨午休]'
                            file_result['reasons'].append(f'第{idx+2}行: {warning}')
                        elif '请假' in warning:
                            cleaned['备注'] = str(cleaned.get('备注', '')) + ' [注意:技师请假]'
                            file_result['reasons'].append(f'第{idx+2}行: {warning}')
                        else:
                            file_result['reasons'].append(f'第{idx+2}行: {warning}')
                
                cleaned_records.append(cleaned)
                file_result['success_records'] += 1
            
            if file_result['success_records'] == 0 and file_result['total_records'] > 0:
                file_result['status'] = 'failed'
            elif file_result['failed_records'] > 0:
                file_result['status'] = 'partial'
            
        except Exception as e:
            file_result['status'] = 'failed'
            file_result['reasons'].append(f'处理异常: {str(e)}')
        
        return cleaned_records, file_result

    def run(self, input_files: List[str], output_dir: str):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        all_cleaned_records = []
        self.summary['total_files'] = len(input_files)
        
        for file_path_str in input_files:
            file_path = Path(file_path_str)
            
            if not file_path.exists():
                self.summary['files_skipped'] += 1
                self.summary['skip_reasons'].append(f'{file_path.name}: 文件不存在')
                continue
            
            cleaned_records, file_result = self.process_file(file_path)
            
            self.summary['file_details'].append(file_result)
            self.summary['total_records'] += file_result['total_records']
            self.summary['records_success'] += file_result['success_records']
            self.summary['records_failed'] += file_result['failed_records']
            
            if file_result['status'] == 'failed':
                self.summary['files_failed'] += 1
                self.summary['fail_reasons'].extend([f"{file_path.name}: {r}" for r in file_result['reasons']])
            else:
                self.summary['files_processed'] += 1
                all_cleaned_records.extend(cleaned_records)
        
        if all_cleaned_records:
            result_df = pd.DataFrame(all_cleaned_records)
            result_df = result_df.reindex(columns=COLUMN_ORDER)
            
            output_file = output_path / 'cleaned_schedule.xlsx'
            result_df.to_excel(output_file, index=False)
            
            output_csv = output_path / 'cleaned_schedule.csv'
            result_df.to_csv(output_csv, index=False, encoding='utf-8-sig')
        
        summary_file = output_path / 'cleaning_summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.summary, f, ensure_ascii=False, indent=2)
        
        return self.summary


def print_summary(summary):
    click.echo("\n" + "="*60)
    click.echo("           汽车美容店车辆施工排班数据清洗摘要")
    click.echo("="*60)
    
    click.echo(f"\n📁 文件处理统计:")
    click.echo(f"   总文件数: {summary['total_files']}")
    click.echo(f"   成功处理: {summary['files_processed']}")
    click.echo(f"   跳过文件: {summary['files_skipped']}")
    click.echo(f"   失败文件: {summary['files_failed']}")
    
    click.echo(f"\n📊 记录处理统计:")
    click.echo(f"   总记录数: {summary['total_records']}")
    click.echo(f"   成功清洗: {summary['records_success']}")
    click.echo(f"   失败记录: {summary['records_failed']}")
    
    if summary['file_details']:
        click.echo(f"\n📋 文件详情:")
        for detail in summary['file_details']:
            status_icon = '✅' if detail['status'] == 'success' else '⚠️' if detail['status'] == 'partial' else '❌'
            click.echo(f"   {status_icon} {detail['file_name']}: 总计{detail['total_records']}条, 成功{detail['success_records']}条, 失败{detail['failed_records']}条")
            if detail['reasons']:
                for reason in detail['reasons'][:5]:
                    click.echo(f"      · {reason}")
                if len(detail['reasons']) > 5:
                    click.echo(f"      · ...还有{len(detail['reasons'])-5}条原因")
    
    if summary['skip_reasons']:
        click.echo(f"\n⏭️ 跳过原因:")
        for reason in summary['skip_reasons']:
            click.echo(f"   · {reason}")
    
    if summary['fail_reasons']:
        click.echo(f"\n❌ 失败原因:")
        for reason in summary['fail_reasons'][:10]:
            click.echo(f"   · {reason}")
    
    click.echo("\n" + "="*60)


@click.command()
@click.argument('input_files', nargs=-1, type=click.Path(exists=False))
@click.option('-o', '--output', default='./output', help='输出目录路径', type=click.Path())
@click.option('--verbose', is_flag=True, help='显示详细信息')
def main(input_files, output, verbose):
    """
    汽车美容店车辆施工排班数据清洗工具
    
    支持多文件输入，处理脏数据，输出清洗后的排班数据和详细摘要。
    
    功能特性:
    - 支持 Excel (.xlsx, .xls) 和 CSV 格式
    - 自动验证排班数据的业务规则
    - 检测跨午休、技师请假等情况并继续处理
    - 输出成功、跳过、失败的详细统计
    - 保留关键业务列并按稳定顺序输出
    """
    if not input_files:
        click.echo("错误: 请指定至少一个输入文件")
        return
    
    click.echo("🚗 汽车美容店车辆施工排班数据清洗工具启动")
    click.echo(f"📥 待处理文件数: {len(input_files)}")
    
    cleaner = ScheduleCleaner()
    summary = cleaner.run(list(input_files), output)
    
    print_summary(summary)
    
    click.echo(f"\n📤 输出文件已保存至: {output}")
    click.echo("   - cleaned_schedule.xlsx: 清洗后的排班数据(Excel格式)")
    click.echo("   - cleaned_schedule.csv: 清洗后的排班数据(CSV格式)")
    click.echo("   - cleaning_summary.json: 清洗摘要详情(JSON格式)")


if __name__ == '__main__':
    main()
