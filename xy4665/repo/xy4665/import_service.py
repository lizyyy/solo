import json
import csv
import os
from datetime import datetime, date, time
from typing import Dict, List, Any, Optional, Tuple
from models import (
    db, AliasTemplate, FieldAlias, Team, Member, Boat, 
    RaceSchedule, UnmappedRow, ImportSession, ImportedFile
)

class FieldMapper:
    def __init__(self, template_id: Optional[int] = None):
        self.mapping = {}
        self.reverse_mapping = {}
        self.template = None
        if template_id:
            self.load_template(template_id)
        else:
            self.load_default_template()
    
    def load_default_template(self):
        default_template = AliasTemplate.query.filter_by(is_default=True).first()
        if default_template:
            self.load_template(default_template.id)
        else:
            self._create_default_template()
    
    def _create_default_template(self):
        default_aliases = {
            'team_name': ['队伍名称', '队名', 'team', 'team_name', '队伍'],
            'community': ['社区', '所属社区', 'community', '单位'],
            'member_number': ['队员号', '选手ID', 'member_id', '选手号', '队员编号', 'id'],
            'name': ['姓名', 'name', '队员姓名', '选手姓名'],
            'gender': ['性别', 'gender', 'sex'],
            'age': ['年龄', 'age', '岁数'],
            'weight': ['体重', 'weight', 'kg', '重量'],
            'id_card': ['身份证号', '身份证', 'id_card', '证件号'],
            'role': ['角色', 'role', '职位', '岗位'],
            'boat_number': ['船号', '艇号', 'boat', '船艇号', 'boat_number'],
            'capacity': ['容量', 'capacity', '载客数'],
            'status': ['状态', 'status'],
            'race_name': ['赛事名称', '比赛名称', 'race_name', '赛事'],
            'race_date': ['比赛日期', '日期', 'race_date', 'date'],
            'start_time': ['开始时间', 'start_time', '开赛时间'],
            'end_time': ['结束时间', 'end_time', '完赛时间'],
            'track_number': ['赛道号', '赛道', 'track_number', '赛道编号'],
            'round_type': ['轮次', 'round_type', '比赛类型', '阶段']
        }
        
        template = AliasTemplate(
            name='默认别名模板',
            description='系统默认的字段别名映射模板',
            is_default=True
        )
        db.session.add(template)
        db.session.flush()
        
        for standard_field, aliases in default_aliases.items():
            field_alias = FieldAlias(
                template_id=template.id,
                standard_field=standard_field,
                aliases=','.join(aliases),
                description=f'{standard_field} 的别名映射'
            )
            db.session.add(field_alias)
            self.mapping.update({alias.lower(): standard_field for alias in aliases})
            self.reverse_mapping[standard_field] = aliases
        
        db.session.commit()
        self.template = template
    
    def load_template(self, template_id: int):
        template = AliasTemplate.query.get(template_id)
        if not template:
            self.load_default_template()
            return
        
        self.template = template
        self.mapping = {}
        self.reverse_mapping = {}
        
        for field_alias in template.aliases:
            standard_field = field_alias.standard_field
            aliases = field_alias.get_aliases_list()
            self.reverse_mapping[standard_field] = aliases
            for alias in aliases:
                self.mapping[alias] = standard_field
    
    def map_field(self, field_name: str) -> str:
        normalized = field_name.strip().lower()
        return self.mapping.get(normalized, field_name)
    
    def map_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        mapped = {}
        unmapped_fields = {}
        
        for key, value in row.items():
            mapped_key = self.map_field(key)
            if mapped_key != key and mapped_key not in mapped:
                mapped[mapped_key] = value
            elif mapped_key not in mapped:
                unmapped_fields[key] = value
        
        mapped.update(unmapped_fields)
        return mapped
    
    def get_standard_fields(self) -> List[str]:
        return list(self.reverse_mapping.keys())

