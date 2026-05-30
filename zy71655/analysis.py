import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from config import Config
from models import db, Segment, Anomaly, AnalysisReport, TrackPoint, Run

class RunAnalyzer:
    def __init__(self, run_id):
        self.run_id = run_id
        self.run = Run.query.get(run_id)
        self.track_points = None
        self.segments = []
        self.anomalies = []
        
    def load_data(self):
        points = TrackPoint.query.filter_by(run_id=self.run_id).order_by(TrackPoint.timestamp).all()
        if not points:
            return False
        self.track_points = pd.DataFrame([{
            'timestamp': p.timestamp,
            'distance': p.distance,
            'altitude': p.altitude,
            'speed': p.speed,
            'heart_rate': p.heart_rate,
            'cadence': p.cadence,
            'grade': p.grade
        } for p in points])
        return True
    
    def calculate_segments(self, segment_distance=Config.SEGMENT_DISTANCE):
        if self.track_points is None or len(self.track_points) == 0:
            return []
        
        df = self.track_points.copy()
        total_distance = df['distance'].max()
        num_segments = int(np.ceil(total_distance / segment_distance))
        
        segments = []
        for i in range(num_segments):
            start_dist = i * segment_distance
            end_dist = min((i + 1) * segment_distance, total_distance)
            
            segment_df = df[(df['distance'] >= start_dist) & (df['distance'] <= end_dist)]
            if len(segment_df) < 2:
                continue
            
            duration = (segment_df['timestamp'].max() - segment_df['timestamp'].min()).total_seconds()
            seg_distance = end_dist - start_dist
            avg_pace = duration / seg_distance * 1000 if seg_distance > 0 else None
            
            segment = Segment(
                run_id=self.run_id,
                segment_number=i + 1,
                start_distance=start_dist,
                end_distance=end_dist,
                duration=duration,
                avg_pace=avg_pace,
                avg_hr=segment_df['heart_rate'].mean() if segment_df['heart_rate'].notna().any() else None,
                max_hr=segment_df['heart_rate'].max() if segment_df['heart_rate'].notna().any() else None,
                min_hr=segment_df['heart_rate'].min() if segment_df['heart_rate'].notna().any() else None,
                avg_grade=segment_df['grade'].mean() if segment_df['grade'].notna().any() else None,
                elevation_gain=segment_df[segment_df['altitude'].diff() > 0]['altitude'].diff().sum() if 'altitude' in segment_df else 0,
                elevation_loss=abs(segment_df[segment_df['altitude'].diff() < 0]['altitude'].diff().sum()) if 'altitude' in segment_df else 0,
                cadence=segment_df['cadence'].mean() if segment_df['cadence'].notna().any() else None
            )
            segments.append(segment)
        
        self.segments = segments
        return segments
    
    def detect_anomalies(self):
        anomalies = []
        
        anomalies.extend(self._detect_track_gaps())
        anomalies.extend(self._detect_pace_drop())
        anomalies.extend(self._detect_heart_rate_drift())
        anomalies.extend(self._detect_grade_anomalies())
        anomalies.extend(self._detect_half_marathon_collapse())
        
        self.anomalies = anomalies
        return anomalies
    
    def _detect_track_gaps(self):
        anomalies = []
        if self.track_points is None or len(self.track_points) < 2:
            return anomalies
        
        df = self.track_points.sort_values('timestamp')
        time_diffs = df['timestamp'].diff().dt.total_seconds()
        distance_diffs = df['distance'].diff()
        
        gap_indices = time_diffs[time_diffs > Config.GAP_THRESHOLD].index
        
        for idx in gap_indices:
            if idx > 0:
                prev_point = df.iloc[idx - 1]
                curr_point = df.iloc[idx]
                
                anomaly = Anomaly(
                    run_id=self.run_id,
                    anomaly_type='track_gap',
                    severity='high' if time_diffs[idx] > 60 else 'medium',
                    start_distance=prev_point['distance'],
                    end_distance=curr_point['distance'],
                    start_time=prev_point['timestamp'],
                    end_time=curr_point['timestamp'],
                    description=f'轨迹数据断点，时间间隔 {time_diffs[idx]:.1f}秒',
                    expected_value=1.0,
                    actual_value=time_diffs[idx],
                    deviation_percent=(time_diffs[idx] - 1) / 1 * 100,
                    impact=f'断点跨越 {distance_diffs[idx]:.1f}米，可能影响配速计算准确性，进而影响分段成绩排名'
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_pace_drop(self):
        anomalies = []
        if not self.segments or len(self.segments) < 3:
            return anomalies
        
        first_half_pace = np.mean([s.avg_pace for s in self.segments[:len(self.segments)//2] if s.avg_pace])
        
        for i, segment in enumerate(self.segments):
            if segment.avg_pace and first_half_pace:
                pace_increase = (segment.avg_pace - first_half_pace) / first_half_pace
                
                if pace_increase > Config.PACEDROP_THRESHOLD:
                    anomaly = Anomaly(
                        run_id=self.run_id,
                        anomaly_type='pace_drop',
                        severity='high' if pace_increase > 0.25 else 'medium',
                        start_distance=segment.start_distance,
                        end_distance=segment.end_distance,
                        description=f'第{i+1}公里配速下降 {pace_increase*100:.1f}%',
                        expected_value=first_half_pace,
                        actual_value=segment.avg_pace,
                        deviation_percent=pace_increase * 100,
                        impact=f'配速明显下降，可能影响最终完赛时间，预计损失时间约 {(segment.avg_pace - first_half_pace) * (segment.end_distance - segment.start_distance) / 1000:.0f}秒'
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_heart_rate_drift(self):
        anomalies = []
        if self.track_points is None:
            return anomalies
        
        df = self.track_points.copy()
        df = df.dropna(subset=['heart_rate'])
        
        if len(df) < 10:
            return anomalies
        
        df['hr_rolling'] = df['heart_rate'].rolling(window=10, center=True).mean()
        
        first_quarter = df.iloc[:len(df)//4]['heart_rate'].mean()
        last_quarter = df.iloc[-len(df)//4:]['heart_rate'].mean()
        
        drift = last_quarter - first_quarter
        
        if abs(drift) > Config.HEARTRATE_DRIFT_THRESHOLD:
            anomaly = Anomaly(
                run_id=self.run_id,
                anomaly_type='heart_rate_drift',
                severity='high' if abs(drift) > 20 else 'medium',
                start_distance=df.iloc[-len(df)//4]['distance'],
                end_distance=df['distance'].max(),
                description=f'心率漂移 {drift:+.1f} bpm',
                expected_value=first_quarter,
                actual_value=last_quarter,
                deviation_percent=drift / first_quarter * 100 if first_quarter > 0 else 0,
                impact=f'心率{"上升" if drift > 0 else "下降"}可能表示{"心血管疲劳" if drift > 0 else "传感器问题或体能过剩"}，{drift > 0 and "将影响后半程表现" or "需确认数据准确性"}'
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_grade_anomalies(self):
        anomalies = []
        if self.track_points is None:
            return anomalies
        
        df = self.track_points.copy()
        df = df.dropna(subset=['grade'])
        
        if len(df) == 0:
            return anomalies
        
        extreme_grades = df[(df['grade'] > 30) | (df['grade'] < -30)]
        
        if len(extreme_grades) > 0:
            for _, row in extreme_grades.head(3).iterrows():
                anomaly = Anomaly(
                    run_id=self.run_id,
                    anomaly_type='grade_anomaly',
                    severity='high',
                    start_distance=max(0, row['distance'] - 10),
                    end_distance=row['distance'] + 10,
                    description=f'坡度数据异常 {row["grade"]:.1f}%',
                    expected_value=0.0,
                    actual_value=row['grade'],
                    deviation_percent=abs(row['grade']),
                    impact=f'坡度超过正常范围，可能是单位错误（百分比被误读为角度），将影响海拔爬升计算和难度系数评定'
                )
                anomalies.append(anomaly)
                break
        
        return anomalies
    
    def _detect_half_marathon_collapse(self):
        anomalies = []
        if not self.segments or len(self.segments) < 21:
            return anomalies
        
        halfway = 21
        first_half = [s.avg_pace for s in self.segments[:halfway] if s.avg_pace]
        second_half = [s.avg_pace for s in self.segments[halfway:] if s.avg_pace]
        
        if len(first_half) > 0 and len(second_half) > 0:
            first_half_avg = np.mean(first_half)
            second_half_avg = np.mean(second_half)
            slowdown = (second_half_avg - first_half_avg) / first_half_avg
            
            if slowdown > Config.PACEDROP_THRESHOLD:
                anomaly = Anomaly(
                    run_id=self.run_id,
                    anomaly_type='half_marathon_collapse',
                    severity='high',
                    start_distance=21000,
                    end_distance=self.segments[-1].end_distance if self.segments else 42195,
                    description=f'半程后配速崩盘，后半程平均配速下降 {slowdown*100:.1f}%',
                    expected_value=first_half_avg,
                    actual_value=second_half_avg,
                    deviation_percent=slowdown * 100,
                    impact=f'典型的"撞墙"现象，预计增加完赛时间约 {(second_half_avg - first_half_avg) * 21.0975 / 60:.1f}分钟，将影响奖金获得和最终排名'
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def generate_report(self):
        if not self.segments:
            self.calculate_segments()
        if not self.anomalies:
            self.detect_anomalies()
        
        summary = self._generate_summary()
        pace_trend = self._analyze_pace_trend()
        hr_trend = self._analyze_hr_trend()
        pacing_strategy = self._analyze_pacing_strategy()
        fatigue_analysis = self._analyze_fatigue()
        recommendations = self._generate_recommendations()
        
        report = AnalysisReport(
            run_id=self.run_id,
            report_type='full',
            title=f'{self.run.athlete.name} - {self.run.title} 分析报告',
            summary=summary,
            pace_trend=pace_trend,
            hr_trend=hr_trend,
            pacing_strategy=pacing_strategy,
            fatigue_analysis=fatigue_analysis,
            recommendations=recommendations,
            chart_paths=json.dumps([])
        )
        
        return report
    
    def _generate_summary(self):
        if not self.segments:
            return '数据不足，无法生成分析'
        
        total_time = sum(s.duration for s in self.segments)
        avg_pace = total_time / (self.segments[-1].end_distance / 1000) if self.segments else 0
        
        return f'本次跑步距离 {self.run.total_distance/1000:.2f}公里，总用时 {int(total_time//60)}分{int(total_time%60)}秒，平均配速 {int(avg_pace//60)}分{int(avg_pace%60)}秒/公里。检测到 {len(self.anomalies)} 个异常点。'
    
    def _analyze_pace_trend(self):
        if len(self.segments) < 2:
            return '分段数据不足'
        
        paces = [s.avg_pace for s in self.segments if s.avg_pace]
        if len(paces) < 2:
            return '有效配速数据不足'
        
        trend = '上升' if paces[-1] > paces[0] else '下降'
        change = (paces[-1] - paces[0]) / paces[0] * 100
        
        return f'配速整体呈{trend}趋势，首尾变化 {change:+.1f}%。{"前快后慢，属于典型的出发过快" if trend == "上升" and change > 10 else "配速相对稳定"}'
    
    def _analyze_hr_trend(self):
        hrs = [s.avg_hr for s in self.segments if s.avg_hr]
        if len(hrs) < 2:
            return '心率数据不足'
        
        trend = '上升' if hrs[-1] > hrs[0] else '下降'
        drift = hrs[-1] - hrs[0]
        
        return f'心率整体呈{trend}趋势，漂移量 {drift:+.1f} bpm。{"存在明显心血管疲劳迹象" if drift > 15 else "心率控制良好"}'
    
    def _analyze_pacing_strategy(self):
        if len(self.segments) < 2:
            return '数据不足'
        
        mid = len(self.segments) // 2
        first_half = np.mean([s.avg_pace for s in self.segments[:mid] if s.avg_pace])
        second_half = np.mean([s.avg_pace for s in self.segments[mid:] if s.avg_pace])
        
        diff = (second_half - first_half) / first_half * 100
        
        if diff > 15:
            return f'配速策略：前快后慢（正配速 {diff:.1f}%），后半程减速明显，建议下次比赛采用更保守的出发配速'
        elif diff < -5:
            return f'配速策略：后快前慢（负配速 {-diff:.1f}%），表现优秀，体能分配合理'
        else:
            return f'配速策略：相对稳定（配速差 {diff:.1f}%），整体控制良好'
    
    def _analyze_fatigue(self):
        pace_anomalies = [a for a in self.anomalies if a.anomaly_type == 'pace_drop']
        hr_anomalies = [a for a in self.anomalies if a.anomaly_type == 'heart_rate_drift']
        
        fatigue_level = '低'
        if len(pace_anomalies) > 3 or any(a.severity == 'high' for a in pace_anomalies):
            fatigue_level = '高'
        elif len(pace_anomalies) > 1:
            fatigue_level = '中'
        
        factors = []
        collapse = [a for a in self.anomalies if a.anomaly_type == 'half_marathon_collapse']
        if collapse:
            factors.append('出现半程后"撞墙"现象')
        
        grade_issues = [a for a in self.anomalies if a.anomaly_type == 'grade_anomaly']
        if grade_issues:
            factors.append('坡度数据可能存在单位错误，影响难度评估')
        
        return f'疲劳程度：{fatigue_level}。' + ('；'.join(factors) if factors else '各项指标正常')
    
    def _generate_recommendations(self):
        recs = []
        
        pace_anomalies = [a for a in self.anomalies if a.anomaly_type == 'pace_drop']
        if len(pace_anomalies) > 2:
            recs.append('建议加强长距离耐力训练，提高乳酸阈值')
        
        hr_drift = [a for a in self.anomalies if a.anomaly_type == 'heart_rate_drift']
        if hr_drift:
            recs.append('建议进行心率变异性训练，提高心血管稳定性')
        
        gaps = [a for a in self.anomalies if a.anomaly_type == 'track_gap']
        if gaps:
            recs.append('建议检查GPS设备，确保信号良好，避免数据丢失影响成绩')
        
        grade_issues = [a for a in self.anomalies if a.anomaly_type == 'grade_anomaly']
        if grade_issues:
            recs.append('注意：坡度数据异常，请确认数据单位是否正确（应为百分比），否则将影响成绩计算')
        
        collapse = [a for a in self.anomalies if a.anomaly_type == 'half_marathon_collapse']
        if collapse:
            recs.append('重点建议：比赛中采用负配速策略，前半程控制配速，避免过早出现糖原耗尽导致的"撞墙"')
        
        if not recs:
            recs.append('表现良好，继续保持当前训练水平')
        
        return '\n'.join(recs)
    
    def save_all(self):
        for segment in self.segments:
            db.session.add(segment)
        
        for anomaly in self.anomalies:
            db.session.add(anomaly)
        
        report = self.generate_report()
        db.session.add(report)
        
        self.run.status = 'analyzed'
        db.session.commit()
        
        return {
            'segments_count': len(self.segments),
            'anomalies_count': len(self.anomalies),
            'report_id': report.id
        }
