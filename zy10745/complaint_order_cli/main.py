import os
import json
from pathlib import Path
import click
import pandas as pd
from datetime import datetime


class ComplaintOrderProcessor:
    def __init__(self, rules_file, output_dir, dry_run=False, overwrite=False):
        self.rules_file = rules_file
        self.output_dir = Path(output_dir)
        self.dry_run = dry_run
        self.overwrite = overwrite
        self.rules = self._load_rules()
        
    def _load_rules(self):
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _ensure_output_dir(self):
        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def process(self, input_file):
        click.echo(f"="*60)
        click.echo(f"【投诉工单包投诉升级整理】开始处理")
        click.echo(f"="*60)
        click.echo(f"输入文件: {input_file}")
        click.echo(f"规则文件: {self.rules_file}")
        click.echo(f"输出目录: {self.output_dir}")
        click.echo(f"试运行模式: {'是' if self.dry_run else '否'}")
        click.echo(f"覆盖模式: {'是' if self.overwrite else '否'}")
        click.echo(f"")
        
        self._ensure_output_dir()
        
        df = self._read_input_file(input_file)
        if df is None:
            return False
        
        click.echo(f"✅ 成功读取投诉工单，共 {len(df)} 条记录")
        click.echo(f"")
        
        result = self._analyze_complaints(df)
        self._generate_report(result, input_file)
        
        return True
    
    def _read_input_file(self, input_file):
        try:
            if input_file.endswith('.xlsx') or input_file.endswith('.xls'):
                return pd.read_excel(input_file)
            elif input_file.endswith('.csv'):
                return pd.read_csv(input_file, encoding='utf-8')
            else:
                click.echo(f"❌ 不支持的文件格式: {input_file}", err=True)
                return None
        except Exception as e:
            click.echo(f"❌ 读取文件失败: {str(e)}", err=True)
            return None
    
    def _analyze_complaints(self, df):
        result = {
            'total': len(df),
            'additional_evidence': [],
            'driver_appeal': [],
            'cs_overrule': [],
            'other': [],
            'by_status': {},
            'by_type': {}
        }
        
        evidence_keywords = self.rules.get('evidence_keywords', ['追加证据', '补充证据', '新证据'])
        appeal_keywords = self.rules.get('appeal_keywords', ['司机申诉', '申诉', '司机申请'])
        overrule_keywords = self.rules.get('overrule_keywords', ['客服改判', '改判', '重新判定'])
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            order_id = str(row_dict.get('工单编号', row_dict.get('投诉编号', row_dict.get('id', f'未知-{idx}'))))
            content = str(row_dict.get('投诉内容', row_dict.get('内容', row_dict.get('description', ''))))
            status = str(row_dict.get('工单状态', row_dict.get('状态', '未知')))
            order_type = str(row_dict.get('投诉类型', row_dict.get('类型', '未知')))
            
            result['by_status'][status] = result['by_status'].get(status, 0) + 1
            result['by_type'][order_type] = result['by_type'].get(order_type, 0) + 1
            
            order_info = {
                'index': idx,
                '工单编号': order_id,
                '投诉内容': content[:100] + '...' if len(content) > 100 else content,
                '状态': status,
                '类型': order_type,
                '创建时间': str(row_dict.get('创建时间', row_dict.get('时间', '')))
            }
            
            classified = False
            for keyword in evidence_keywords:
                if keyword in content:
                    result['additional_evidence'].append(order_info)
                    classified = True
                    break
            
            if not classified:
                for keyword in appeal_keywords:
                    if keyword in content:
                        result['driver_appeal'].append(order_info)
                        classified = True
                        break
            
            if not classified:
                for keyword in overrule_keywords:
                    if keyword in content:
                        result['cs_overrule'].append(order_info)
                        classified = True
                        break
            
            if not classified:
                result['other'].append(order_info)
        
        return result
    
    def _generate_report(self, result, input_file):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_file = self.output_dir / f'投诉升级整理报告_{timestamp}.txt'
        excel_file = self.output_dir / f'投诉升级分类结果_{timestamp}.xlsx'
        
        report_content = self._build_report_content(result, input_file)
        
        click.echo(report_content)
        
        if not self.dry_run:
            if report_file.exists() and not self.overwrite:
                click.echo(f"⚠️  报告文件已存在，跳过写入: {report_file}")
            else:
                with open(report_file, 'w', encoding='utf-8') as f:
                    f.write(report_content)
                click.echo(f"✅ 报告文件已生成: {report_file}")
            
            if excel_file.exists() and not self.overwrite:
                click.echo(f"⚠️  Excel文件已存在，跳过写入: {excel_file}")
            else:
                self._write_excel_result(result, excel_file)
                click.echo(f"✅ Excel分类结果已生成: {excel_file}")
        
        click.echo("")
        click.echo("="*60)
        click.echo("【投诉工单包投诉升级整理】处理完成")
        click.echo("="*60)
    
    def _build_report_content(self, result, input_file):
        content = []
        content.append("="*60)
        content.append("【投诉工单包投诉升级整理报告】")
        content.append("="*60)
        content.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append(f"源文件: {input_file}")
        content.append("")
        
        content.append("-"*60)
        content.append("一、整体统计")
        content.append("-"*60)
        content.append(f"投诉工单总数: {result['total']} 条")
        content.append(f"追加证据工单: {len(result['additional_evidence'])} 条 ({len(result['additional_evidence'])/result['total']*100:.1f}%)")
        content.append(f"司机申诉工单: {len(result['driver_appeal'])} 条 ({len(result['driver_appeal'])/result['total']*100:.1f}%)")
        content.append(f"客服改判工单: {len(result['cs_overrule'])} 条 ({len(result['cs_overrule'])/result['total']*100:.1f}%)")
        content.append(f"其他工单: {len(result['other'])} 条 ({len(result['other'])/result['total']*100:.1f}%)")
        content.append("")
        
        content.append("-"*60)
        content.append("二、按状态分布")
        content.append("-"*60)
        for status, count in sorted(result['by_status'].items(), key=lambda x: -x[1]):
            content.append(f"  {status}: {count} 条")
        content.append("")
        
        content.append("-"*60)
        content.append("三、按类型分布")
        content.append("-"*60)
        for order_type, count in sorted(result['by_type'].items(), key=lambda x: -x[1]):
            content.append(f"  {order_type}: {count} 条")
        content.append("")
        
        if result['additional_evidence']:
            content.append("-"*60)
            content.append("四、【重点关注】追加证据工单列表")
            content.append("-"*60)
            for i, order in enumerate(result['additional_evidence'], 1):
                content.append(f"  {i}. 工单编号: {order['工单编号']}")
                content.append(f"     状态: {order['状态']} | 类型: {order['类型']}")
                content.append(f"     投诉内容: {order['投诉内容']}")
                content.append(f"     创建时间: {order['创建时间']}")
                content.append("")
        
        if result['driver_appeal']:
            content.append("-"*60)
            content.append("五、【重点关注】司机申诉工单列表")
            content.append("-"*60)
            for i, order in enumerate(result['driver_appeal'], 1):
                content.append(f"  {i}. 工单编号: {order['工单编号']}")
                content.append(f"     状态: {order['状态']} | 类型: {order['类型']}")
                content.append(f"     投诉内容: {order['投诉内容']}")
                content.append(f"     创建时间: {order['创建时间']}")
                content.append("")
        
        if result['cs_overrule']:
            content.append("-"*60)
            content.append("六、【重点关注】客服改判工单列表")
            content.append("-"*60)
            for i, order in enumerate(result['cs_overrule'], 1):
                content.append(f"  {i}. 工单编号: {order['工单编号']}")
                content.append(f"     状态: {order['状态']} | 类型: {order['类型']}")
                content.append(f"     投诉内容: {order['投诉内容']}")
                content.append(f"     创建时间: {order['创建时间']}")
                content.append("")
        
        content.append("-"*60)
        content.append("七、其他工单列表（前10条）")
        content.append("-"*60)
        for i, order in enumerate(result['other'][:10], 1):
            content.append(f"  {i}. 工单编号: {order['工单编号']} | 状态: {order['状态']} | {order['投诉内容'][:50]}...")
        
        if len(result['other']) > 10:
            content.append(f"  ... 还有 {len(result['other']) - 10} 条其他工单未显示")
        
        content.append("")
        content.append("="*60)
        content.append("报告结束 - 投诉工单包投诉升级整理")
        content.append("="*60)
        
        return "\n".join(content)
    
    def _write_excel_result(self, result, excel_file):
        with pd.ExcelWriter(excel_file, engine='openpyxl') as writer:
            pd.DataFrame(result['additional_evidence']).to_excel(writer, sheet_name='追加证据', index=False)
            pd.DataFrame(result['driver_appeal']).to_excel(writer, sheet_name='司机申诉', index=False)
            pd.DataFrame(result['cs_overrule']).to_excel(writer, sheet_name='客服改判', index=False)
            pd.DataFrame(result['other']).to_excel(writer, sheet_name='其他工单', index=False)
            
            summary_data = {
                '分类': ['投诉工单总数', '追加证据', '司机申诉', '客服改判', '其他'],
                '数量': [
                    result['total'],
                    len(result['additional_evidence']),
                    len(result['driver_appeal']),
                    len(result['cs_overrule']),
                    len(result['other'])
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='统计汇总', index=False)


@click.command()
@click.option('--input', '-i', required=True, type=click.Path(exists=True), help='投诉工单文件路径（Excel/CSV）')
@click.option('--rules', '-r', required=True, type=click.Path(exists=True), help='规则配置文件路径（JSON）')
@click.option('--output', '-o', required=True, type=click.Path(), help='输出目录路径')
@click.option('--dry-run', '-d', is_flag=True, help='试运行模式，不生成实际文件')
@click.option('--overwrite', '-w', is_flag=True, help='覆盖已存在的输出文件')
def cli(input, rules, output, dry_run, overwrite):
    """投诉工单包投诉升级整理 CLI 工具"""
    processor = ComplaintOrderProcessor(rules, output, dry_run, overwrite)
    success = processor.process(input)
    if not success:
        raise click.ClickException("处理失败")


if __name__ == '__main__':
    cli()
