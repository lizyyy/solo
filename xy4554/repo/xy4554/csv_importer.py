import pandas as pd
import os
from datetime import datetime
from database import get_db

class CSVImporter:
    def __init__(self, db_path=None):
        self.db_path = db_path
    
    def import_sand_mold_orders(self, csv_path):
        df = pd.read_csv(csv_path)
        df.columns = [col.strip() for col in df.columns]
        
        conn = get_db()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO sand_mold_orders 
                (mold_no, part_name, mold_qty, material, pouring_temp, create_time)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                str(row.get('mold_no', '')).strip(),
                str(row.get('part_name', '')).strip(),
                int(row.get('mold_qty', 0)),
                str(row.get('material', '')).strip(),
                float(row.get('pouring_temp', 0)),
                str(row.get('create_time', '')).strip()
            ))
        
        conn.commit()
        conn.close()
        return {'table': 'sand_mold_orders', 'count': len(df)}
    
    def import_oven_temperature_logs(self, csv_path):
        df = pd.read_csv(csv_path)
        df.columns = [col.strip() for col in df.columns]
        
        conn = get_db()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO oven_temperature_logs 
                (oven_no, batch_no, log_time, temperature, target_temp, duration_min, mold_nos)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(row.get('oven_no', '')).strip(),
                str(row.get('batch_no', '')).strip(),
                str(row.get('log_time', '')).strip(),
                float(row.get('temperature', 0)),
                float(row.get('target_temp', 0)),
                int(row.get('duration_min', 0)),
                str(row.get('mold_nos', '')).strip()
            ))
        
        conn.commit()
        conn.close()
        return {'table': 'oven_temperature_logs', 'count': len(df)}
    
    def import_moisture_inspections(self, csv_path):
        df = pd.read_csv(csv_path)
        df.columns = [col.strip() for col in df.columns]
        
        conn = get_db()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO moisture_inspections 
                (mold_no, inspect_time, moisture_content, inspector, location, remark)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                str(row.get('mold_no', '')).strip(),
                str(row.get('inspect_time', '')).strip(),
                float(row.get('moisture_content', 0)),
                str(row.get('inspector', '')).strip(),
                str(row.get('location', '')).strip(),
                str(row.get('remark', '')).strip()
            ))
        
        conn.commit()
        conn.close()
        return {'table': 'moisture_inspections', 'count': len(df)}
    
    def import_pouring_schedules(self, csv_path):
        df = pd.read_csv(csv_path)
        df.columns = [col.strip() for col in df.columns]
        
        conn = get_db()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO pouring_schedules 
                (schedule_no, mold_no, furnace_no, planned_start_time, 
                 planned_end_time, actual_start_time, actual_end_time, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(row.get('schedule_no', '')).strip(),
                str(row.get('mold_no', '')).strip(),
                str(row.get('furnace_no', '')).strip(),
                str(row.get('planned_start_time', '')).strip(),
                str(row.get('planned_end_time', '')).strip(),
                str(row.get('actual_start_time', '')).strip(),
                str(row.get('actual_end_time', '')).strip(),
                str(row.get('status', 'pending')).strip()
            ))
        
        conn.commit()
        conn.close()
        return {'table': 'pouring_schedules', 'count': len(df)}
    
    def import_quality_notes(self, csv_path):
        df = pd.read_csv(csv_path)
        df.columns = [col.strip() for col in df.columns]
        
        conn = get_db()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO quality_notes 
                (mold_no, note_time, note_type, content, reporter)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                str(row.get('mold_no', '')).strip(),
                str(row.get('note_time', '')).strip(),
                str(row.get('note_type', '')).strip(),
                str(row.get('content', '')).strip(),
                str(row.get('reporter', '')).strip()
            ))
        
        conn.commit()
        conn.close()
        return {'table': 'quality_notes', 'count': len(df)}
    
    def import_all(self, csv_directory):
        results = []
        
        file_mappings = [
            ('砂型工单', self.import_sand_mold_orders),
            ('烘干炉温度', self.import_oven_temperature_logs),
            ('水分抽检', self.import_moisture_inspections),
            ('浇注排程', self.import_pouring_schedules),
            ('质检备注', self.import_quality_notes)
        ]
        
        for filename in os.listdir(csv_directory):
            if filename.endswith('.csv'):
                for keyword, import_func in file_mappings:
                    if keyword in filename:
                        filepath = os.path.join(csv_directory, filename)
                        try:
                            result = import_func(filepath)
                            result['filename'] = filename
                            results.append(result)
                        except Exception as e:
                            results.append({
                                'filename': filename,
                                'error': str(e)
                            })
                        break
        
        return results

if __name__ == '__main__':
    from database import init_db
    init_db()
    
    importer = CSVImporter()
    
    sample_dir = os.path.join(os.path.dirname(__file__), 'samples')
    if os.path.exists(sample_dir):
        print(f'Importing from {sample_dir}...')
        results = importer.import_all(sample_dir)
        for r in results:
            print(r)
    else:
        print('Sample directory not found.')
