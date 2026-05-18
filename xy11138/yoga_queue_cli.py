#!/usr/bin/env python3
import os
import sys
import yaml
import json
import pandas as pd
from datetime import datetime
from dateutil import parser as date_parser
from typing import List, Dict, Any, Tuple, Optional
import click
import warnings
warnings.filterwarnings('ignore')

DEFAULT_CONFIG = {
    'time_formats': [
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y年%m月%d日 %H:%M',
        '%m/%d/%Y %H:%M',
        '%Y-%m-%dT%H:%M:%S'
    ],
    'default_queue_rules': {
        'priority_order': ['VIP会员', '年卡会员', '月卡会员', '次卡会员'],
        'max_queue_size': 20,
        'allow_manual_insert': True,
        'manual_insert_privilege': ['VIP会员', '店长特批']
    },
    'output': {
        'include_audit_trail': True,
        'audit_trail_columns': ['操作时间', '操作人', '操作类型', '变更前', '变更后', '备注']
    },
    'file_types': ['.xlsx', '.csv', '.xls']
}

EXIT_CODES = {
    'SUCCESS': 0,
    'PARTIAL_SUCCESS': 1,
    'FAILURE': 2
}


class YogaQueueProcessor:
    def __init__(self, config_path: Optional[str] = None, dry_run: bool = False):
        self.config = self._load_config(config_path)
        self.dry_run = dry_run
        self.audit_trail = []
        self.errors = []
        self.success_count = 0
        self.fail_count = 0

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        return DEFAULT_CONFIG

    def parse_time(self, time_str: str) -> Optional[datetime]:
        if pd.isna(time_str) or time_str == '':
            return None
        if isinstance(time_str, datetime):
            return time_str
        for fmt in self.config['time_formats']:
            try:
                return datetime.strptime(str(time_str), fmt)
            except (ValueError, TypeError):
                continue
        try:
            return date_parser.parse(str(time_str))
        except (ValueError, TypeError):
            return None

    def _get_priority_score(self, member_type: str) -> int:
        priority_order = self.config['default_queue_rules']['priority_order']
        member_type = str(member_type).strip()
        for idx, priority in enumerate(priority_order):
            if priority in member_type:
                return idx
        return len(priority_order)

    def _is_manual_insert_allowed(self, member_type: str, operator: str) -> bool:
        if not self.config['default_queue_rules']['allow_manual_insert']:
            return False
        privileges = self.config['default_queue_rules']['manual_insert_privilege']
        member_type = str(member_type).strip()
        operator = str(operator).strip() if operator else ''
        return any(p in member_type for p in privileges) or any(p in operator for p in privileges)

    def _record_audit(self, action_type: str, before: Any, after: Any, operator: str = '系统', note: str = ''):
        audit_entry = {
            '操作时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '操作人': operator,
            '操作类型': action_type,
            '变更前': str(before),
            '变更后': str(after),
            '备注': note
        }
        self.audit_trail.append(audit_entry)

    def process_queue_data(self, df: pd.DataFrame, filename: str) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        file_audit = []
        required_columns = ['会员姓名', '会员类型', '报名时间', '课程名称']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")

        df['_parsed_time'] = df['报名时间'].apply(self.parse_time)
        invalid_time_rows = df[df['_parsed_time'].isna()].index.tolist()
        for idx in invalid_time_rows:
            original_time = df.loc[idx, '报名时间']
            file_audit.append({
                '操作时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                '操作人': '系统',
                '操作类型': '时间格式修正',
                '变更前': original_time,
                '变更后': '无法解析',
                '备注': f'行号: {idx+2}'
            })

        df['_priority_score'] = df['会员类型'].apply(self._get_priority_score)
        if '插队标记' in df.columns:
            df['_manual_insert'] = df['插队标记'].apply(
                lambda x: str(x).strip() in ['是', 'yes', '1', 'True', '插队']
            )
        else:
            df['_manual_insert'] = False

        if '操作人' in df.columns:
            for idx, row in df.iterrows():
                if row['_manual_insert']:
                    if self._is_manual_insert_allowed(row['会员类型'], row.get('操作人', '')):
                        file_audit.append({
                            '操作时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            '操作人': row.get('操作人', '未知'),
                            '操作类型': '手工插队确认',
                            '变更前': f'原排位待计算',
                            '变更后': '插队生效',
                            '备注': f'会员: {row["会员姓名"]}'
                        })
                    else:
                        df.loc[idx, '_manual_insert'] = False
                        file_audit.append({
                            '操作时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            '操作人': '系统',
                            '操作类型': '插队拒绝',
                            '变更前': '插队申请',
                            '变更后': '恢复正常排序',
                            '备注': f'会员: {row["会员姓名"]}, 无权限'
                        })

        valid_df = df[df['_parsed_time'].notna()].copy()
        insert_rows = valid_df[valid_df['_manual_insert']].copy()
        normal_rows = valid_df[~valid_df['_manual_insert']].copy()

        normal_rows = normal_rows.sort_values(
            by=['_priority_score', '_parsed_time'],
            ascending=[True, True]
        ).reset_index(drop=True)

        result_rows = []
        normal_idx = 0
        insert_queue = insert_rows.sort_values(by='_parsed_time').to_dict('records')

        max_size = self.config['default_queue_rules']['max_queue_size']
        current_pos = 0

        while normal_idx < len(normal_rows) or insert_queue:
            if current_pos >= max_size:
                break

            if insert_queue and current_pos < len(insert_queue):
                insert_row = insert_queue.pop(0)
                insert_row['_final_position'] = current_pos + 1
                insert_row['排序方式'] = '插队'
                result_rows.append(insert_row)
                current_pos += 1
                continue

            if normal_idx < len(normal_rows):
                normal_row = normal_rows.iloc[normal_idx].copy()
                normal_row['_final_position'] = current_pos + 1
                normal_row['排序方式'] = '正常排序'
                result_rows.append(normal_row)
                normal_idx += 1
                current_pos += 1

        result_df = pd.DataFrame(result_rows)
        result_df['候补排位'] = result_df['_final_position']

        output_columns = [col for col in df.columns if not col.startswith('_')] + ['候补排位', '排序方式']
        output_columns = [col for col in output_columns if col in result_df.columns]

        return result_df[output_columns], file_audit

    def process_file(self, input_path: str, output_path: str) -> bool:
        try:
            file_ext = os.path.splitext(input_path)[1].lower()
            if file_ext == '.csv':
                df = pd.read_csv(input_path, encoding='utf-8')
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(input_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_ext}")

            result_df, file_audit = self.process_queue_data(df, os.path.basename(input_path))
            self.audit_trail.extend(file_audit)

            if not self.dry_run:
                output_dir = os.path.dirname(output_path)
                if output_dir and not os.path.exists(output_dir):
                    os.makedirs(output_dir)

                output_ext = os.path.splitext(output_path)[1].lower()
                if output_ext == '.csv':
                    result_df.to_csv(output_path, index=False, encoding='utf-8-sig')
                elif output_ext in ['.xlsx', '.xls']:
                    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                        result_df.to_excel(writer, sheet_name='候补排序结果', index=False)
                        if self.config['output']['include_audit_trail'] and self.audit_trail:
                            audit_df = pd.DataFrame(self.audit_trail)
                            audit_df.to_excel(writer, sheet_name='审计日志', index=False)

            self.success_count += 1
            self._record_audit('文件处理完成', input_path, output_path, note=f'处理行数: {len(result_df)}')
            return True

        except Exception as e:
            self.fail_count += 1
            error_msg = f"{os.path.basename(input_path)}: {str(e)}"
            self.errors.append(error_msg)
            self._record_audit('文件处理失败', input_path, '', note=error_msg)
            return False

    def process_directory(self, input_dir: str, output_dir: str, overwrite: bool) -> Dict[str, Any]:
        if not os.path.exists(input_dir):
            raise ValueError(f"输入目录不存在: {input_dir}")

        if not os.path.exists(output_dir) and not self.dry_run:
            os.makedirs(output_dir)

        file_types = self.config['file_types']
        files = [f for f in os.listdir(input_dir) if os.path.splitext(f)[1].lower() in file_types]

        for filename in files:
            input_path = os.path.join(input_dir, filename)
            name, ext = os.path.splitext(filename)
            output_filename = f"{name}_候补排序结果{ext}"
            output_path = os.path.join(output_dir, output_filename)

            if os.path.exists(output_path) and not overwrite:
                self.errors.append(f"{filename}: 输出文件已存在，跳过")
                self.fail_count += 1
                continue

            self.process_file(input_path, output_path)

        return {
            'success_count': self.success_count,
            'fail_count': self.fail_count,
            'errors': self.errors,
            'audit_trail': self.audit_trail
        }


