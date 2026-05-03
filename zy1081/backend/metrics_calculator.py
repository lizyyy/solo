from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import json


class MetricsCalculator:
    TIME_SLOT_HOURS = {
        'morning': 4,
        'afternoon': 6,
        'evening': 4,
        'night': 8
    }

    def __init__(self, data: Dict[str, Any]):
        self.bookings = data.get('bookings', [])
        self.checkins = data.get('checkins', [])
        self.complaints = data.get('complaints', [])
        self.seats_config = data.get('seats_config', {})
        self.zones = {z['id']: z for z in self.seats_config.get('zones', [])}
        self.seats = {s['id']: s for s in self.seats_config.get('seats', [])}
        
        self._booking_by_id = {b['booking_id']: b for b in self.bookings}
        self._checkins_by_booking = defaultdict(list)
        for checkin in self.checkins:
            self._checkins_by_booking[checkin['booking_id']].append(checkin)
        
        self._complaints_by_booking = defaultdict(list)
        for complaint in self.complaints:
            self._complaints_by_booking[complaint['booking_id']].append(complaint)

    def calculate_overall_metrics(self) -> Dict[str, Any]:
        total_bookings = len(self.bookings)
        if total_bookings == 0:
            return {
                'total_bookings': 0,
                'no_show_rate': 0.0,
                'late_rate': 0.0,
                'complaint_rate': 0.0,
                'refund_rate': 0.0,
                'utilization_rate': 0.0,
                'cancellation_rate': 0.0
            }

        no_show_count = sum(1 for b in self.bookings if b['status'] == 'no-show')
        cancelled_count = sum(1 for b in self.bookings if b['status'] == 'cancelled')
        checked_in_count = sum(1 for b in self.bookings if b['status'] == 'checked-in')
        
        late_count = 0
        for checkin in self.checkins:
            if checkin['late_minutes'] > 0:
                late_count += 1
        
        noise_complaints = [c for c in self.complaints if c['complaint_type'] == 'noise']
        refund_complaints = [c for c in self.complaints if c['complaint_type'] == 'refund']
        
        utilization = self._calculate_utilization_rate()

        return {
            'total_bookings': total_bookings,
            'checked_in_count': checked_in_count,
            'no_show_count': no_show_count,
            'no_show_rate': round((no_show_count / total_bookings) * 100, 2),
            'late_count': late_count,
            'late_rate': round((late_count / max(checked_in_count, 1)) * 100, 2) if checked_in_count > 0 else 0.0,
            'cancelled_count': cancelled_count,
            'cancellation_rate': round((cancelled_count / total_bookings) * 100, 2),
            'noise_complaint_count': len(noise_complaints),
            'refund_complaint_count': len(refund_complaints),
            'complaint_rate': round((len(self.complaints) / total_bookings) * 100, 2) if total_bookings > 0 else 0.0,
            'refund_rate': round((len(refund_complaints) / total_bookings) * 100, 2) if total_bookings > 0 else 0.0,
            'utilization_rate': round(utilization * 100, 2),
            'total_deposit': sum(b['deposit_amount'] for b in self.bookings),
            'avg_late_minutes': self._calculate_avg_late_minutes()
        }

    def _calculate_utilization_rate(self) -> float:
        if not self.bookings or not self.seats:
            return 0.0
        
        date_slot_usage = defaultdict(set)
        for booking in self.bookings:
            if booking['status'] in ['checked-in', 'no-show']:
                key = (booking['date'], booking['time_slot'])
                date_slot_usage[key].add(booking['seat_id'])
        
        unique_dates = len({b['date'] for b in self.bookings})
        total_seats = len(self.seats)
        time_slots_per_day = 4
        
        total_capacity = unique_dates * total_seats * time_slots_per_day
        
        total_used = sum(len(seats) for seats in date_slot_usage.values())
        
        return total_used / total_capacity if total_capacity > 0 else 0.0

    def _calculate_avg_late_minutes(self) -> float:
        late_checkins = [c for c in self.checkins if c['late_minutes'] > 0]
        if not late_checkins:
            return 0.0
        return round(sum(c['late_minutes'] for c in late_checkins) / len(late_checkins), 2)

    def calculate_by_zone(self) -> Dict[str, Any]:
        zone_stats = defaultdict(lambda: {
            'bookings': 0,
            'no_shows': 0,
            'late_checkins': 0,
            'checked_in': 0,
            'complaints': 0,
            'noise_complaints': 0,
            'refund_complaints': 0,
            'cancelled': 0,
            'total_deposit': 0.0,
            'seats': set()
        })

        for booking in self.bookings:
            seat = self.seats.get(booking['seat_id'], {})
            zone = seat.get('zone', 'unknown')
            zone_stats[zone]['bookings'] += 1
            zone_stats[zone]['seats'].add(booking['seat_id'])
            zone_stats[zone]['total_deposit'] += booking['deposit_amount']
            
            if booking['status'] == 'no-show':
                zone_stats[zone]['no_shows'] += 1
            elif booking['status'] == 'checked-in':
                zone_stats[zone]['checked_in'] += 1
            elif booking['status'] == 'cancelled':
                zone_stats[zone]['cancelled'] += 1

        for checkin in self.checkins:
            if checkin['late_minutes'] > 0:
                seat = self.seats.get(checkin['seat_id'], {})
                zone = seat.get('zone', 'unknown')
                zone_stats[zone]['late_checkins'] += 1

        for complaint in self.complaints:
            if complaint['reported_by_zone']:
                zone = complaint['reported_by_zone']
            else:
                seat = self.seats.get(complaint['seat_id'], {})
                zone = seat.get('zone', 'unknown')
            
            zone_stats[zone]['complaints'] += 1
            if complaint['complaint_type'] == 'noise':
                zone_stats[zone]['noise_complaints'] += 1
            elif complaint['complaint_type'] == 'refund':
                zone_stats[zone]['refund_complaints'] += 1

        result = {}
        for zone_id, stats in zone_stats.items():
            zone_info = self.zones.get(zone_id, {'name': zone_id})
            total = stats['bookings']
            checked_in = stats['checked_in']
            
            result[zone_id] = {
                'zone_id': zone_id,
                'zone_name': zone_info.get('name', zone_id),
                'zone_description': zone_info.get('description', ''),
                'total_bookings': total,
                'no_shows': stats['no_shows'],
                'no_show_rate': round((stats['no_shows'] / total) * 100, 2) if total > 0 else 0.0,
                'late_checkins': stats['late_checkins'],
                'late_rate': round((stats['late_checkins'] / max(checked_in, 1)) * 100, 2) if checked_in > 0 else 0.0,
                'checked_in': checked_in,
                'cancelled': stats['cancelled'],
                'cancellation_rate': round((stats['cancelled'] / total) * 100, 2) if total > 0 else 0.0,
                'complaints': stats['complaints'],
                'noise_complaints': stats['noise_complaints'],
                'refund_complaints': stats['refund_complaints'],
                'complaint_rate': round((stats['complaints'] / total) * 100, 2) if total > 0 else 0.0,
                'total_deposit': round(stats['total_deposit'], 2),
                'seat_count': len(stats['seats'])
            }

        return result

    def calculate_by_time_slot(self) -> Dict[str, Any]:
        slot_stats = defaultdict(lambda: {
            'bookings': 0,
            'no_shows': 0,
            'late_checkins': 0,
            'checked_in': 0,
            'complaints': 0,
            'noise_complaints': 0,
            'cancelled': 0
        })

        for booking in self.bookings:
            slot = booking['time_slot']
            slot_stats[slot]['bookings'] += 1
            
            if booking['status'] == 'no-show':
                slot_stats[slot]['no_shows'] += 1
            elif booking['status'] == 'checked-in':
                slot_stats[slot]['checked_in'] += 1
            elif booking['status'] == 'cancelled':
                slot_stats[slot]['cancelled'] += 1

        for checkin in self.checkins:
            if checkin['late_minutes'] > 0:
                booking = self._booking_by_id.get(checkin['booking_id'])
                if booking:
                    slot = booking['time_slot']
                    slot_stats[slot]['late_checkins'] += 1

        for complaint in self.complaints:
            booking = self._booking_by_id.get(complaint['booking_id'])
            if booking:
                slot = booking['time_slot']
                slot_stats[slot]['complaints'] += 1
                if complaint['complaint_type'] == 'noise':
                    slot_stats[slot]['noise_complaints'] += 1

        time_slots = self.seats_config.get('time_slots', {})
        result = {}
        for slot_id, stats in slot_stats.items():
            slot_info = time_slots.get(slot_id, {'name': slot_id})
            total = stats['bookings']
            checked_in = stats['checked_in']
            
            result[slot_id] = {
                'slot_id': slot_id,
                'slot_name': slot_info.get('name', slot_id),
                'start_time': slot_info.get('start', ''),
                'end_time': slot_info.get('end', ''),
                'total_bookings': total,
                'no_shows': stats['no_shows'],
                'no_show_rate': round((stats['no_shows'] / total) * 100, 2) if total > 0 else 0.0,
                'late_checkins': stats['late_checkins'],
                'late_rate': round((stats['late_checkins'] / max(checked_in, 1)) * 100, 2) if checked_in > 0 else 0.0,
                'checked_in': checked_in,
                'cancelled': stats['cancelled'],
                'cancellation_rate': round((stats['cancelled'] / total) * 100, 2) if total > 0 else 0.0,
                'complaints': stats['complaints'],
                'noise_complaints': stats['noise_complaints'],
                'complaint_rate': round((stats['complaints'] / total) * 100, 2) if total > 0 else 0.0
            }

        return result

    def calculate_by_member(self) -> Dict[str, Any]:
        member_stats = defaultdict(lambda: {
            'bookings': 0,
            'no_shows': 0,
            'late_checkins': 0,
            'checked_in': 0,
            'complaints_made': 0,
            'complaints_about': 0,
            'cancelled': 0,
            'total_deposit': 0.0,
            'total_late_minutes': 0,
            'is_member': False,
            'booking_dates': set()
        })

        for booking in self.bookings:
            member_id = booking['member_id']
            member_stats[member_id]['bookings'] += 1
            member_stats[member_id]['total_deposit'] += booking['deposit_amount']
            member_stats[member_id]['is_member'] = booking['is_member']
            member_stats[member_id]['booking_dates'].add(booking['date'])
            
            if booking['status'] == 'no-show':
                member_stats[member_id]['no_shows'] += 1
            elif booking['status'] == 'checked-in':
                member_stats[member_id]['checked_in'] += 1
            elif booking['status'] == 'cancelled':
                member_stats[member_id]['cancelled'] += 1

        for checkin in self.checkins:
            member_id = checkin['member_id']
            if checkin['late_minutes'] > 0:
                member_stats[member_id]['late_checkins'] += 1
                member_stats[member_id]['total_late_minutes'] += checkin['late_minutes']

        for complaint in self.complaints:
            member_stats[complaint['member_id']]['complaints_made'] += 1
            
            booking = self._booking_by_id.get(complaint['booking_id'])
            if booking:
                member_stats[booking['member_id']]['complaints_about'] += 1

        result = {}
        for member_id, stats in member_stats.items():
            total = stats['bookings']
            checked_in = stats['checked_in']
            late_count = stats['late_checkins']
            
            result[member_id] = {
                'member_id': member_id,
                'is_member': stats['is_member'],
                'total_bookings': total,
                'no_shows': stats['no_shows'],
                'no_show_rate': round((stats['no_shows'] / total) * 100, 2) if total > 0 else 0.0,
                'late_checkins': late_count,
                'late_rate': round((late_count / max(checked_in, 1)) * 100, 2) if checked_in > 0 else 0.0,
                'avg_late_minutes': round(stats['total_late_minutes'] / late_count, 2) if late_count > 0 else 0.0,
                'checked_in': checked_in,
                'cancelled': stats['cancelled'],
                'cancellation_rate': round((stats['cancelled'] / total) * 100, 2) if total > 0 else 0.0,
                'complaints_made': stats['complaints_made'],
                'complaints_about': stats['complaints_about'],
                'total_deposit': round(stats['total_deposit'], 2),
                'unique_dates': len(stats['booking_dates'])
            }

        return result

    def calculate_seat_heatmap(self) -> Dict[str, Any]:
        seat_metrics = defaultdict(lambda: {
            'bookings': 0,
            'no_shows': 0,
            'complaints': 0,
            'noise_complaints': 0,
            'late_checkins': 0,
            'utilization_days': set()
        })

        for booking in self.bookings:
            seat_id = booking['seat_id']
            seat_metrics[seat_id]['bookings'] += 1
            seat_metrics[seat_id]['utilization_days'].add((booking['date'], booking['time_slot']))
            
            if booking['status'] == 'no-show':
                seat_metrics[seat_id]['no_shows'] += 1

        for checkin in self.checkins:
            if checkin['late_minutes'] > 0:
                seat_metrics[checkin['seat_id']]['late_checkins'] += 1

        for complaint in self.complaints:
            seat_metrics[complaint['seat_id']]['complaints'] += 1
            if complaint['complaint_type'] == 'noise':
                seat_metrics[complaint['seat_id']]['noise_complaints'] += 1

        total_days = len({b['date'] for b in self.bookings})
        
        heatmap_data = []
        for seat_id, metrics in seat_metrics.items():
            seat = self.seats.get(seat_id, {})
            zone = seat.get('zone', 'unknown')
            position = seat.get('position', {'row': 0, 'col': 0})
            
            total = metrics['bookings']
            utilization_score = len(metrics['utilization_days']) / max(total_days * 4, 1) if total_days > 0 else 0
            
            heatmap_data.append({
                'seat_id': seat_id,
                'zone': zone,
                'row': position.get('row', 0),
                'col': position.get('col', 0),
                'total_bookings': total,
                'no_shows': metrics['no_shows'],
                'no_show_rate': round((metrics['no_shows'] / total) * 100, 2) if total > 0 else 0.0,
                'complaints': metrics['complaints'],
                'noise_complaints': metrics['noise_complaints'],
                'late_checkins': metrics['late_checkins'],
                'utilization_score': round(utilization_score, 4),
                'risk_score': self._calculate_seat_risk_score(metrics, total)
            })

        return {
            'heatmap': heatmap_data,
            'zones': [{'id': z['id'], 'name': z['name']} for z in self.seats_config.get('zones', [])],
            'total_seats': len(self.seats),
            'total_days': total_days
        }

    def _calculate_seat_risk_score(self, metrics: Dict, total_bookings: int) -> float:
        if total_bookings == 0:
            return 0.0
        
        no_show_weight = 3.0
        complaint_weight = 5.0
        noise_weight = 2.0
        
        score = 0.0
        score += (metrics['no_shows'] / total_bookings) * no_show_weight * 100
        score += (metrics['complaints'] / total_bookings) * complaint_weight * 100
        score += (metrics['noise_complaints'] / total_bookings) * noise_weight * 100
        
        return min(round(score, 2), 100.0)

    def calculate_daily_trend(self) -> List[Dict[str, Any]]:
        daily_stats = defaultdict(lambda: {
            'bookings': 0,
            'no_shows': 0,
            'late_checkins': 0,
            'checked_in': 0,
            'complaints': 0,
            'cancelled': 0
        })

        for booking in self.bookings:
            date = booking['date']
            daily_stats[date]['bookings'] += 1
            
            if booking['status'] == 'no-show':
                daily_stats[date]['no_shows'] += 1
            elif booking['status'] == 'checked-in':
                daily_stats[date]['checked_in'] += 1
            elif booking['status'] == 'cancelled':
                daily_stats[date]['cancelled'] += 1

        for checkin in self.checkins:
            if checkin['late_minutes'] > 0:
                checkin_date = checkin['checkin_time'].split()[0] if checkin['checkin_time'] else ''
                if checkin_date:
                    daily_stats[checkin_date]['late_checkins'] += 1

        for complaint in self.complaints:
            complaint_date = complaint['complaint_time'].split()[0] if complaint['complaint_time'] else ''
            if complaint_date:
                daily_stats[complaint_date]['complaints'] += 1

        result = []
        for date in sorted(daily_stats.keys()):
            stats = daily_stats[date]
            total = stats['bookings']
            checked_in = stats['checked_in']
            
            result.append({
                'date': date,
                'total_bookings': total,
                'no_shows': stats['no_shows'],
                'no_show_rate': round((stats['no_shows'] / total) * 100, 2) if total > 0 else 0.0,
                'late_checkins': stats['late_checkins'],
                'late_rate': round((stats['late_checkins'] / max(checked_in, 1)) * 100, 2) if checked_in > 0 else 0.0,
                'checked_in': checked_in,
                'cancelled': stats['cancelled'],
                'cancellation_rate': round((stats['cancelled'] / total) * 100, 2) if total > 0 else 0.0,
                'complaints': stats['complaints']
            })

        return result

    def get_all_metrics(self) -> Dict[str, Any]:
        return {
            'overall': self.calculate_overall_metrics(),
            'by_zone': self.calculate_by_zone(),
            'by_time_slot': self.calculate_by_time_slot(),
            'by_member': self.calculate_by_member(),
            'seat_heatmap': self.calculate_seat_heatmap(),
            'daily_trend': self.calculate_daily_trend()
        }
