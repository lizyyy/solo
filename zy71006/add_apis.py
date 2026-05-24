#!/usr/bin/env python3
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def add_apis():
    apis = [
        '',
        '@app.post("/api/hazards/register", response_model=HazardResponse)',
        'def register_hazard(hazard: HazardCreate, db: Session = Depends(get_db), operator: Optional[str] = None):',
        '    loc_hash = calc_location_hash(hazard.tree_number, hazard.road_location)',
        '    existing = db.query(HazardDB).filter(HazardDB.location_hash == loc_hash, HazardDB.is_duplicate == 0).first()',
        '    db_hazard = HazardDB(',
        '        tree_number=hazard.tree_number,',
        '        road_location=hazard.road_location,',
        '        location_hash=loc_hash,',
        '        photo_path=hazard.photo_path,',
        '        hazard_level=hazard.hazard_level.value,',
        '        disposal_team=hazard.disposal_team,',
        '        batch_id=hazard.batch_id,',
        '        description=hazard.description,',
        '        is_duplicate=1 if existing else 0,',
        '        original_hazard_id=existing.id if existing else None,',
        '    )',
        '    db.add(db_hazard)',
        '    db.commit()',
        '    db.refresh(db_hazard)',
        '    log_operation(db, db_hazard.id, OperationType.REGISTER, operator=operator, remark="重复上报" if existing else "新登记", new_status=db_hazard.status, new_level=db_hazard.hazard_level)',
        '    return db_hazard',
        '',
    ]
    
    path = os.path.join(BASE, 'main.py')
    with open(path, 'a') as f:
        f.write('\n'.join(apis))
    print(f"Added {len(apis)} lines")

if __name__ == '__main__':
    add_apis()
