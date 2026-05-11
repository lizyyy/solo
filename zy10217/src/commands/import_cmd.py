import os
import click
import pandas as pd
from sqlalchemy.exc import IntegrityError
from src.database import get_session, init_db, calculate_source_hash, parse_date, safe_float, log_audit
from src.models import Farmer, Plot, WorkType, WorkRecord, OilSubsidyRule, HistoricalDebt


@click.group()
def import_cmd():
    """数据导入命令"""
    pass


@import_cmd.command('farmers')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
def import_farmers(file_path, sheet, dry_run):
    """导入农户数据"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['姓名']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        skipped = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                id_number = str(row.get('身份证号', '')).strip() if row.get('身份证号') else None
                
                farmer = Farmer(
                    name=str(row['姓名']).strip(),
                    phone=str(row.get('电话', '')).strip(),
                    village=str(row.get('村', '')).strip(),
                    id_number=id_number,
                    source=os.path.basename(file_path)
                )
                
                existing = session.query(Farmer).filter(
                    Farmer.name == farmer.name
                ).first()
                
                if existing:
                    if id_number and existing.id_number != id_number:
                        existing.id_number = id_number
                    if row.get('电话') and existing.phone != str(row['电话']).strip():
                        existing.phone = str(row['电话']).strip()
                    if row.get('村') and existing.village != str(row['村']).strip():
                        existing.village = str(row['村']).strip()
                    skipped += 1
                else:
                    session.add(farmer)
                    imported += 1
                    
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 个农户，跳过 {skipped} 个已存在的农户')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 个农户，跳过 {skipped} 个已存在的农户')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@import_cmd.command('plots')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
def import_plots(file_path, sheet, dry_run):
    """导入地块数据"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['农户姓名', '地块名称', '面积']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        skipped = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                farmer_name = str(row['农户姓名']).strip()
                farmer = session.query(Farmer).filter(
                    Farmer.name == farmer_name
                ).first()
                
                if not farmer:
                    errors.append(f'第{idx+2}行: 农户 "{farmer_name}" 不存在')
                    continue
                
                plot_code = str(row.get('地块编号', '')).strip()
                if not plot_code:
                    plot_code = f'{farmer_name}_{str(row["地块名称"]).strip()}'
                
                area = safe_float(row['面积'])
                area_unit = str(row.get('面积单位', '亩')).strip() or '亩'
                
                existing = session.query(Plot).filter(
                    Plot.plot_code == plot_code
                ).first()
                
                if existing:
                    skipped += 1
                    continue
                
                plot = Plot(
                    farmer_id=farmer.id,
                    plot_name=str(row['地块名称']).strip(),
                    plot_code=plot_code,
                    area=area,
                    area_unit=area_unit,
                    location=str(row.get('位置', '')).strip(),
                    source=os.path.basename(file_path)
                )
                session.add(plot)
                imported += 1
                
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 个地块，跳过 {skipped} 个已存在的地块')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 个地块，跳过 {skipped} 个已存在的地块')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@import_cmd.command('work-types')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
def import_work_types(file_path, sheet, dry_run):
    """导入作业类型数据"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['作业类型', '单价']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        updated = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                name = str(row['作业类型']).strip()
                unit_price = safe_float(row['单价'])
                unit = str(row.get('单位', '亩')).strip() or '亩'
                
                existing = session.query(WorkType).filter(
                    WorkType.name == name
                ).first()
                
                if existing:
                    existing.unit_price = unit_price
                    existing.unit = unit
                    existing.description = str(row.get('说明', '')).strip()
                    updated += 1
                else:
                    work_type = WorkType(
                        name=name,
                        unit_price=unit_price,
                        unit=unit,
                        description=str(row.get('说明', '')).strip(),
                        source=os.path.basename(file_path)
                    )
                    session.add(work_type)
                    imported += 1
                
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 个作业类型，更新 {updated} 个已存在的作业类型')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 个作业类型，更新 {updated} 个已存在的作业类型')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@import_cmd.command('records')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
@click.option('--auto-confirm', is_flag=True, help='自动标记为已确认（请谨慎使用）')
def import_work_records(file_path, sheet, dry_run, auto_confirm):
    """导入作业记录数据"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['农户姓名', '地块名称', '作业类型', '作业日期', '面积']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        duplicates = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                farmer_name = str(row['农户姓名']).strip()
                plot_name = str(row['地块名称']).strip()
                work_type_name = str(row['作业类型']).strip()
                work_date = parse_date(row['作业日期'])
                area = safe_float(row['面积'])
                area_unit = str(row.get('面积单位', '亩')).strip() or '亩'
                
                farmer = session.query(Farmer).filter(
                    Farmer.name == farmer_name
                ).first()
                if not farmer:
                    errors.append(f'第{idx+2}行: 农户 "{farmer_name}" 不存在')
                    continue
                
                plot = session.query(Plot).filter(
                    Plot.farmer_id == farmer.id,
                    Plot.plot_name == plot_name
                ).first()
                if not plot:
                    errors.append(f'第{idx+2}行: 地块 "{plot_name}" 不属于农户 "{farmer_name}"')
                    continue
                
                work_type = session.query(WorkType).filter(
                    WorkType.name == work_type_name
                ).first()
                if not work_type:
                    errors.append(f'第{idx+2}行: 作业类型 "{work_type_name}" 不存在')
                    continue
                
                source_hash = calculate_source_hash(
                    farmer.id, plot.id, work_type.id, work_date, area, area_unit
                )
                
                existing = session.query(WorkRecord).filter(
                    WorkRecord.source_hash == source_hash
                ).first()
                
                if existing:
                    duplicates += 1
                    continue
                
                is_confirmed = bool(row.get('已确认', auto_confirm))
                
                record = WorkRecord(
                    farmer_id=farmer.id,
                    plot_id=plot.id,
                    work_type_id=work_type.id,
                    work_date=work_date,
                    area=area,
                    area_unit=area_unit,
                    operator_name=str(row.get('机手', '')).strip(),
                    machine_name=str(row.get('机械', '')).strip(),
                    is_confirmed=is_confirmed,
                    confirmed_by=str(row.get('确认人', 'system')).strip() if is_confirmed else None,
                    confirmed_at=None,
                    source=os.path.basename(file_path),
                    source_hash=source_hash
                )
                session.add(record)
                imported += 1
                
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 条作业记录，跳过 {duplicates} 条重复记录')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:10]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 条作业记录，跳过 {duplicates} 条重复记录')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:10]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@import_cmd.command('oil-subsidy')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
def import_oil_subsidy(file_path, sheet, dry_run):
    """导入油补规则"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['规则名称', '作业类型', '补贴类型', '补贴值']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                work_type_name = str(row['作业类型']).strip()
                work_type = session.query(WorkType).filter(
                    WorkType.name == work_type_name
                ).first()
                
                if not work_type:
                    errors.append(f'第{idx+2}行: 作业类型 "{work_type_name}" 不存在')
                    continue
                
                subsidy_type = str(row['补贴类型']).strip().lower()
                if subsidy_type not in ['percentage', 'fixed', '比例', '固定']:
                    errors.append(f'第{idx+2}行: 补贴类型必须是 percentage/fixed 或 比例/固定')
                    continue
                
                if subsidy_type in ['比例', 'percentage']:
                    subsidy_type = 'percentage'
                else:
                    subsidy_type = 'fixed'
                
                rule = OilSubsidyRule(
                    name=str(row['规则名称']).strip(),
                    work_type_id=work_type.id,
                    subsidy_type=subsidy_type,
                    value=safe_float(row['补贴值']),
                    max_amount=safe_float(row.get('最高补贴', 0)) or None,
                    effective_date=parse_date(row['生效日期']) if row.get('生效日期') else None,
                    expiration_date=parse_date(row['截止日期']) if row.get('截止日期') else None,
                    is_active=bool(row.get('是否启用', True)),
                    source=os.path.basename(file_path)
                )
                session.add(rule)
                imported += 1
                
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 条油补规则')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 条油补规则')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()


@import_cmd.command('historical-debt')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--sheet', default=0, help='Excel工作表名称或索引')
@click.option('--dry-run', is_flag=True, help='试运行，不实际写入数据库')
def import_historical_debt(file_path, sheet, dry_run):
    """导入历史欠款"""
    init_db()
    session = get_session()
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet)
        df = df.fillna('')
        
        required_cols = ['农户姓名', '欠款金额']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            click.echo(f'缺少必要列: {missing}')
            return
        
        imported = 0
        duplicates = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                farmer_name = str(row['农户姓名']).strip()
                farmer = session.query(Farmer).filter(
                    Farmer.name == farmer_name
                ).first()
                
                if not farmer:
                    errors.append(f'第{idx+2}行: 农户 "{farmer_name}" 不存在')
                    continue
                
                amount = safe_float(row['欠款金额'])
                debt_date = parse_date(row['欠款日期']) if row.get('欠款日期') else None
                description = str(row.get('说明', '')).strip()
                
                source_hash = calculate_source_hash(
                    farmer.id, amount, debt_date, description
                )
                
                existing = session.query(HistoricalDebt).filter(
                    HistoricalDebt.source_hash == source_hash
                ).first()
                
                if existing:
                    duplicates += 1
                    continue
                
                debt = HistoricalDebt(
                    farmer_id=farmer.id,
                    amount=amount,
                    debt_date=debt_date,
                    description=description,
                    source=os.path.basename(file_path),
                    source_hash=source_hash
                )
                session.add(debt)
                imported += 1
                
            except Exception as e:
                errors.append(f'第{idx+2}行: {str(e)}')
        
        if dry_run:
            click.echo(f'[试运行] 将导入 {imported} 条历史欠款，跳过 {duplicates} 条重复记录')
            if errors:
                click.echo(f'错误: {len(errors)} 个')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
            session.rollback()
        else:
            session.commit()
            click.echo(f'成功导入 {imported} 条历史欠款，跳过 {duplicates} 条重复记录')
            if errors:
                click.echo(f'有 {len(errors)} 个错误')
                for e in errors[:5]:
                    click.echo(f'  - {e}')
                    
    except Exception as e:
        click.echo(f'导入失败: {str(e)}')
        session.rollback()
    finally:
        session.close()
