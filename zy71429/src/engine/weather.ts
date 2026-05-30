import { Weather, GameEvent, EVENT_PRIORITY } from '../types/game';
import { isBetween, addHours } from '../utils/time';

export const getCurrentWeather = (
  weatherForecast: Weather[],
  currentTime: Date
): Weather | null => {
  const sorted = [...weatherForecast].sort((a, b) => 
    Math.abs(a.timestamp.getTime() - currentTime.getTime()) - 
    Math.abs(b.timestamp.getTime() - currentTime.getTime())
  );
  return sorted[0] || null;
};

export const getWeatherForPeriod = (
  weatherForecast: Weather[],
  startTime: Date,
  endTime: Date
): Weather[] => {
  return weatherForecast
    .filter(w => isBetween(w.timestamp, startTime, endTime))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

export const findNextOperableWindow = (
  weatherForecast: Weather[],
  startTime: Date,
  durationMinutes: number,
  minWindowMinutes: number = 30
): { start: Date; end: Date } | null => {
  const sortedForecast = weatherForecast
    .filter(w => w.timestamp.getTime() >= startTime.getTime())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  let operableStart: Date | null = null;
  let operableDuration = 0;
  
  for (let i = 0; i < sortedForecast.length; i++) {
    const weather = sortedForecast[i];
    const nextWeather = sortedForecast[i + 1];
    const intervalMinutes = nextWeather 
      ? (nextWeather.timestamp.getTime() - weather.timestamp.getTime()) / 60000
      : 60;
    
    if (weather.windowType === 'operable' || weather.windowType === 'warning') {
      if (!operableStart) {
        operableStart = weather.timestamp;
      }
      operableDuration += intervalMinutes;
      
      if (operableDuration >= durationMinutes && operableDuration >= minWindowMinutes) {
        return {
          start: operableStart,
          end: new Date(operableStart.getTime() + durationMinutes * 60000),
        };
      }
    } else {
      operableStart = null;
      operableDuration = 0;
    }
  }
  
  return null;
};

export const getWindowTypeDescription = (windowType: Weather['windowType']): string => {
  switch (windowType) {
    case 'operable':
      return '可作业';
    case 'warning':
      return '警告';
    case 'restricted':
      return '禁航';
    default:
      return '未知';
  }
};

export const getWeatherColor = (windowType: Weather['windowType']): string => {
  switch (windowType) {
    case 'operable':
      return '#38B000';
    case 'warning':
      return '#FCBF49';
    case 'restricted':
      return '#D62828';
    default:
      return '#6B7280';
  }
};

export const generateWeatherChangedEvent = (
  oldWeather: Weather | null,
  newWeather: Weather,
  timestamp: Date
): GameEvent | null => {
  if (!oldWeather || oldWeather.windowType === newWeather.windowType) {
    return null;
  }
  
  return {
    id: `evt_weather_${Date.now()}`,
    type: 'weather_changed',
    timestamp,
    scheduleId: null,
    shipId: null,
    tugId: null,
    description: `天气变化: ${getWindowTypeDescription(oldWeather.windowType)} → ${getWindowTypeDescription(newWeather.windowType)}，浪高${newWeather.waveHeight}m，风力${newWeather.windLevel}级`,
    rawData: {
      oldWeather: {
        windLevel: oldWeather.windLevel,
        waveHeight: oldWeather.waveHeight,
        windowType: oldWeather.windowType,
      },
      newWeather: {
        windLevel: newWeather.windLevel,
        waveHeight: newWeather.waveHeight,
        windowType: newWeather.windowType,
      },
      source: newWeather.source,
    },
    priority: EVENT_PRIORITY.weather_changed,
    resolved: false,
  };
};

export const getWeatherRiskLevel = (weather: Weather): 'low' | 'medium' | 'high' => {
  if (weather.windowType === 'operable') {
    return weather.waveHeight < 1.5 ? 'low' : 'medium';
  }
  if (weather.windowType === 'warning') {
    return 'medium';
  }
  return 'high';
};

export const getMaxOperableDuration = (
  weatherForecast: Weather[],
  startTime: Date
): number => {
  const upcoming = getWeatherForPeriod(weatherForecast, startTime, addHours(startTime, 24));
  
  let maxDuration = 0;
  let currentDuration = 0;
  
  for (const weather of upcoming) {
    if (weather.windowType !== 'restricted') {
      currentDuration += 60;
      maxDuration = Math.max(maxDuration, currentDuration);
    } else {
      break;
    }
  }
  
  return maxDuration;
};

export const getOperableWindows = (
  weatherForecast: Weather[],
  startTime: Date,
  endTime: Date
): Array<{ start: Date; end: Date; type: 'operable' | 'warning'; maxWave: number; maxWind: number }> => {
  const windows: Array<{ start: Date; end: Date; type: 'operable' | 'warning'; maxWave: number; maxWind: number }> = [];
  const periodWeather = getWeatherForPeriod(weatherForecast, startTime, endTime);
  
  if (periodWeather.length === 0) return windows;
  
  let currentWindow: { start: Date; type: 'operable' | 'warning'; maxWave: number; maxWind: number } | null = null;
  
  for (let i = 0; i < periodWeather.length; i++) {
    const weather = periodWeather[i];
    const nextWeather = periodWeather[i + 1];
    const intervalEnd = nextWeather ? nextWeather.timestamp : endTime;
    
    if (weather.windowType === 'operable' || weather.windowType === 'warning') {
      const windowType = weather.windowType === 'operable' ? 'operable' : 'warning';
      
      if (!currentWindow) {
        currentWindow = {
          start: weather.timestamp,
          type: windowType,
          maxWave: weather.waveHeight,
          maxWind: weather.windLevel,
        };
      } else {
        currentWindow.type = currentWindow.type === 'warning' || windowType === 'warning' ? 'warning' : 'operable';
        currentWindow.maxWave = Math.max(currentWindow.maxWave, weather.waveHeight);
        currentWindow.maxWind = Math.max(currentWindow.maxWind, weather.windLevel);
      }
      
      if (i === periodWeather.length - 1 || 
          (nextWeather && nextWeather.windowType === 'restricted')) {
        windows.push({
          ...currentWindow,
          end: intervalEnd,
        });
        currentWindow = null;
      }
    } else if (currentWindow) {
      windows.push({
        ...currentWindow,
        end: weather.timestamp,
      });
      currentWindow = null;
    }
  }
  
  return windows;
};

export const isWindowSufficient = (
  window: { start: Date; end: Date },
  requiredDuration: number
): boolean => {
  const duration = (window.end.getTime() - window.start.getTime()) / 60000;
  return duration >= requiredDuration;
};
