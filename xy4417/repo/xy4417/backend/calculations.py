class Calculator:
    def __init__(self, data):
        self.data = data
        self.sections = data.get('sections', [])
        self.feed_points = data.get('feed_points', [])
        self.consists = data.get('consists', [])
        self.power_supplies = data.get('power_supplies', [])
        self.routes = data.get('routes', [])
        
        self.voltage_threshold = data.get('settings', {}).get('voltage_threshold', 0.9)
        self.wire_resistance_per_meter = data.get('settings', {}).get('wire_resistance_per_meter', 0.01)

    def calculate_all(self):
        results = {
            'voltage_drops': self.calculate_voltage_drops(),
            'power_overloads': self.calculate_power_overloads(),
            'schedule_conflicts': self.calculate_schedule_conflicts(),
            'summary': {}
        }
        
        results['summary'] = {
            'total_sections': len(self.sections),
            'total_feed_points': len(self.feed_points),
            'total_consists': len(self.consists),
            'total_power_supplies': len(self.power_supplies),
            'voltage_issues': len([v for v in results['voltage_drops'] if v['is_over_threshold']]),
            'overload_issues': len([p for p in results['power_overloads'] if p['is_overloaded']]),
            'conflict_issues': len(results['schedule_conflicts'])
        }
        
        return results

    def calculate_voltage_drops(self):
        voltage_results = []
        
        for section in self.sections:
            section_result = {
                'section_id': section.get('id'),
                'section_name': section.get('name'),
                'calculations': []
            }
            
            max_distance = section.get('length', 0)
            wire_resistance = max_distance * self.wire_resistance_per_meter
            
            feed_point = self._get_feed_point_for_section(section.get('id'))
            
            if feed_point:
                power_supply = self._get_power_supply_by_id(feed_point.get('power_supply_id'))
                
                if power_supply:
                    for consist in self.consists:
                        current = consist.get('power', 0) / power_supply.get('voltage', 12)
                        voltage_drop = current * wire_resistance
                        voltage_ratio = (power_supply.get('voltage', 12) - voltage_drop) / power_supply.get('voltage', 12)
                        
                        calc = {
                            'consist_id': consist.get('id'),
                            'consist_name': consist.get('name'),
                            'distance': max_distance,
                            'wire_resistance': round(wire_resistance, 4),
                            'current': round(current, 2),
                            'voltage_drop': round(voltage_drop, 2),
                            'voltage_ratio': round(voltage_ratio, 4),
                            'is_over_threshold': voltage_ratio < self.voltage_threshold
                        }
                        section_result['calculations'].append(calc)
            
            section_result['is_over_threshold'] = any(c['is_over_threshold'] for c in section_result['calculations'])
            voltage_results.append(section_result)
        
        return voltage_results

    def calculate_power_overloads(self):
        overload_results = []
        
        for power_supply in self.power_supplies:
            max_power = power_supply.get('max_power', 0)
            supply_voltage = power_supply.get('voltage', 12)
            
            feed_points = [fp for fp in self.feed_points if fp.get('power_supply_id') == power_supply.get('id')]
            sections = []
            for fp in feed_points:
                sections.extend([s for s in self.sections if s.get('feed_point_id') == fp.get('id')])
            
            total_power_needed = sum(c.get('power', 0) for c in self.consists)
            power_ratio = total_power_needed / max_power if max_power > 0 else 0
            
            overload_results.append({
                'power_supply_id': power_supply.get('id'),
                'power_supply_name': power_supply.get('name'),
                'rated_power': max_power,
                'rated_voltage': supply_voltage,
                'sections_served': len(sections),
                'feed_points_connected': len(feed_points),
                'total_power_needed': round(total_power_needed, 2),
                'power_ratio': round(power_ratio, 4),
                'is_overloaded': total_power_needed > max_power
            })
        
        return overload_results

    def calculate_schedule_conflicts(self):
        conflicts = []
        
        if not self.routes:
            return conflicts
        
        for i, route1 in enumerate(self.routes):
            for route2 in self.routes[i+1:]:
                conflict = self._check_route_conflict(route1, route2)
                if conflict:
                    conflicts.append(conflict)
        
        return conflicts

    def _check_route_conflict(self, route1, route2):
        sections1 = route1.get('sections', [])
        sections2 = route2.get('sections', [])
        
        common_sections = [s for s in sections1 if s in sections2]
        
        if not common_sections:
            return None
        
        time1_start = route1.get('start_time', 0)
        time1_end = route1.get('end_time', 0)
        time2_start = route2.get('start_time', 0)
        time2_end = route2.get('end_time', 0)
        
        time_overlap = not (time1_end <= time2_start or time2_end <= time1_start)
        
        if time_overlap:
            return {
                'route1_id': route1.get('id'),
                'route1_name': route1.get('name'),
                'route2_id': route2.get('id'),
                'route2_name': route2.get('name'),
                'common_sections': common_sections,
                'time_overlap_start': max(time1_start, time2_start),
                'time_overlap_end': min(time1_end, time2_end),
                'conflict_type': '时间和区段重叠'
            }
        
        return None

    def _get_feed_point_for_section(self, section_id):
        for section in self.sections:
            if section.get('id') == section_id:
                feed_point_id = section.get('feed_point_id')
                for fp in self.feed_points:
                    if fp.get('id') == feed_point_id:
                        return fp
        return None

    def _get_power_supply_by_id(self, power_supply_id):
        for ps in self.power_supplies:
            if ps.get('id') == power_supply_id:
                return ps
        return None
