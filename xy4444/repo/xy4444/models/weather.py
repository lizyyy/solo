from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from database import Base
from datetime import datetime


class WeatherData(Base):
    __tablename__ = "weather_data"
    
    id = Column(Integer, primary_key=True, index=True)
    
    observation_time = Column(DateTime, nullable=False, index=True)
    airport_code = Column(String(10), nullable=False)
    
    temperature = Column(Float)
    dew_point = Column(Float)
    wind_speed = Column(Float)
    wind_direction = Column(Integer)
    wind_gust = Column(Float)
    
    visibility = Column(Float)
    ceiling = Column(Integer)
    
    precipitation_type = Column(String(20))
    precipitation_intensity = Column(String(20))
    is_freezing_rain = Column(Boolean, default=False)
    is_snow = Column(Boolean, default=False)
    
    relative_humidity = Column(Float)
    pressure = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "observation_time": self.observation_time.isoformat() if self.observation_time else None,
            "airport_code": self.airport_code,
            "temperature": self.temperature,
            "dew_point": self.dew_point,
            "wind_speed": self.wind_speed,
            "wind_direction": self.wind_direction,
            "wind_gust": self.wind_gust,
            "visibility": self.visibility,
            "ceiling": self.ceiling,
            "precipitation_type": self.precipitation_type,
            "precipitation_intensity": self.precipitation_intensity,
            "is_freezing_rain": self.is_freezing_rain,
            "is_snow": self.is_snow,
            "relative_humidity": self.relative_humidity,
            "pressure": self.pressure,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