class FileParser:
    def __init__(self, field_mapper: FieldMapper):
        self.field_mapper = field_mapper
    
    def parse_file(self, file_path: str, file_type: str = None) -> Tuple[List[Dict], List[Dict]]:
        if not file_type:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.json':
                file_type = 'json'
            elif ext == '.csv':
                file_type = 'csv'
            else:
                raise ValueError(f'不支持的文件格式: {ext}')
        
        if file_type == 'json':
            return self._parse_json(file_path)
        elif file_type == 'csv':
            return self._parse_csv(file_path)
        else:
            raise ValueError(f'不支持的文件类型: {file_type}')
    
    def _parse_json(self, file_path: str) -> Tuple[List[Dict], List[Dict]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            data = [data]
        
        parsed_rows = []
        mapping_issues = []
        
        for row_num, row in enumerate(data, start=2):
            if not isinstance(row, dict):
                mapping_issues.append({
                    'row_number': row_num,
                    'error': '行格式错误，应为对象',
                    'row_data': json.dumps(row, ensure_ascii=False)
                })
                continue
            
            mapped_row = self.field_mapper.map_row(row)
            parsed_rows.append({
                'row_number': row_num,
                'data': mapped_row,
                'original_data': row
            })
        
        return parsed_rows, mapping_issues
    
    def _parse_csv(self, file_path: str) -> Tuple[List[Dict], List[Dict]]:
        parsed_rows = []
        mapping_issues = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row_num, row in enumerate(reader, start=2):
                if not row:
                    continue
                
                mapped_row = self.field_mapper.map_row(row)
                parsed_rows.append({
                    'row_number': row_num,
                    'data': mapped_row,
                    'original_data': row
                })
        
        return parsed_rows, mapping_issues

class DataImporter:
    def __init__(self, field_mapper: FieldMapper):
        self.field_mapper = field_mapper
        self.parser = FileParser(field_mapper)
    
    def detect_data_type(self, row: Dict[str, Any]) -> str:
        keys = set(row.keys())
        
        member_indicators = {'name', 'member_number', 'age', 'weight', 'id_card'}
        team_indicators = {'team_name', 'community', 'contact_person'}
        boat_indicators = {'boat_number', 'capacity', 'status'}
        schedule_indicators = {'race_name', 'race_date', 'start_time', 'track_number'}
        
        member_matches = len(keys & member_indicators)
        team_matches = len(keys & team_indicators)
        boat_matches = len(keys & boat_indicators)
        schedule_matches = len(keys & schedule_indicators)
        
        max_matches = max(member_matches, team_matches, boat_matches, schedule_matches)
        
        if max_matches == 0:
            return 'unknown'
        elif member_matches == max_matches:
            return 'member'
        elif team_matches == max_matches:
            return 'team'
        elif boat_matches == max_matches:
            return 'boat'
        else:
            return 'schedule'
    
    def parse_value(self, value: Any, value_type: str):
        if value is None or value == '':
            return None
        
        if value_type == 'int':
            try:
                return int(value)
            except (ValueError, TypeError):
                return None
        elif value_type == 'float':
            try:
                return float(value)
            except (ValueError, TypeError):
                return None
        elif value_type == 'date':
            if isinstance(value, date):
                return value
            try:
                return datetime.strptime(str(value), '%Y-%m-%d').date()
            except ValueError:
                try:
                    return datetime.strptime(str(value), '%Y/%m/%d').date()
                except ValueError:
                    return None
        elif value_type == 'time':
            if isinstance(value, time):
                return value
            try:
                return datetime.strptime(str(value), '%H:%M:%S').time()
            except ValueError:
                try:
                    return datetime.strptime(str(value), '%H:%M').time()
                except ValueError:
                    return None
        else:
            return str(value).strip()
    
    def import_team(self, data: Dict[str, Any], source_file: str, row_number: int) -> Tuple[Optional[Team], List[Dict]]:
        issues = []
        
        team_name = self.parse_value(data.get('team_name'), 'str')
        if not team_name:
            issues.append({
                'field_name': 'team_name',
                'field_value': data.get('team_name'),
                'expected_field': 'team_name',
                'error_message': '队伍名称不能为空'
            })
            return None, issues
        
        existing_team = Team.query.filter_by(name=team_name).first()
        if existing_team:
            return existing_team, []
        
        team = Team(
            name=team_name,
            community=self.parse_value(data.get('community'), 'str'),
            contact_person=self.parse_value(data.get('contact_person'), 'str'),
            contact_phone=self.parse_value(data.get('contact_phone'), 'str'),
            source_file=source_file
        )
        
        db.session.add(team)
        return team, issues
    
    def import_member(self, data: Dict[str, Any], source_file: str, row_number: int) -> Tuple[Optional[Member], List[Dict]]:
        issues = []
        
        name = self.parse_value(data.get('name'), 'str')
        if not name:
            issues.append({
                'field_name': 'name',
                'field_value': data.get('name'),
                'expected_field': 'name',
                'error_message': '队员姓名不能为空'
            })
        
        team_name = self.parse_value(data.get('team_name'), 'str')
        team = None
        if team_name:
            team = Team.query.filter_by(name=team_name).first()
        
        if not team:
            team = Team.query.first()
            if not team:
                team = Team(name='未知队伍', source_file=source_file)
                db.session.add(team)
                db.session.flush()
        
        member = Member(
            team_id=team.id,
            member_number=self.parse_value(data.get('member_number'), 'str'),
            name=name or '未知姓名',
            gender=self.parse_value(data.get('gender'), 'str'),
            age=self.parse_value(data.get('age'), 'int'),
            weight=self.parse_value(data.get('weight'), 'float'),
            id_card=self.parse_value(data.get('id_card'), 'str'),
            role=self.parse_value(data.get('role'), 'str'),
            source_file=source_file,
            source_row=row_number
        )
        
        db.session.add(member)
        return member, issues
    
    def import_boat(self, data: Dict[str, Any], source_file: str, row_number: int) -> Tuple[Optional[Boat], List[Dict]]:
        issues = []
        
        boat_number = self.parse_value(data.get('boat_number'), 'str')
        if not boat_number:
            issues.append({
                'field_name': 'boat_number',
                'field_value': data.get('boat_number'),
                'expected_field': 'boat_number',
                'error_message': '船号不能为空'
            })
            return None, issues
        
        existing_boat = Boat.query.filter_by(boat_number=boat_number).first()
        if existing_boat:
            return existing_boat, []
        
        team_name = self.parse_value(data.get('team_name'), 'str')
        team_id = None
        if team_name:
            team = Team.query.filter_by(name=team_name).first()
            if team:
                team_id = team.id
        
        boat = Boat(
            boat_number=boat_number,
            team_id=team_id,
            capacity=self.parse_value(data.get('capacity'), 'int') or 22,
            status=self.parse_value(data.get('status'), 'str') or 'available',
            source_file=source_file
        )
        
        db.session.add(boat)
        return boat, issues
    
    def import_schedule(self, data: Dict[str, Any], source_file: str, row_number: int) -> Tuple[Optional[RaceSchedule], List[Dict]]:
        issues = []
        
        race_name = self.parse_value(data.get('race_name'), 'str')
        race_date = self.parse_value(data.get('race_date'), 'date')
        start_time = self.parse_value(data.get('start_time'), 'time')
        end_time = self.parse_value(data.get('end_time'), 'time')
        
        if not race_name:
            issues.append({
                'field_name': 'race_name',
                'field_value': data.get('race_name'),
                'expected_field': 'race_name',
                'error_message': '赛事名称不能为空'
            })
        
        if not race_date:
            issues.append({
                'field_name': 'race_date',
                'field_value': data.get('race_date'),
                'expected_field': 'race_date',
                'error_message': '比赛日期不能为空或格式错误'
            })
        
        if not start_time:
            issues.append({
                'field_name': 'start_time',
                'field_value': data.get('start_time'),
                'expected_field': 'start_time',
                'error_message': '开始时间不能为空或格式错误'
            })
        
        if not end_time:
            issues.append({
                'field_name': 'end_time',
                'field_value': data.get('end_time'),
                'expected_field': 'end_time',
                'error_message': '结束时间不能为空或格式错误'
            })
        
        team_name = self.parse_value(data.get('team_name'), 'str')
        team_id = None
        if team_name:
            team = Team.query.filter_by(name=team_name).first()
            if team:
                team_id = team.id
        
        schedule = RaceSchedule(
            race_name=race_name or '未知赛事',
            race_date=race_date or date.today(),
            start_time=start_time or time(9, 0),
            end_time=end_time or time(10, 0),
            track_number=self.parse_value(data.get('track_number'), 'int'),
            boat_number=self.parse_value(data.get('boat_number'), 'str'),
            team_id=team_id,
            round_type=self.parse_value(data.get('round_type'), 'str'),
            source_file=source_file
        )
        
        db.session.add(schedule)
        return schedule, issues
    
    def import_rows(self, rows: List[Dict], source_file: str, data_type_hint: str = None) -> Dict[str, Any]:
        result = {
            'total_rows': len(rows),
            'success_count': 0,
            'error_count': 0,
            'unmapped_rows': [],
            'imported_teams': [],
            'imported_members': [],
            'imported_boats': [],
            'imported_schedules': []
        }
        
        for row_data in rows:
            row_number = row_data['row_number']
            data = row_data['data']
            original_data = row_data['original_data']
            
            data_type = data_type_hint or self.detect_data_type(data)
            
            if data_type == 'unknown':
                unmapped = UnmappedRow(
                    source_file=source_file,
                    row_number=row_number,
                    error_message='无法识别的数据类型',
                    row_data=json.dumps(original_data, ensure_ascii=False)
                )
                db.session.add(unmapped)
                result['unmapped_rows'].append({
                    'row_number': row_number,
                    'error': '无法识别的数据类型'
                })
                result['error_count'] += 1
                continue
            
            issues = []
            imported = None
            
            try:
                if data_type == 'team':
                    imported, issues = self.import_team(data, source_file, row_number)
                    if imported:
                        result['imported_teams'].append(imported.id)
                elif data_type == 'member':
                    imported, issues = self.import_member(data, source_file, row_number)
                    if imported:
                        result['imported_members'].append(imported.id)
                elif data_type == 'boat':
                    imported, issues = self.import_boat(data, source_file, row_number)
                    if imported:
                        result['imported_boats'].append(imported.id)
                elif data_type == 'schedule':
                    imported, issues = self.import_schedule(data, source_file, row_number)
                    if imported:
                        result['imported_schedules'].append(imported.id)
                
                if issues:
                    for issue in issues:
                        unmapped = UnmappedRow(
                            source_file=source_file,
                            row_number=row_number,
                            field_name=issue.get('field_name'),
                            field_value=issue.get('field_value'),
                            expected_field=issue.get('expected_field'),
                            error_message=issue.get('error_message'),
                            row_data=json.dumps(original_data, ensure_ascii=False)
                        )
                        db.session.add(unmapped)
                    result['error_count'] += 1
                else:
                    result['success_count'] += 1
                    
            except Exception as e:
                unmapped = UnmappedRow(
                    source_file=source_file,
                    row_number=row_number,
                    error_message=f'导入错误: {str(e)}',
                    row_data=json.dumps(original_data, ensure_ascii=False)
                )
                db.session.add(unmapped)
                result['unmapped_rows'].append({
                    'row_number': row_number,
                    'error': str(e)
                })
                result['error_count'] += 1
        
        db.session.commit()
        return result
