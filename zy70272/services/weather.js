const models = require('../models');
const dayjs = require('dayjs');

const { weatherData, WIND_DIRECTIONS } = models;

const PREFERRED_WIND_DIRECTIONS = ['NE', 'E', 'SE'];
const MIN_VISIBILITY = 5;
const MAX_WIND_SPEED_BEGINNER = 15;
const MAX_WIND_SPEED_INTERMEDIATE = 20;
const MAX_WIND_SPEED_ADVANCED = 25;
const MIN_WIND_SPEED = 5;

function getWeatherWindows(date, level) {
  const targetDate = date || dayjs().format('YYYY-MM-DD');
  
  const windows = weatherData.filter(w => w.date === targetDate).map(w => {
    const result = { ...w };
    result.flyableForLevel = true;
    result.reasons = [];

    if (w.windSpeed < MIN_WIND_SPEED) {
      result.flyableForLevel = false;
      result.reasons.push('风速过低，无法起飞');
    }

    if (w.visibility < MIN_VISIBILITY) {
      result.flyableForLevel = false;
      result.reasons.push('能见度不足');
    }

    const maxSpeed = level === 'beginner' ? MAX_WIND_SPEED_BEGINNER :
                      level === 'intermediate' ? MAX_WIND_SPEED_INTERMEDIATE :
                      MAX_WIND_SPEED_ADVANCED;

    if (w.windSpeed > maxSpeed) {
      result.flyableForLevel = false;
      result.reasons.push(`风速超过${level}级别限制(${maxSpeed}m/s)`);
    }

    if (!PREFERRED_WIND_DIRECTIONS.includes(w.windDirection)) {
      result.flyableForLevel = false;
      result.reasons.push('风向不适合起飞（非东北/东/东南风）');
    }

    const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    if (levelOrder[level] < levelOrder[w.minLevel]) {
      result.flyableForLevel = false;
      result.reasons.push('学员等级低于天气最低要求');
    }

    if (!w.isFlyable) {
      result.flyableForLevel = false;
      if (w.reason && !result.reasons.includes(w.reason)) {
        result.reasons.push(w.reason);
      }
    }

    return result;
  });

  return {
    date: targetDate,
    windows,
    flyableCount: windows.filter(w => w.flyableForLevel).length
  };
}

function checkWeatherCompatibility(weatherId, studentLevel) {
  const weather = weatherData.find(w => w.id === weatherId);
  if (!weather) {
    return { success: false, error: '天气窗口不存在' };
  }

  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  
  if (levelOrder[studentLevel] < levelOrder[weather.minLevel]) {
    return {
      success: false,
      error: '学员等级不足',
      details: `需要${weather.minLevel}级别，当前${studentLevel}级别`
    };
  }

  const maxSpeed = studentLevel === 'beginner' ? MAX_WIND_SPEED_BEGINNER :
                    studentLevel === 'intermediate' ? MAX_WIND_SPEED_INTERMEDIATE :
                    MAX_WIND_SPEED_ADVANCED;

  if (weather.windSpeed > maxSpeed) {
    return {
      success: false,
      error: '风速超过学员能力范围',
      details: `当前风速${weather.windSpeed}m/s，限制${maxSpeed}m/s`
    };
  }

  if (!PREFERRED_WIND_DIRECTIONS.includes(weather.windDirection)) {
    return {
      success: false,
      error: '风向不适合',
      details: `当前风向${weather.windDirection}，优先风向: ${PREFERRED_WIND_DIRECTIONS.join('/')}`
    };
  }

  if (!weather.isFlyable) {
    return {
      success: false,
      error: '天气窗口不可飞',
      details: weather.reason || '未知原因'
    };
  }

  return {
    success: true,
    weather,
    details: '天气条件符合要求'
  };
}

module.exports = {
  getWeatherWindows,
  checkWeatherCompatibility,
  PREFERRED_WIND_DIRECTIONS,
  MAX_WIND_SPEED_BEGINNER,
  MAX_WIND_SPEED_INTERMEDIATE,
  MAX_WIND_SPEED_ADVANCED,
  MIN_WIND_SPEED,
  MIN_VISIBILITY
};