@click.command()
@click.argument('input_path', type=click.Path(exists=True))
@click.argument('output_path', type=click.Path())
@click.option('--dry-run', '-d', is_flag=True, help='试运行模式，不实际写入文件')
@click.option('--overwrite', '-o', is_flag=True, help='覆盖已存在的输出文件')
@click.option('--config', '-c', type=click.Path(exists=True), help='配置文件路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细处理信息')
def main(input_path: str, output_path: str, dry_run: bool, overwrite: bool, config: str, verbose: bool):
    """瑜伽教室团课候补排序 CLI 工具

    INPUT_PATH: 输入文件或目录路径
    OUTPUT_PATH: 输出文件或目录路径
    """
    click.echo(click.style("="*50, fg='cyan'))
    click.echo(click.style("瑜伽教室团课候补排序 CLI", fg='cyan', bold=True))
    click.echo(click.style("="*50, fg='cyan'))

    processor = YogaQueueProcessor(config_path=config, dry_run=dry_run)

    if dry_run:
        click.echo(click.style("【试运行模式】不会实际生成输出文件", fg='yellow'))

    try:
        if os.path.isfile(input_path):
            if os.path.isdir(output_path):
                name, ext = os.path.splitext(os.path.basename(input_path))
                output_filename = f"{name}_候补排序结果{ext}"
                output_path = os.path.join(output_path, output_filename)
            processor.process_file(input_path, output_path)
        else:
            processor.process_directory(input_path, output_path, overwrite)

        result = {
            'success_count': processor.success_count,
            'fail_count': processor.fail_count,
            'errors': processor.errors,
            'audit_trail_count': len(processor.audit_trail)
        }

        click.echo(f"\n{click.style('处理摘要:', fg='green', bold=True)}")
        click.echo(f"  成功处理: {result['success_count']} 个文件")
        click.echo(f"  处理失败: {result['fail_count']} 个文件")
        click.echo(f"  审计记录: {result['audit_trail_count']} 条")

        if result['errors']:
            click.echo(f"\n{click.style('错误详情:', fg='red', bold=True)}")
            for err in result['errors']:
                click.echo(f"  - {err}")

        if verbose and processor.audit_trail:
            click.echo(f"\n{click.style('审计日志:', fg='blue', bold=True)}")
            for audit in processor.audit_trail[-5:]:
                click.echo(f"  [{audit['操作时间']}] {audit['操作类型']}: {audit['备注']}")

        if result['fail_count'] > 0 and result['success_count'] > 0:
            sys.exit(EXIT_CODES['PARTIAL_SUCCESS'])
        elif result['fail_count'] > 0:
            sys.exit(EXIT_CODES['FAILURE'])
        else:
            sys.exit(EXIT_CODES['SUCCESS'])

    except Exception as e:
        click.echo(click.style(f"\n致命错误: {str(e)}", fg='red', bold=True))
        import traceback
        traceback.print_exc()
        sys.exit(EXIT_CODES['FAILURE'])


if __name__ == '__main__':
    main()
