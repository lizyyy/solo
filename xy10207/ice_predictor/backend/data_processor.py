import hashlib
import pandas as pd
import numpy as np
from datetime import datetime, date
from dateutil.parser import parse
from sqlalchemy import and_
from .models import db, DataImport, Location, SalesRecord, WeatherFeature

def calculate_file_hash(file_content):
    return hashlib.sha256(file_content).hexdigest()

def normalize_column_name(col):
    return col.strip().lower().replace(' ', '_').replace('-', '_')

def parse_date_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return parse(str(val)).date()
    except:
        return None

def clean_and_extract_features(df):
    df = df.copy()
    df.columns = [normalize_column_name(c) for c in df.columns]
    
    date_cols = ['date', 'sales_date', 'transaction_date']
    date_col = next((c for c in date_cols if c in df.columns), None)
    if date_col and date_col != 'date':
        df['date'] = df[date_col]
    
    if 'date' not in df.columns:
        df['date'] = date.today()
    
    df['date'] = df['date'].apply(parse_date_value)
    df = df[df['date'].notna()].copy()
    
    hour_cols = ['hour', 'time_hour', 'hour_of_day']
    hour_col = next((c for c in hour_cols if c in df.columns), None)
    if hour_col:
        df['time_hour'] = pd.to_numeric(df[hour_col], errors='coerce').fillna(12).astype(int)
    else:
        df['time_hour'] = 12
    
    sales_cols = ['sales', 'sales_volume', 'quantity', 'units_sold']
    sales_col = next((c for c in sales_cols if c in df.columns), 'sales')
    df['sales_volume'] = pd.to_numeric(df.get(sales_col, 0), errors='coerce').fillna(0)
    
    loc_cols = ['location', 'location_id', 'site', 'store', 'station']
    loc_col = next((c for c in loc_cols if c in df.columns), None)
    if loc_col:
        df['location_id'] = df[loc_col].astype(str).str.strip()
    else:
        df['location_id'] = 'UNKNOWN'
    
    temp_cols = ['temperature', 'temp', 't']
    temp_col = next((c for c in temp_cols if c in df.columns), None)
    if temp_col:
        df['temperature'] = pd.to_numeric(df[temp_col], errors='coerce')
    else:
        df['temperature'] = None
    
    hum_cols = ['humidity', 'hum', 'relative_humidity']
    hum_col = next((c for c in hum_cols if c in df.columns), None)
    if hum_col:
        df['humidity'] = pd.to_numeric(df[hum_col], errors='coerce')
    else:
        df['humidity'] = None
    
    event_cols = ['event', 'event_type', 'activity']
    event_col = next((c for c in event_cols if c in df.columns), None)
    if event_col:
        df['event_type'] = df[event_col].astype(str).fillna('')
    else:
        df['event_type'] = ''
    
    df['is_weekend'] = df['date'].apply(lambda d: d.weekday() >= 5)
    
    df['is_holiday'] = False
    
    return df

def process_weather_features(location_id, date_val, temperature, humidity, hour=12):
    if temperature is None or pd.isna(temperature):
        temperature = 25.0
    if humidity is None or pd.isna(humidity):
        humidity = 60.0
    
    is_high_temp = temperature >= 32.0
    
    if temperature >= 35.0:
        temp_category = 'extreme'
    elif temperature >= 32.0:
        temp_category = 'high'
    elif temperature >= 28.0:
        temp_category = 'warm'
    elif temperature >= 22.0:
        temp_category = 'mild'
    else:
        temp_category = 'cool'
    
    heat_score = 0.0
    if temperature >= 32.0:
        heat_score += (temperature - 30) * 2
    if 11 <= hour <= 17:
        heat_score += 5
    if humidity < 50:
        heat_score += 3
    
    return {
        'temperature': temperature,
        'humidity': humidity,
        'hour': hour,
        'is_high_temp': is_high_temp,
        'temp_category': temp_category,
        'heat_score': heat_score
    }

def save_imported_data(import_obj, df):
    cleaned_df = clean_and_extract_features(df)
    
    for loc_id in cleaned_df['location_id'].unique():
        loc = Location.query.filter_by(location_id=str(loc_id)).first()
        if not loc:
            loc = Location(
                location_id=str(loc_id),
                name=f"投放点 {loc_id}",
                is_outdoor=True
            )
            db.session.add(loc)
            db.session.flush()
    
    db.session.commit()
    
    saved_count = 0
    for _, row in cleaned_df.iterrows():
        loc = Location.query.filter_by(location_id=str(row['location_id'])).first()
        if not loc:
            continue
        
        existing = SalesRecord.query.filter(
            and_(
                SalesRecord.import_id == import_obj.id,
                SalesRecord.location_id == loc.id,
                SalesRecord.date == row['date'],
                SalesRecord.time_hour == int(row['time_hour'])
            )
        ).first()
        
        if existing:
            existing.sales_volume = float(row['sales_volume'])
            existing.temperature = row['temperature']
            existing.humidity = row['humidity']
            existing.is_weekend = bool(row['is_weekend'])
            existing.is_holiday = bool(row['is_holiday'])
            existing.event_type = str(row['event_type'])
            existing.ice_consumed = float(row['sales_volume']) * 0.3
        else:
            record = SalesRecord(
                import_id=import_obj.id,
                location_id=loc.id,
                date=row['date'],
                time_hour=int(row['time_hour']),
                sales_volume=float(row['sales_volume']),
                temperature=row['temperature'],
                humidity=row['humidity'],
                is_weekend=bool(row['is_weekend']),
                is_holiday=bool(row['is_holiday']),
                event_type=str(row['event_type']),
                ice_consumed=float(row['sales_volume']) * 0.3
            )
            db.session.add(record)
        
        weather_data = process_weather_features(
            loc.id,
            row['date'],
            row['temperature'],
            row['humidity'],
            int(row['time_hour'])
        )
        
        wf = WeatherFeature.query.filter(
            and_(
                WeatherFeature.location_id == loc.id,
                WeatherFeature.date == row['date'],
                WeatherFeature.hour == int(row['time_hour'])
            )
        ).first()
        
        if not wf:
            wf = WeatherFeature(
                location_id=loc.id,
                date=row['date'],
                hour=int(row['time_hour']),
                temperature=weather_data['temperature'],
                humidity=weather_data['humidity'],
                is_high_temp=weather_data['is_high_temp'],
                temp_category=weather_data['temp_category'],
                heat_score=weather_data['heat_score']
            )
            db.session.add(wf)
        else:
            wf.temperature = weather_data['temperature']
            wf.humidity = weather_data['humidity']
            wf.is_high_temp = weather_data['is_high_temp']
            wf.temp_category = weather_data['temp_category']
            wf.heat_score = weather_data['heat_score']
        
        saved_count += 1
    
    db.session.commit()
    import_obj.processed_count = saved_count
    import_obj.status = 'processed'
    db.session.commit()
    
    return saved_count
