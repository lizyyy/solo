from datetime import datetime, date, time
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy import and_, or_
from models import (
    db, Member, Team, Boat, RaceSchedule, Risk
)
from config import Config

class ValidationService:
    def __init__(self):
        self.rules = [
            self.check_duplicate_members,
            self.check_age_violations,
            self.check_weight_violations,
            self.check_boat_conflicts,
            self.check_schedule_conflicts,
            self.check_team_size,
        ]
    
    def run_all_validations(self) -> Dict[str, Any]:
        all_risks = []
        stats = {
            'total_checks': len(self.rules),
            'risks_found': 0,
            'errors': 0,
            'warnings': 0,
            'infos': 0
        }
        
        for rule in self.rules:
            risks = rule()
            all_risks.extend(risks)
            
            for risk in risks:
                if risk.severity == 'error':
                    stats['errors'] += 1
                elif risk.severity == 'warning':
                    stats['warnings'] += 1
                else:
                    stats['infos'] += 1
        
        stats['risks_found'] = len(all_risks)
        
        return {
            'stats': stats,
            'risks': [risk.to_dict() for risk in all_risks]
        }
    
    def check_duplicate_members(self) -> List[Risk]:
        risks = []
        
        members = Member.query.all()
        
        id_card_groups = {}
        name_groups = {}
        
        for member in members:
            if member.id_card:
                if member.id_card not in id_card_groups:
                    id_card_groups[member.id_card] = []
                id_card_groups[member.id_card].append(member)
            
            name_key = (member.name, member.age) if member.age else (member.name,)
            if name_key not in name_groups:
                name_groups[name_key] = []
            name_groups[name_key].append(member)
        
        for id_card, member_list in id_card_groups.items():
            if len(member_list) > 1:
                for i, member in enumerate(member_list):
                    other_members = [m for j, m in enumerate(member_list) if j != i]
                    other_teams = ', '.join([f"{m.team.name if m.team else '未知队伍'} (行{m.source_row})" for m in other_members])
                    
                    existing = Risk.query.filter_by(
                        risk_type='duplicate_member',
                        related_type='member',
                        related_id=member.id,
                        is_resolved=False
                    ).first()
                    
                    if not existing:
                        risk = Risk(
                            risk_type='duplicate_member',
                            severity='error',
                            title=f'重复队员: {member.name}',
                            description=f'身份证号 {id_card} 在多个队伍中出现: {other_teams}',
                            related_type='member',
                            related_id=member.id,
                            source_file=member.source_file,
                            source_row=member.source_row
                        )
                        db.session.add(risk)
                        risks.append(risk)
        
        for name_key, member_list in name_groups.items():
            if len(member_list) > 1:
                name = name_key[0]
                age = name_key[1] if len(name_key) > 1 else None
                
                id_cards = set([m.id_card for m in member_list if m.id_card])
                if len(id_cards) <= 1:
                    continue
                
                for i, member in enumerate(member_list):
                    other_members = [m for j, m in enumerate(member_list) if j != i]
                    other_teams = ', '.join([f"{m.team.name if m.team else '未知队伍'} (行{m.source_row})" for m in other_members])
                    
                    existing = Risk.query.filter_by(
                        risk_type='duplicate_member_name',
                        related_type='member',
                        related_id=member.id,
                        is_resolved=False
                    ).first()
                    
                    if not existing:
                        age_str = f", 年龄: {age}" if age else ""
                        risk = Risk(
                            risk_type='duplicate_member_name',
                            severity='warning',
                            title=f'疑似重复队员: {name}',
                            description=f'队员 {name}{age_str} 在多个队伍中出现，可能是重名: {other_teams}。请核实身份证号。',
                            related_type='member',
                            related_id=member.id,
                            source_file=member.source_file,
                            source_row=member.source_row
                        )
                        db.session.add(risk)
                        risks.append(risk)
        
        db.session.commit()
        return risks
    
    def check_age_violations(self) -> List[Risk]:
        risks = []
        
        members = Member.query.filter(
            or_(
                Member.age < Config.MIN_AGE,
                Member.age > Config.MAX_AGE
            )
        ).all()
        
        for member in members:
            if member.age is None:
                continue
            
            existing = Risk.query.filter_by(
                risk_type='age_violation',
                related_type='member',
                related_id=member.id,
                is_resolved=False
            ).first()
            
            if not existing:
                if member.age < Config.MIN_AGE:
                    severity = 'error'
                    title = f'年龄偏小: {member.name}'
                    description = f'队员 {member.name} 年龄 {member.age} 岁，小于最小参赛年龄 {Config.MIN_AGE} 岁'
                else:
                    severity = 'error'
                    title = f'年龄偏大: {member.name}'
                    description = f'队员 {member.name} 年龄 {member.age} 岁，超过最大参赛年龄 {Config.MAX_AGE} 岁'
                
                risk = Risk(
                    risk_type='age_violation',
                    severity=severity,
                    title=title,
                    description=description,
                    related_type='member',
                    related_id=member.id,
                    source_file=member.source_file,
                    source_row=member.source_row
                )
                db.session.add(risk)
                risks.append(risk)
        
        db.session.commit()
        return risks
    
    def check_weight_violations(self) -> List[Risk]:
        risks = []
        
        members = Member.query.filter(
            or_(
                Member.weight < Config.MIN_WEIGHT_PER_PERSON,
                Member.weight > Config.MAX_WEIGHT_PER_PERSON
            )
        ).all()
        
        for member in members:
            if member.weight is None:
                continue
            
            existing = Risk.query.filter_by(
                risk_type='weight_violation',
                related_type='member',
                related_id=member.id,
                is_resolved=False
            ).first()
            
            if not existing:
                if member.weight < Config.MIN_WEIGHT_PER_PERSON:
                    severity = 'warning'
                    title = f'体重偏轻: {member.name}'
                    description = f'队员 {member.name} 体重 {member.weight}kg，低于建议最小体重 {Config.MIN_WEIGHT_PER_PERSON}kg'
                else:
                    severity = 'warning'
                    title = f'体重偏重: {member.name}'
                    description = f'队员 {member.name} 体重 {member.weight}kg，超过建议最大体重 {Config.MAX_WEIGHT_PER_PERSON}kg'
                
                risk = Risk(
                    risk_type='weight_violation',
                    severity=severity,
                    title=title,
                    description=description,
                    related_type='member',
                    related_id=member.id,
                    source_file=member.source_file,
                    source_row=member.source_row
                )
                db.session.add(risk)
                risks.append(risk)
        
        db.session.commit()
        return risks
    
    def check_boat_conflicts(self) -> List[Risk]:
        risks = []
        
        boats = Boat.query.filter(Boat.team_id.isnot(None)).all()
        
        boat_assignments = {}
        for boat in boats:
            if boat.boat_number not in boat_assignments:
                boat_assignments[boat.boat_number] = []
            boat_assignments[boat.boat_number].append(boat)
        
        for boat_number, boat_list in boat_assignments.items():
            if len(boat_list) > 1:
                for i, boat in enumerate(boat_list):
                    other_boats = [b for j, b in enumerate(boat_list) if j != i]
                    other_teams = ', '.join([f"{b.team.name if b.team else '未知队伍'}" for b in other_boats])
                    
                    existing = Risk.query.filter_by(
                        risk_type='boat_conflict',
                        related_type='boat',
                        related_id=boat.id,
                        is_resolved=False
                    ).first()
                    
                    if not existing:
                        risk = Risk(
                            risk_type='boat_conflict',
                            severity='error',
                            title=f'船艇分配冲突: {boat_number}',
                            description=f'船号 {boat_number} 被分配给多个队伍: {boat.team.name if boat.team else "未知队伍"} 和 {other_teams}',
                            related_type='boat',
                            related_id=boat.id,
                            source_file=boat.source_file
                        )
                        db.session.add(risk)
                        risks.append(risk)
        
        db.session.commit()
        return risks
    
    def check_schedule_conflicts(self) -> List[Risk]:
        risks = []
        
        schedules = RaceSchedule.query.order_by(
            RaceSchedule.race_date,
            RaceSchedule.start_time
        ).all()
        
        for i, schedule1 in enumerate(schedules):
            for j, schedule2 in enumerate(schedules[i+1:], i+1):
                if schedule1.race_date != schedule2.race_date:
                    continue
                
                conflict_type = None
                conflict_description = ""
                
                if schedule1.track_number and schedule2.track_number:
                    if schedule1.track_number == schedule2.track_number:
                        if self._time_overlap(schedule1, schedule2):
                            conflict_type = 'track_time_conflict'
                            conflict_description = (
                                f'赛道 {schedule1.track_number} 在 {schedule1.race_date} '
                                f'{schedule1.start_time}-{schedule1.end_time} 与 {schedule2.start_time}-{schedule2.end_time} 时段冲突'
                            )
                
                if schedule1.boat_number and schedule2.boat_number:
                    if schedule1.boat_number == schedule2.boat_number:
                        if self._time_overlap(schedule1, schedule2):
                            conflict_type = 'boat_time_conflict'
                            conflict_description = (
                                f'船艇 {schedule1.boat_number} 在 {schedule1.race_date} '
                                f'{schedule1.start_time}-{schedule1.end_time} 与 {schedule2.start_time}-{schedule2.end_time} 时段冲突'
                            )
                
                if conflict_type:
                    existing1 = Risk.query.filter_by(
                        risk_type=conflict_type,
                        related_type='schedule',
                        related_id=schedule1.id,
                        is_resolved=False
                    ).first()
                    
                    existing2 = Risk.query.filter_by(
                        risk_type=conflict_type,
                        related_type='schedule',
                        related_id=schedule2.id,
                        is_resolved=False
                    ).first()
                    
                    if not existing1:
                        risk1 = Risk(
                            risk_type=conflict_type,
                            severity='error',
                            title=f'赛程冲突: {schedule1.race_name}',
                            description=conflict_description,
                            related_type='schedule',
                            related_id=schedule1.id,
                            source_file=schedule1.source_file
                        )
                        db.session.add(risk1)
                        risks.append(risk1)
                    
                    if not existing2:
                        risk2 = Risk(
                            risk_type=conflict_type,
                            severity='error',
                            title=f'赛程冲突: {schedule2.race_name}',
                            description=conflict_description,
                            related_type='schedule',
                            related_id=schedule2.id,
                            source_file=schedule2.source_file
                        )
                        db.session.add(risk2)
                        risks.append(risk2)
        
        db.session.commit()
        return risks
    
    def _time_overlap(self, s1, s2) -> bool:
        if s1.start_time is None or s1.end_time is None:
            return False
        if s2.start_time is None or s2.end_time is None:
            return False
        
        return s1.start_time < s2.end_time and s2.start_time < s1.end_time
    
    def check_team_size(self) -> List[Risk]:
        risks = []
        
        teams = Team.query.all()
        
        for team in teams:
            member_count = team.members.count()
            
            if member_count == 0:
                continue
            
            existing = Risk.query.filter_by(
                risk_type='team_size',
                related_type='team',
                related_id=team.id,
                is_resolved=False
            ).first()
            
            if not existing:
                if member_count < Config.TEAM_SIZE:
                    severity = 'warning' if member_count > 0 else 'error'
                    title = f'队伍人数不足: {team.name}'
                    description = f'队伍 {team.name} 仅有 {member_count} 名队员，标准配置为 {Config.TEAM_SIZE} 人'
                elif member_count > Config.TEAM_SIZE:
                    severity = 'warning'
                    title = f'队伍人数超出: {team.name}'
                    description = f'队伍 {team.name} 有 {member_count} 名队员，标准配置为 {Config.TEAM_SIZE} 人'
                else:
                    continue
                
                risk = Risk(
                    risk_type='team_size',
                    severity=severity,
                    title=title,
                    description=description,
                    related_type='team',
                    related_id=team.id,
                    source_file=team.source_file
                )
                db.session.add(risk)
                risks.append(risk)
        
        db.session.commit()
        return risks
    
    def validate_member(self, member_id: int) -> Dict[str, Any]:
        member = Member.query.get(member_id)
        if not member:
            return {'valid': False, 'error': '队员不存在'}
        
        issues = []
        
        if member.age is not None:
            if member.age < Config.MIN_AGE:
                issues.append({
                    'type': 'age_violation',
                    'severity': 'error',
                    'message': f'年龄 {member.age} 岁小于最小参赛年龄 {Config.MIN_AGE} 岁'
                })
            elif member.age > Config.MAX_AGE:
                issues.append({
                    'type': 'age_violation',
                    'severity': 'error',
                    'message': f'年龄 {member.age} 岁超过最大参赛年龄 {Config.MAX_AGE} 岁'
                })
        
        if member.weight is not None:
            if member.weight < Config.MIN_WEIGHT_PER_PERSON:
                issues.append({
                    'type': 'weight_violation',
                    'severity': 'warning',
                    'message': f'体重 {member.weight}kg 低于建议最小体重 {Config.MIN_WEIGHT_PER_PERSON}kg'
                })
            elif member.weight > Config.MAX_WEIGHT_PER_PERSON:
                issues.append({
                    'type': 'weight_violation',
                    'severity': 'warning',
                    'message': f'体重 {member.weight}kg 超过建议最大体重 {Config.MAX_WEIGHT_PER_PERSON}kg'
                })
        
        if member.id_card:
            duplicates = Member.query.filter(
                Member.id_card == member.id_card,
                Member.id != member.id
            ).all()
            if duplicates:
                issues.append({
                    'type': 'duplicate_member',
                    'severity': 'error',
                    'message': f'身份证号 {member.id_card} 与其他队员重复: {", ".join([d.name for d in duplicates])}'
                })
        
        return {
            'valid': len([i for i in issues if i['severity'] == 'error']) == 0,
            'member': member.to_dict(),
            'issues': issues
        }
    
    def validate_team(self, team_id: int) -> Dict[str, Any]:
        team = Team.query.get(team_id)
        if not team:
            return {'valid': False, 'error': '队伍不存在'}
        
        members = team.members.all()
        member_issues = []
        
        for member in members:
            result = self.validate_member(member.id)
            if not result['valid']:
                member_issues.append({
                    'member': member.name,
                    'issues': result['issues']
                })
        
        member_count = len(members)
        size_issue = None
        if member_count < Config.TEAM_SIZE:
            size_issue = {
                'type': 'team_size',
                'severity': 'warning' if member_count > 0 else 'error',
                'message': f'队伍人数 {member_count} 人，标准配置为 {Config.TEAM_SIZE} 人'
            }
        elif member_count > Config.TEAM_SIZE:
            size_issue = {
                'type': 'team_size',
                'severity': 'warning',
                'message': f'队伍人数 {member_count} 人，超过标准配置 {Config.TEAM_SIZE} 人'
            }
        
        all_issues = member_issues + ([size_issue] if size_issue else [])
        has_errors = any(
            (isinstance(i, dict) and i.get('severity') == 'error') or
            (isinstance(i, dict) and 'issues' in i and any(
                j.get('severity') == 'error' for j in i.get('issues', [])
            ))
            for i in all_issues
        )
        
        return {
            'valid': not has_errors,
            'team': team.to_dict(),
            'member_count': member_count,
            'issues': all_issues
        }
