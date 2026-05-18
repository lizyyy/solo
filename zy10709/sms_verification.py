#!/usr/bin/env python3
import click
import yaml
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import json


class SmsUnsubscribeVerifier:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.results = {
            'summary': {},
            'recovery_range_checks': [],
            'error_sms_checks': [],
            'issues': []
        }

    def _load_config(self, config_path: str) -> Dict:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _load_data(self) -> Dict[str, pd.DataFrame]:
        data = {}
        data_files = {
            'unsubscribe': self.config['data_files']['unsubscribe_table'],
            'recovery': self.config['data_files']['recovery_applications'],
            'sms_detail': self.config['data_files']['sms_details']
        }
        
        for name, filepath in data_files.items():
            path = Path(filepath)
            if not path.exists():
                raise FileNotFoundError(f"数据文件不存在: {filepath}")
            
            if path.suffix == '.csv':
                df = pd.read_csv(filepath)
            elif path.suffix in ['.xlsx', '.xls']:
                df = pd.read_excel(filepath)
            else:
                raise ValueError(f"不支持的文件格式: {filepath}")
            
            df.columns = df.columns.str.strip()
            data[name] = df
        
        return data

    def _mask_phone(self, phone: str) -> str:
        if pd.isna(phone) or not phone:
            return ''
        phone_str = str(phone)
        if len(phone_str) >= 7:
            return phone_str[:3] + '****' + phone_str[-4:]
        return phone_str

    def _check_recovery_range(self, unsubscribe_df: pd.DataFrame, recovery_df: pd.DataFrame) -> None:
        rules = self.config['rules']['recovery_range']
        channel_mapping = rules.get('channel_mapping', {})
        
        for _, recovery in recovery_df.iterrows():
            phone = recovery.get(self.config['fields']['recovery']['phone'])
            apply_time = recovery.get(self.config['fields']['recovery']['apply_time'])
            recovery_channels = recovery.get(self.config['fields']['recovery']['recovery_channels'], '')
            recovery_id = recovery.get(self.config['fields']['recovery'].get('id', 'id'))
            
            if pd.isna(phone):
                continue
            
            unsubscribe_record = unsubscribe_df[
                unsubscribe_df[self.config['fields']['unsubscribe']['phone']] == phone
            ]
            
            status = 'PASS'
            issues = []
            
            if len(unsubscribe_record) == 0:
                status = 'FAIL'
                issues.append('该号码无退订记录，无需恢复')
            else:
                unsub = unsubscribe_record.iloc[0]
                unsub_channels = unsub.get(self.config['fields']['unsubscribe']['unsubscribe_channels'], '')
                
                recovery_channel_list = [c.strip() for c in str(recovery_channels).split(',') if c.strip()]
                unsub_channel_list = [c.strip() for c in str(unsub_channels).split(',') if c.strip()]
                
                for channel in recovery_channel_list:
                    if channel not in unsub_channel_list:
                        status = 'FAIL'
                        issues.append(f"恢复渠道[{channel}]不在退订渠道范围内")
            
            result = {
                'recovery_id': str(recovery_id),
                'phone': self._mask_phone(str(phone)),
                'apply_time': str(apply_time),
                'status': status,
                'issues': issues
            }
            self.results['recovery_range_checks'].append(result)
            
            if status == 'FAIL':
                self.results['issues'].append({
                    'type': '恢复范围异常',
                    'phone': self._mask_phone(str(phone)),
                    'recovery_id': str(recovery_id),
                    'details': '; '.join(issues)
                })

    def _check_error_sms(self, unsubscribe_df: pd.DataFrame, recovery_df: pd.DataFrame, sms_df: pd.DataFrame) -> None:
        rules = self.config['rules']['error_sms']
        marketing_sms_types = rules.get('marketing_sms_types', [])
        verification_sms_types = rules.get('verification_sms_types', [])
        
        recovery_phones = set(recovery_df[self.config['fields']['recovery']['phone']].dropna().astype(str))
        
        for _, sms in sms_df.iterrows():
            phone = sms.get(self.config['fields']['sms']['phone'])
            sms_type = sms.get(self.config['fields']['sms']['sms_type'])
            send_time = sms.get(self.config['fields']['sms']['send_time'])
            sms_id = sms.get(self.config['fields']['sms'].get('id', 'id'))
            content = sms.get(self.config['fields']['sms'].get('content', ''))
            
            if pd.isna(phone):
                continue
            
            phone_str = str(phone)
            
            unsubscribe_record = unsubscribe_df[
                unsubscribe_df[self.config['fields']['unsubscribe']['phone']].astype(str) == phone_str
            ]
            
            if len(unsubscribe_record) > 0:
                is_verification = sms_type in verification_sms_types
                is_marketing = sms_type in marketing_sms_types
                
                if phone_str in recovery_phones:
                    status = 'PASS'
                    issues = []
                elif is_verification:
                    status = 'PASS'
                    issues = []
                elif is_marketing:
                    status = 'FAIL'
                    issues = ['退订用户收到营销短信，属于误发']
                else:
                    status = 'WARN'
                    issues = ['短信类型未明确分类，需人工复核']
                
                result = {
                    'sms_id': str(sms_id),
                    'phone': self._mask_phone(phone_str),
                    'sms_type': sms_type,
                    'send_time': str(send_time),
                    'content_preview': str(content)[:50] + '...' if len(str(content)) > 50 else str(content),
                    'status': status,
                    'issues': issues
                }
                self.results['error_sms_checks'].append(result)
                
                if status == 'FAIL':
                    self.results['issues'].append({
                        'type': '误发短信',
                        'phone': self._mask_phone(phone_str),
                        'sms_id': str(sms_id),
                        'details': '; '.join(issues)
                    })

    def _generate_summary(self) -> None:
        recovery_total = len(self.results['recovery_range_checks'])
        recovery_pass = sum(1 for r in self.results['recovery_range_checks'] if r['status'] == 'PASS')
        recovery_fail = sum(1 for r in self.results['recovery_range_checks'] if r['status'] == 'FAIL')
        
        sms_total = len(self.results['error_sms_checks'])
        sms_pass = sum(1 for r in self.results['error_sms_checks'] if r['status'] == 'PASS')
        sms_fail = sum(1 for r in self.results['error_sms_checks'] if r['status'] == 'FAIL')
        sms_warn = sum(1 for r in self.results['error_sms_checks'] if r['status'] == 'WARN')
        
        total_issues = len(self.results['issues'])
        
        self.results['summary'] = {
            'check_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'recovery_range': {
                'total': recovery_total,
                'pass': recovery_pass,
                'fail': recovery_fail,
                'pass_rate': f"{(recovery_pass/recovery_total*100):.2f}%" if recovery_total > 0 else 'N/A'
            },
            'error_sms': {
                'total': sms_total,
                'pass': sms_pass,
                'fail': sms_fail,
                'warn': sms_warn,
                'pass_rate': f"{(sms_pass/sms_total*100):.2f}%" if sms_total > 0 else 'N/A'
            },
            'issues': {
                'total': total_issues
            },
            'overall_status': 'FAIL' if (recovery_fail > 0 or sms_fail > 0) else 'PASS'
        }

    def _generate_report(self, output_path: str) -> None:
        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("                短信发送记录退订恢复核验报告")
        report_lines.append("=" * 70)
        report_lines.append(f"核验时间: {self.results['summary']['check_time']}")
        report_lines.append(f"总体结论: {self.results['summary']['overall_status']}")
        report_lines.append("")
        
        report_lines.append("一、恢复范围核验")
        report_lines.append("-" * 70)
        s = self.results['summary']['recovery_range']
        report_lines.append(f"  总计: {s['total']} 条")
        report_lines.append(f"  通过: {s['pass']} 条")
        report_lines.append(f"  失败: {s['fail']} 条")
        report_lines.append(f"  通过率: {s['pass_rate']}")
        report_lines.append("")
        report_lines.append("  恢复范围核验明细:")
        report_lines.append("  " + "-" * 65)
        for r in self.results['recovery_range_checks']:
            flag = "✓" if r['status'] == 'PASS' else "✗"
            report_lines.append(f"  {flag} 恢复申请[{r['recovery_id']}] 号码:{r['phone']} 时间:{r['apply_time']}")
            if r['issues']:
                report_lines.append(f"      问题: {'; '.join(r['issues'])}")
        report_lines.append("")
        
        report_lines.append("二、误发短信核验")
        report_lines.append("-" * 70)
        s = self.results['summary']['error_sms']
        report_lines.append(f"  总计: {s['total']} 条")
        report_lines.append(f"  通过: {s['pass']} 条")
        report_lines.append(f"  失败: {s['fail']} 条")
        report_lines.append(f"  警告: {s['warn']} 条")
        report_lines.append(f"  通过率: {s['pass_rate']}")
        report_lines.append("")
        report_lines.append("  误发短信核验明细:")
        report_lines.append("  " + "-" * 65)
        for r in self.results['error_sms_checks']:
            flag = "✓" if r['status'] == 'PASS' else ("!" if r['status'] == 'WARN' else "✗")
            report_lines.append(f"  {flag} 短信[{r['sms_id']}] 号码:{r['phone']} 类型:{r['sms_type']} 时间:{r['send_time']}")
            report_lines.append(f"      内容摘要: {r['content_preview']}")
            if r['issues']:
                report_lines.append(f"      问题: {'; '.join(r['issues'])}")
        report_lines.append("")
        
        report_lines.append("三、问题汇总")
        report_lines.append("-" * 70)
        if self.results['issues']:
            for i, issue in enumerate(self.results['issues'], 1):
                report_lines.append(f"  {i}. [{issue['type']}] {issue['phone']}")
                if 'recovery_id' in issue:
                    report_lines.append(f"     恢复申请号: {issue['recovery_id']}")
                if 'sms_id' in issue:
                    report_lines.append(f"     短信ID: {issue['sms_id']}")
                report_lines.append(f"     详情: {issue['details']}")
        else:
            report_lines.append("  未发现问题")
        report_lines.append("")
        report_lines.append("=" * 70)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        
        json_path = output_path.replace('.txt', '.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        
        click.echo(f"报告已生成: {output_path}")
        click.echo(f"JSON报告: {json_path}")

    def run(self, output_path: str) -> None:
        click.echo("开始短信发送记录退订恢复核验...")
        
        data = self._load_data()
        click.echo(f"  加载退订表: {len(data['unsubscribe'])} 条记录")
        click.echo(f"  加载恢复申请: {len(data['recovery'])} 条记录")
        click.echo(f"  加载发送明细: {len(data['sms_detail'])} 条记录")
        
        click.echo("\n执行恢复范围核验...")
        self._check_recovery_range(data['unsubscribe'], data['recovery'])
        
        click.echo("执行误发短信核验...")
        self._check_error_sms(data['unsubscribe'], data['recovery'], data['sms_detail'])
        
        click.echo("生成核验总结...")
        self._generate_summary()
        
        click.echo("生成核验报告...")
        self._generate_report(output_path)
        
        click.echo("\n核验完成!")
        click.echo(f"总体结论: {self.results['summary']['overall_status']}")
        click.echo(f"发现问题数: {self.results['summary']['issues']['total']}")


@click.command()
@click.option('--config', '-c', default='config.yaml', help='配置文件路径')
@click.option('--output', '-o', default='verification_report.txt', help='输出报告路径')
def main(config, output):
    """短信发送记录退订恢复核验CLI"""
    try:
        verifier = SmsUnsubscribeVerifier(config)
        verifier.run(output)
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        raise


if __name__ == '__main__':
    main()
