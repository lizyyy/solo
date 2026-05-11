from datetime import date
from sqlalchemy.orm import Session
from .models import WorkRecord, WorkType, OilSubsidyRule, HistoricalDebt, Farmer
from .database import normalize_area


def calculate_work_fee(session: Session, record: WorkRecord):
    if not record.work_type:
        return 0.0
    
    unit_price = record.work_type.unit_price
    area_mu = normalize_area(record.area, record.area_unit)
    
    return area_mu * unit_price


def calculate_oil_subsidy_raw(session: Session, record: WorkRecord):
    work_fee = calculate_work_fee(session, record)
    if work_fee <= 0:
        return 0.0
    
    rules = session.query(OilSubsidyRule).filter(
        OilSubsidyRule.work_type_id == record.work_type_id,
        OilSubsidyRule.is_active == True
    ).all()
    
    if not rules:
        return 0.0
    
    max_subsidy = 0.0
    for rule in rules:
        if rule.effective_date and record.work_date < rule.effective_date:
            continue
        if rule.expiration_date and record.work_date > rule.expiration_date:
            continue
        
        if rule.subsidy_type == 'percentage':
            subsidy = work_fee * (rule.value / 100)
        elif rule.subsidy_type == 'fixed':
            subsidy = rule.value
        else:
            continue
        
        if rule.max_amount and subsidy > rule.max_amount:
            subsidy = rule.max_amount
        
        if subsidy > max_subsidy:
            max_subsidy = subsidy
    
    return max_subsidy


def calculate_oil_subsidy(session: Session, record: WorkRecord):
    raw_subsidy = calculate_oil_subsidy_raw(session, record)
    work_fee = calculate_work_fee(session, record)
    return min(raw_subsidy, work_fee)


def calculate_historical_debt(session: Session, farmer_id: int):
    debts = session.query(HistoricalDebt).filter(
        HistoricalDebt.farmer_id == farmer_id
    ).all()
    
    return sum(d.amount for d in debts)


def calculate_record_total(session: Session, record: WorkRecord):
    work_fee = calculate_work_fee(session, record)
    subsidy = calculate_oil_subsidy(session, record)
    actual_fee = work_fee - subsidy
    
    return {
        'work_fee': work_fee,
        'oil_subsidy': subsidy,
        'actual_fee': actual_fee
    }


def calculate_farmer_total(
    session: Session, 
    farmer_id: int, 
    include_confirmed_only: bool = True,
    include_finalized_only: bool = False
):
    query = session.query(WorkRecord).filter(
        WorkRecord.farmer_id == farmer_id
    )
    
    if include_confirmed_only:
        query = query.filter(WorkRecord.is_confirmed == True)
    
    if include_finalized_only:
        query = query.filter(WorkRecord.is_finalized == True)
    
    records = query.all()
    
    total_work_fee = 0.0
    total_subsidy = 0.0
    
    for record in records:
        fees = calculate_record_total(session, record)
        total_work_fee += fees['work_fee']
        total_subsidy += fees['oil_subsidy']
    
    historical_debt = calculate_historical_debt(session, farmer_id)
    
    return {
        'work_fee': total_work_fee,
        'oil_subsidy': total_subsidy,
        'current_actual_fee': total_work_fee - total_subsidy,
        'historical_debt': historical_debt,
        'total_amount': (total_work_fee - total_subsidy) + historical_debt
    }


def calculate_village_summary(session: Session, village: str = None, include_finalized_only: bool = True):
    query = session.query(Farmer)
    if village:
        query = query.filter(Farmer.village == village)
    
    farmers = query.all()
    
    village_stats = {}
    
    for farmer in farmers:
        farmer_village = farmer.village or '未分配'
        if farmer_village not in village_stats:
            village_stats[farmer_village] = {
                'village': farmer_village,
                'farmer_count': 0,
                'record_count': 0,
                'work_fee': 0.0,
                'oil_subsidy': 0.0,
                'historical_debt': 0.0,
                'total_amount': 0.0
            }
        
        stats = village_stats[farmer_village]
        stats['farmer_count'] += 1
        
        record_query = session.query(WorkRecord).filter(
            WorkRecord.farmer_id == farmer.id
        )
        if include_finalized_only:
            record_query = record_query.filter(WorkRecord.is_finalized == True)
        
        records = record_query.all()
        stats['record_count'] += len(records)
        
        farmer_totals = calculate_farmer_total(
            session, 
            farmer.id, 
            include_confirmed_only=True,
            include_finalized_only=include_finalized_only
        )
        stats['work_fee'] += farmer_totals['work_fee']
        stats['oil_subsidy'] += farmer_totals['oil_subsidy']
        stats['historical_debt'] += farmer_totals['historical_debt']
        stats['total_amount'] += farmer_totals['total_amount']
    
    return list(village_stats.values())


def get_duplicate_records(session: Session):
    from sqlalchemy import func
    
    duplicates = []
    
    subquery = session.query(
        WorkRecord.farmer_id,
        WorkRecord.plot_id,
        WorkRecord.work_type_id,
        WorkRecord.work_date,
        func.count(WorkRecord.id).label('count')
    ).group_by(
        WorkRecord.farmer_id,
        WorkRecord.plot_id,
        WorkRecord.work_type_id,
        WorkRecord.work_date
    ).having(func.count(WorkRecord.id) > 1).subquery()
    
    results = session.query(WorkRecord).join(
        subquery,
        (WorkRecord.farmer_id == subquery.c.farmer_id) &
        (WorkRecord.plot_id == subquery.c.plot_id) &
        (WorkRecord.work_type_id == subquery.c.work_type_id) &
        (WorkRecord.work_date == subquery.c.work_date)
    ).order_by(
        WorkRecord.farmer_id,
        WorkRecord.plot_id,
        WorkRecord.work_date
    ).all()
    
    return results


def check_area_unit_conflicts(session: Session):
    conflicts = []
    
    records = session.query(WorkRecord).all()
    for record in records:
        if not record.plot:
            continue
        
        plot_unit = record.plot.area_unit
        record_unit = record.area_unit
        
        if plot_unit != record_unit:
            conflicts.append({
                'record_id': record.id,
                'farmer_name': record.farmer.name if record.farmer else '未知',
                'plot_name': record.plot.plot_name,
                'plot_unit': plot_unit,
                'record_unit': record_unit,
                'plot_area': record.plot.area,
                'record_area': record.area
            })
    
    return conflicts


def check_unconfirmed_finalized(session: Session):
    records = session.query(WorkRecord).filter(
        WorkRecord.is_finalized == True,
        WorkRecord.is_confirmed == False
    ).all()
    
    return records


def check_subsidy_exceeds_fee(session: Session):
    issues = []
    
    records = session.query(WorkRecord).all()
    for record in records:
        work_fee = calculate_work_fee(session, record)
        raw_subsidy = calculate_oil_subsidy_raw(session, record)
        if raw_subsidy > work_fee:
            issues.append({
                'record_id': record.id,
                'farmer_name': record.farmer.name if record.farmer else '未知',
                'work_fee': work_fee,
                'oil_subsidy_raw': raw_subsidy,
                'oil_subsidy_capped': min(raw_subsidy, work_fee),
                'excess_amount': raw_subsidy - work_fee
            })
    
    return issues
