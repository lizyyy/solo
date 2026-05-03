import csv
import json
import yaml
from typing import Dict, Any, List, Optional
from datetime import datetime, date
from pathlib import Path
from sqlalchemy.orm import Session

import database as db
import schemas


class ImportService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def import_scenes_csv(self, file_path: Path) -> int:
        count = 0
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                location_name = row.get('location_name', '').strip()
                location = self._get_or_create_location(location_name)

                existing = self.db.query(db.Scene).filter(
                    db.Scene.scene_number == row.get('scene_number')
                ).first()

                if existing:
                    existing.description = row.get('description', existing.description)
                    existing.is_night = str(row.get('is_night', 'false')).lower() == 'true'
                    existing.is_interior = str(row.get('is_interior', 'false')).lower() == 'true'
                    existing.cast = row.get('cast', existing.cast)
                    existing.location_id = location.id if location else existing.location_id
                    existing.estimated_duration_minutes = int(row.get('duration_minutes', 60))
                else:
                    scene = db.Scene(
                        scene_number=row.get('scene_number'),
                        description=row.get('description'),
                        location_id=location.id if location else None,
                        is_night=str(row.get('is_night', 'false')).lower() == 'true',
                        is_interior=str(row.get('is_interior', 'false')).lower() == 'true',
                        cast=row.get('cast'),
                        estimated_duration_minutes=int(row.get('duration_minutes', 60))
                    )
                    self.db.add(scene)
                    count += 1

                if count % 10 == 0:
                    self.db.commit()

        self.db.commit()
        return count

    def import_crew_json(self, file_path: Path) -> int:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        crew_list = data if isinstance(data, list) else data.get('crew', [])
        count = 0

        for item in crew_list:
            existing = self.db.query(db.Crew).filter(
                db.Crew.name == item.get('name')
            ).first()

            avail_start = item.get('availability_start')
            avail_end = item.get('availability_end')

            if existing:
                existing.role = item.get('role', existing.role)
                existing.is_actor = item.get('is_actor', existing.is_actor)
                existing.group_name = item.get('group_name', existing.group_name)
                existing.availability_start = self._parse_date(avail_start) if avail_start else existing.availability_start
                existing.availability_end = self._parse_date(avail_end) if avail_end else existing.availability_end
            else:
                crew = db.Crew(
                    name=item.get('name'),
                    role=item.get('role'),
                    is_actor=item.get('is_actor', False),
                    group_name=item.get('group_name'),
                    availability_start=self._parse_date(avail_start) if avail_start else None,
                    availability_end=self._parse_date(avail_end) if avail_end else None
                )
                self.db.add(crew)
                count += 1

            if count % 10 == 0:
                self.db.commit()

        self.db.commit()
        return count

    def import_locations_yaml(self, file_path: Path) -> int:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        locations_list = data if isinstance(data, list) else data.get('locations', [])
        count = 0

        for item in locations_list:
            existing = self.db.query(db.Location).filter(
                db.Location.name == item.get('name')
            ).first()

            if existing:
                existing.address = item.get('address', existing.address)
                existing.is_exterior = item.get('is_exterior', existing.is_exterior)
                existing.is_sound_stage = item.get('is_sound_stage', existing.is_sound_stage)
                existing.latitude = item.get('latitude', existing.latitude)
                existing.longitude = item.get('longitude', existing.longitude)
            else:
                location = db.Location(
                    name=item.get('name'),
                    address=item.get('address'),
                    is_exterior=item.get('is_exterior', False),
                    is_sound_stage=item.get('is_sound_stage', False),
                    latitude=item.get('latitude'),
                    longitude=item.get('longitude')
                )
                self.db.add(location)
                count += 1

            if count % 10 == 0:
                self.db.commit()

        self.db.commit()
        return count

    def import_weather_json(self, file_path: Path) -> int:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        weather_list = data if isinstance(data, list) else data.get('weather', [])
        count = 0

        for item in weather_list:
            location_name = item.get('location_name', '').strip()
            location = self._get_or_create_location(location_name)

            if not location:
                continue

            weather_date = self._parse_date(item.get('date'))
            if not weather_date:
                continue

            existing = self.db.query(db.Weather).filter(
                db.Weather.location_id == location.id,
                db.Weather.date == weather_date
            ).first()

            is_rainy = item.get('is_rainy', False) or 'rain' in str(item.get('condition', '')).lower()

            if existing:
                existing.condition = item.get('condition', existing.condition)
                existing.temperature = item.get('temperature', existing.temperature)
                existing.precipitation_probability = item.get('precipitation_probability', existing.precipitation_probability)
                existing.is_rainy = is_rainy
            else:
                weather = db.Weather(
                    location_id=location.id,
                    date=weather_date,
                    condition=item.get('condition'),
                    temperature=item.get('temperature'),
                    precipitation_probability=item.get('precipitation_probability', 0.0),
                    is_rainy=is_rainy
                )
                self.db.add(weather)
                count += 1

            if count % 10 == 0:
                self.db.commit()

        self.db.commit()
        return count

    def _get_or_create_location(self, name: str) -> Optional[db.Location]:
        if not name:
            return None

        location = self.db.query(db.Location).filter(db.Location.name == name).first()
        if not location:
            location = db.Location(name=name)
            self.db.add(location)
            self.db.commit()
            self.db.refresh(location)

        return location

    def _parse_date(self, date_str: Any) -> Optional[date]:
        if isinstance(date_str, date):
            return date_str
        if not date_str:
            return None

        formats = ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%m/%d/%Y']
        for fmt in formats:
            try:
                return datetime.strptime(str(date_str), fmt).date()
            except (ValueError, TypeError):
                continue
        return None
