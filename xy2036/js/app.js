let compareSelectorsInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

function initApp() {
  loadWeatherData(APP_STATE.currentCityId);
  setupNavigation();
  setupSearch();
  renderSolarTerm();
  renderFavorites();
  initCompareSelectors();
}

function loadWeatherData(cityId) {
  APP_STATE.currentCityId = cityId;
  APP_STATE.weatherData = WEATHER_DATA.generateWeatherData(cityId);
  
  if (APP_STATE.currentPage === 'home') {
    renderHomePage();
  } else if (APP_STATE.currentPage === 'city') {
    renderCityPage();
  }
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const page = this.getAttribute('data-page');
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  APP_STATE.currentPage = page;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    }
  });

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });

  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  if (page === 'home') {
    renderHomePage();
  } else if (page === 'city') {
    renderCityPage();
  } else if (page === 'compare') {
    renderComparePage();
  } else if (page === 'favorites') {
    renderFavoritesPage();
  }
}

function setupSearch() {
  const searchInputs = document.querySelectorAll('.search-input');
  searchInputs.forEach(input => {
    input.addEventListener('input', function() {
      const query = this.value.trim();
      if (query.length > 0) {
        APP_STATE.searchResults = WEATHER_DATA.searchCities(query);
        renderSearchResults();
      } else {
        APP_STATE.searchResults = [];
        hideSearchResults();
      }
    });

    input.addEventListener('focus', function() {
      if (APP_STATE.searchResults.length > 0) {
        renderSearchResults();
      }
    });
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-container')) {
      hideSearchResults();
    }
  });
}

function renderSearchResults() {
  const resultContainers = document.querySelectorAll('.search-results');
  resultContainers.forEach(container => {
    if (APP_STATE.searchResults.length === 0) {
      container.innerHTML = '<div class="search-no-result">未找到相关城市</div>';
    } else {
      container.innerHTML = APP_STATE.searchResults.map(city => `
        <div class="search-result-item" onclick="selectCity('${city.id}')">
          <div class="search-result-name">${city.name}</div>
          <div class="search-result-info">${city.province} · ${city.terrain}</div>
        </div>
      `).join('');
    }
    container.style.display = 'block';
  });
}

function hideSearchResults() {
  document.querySelectorAll('.search-results').forEach(container => {
    container.style.display = 'none';
  });
}

function selectCity(cityId) {
  hideSearchResults();
  document.querySelectorAll('.search-input').forEach(input => {
    input.value = '';
  });
  APP_STATE.searchResults = [];
  
  loadWeatherData(cityId);
  navigateTo('city');
}

function renderHomePage() {
  const data = APP_STATE.weatherData;
  if (!data) return;

  const todayCheckIn = getTodayCheckIn(data.city.id);

  document.getElementById('home-city-name').textContent = data.city.name;
  document.getElementById('home-city-province').textContent = data.city.province;
  document.getElementById('home-temp').textContent = data.current.temp;
  document.getElementById('home-weather-icon').textContent = data.current.icon;
  document.getElementById('home-weather').textContent = data.current.weather;
  document.getElementById('home-high-low').textContent = `${data.current.high}°/${data.current.low}°`;

  document.getElementById('home-humidity').textContent = data.current.humidity + '%';
  document.getElementById('home-wind').textContent = data.current.windSpeed + '级';
  document.getElementById('home-visibility').textContent = data.current.visibility + 'km';
  document.getElementById('home-uv').textContent = data.current.uvIndex;

  const aqiEl = document.getElementById('home-aqi');
  aqiEl.textContent = data.aqi.value;
  aqiEl.className = `aqi-value ${data.aqi.color}`;
  document.getElementById('home-aqi-level').textContent = data.aqi.level;

  renderHourlyForecast(data.hour24);
  renderDailyForecast(data.forecast7);
  renderWarnings(data.warnings);

  const outfit = WEATHER_DATA.getOutfitSuggestion(data.current.temp, data.current.weather);
  renderOutfitSuggestion(outfit);

  if (todayCheckIn) {
    document.getElementById('check-in-btn').textContent = '今日已打卡 ✓';
    document.getElementById('check-in-btn').classList.add('checked-in');
    document.getElementById('check-in-btn').disabled = true;
  } else {
    document.getElementById('check-in-btn').textContent = '打卡';
    document.getElementById('check-in-btn').classList.remove('checked-in');
    document.getElementById('check-in-btn').disabled = false;
  }

  updateFavoriteButton();
}

function renderHourlyForecast(hourly) {
  const container = document.getElementById('hourly-forecast');
  container.innerHTML = hourly.map(hour => `
    <div class="hourly-item">
      <div class="hourly-time">${hour.hour}:00</div>
      <div class="hourly-icon">${hour.icon}</div>
      <div class="hourly-temp">${hour.temp}°</div>
    </div>
  `).join('');
}

function renderDailyForecast(daily) {
  const container = document.getElementById('daily-forecast');
  container.innerHTML = daily.map((day, index) => `
    <div class="daily-item ${index === 0 ? 'today' : ''}">
      <div class="daily-weekday">${day.weekday}</div>
      <div class="daily-date">${day.date}</div>
      <div class="daily-icon">${day.icon}</div>
      <div class="daily-weather">${day.weather}</div>
      <div class="daily-temp">
        <span class="daily-high">${day.high}°</span>
        <span class="daily-low">${day.low}°</span>
      </div>
    </div>
  `).join('');
}

function renderWarnings(warnings) {
  const container = document.getElementById('warning-container');
  const section = document.getElementById('warning-section');

  if (warnings.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = warnings.map(warning => `
    <div class="warning-card">
      <div class="warning-icon">${warning.icon}</div>
      <div class="warning-content">
        <div class="warning-title">${warning.type} ${warning.level}</div>
        <div class="warning-message">${warning.message}</div>
      </div>
    </div>
  `).join('');
}

function renderOutfitSuggestion(outfit) {
  const container = document.getElementById('outfit-container');
  
  container.innerHTML = `
    <div class="outfit-section">
      <h4>👕 上衣推荐</h4>
      <div class="outfit-items">
        ${outfit.tops.map(item => `<span class="outfit-tag">${item}</span>`).join('')}
      </div>
    </div>
    <div class="outfit-section">
      <h4>👖 下装推荐</h4>
      <div class="outfit-items">
        ${outfit.bottoms.map(item => `<span class="outfit-tag">${item}</span>`).join('')}
      </div>
    </div>
    <div class="outfit-section">
      <h4>🧥 外套推荐</h4>
      <div class="outfit-items">
        ${outfit.outerwear.map(item => `<span class="outfit-tag">${item}</span>`).join('')}
      </div>
    </div>
    <div class="outfit-section">
      <h4>🎒 配饰推荐</h4>
      <div class="outfit-items">
        ${outfit.accessories.map(item => `<span class="outfit-tag">${item}</span>`).join('')}
      </div>
    </div>
    <div class="outfit-tips">
      <h4>💡 小贴士</h4>
      <ul>
        ${outfit.tips.map(tip => `<li>${tip}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderCityPage() {
  const data = APP_STATE.weatherData;
  if (!data) return;

  document.getElementById('city-name').textContent = data.city.name;
  document.getElementById('city-province').textContent = data.city.province;
  document.getElementById('city-terrain').textContent = data.city.terrain;
  document.getElementById('city-terrain-icon').textContent = getTerrainIcon(data.city.terrain);

  document.getElementById('city-lat').textContent = data.city.lat.toFixed(4) + '°N';
  document.getElementById('city-lng').textContent = data.city.lng.toFixed(4) + '°E';
  document.getElementById('city-elevation').textContent = data.city.elevation + ' 米';
  document.getElementById('city-terrain-desc').textContent = data.city.terrainDesc;
  document.getElementById('city-climate').textContent = data.city.climateType;
  document.getElementById('city-climate-desc').textContent = data.city.climateDesc;
  document.getElementById('city-features').textContent = data.city.features;

  renderTerrainAnalysis(data.terrainAnalysis);
  renderCityCard(data.city.id);
  renderDisasterInfo(data.city);

  updateCityFavoriteButton();
}

function getTerrainIcon(terrain) {
  const icons = {
    '高原': '🏔️',
    '高原谷地': '🏔️',
    '高原盆地': '🏔️',
    '山地': '⛰️',
    '山地丘陵': '⛰️',
    '盆地': '🏕️',
    '平原': '🌳',
    '丘陵': '🌄',
    '丘陵平原': '🌄',
    '平原丘陵': '🌄',
    '盆地边缘': '🌅'
  };
  return icons[terrain] || '🌍';
}

function renderTerrainAnalysis(analyses) {
  const container = document.getElementById('terrain-analysis');
  
  container.innerHTML = analyses.map(analysis => `
    <div class="analysis-card">
      <h4 class="analysis-title">${analysis.title}</h4>
      <p class="analysis-content">${analysis.content}</p>
    </div>
  `).join('');
}

function renderCityCard(cityId) {
  const cardInfo = WEATHER_DATA.getCityCardInfo(cityId);
  if (!cardInfo) return;

  const container = document.getElementById('city-card-container');
  container.innerHTML = `
    <div class="city-card" style="background: ${cardInfo.cardBg}">
      <div class="card-header">
        <span class="card-terrain-icon">${cardInfo.terrainIcon}</span>
        <div>
          <div class="card-city-name">${cardInfo.city.name}</div>
          <div class="card-city-province">${cardInfo.city.province}</div>
        </div>
        <div class="card-weather">
          <div class="card-temp">${cardInfo.weather.temp}°</div>
          <div class="card-icon">${cardInfo.weather.icon}</div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-info-item">
          <span class="card-info-label">地形</span>
          <span class="card-info-value">${cardInfo.city.terrain}</span>
        </div>
        <div class="card-info-item">
          <span class="card-info-label">海拔</span>
          <span class="card-info-value">${cardInfo.city.elevation}m</span>
        </div>
        <div class="card-info-item">
          <span class="card-info-label">气候</span>
          <span class="card-info-value">${cardInfo.city.climateType}</span>
        </div>
      </div>
      <div class="card-disasters">
        <div class="card-disasters-title">📍 可能发生的地理灾害</div>
        <div class="card-disasters-list">
          ${cardInfo.disasterInfo.slice(0, 3).map(d => `
            <div class="disaster-badge" title="${d.reason}">
              ${d.icon} ${d.name}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDisasterInfo(city) {
  const container = document.getElementById('disaster-info');
  
  const disasterIcons = {
    '沙尘暴': '💨',
    '干旱': '☀️',
    '暴雨': '🌧️',
    '洪涝': '🌊',
    '台风': '🌀',
    '高温': '🌡️',
    '寒潮': '❄️',
    '暴雪': '❄️',
    '地质灾害': '🪨',
    '雷电': '⚡',
    '冰雹': '🧊',
    '低温': '🥶',
    '大风': '💨',
    '风暴潮': '🌊'
  };

  container.innerHTML = city.naturalDisasters.map(disaster => `
    <div class="disaster-card">
      <div class="disaster-header">
        <span class="disaster-icon">${disasterIcons[disaster] || '⚠️'}</span>
        <span class="disaster-name">${disaster}</span>
      </div>
      <div class="disaster-reason">${city.disasterReasons[disaster] || '地形气候因素导致'}</div>
    </div>
  `).join('');
}

function initCompareSelectors() {
  if (compareSelectorsInitialized) return;
  
  const cities = WEATHER_DATA.cities;
  const select1 = document.getElementById('compare-city-1');
  const select2 = document.getElementById('compare-city-2');

  const options = cities.map(city => 
    `<option value="${city.id}">${city.name} (${city.province})</option>`
  ).join('');

  select1.innerHTML = `<option value="">请选择城市1</option>${options}`;
  select2.innerHTML = `<option value="">请选择城市2</option>${options}`;

  select1.addEventListener('change', function() {
    APP_STATE.compareCity1 = this.value || null;
    updateCompareResults();
  });

  select2.addEventListener('change', function() {
    APP_STATE.compareCity2 = this.value || null;
    updateCompareResults();
  });

  compareSelectorsInitialized = true;
}

function renderComparePage() {
  const select1 = document.getElementById('compare-city-1');
  const select2 = document.getElementById('compare-city-2');

  if (APP_STATE.compareCity1) {
    select1.value = APP_STATE.compareCity1;
  }
  if (APP_STATE.compareCity2) {
    select2.value = APP_STATE.compareCity2;
  }

  updateCompareResults();
}

function updateCompareResults() {
  const resultsContainer = document.getElementById('compare-results');
  const emptyState = document.getElementById('compare-empty');

  if (!APP_STATE.compareCity1 || !APP_STATE.compareCity2) {
    resultsContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  if (APP_STATE.compareCity1 === APP_STATE.compareCity2) {
    showToast('请选择两个不同的城市进行对比');
    return;
  }

  resultsContainer.style.display = 'block';
  emptyState.style.display = 'none';

  const city1 = WEATHER_DATA.getCityById(APP_STATE.compareCity1);
  const city2 = WEATHER_DATA.getCityById(APP_STATE.compareCity2);
  const weather1 = WEATHER_DATA.generateWeatherData(APP_STATE.compareCity1);
  const weather2 = WEATHER_DATA.generateWeatherData(APP_STATE.compareCity2);

  document.getElementById('compare-name-1').textContent = city1.name;
  document.getElementById('compare-name-2').textContent = city2.name;

  document.getElementById('compare-weather-1').innerHTML = `
    <div class="compare-weather-icon">${weather1.current.icon}</div>
    <div class="compare-weather-temp">${weather1.current.temp}°C</div>
    <div class="compare-weather-text">${weather1.current.weather}</div>
    <div class="compare-temp-range">最高${weather1.current.high}° / 最低${weather1.current.low}°</div>
  `;
  document.getElementById('compare-weather-2').innerHTML = `
    <div class="compare-weather-icon">${weather2.current.icon}</div>
    <div class="compare-weather-temp">${weather2.current.temp}°C</div>
    <div class="compare-weather-text">${weather2.current.weather}</div>
    <div class="compare-temp-range">最高${weather2.current.high}° / 最低${weather2.current.low}°</div>
  `;

  renderCompareWeatherDetail(weather1, weather2);
  renderCompareHourly(weather1, weather2, city1.name, city2.name);
  renderCompareDaily(weather1, weather2, city1.name, city2.name);

  const comparison = [
    { label: '地理位置', value1: `${city1.lat.toFixed(2)}°N, ${city1.lng.toFixed(2)}°E`, value2: `${city2.lat.toFixed(2)}°N, ${city2.lng.toFixed(2)}°E` },
    { label: '海拔高度', value1: `${city1.elevation} 米`, value2: `${city2.elevation} 米` },
    { label: '地形类型', value1: city1.terrain, value2: city2.terrain },
    { label: '气候类型', value1: city1.climateType, value2: city2.climateType },
    { label: '当前气温', value1: `${weather1.current.temp}°C`, value2: `${weather2.current.temp}°C` },
    { label: '温差', value1: `${weather1.current.high - weather1.current.low}°C`, value2: `${weather2.current.high - weather2.current.low}°C` },
    { label: '空气质量', value1: `AQI ${weather1.aqi.value} (${weather1.aqi.level})`, value2: `AQI ${weather2.aqi.value} (${weather2.aqi.level})` },
    { label: '湿度', value1: `${weather1.current.humidity}%`, value2: `${weather2.current.humidity}%` },
    { label: '风力', value1: `${weather1.current.windDirection} ${weather1.current.windSpeed}级`, value2: `${weather2.current.windDirection} ${weather2.current.windSpeed}级` },
    { label: '能见度', value1: `${weather1.current.visibility}km`, value2: `${weather2.current.visibility}km` },
    { label: '紫外线指数', value1: weather1.current.uvIndex, value2: weather2.current.uvIndex },
    { label: '主要灾害', value1: city1.naturalDisasters.slice(0, 3).join('、'), value2: city2.naturalDisasters.slice(0, 3).join('、') }
  ];

  document.getElementById('compare-table').innerHTML = comparison.map(item => {
    let highlight1 = '';
    let highlight2 = '';
    
    if (item.label === '海拔高度') {
      const h1 = parseFloat(item.value1);
      const h2 = parseFloat(item.value2);
      highlight1 = h1 > h2 ? 'higher' : h1 < h2 ? 'lower' : '';
      highlight2 = h2 > h1 ? 'higher' : h2 < h1 ? 'lower' : '';
    } else if (item.label === '当前气温' || item.label === '温差') {
      const t1 = parseFloat(item.value1);
      const t2 = parseFloat(item.value2);
      highlight1 = t1 > t2 ? 'higher' : t1 < t2 ? 'lower' : '';
      highlight2 = t2 > t1 ? 'higher' : t2 < t1 ? 'lower' : '';
    } else if (item.label === '空气质量') {
      const a1 = weather1.aqi.value;
      const a2 = weather2.aqi.value;
      highlight1 = a1 < a2 ? 'higher' : a1 > a2 ? 'lower' : '';
      highlight2 = a2 < a1 ? 'higher' : a2 > a1 ? 'lower' : '';
    } else if (item.label === '紫外线指数') {
      const u1 = parseInt(item.value1);
      const u2 = parseInt(item.value2);
      highlight1 = u1 > u2 ? 'lower' : u1 < u2 ? 'higher' : '';
      highlight2 = u2 > u1 ? 'lower' : u2 < u1 ? 'higher' : '';
    }

    return `
      <tr>
        <td class="compare-label">${item.label}</td>
        <td class="compare-value ${highlight1}">${item.value1}</td>
        <td class="compare-value ${highlight2}">${item.value2}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('compare-analysis').innerHTML = generateCompareAnalysis(city1, city2, weather1, weather2);
}

function renderCompareWeatherDetail(weather1, weather2) {
  const container = document.getElementById('compare-weather-detail');
  
  const details = [
    { icon: '💧', label: '湿度', value1: `${weather1.current.humidity}%`, value2: `${weather2.current.humidity}%` },
    { icon: '💨', label: '风力', value1: `${weather1.current.windDirection} ${weather1.current.windSpeed}级`, value2: `${weather2.current.windDirection} ${weather2.current.windSpeed}级` },
    { icon: '👁️', label: '能见度', value1: `${weather1.current.visibility}km`, value2: `${weather2.current.visibility}km` },
    { icon: '☀️', label: '紫外线', value1: weather1.current.uvIndex, value2: weather2.current.uvIndex },
    { icon: '🌡️', label: '气压', value1: `${weather1.current.pressure}hPa`, value2: `${weather2.current.pressure}hPa` }
  ];

  container.innerHTML = details.map(detail => `
    <div class="compare-detail-item">
      <div class="compare-detail-icon">${detail.icon}</div>
      <div class="compare-detail-label">${detail.label}</div>
      <div class="compare-detail-values">
        <div class="compare-detail-value">${detail.value1}</div>
        <div class="compare-detail-vs">vs</div>
        <div class="compare-detail-value">${detail.value2}</div>
      </div>
    </div>
  `).join('');
}

function renderCompareHourly(weather1, weather2, city1Name, city2Name) {
  const container = document.getElementById('compare-hourly');
  
  container.innerHTML = `
    <div class="compare-hourly-header">
      <div class="compare-hourly-city">${city1Name}</div>
      <div class="compare-hourly-time">时间</div>
      <div class="compare-hourly-city">${city2Name}</div>
    </div>
    <div class="compare-hourly-list">
      ${weather1.hour24.map((hour1, index) => {
        const hour2 = weather2.hour24[index];
        return `
          <div class="compare-hourly-row">
            <div class="compare-hourly-weather">
              <span class="compare-hourly-icon">${hour1.icon}</span>
              <span class="compare-hourly-temp">${hour1.temp}°</span>
            </div>
            <div class="compare-hourly-time">${hour1.hour}:00</div>
            <div class="compare-hourly-weather">
              <span class="compare-hourly-icon">${hour2.icon}</span>
              <span class="compare-hourly-temp">${hour2.temp}°</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCompareDaily(weather1, weather2, city1Name, city2Name) {
  const container = document.getElementById('compare-daily');
  
  container.innerHTML = `
    <div class="compare-daily-header">
      <div class="compare-daily-city">${city1Name}</div>
      <div class="compare-daily-date">日期</div>
      <div class="compare-daily-city">${city2Name}</div>
    </div>
    <div class="compare-daily-list">
      ${weather1.forecast7.map((day1, index) => {
        const day2 = weather2.forecast7[index];
        return `
          <div class="compare-daily-row">
            <div class="compare-daily-weather">
              <span class="compare-daily-icon">${day1.icon}</span>
              <div class="compare-daily-temp">
                <span class="compare-daily-high">${day1.high}°</span>
                <span class="compare-daily-low">${day1.low}°</span>
              </div>
            </div>
            <div class="compare-daily-date-info">
              <div class="compare-daily-weekday">${day1.weekday}</div>
              <div class="compare-daily-date-text">${day1.date}</div>
            </div>
            <div class="compare-daily-weather">
              <span class="compare-daily-icon">${day2.icon}</span>
              <div class="compare-daily-temp">
                <span class="compare-daily-high">${day2.high}°</span>
                <span class="compare-daily-low">${day2.low}°</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function generateCompareAnalysis(city1, city2, weather1, weather2) {
  const analyses = [];

  const tempDiff = weather1.current.temp - weather2.current.temp;
  if (Math.abs(tempDiff) >= 5) {
    if (tempDiff > 0) {
      analyses.push(`<p><strong>🌡️ 气温差异：</strong>${city1.name}比${city2.name}高${tempDiff}°C。这主要是因为${city1.terrain === '盆地' ? `${city1.name}地处盆地，热量不易散发` : city1.lat < city2.lat ? `${city1.name}纬度更低，太阳辐射更强` : `${city1.name}的地形和地理位置影响`}。</p>`);
    } else {
      analyses.push(`<p><strong>🌡️ 气温差异：</strong>${city2.name}比${city1.name}高${Math.abs(tempDiff)}°C。这主要是因为${city2.terrain === '盆地' ? `${city2.name}地处盆地，热量不易散发` : city2.lat < city1.lat ? `${city2.name}纬度更低，太阳辐射更强` : `${city2.name}的地形和地理位置影响`}。</p>`);
    }
  }

  if (city1.terrain !== city2.terrain) {
    analyses.push(`<p><strong>🏔️ 地形差异：</strong>${city1.name}属于${city1.terrain}地形，而${city2.name}属于${city2.terrain}地形。这种地形差异导致了两地气候的显著不同：${city1.terrain.includes('高原') ? `${city1.name}海拔高，气温低，昼夜温差大` : city1.terrain === '盆地' ? `${city1.name}四周环山，夏季闷热，冬季温和` : `${city1.name}地形平坦，气候相对稳定`}；而${city2.terrain.includes('高原') ? `${city2.name}海拔高，气温低，昼夜温差大` : city2.terrain === '盆地' ? `${city2.name}四周环山，夏季闷热，冬季温和` : `${city2.name}地形平坦，气候相对稳定`}。</p>`);
  }

  const aqiDiff = weather1.aqi.value - weather2.aqi.value;
  if (Math.abs(aqiDiff) >= 20) {
    if (aqiDiff > 0) {
      analyses.push(`<p><strong>💨 空气质量：</strong>${city2.name}的空气质量优于${city1.name}。${city1.id === 'beijing' || city1.id === 'tianjin' ? `${city1.name}地处华北，工业活动密集，冬季燃煤取暖等因素影响空气质量` : city1.terrain === '盆地' ? `${city1.name}盆地地形不利于污染物扩散` : ''}</p>`);
    } else {
      analyses.push(`<p><strong>💨 空气质量：</strong>${city1.name}的空气质量优于${city2.name}。${city2.id === 'beijing' || city2.id === 'tianjin' ? `${city2.name}地处华北，工业活动密集，冬季燃煤取暖等因素影响空气质量` : city2.terrain === '盆地' ? `${city2.name}盆地地形不利于污染物扩散` : ''}</p>`);
    }
  }

  if (city1.naturalDisasters.length > 0 && city2.naturalDisasters.length > 0) {
    const uniqueDisasters1 = city1.naturalDisasters.filter(d => !city2.naturalDisasters.includes(d));
    const uniqueDisasters2 = city2.naturalDisasters.filter(d => !city1.naturalDisasters.includes(d));
    
    if (uniqueDisasters1.length > 0 || uniqueDisasters2.length > 0) {
      let disasterAnalysis = '<p><strong>⚠️ 灾害差异：</strong>';
      if (uniqueDisasters1.length > 0) {
        disasterAnalysis += `${city1.name}特有的灾害有：${uniqueDisasters1.join('、')}。这与${city1.terrainDesc}有关。`;
      }
      if (uniqueDisasters2.length > 0) {
        disasterAnalysis += `${city2.name}特有的灾害有：${uniqueDisasters2.join('、')}。这与${city2.terrainDesc}有关。`;
      }
      disasterAnalysis += '</p>';
      analyses.push(disasterAnalysis);
    }
  }

  return analyses.join('');
}

function renderFavoritesPage() {
  renderFavoritesList();
  renderCheckInHistory();
}

function renderFavoritesList() {
  const container = document.getElementById('favorites-list');
  const emptyState = document.getElementById('favorites-empty');

  if (APP_STATE.favorites.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  container.innerHTML = APP_STATE.favorites.map(cityId => {
    const cardInfo = WEATHER_DATA.getCityCardInfo(cityId);
    if (!cardInfo) return '';

    return `
      <div class="favorite-card" style="background: ${cardInfo.cardBg}">
        <div class="favorite-header" onclick="selectCity('${cityId}')">
          <span class="favorite-terrain">${cardInfo.terrainIcon}</span>
          <div class="favorite-info">
            <div class="favorite-name">${cardInfo.city.name}</div>
            <div class="favorite-terrain-type">${cardInfo.city.terrain} · ${cardInfo.city.province}</div>
          </div>
          <div class="favorite-weather">
            <span class="favorite-temp">${cardInfo.weather.temp}°</span>
            <span class="favorite-icon">${cardInfo.weather.icon}</span>
          </div>
        </div>
        <div class="favorite-disasters">
          ${cardInfo.disasterInfo.slice(0, 3).map(d => `
            <span class="favorite-disaster-tag" title="${d.reason}">${d.icon} ${d.name}</span>
          `).join('')}
        </div>
        <div class="favorite-actions">
          <button class="action-btn view-btn" onclick="selectCity('${cityId}')">查看详情</button>
          <button class="action-btn remove-btn" onclick="removeFromFavorites('${cityId}')">取消收藏</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderCheckInHistory() {
  const container = document.getElementById('checkin-history');
  const emptyState = document.getElementById('checkin-empty');

  if (APP_STATE.checkInHistory.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  container.innerHTML = APP_STATE.checkInHistory.map(checkIn => {
    const city = WEATHER_DATA.getCityById(checkIn.cityId);
    const cardInfo = WEATHER_DATA.getCityCardInfo(checkIn.cityId);
    
    return `
      <div class="checkin-card">
        <div class="checkin-header">
          <div class="checkin-city-info">
            <span class="checkin-terrain-icon">${cardInfo ? cardInfo.terrainIcon : '🌍'}</span>
            <div>
              <div class="checkin-city-name">${checkIn.cityName}</div>
              <div class="checkin-weather-info">${checkIn.icon} ${checkIn.weather} ${checkIn.temp}°C · AQI ${checkIn.aqi}</div>
            </div>
          </div>
          <div class="checkin-datetime">
            <div class="checkin-date">${checkIn.date}</div>
            <div class="checkin-time">${checkIn.time}</div>
          </div>
        </div>
        <div class="checkin-poster-btn">
          <button class="poster-btn" onclick="generatePoster(${checkIn.id})">🎨 生成海报</button>
        </div>
      </div>
    `;
  }).join('');
}

function removeFromFavorites(cityId) {
  const index = APP_STATE.favorites.indexOf(cityId);
  if (index > -1) {
    APP_STATE.favorites.splice(index, 1);
    saveFavorites();
    renderFavoritesList();
  }
}

function toggleCurrentFavorite() {
  const cityId = APP_STATE.currentCityId;
  const isAdded = toggleFavorite(cityId);
  updateFavoriteButton();
  updateCityFavoriteButton();
  
  const message = isAdded ? '已添加到收藏' : '已取消收藏';
  showToast(message);
}

function updateFavoriteButton() {
  const btn = document.getElementById('favorite-btn');
  if (btn) {
    if (isFavorite(APP_STATE.currentCityId)) {
      btn.textContent = '❤️ 已收藏';
      btn.classList.add('favorited');
    } else {
      btn.textContent = '🤍 收藏';
      btn.classList.remove('favorited');
    }
  }
}

function updateCityFavoriteButton() {
  const btn = document.getElementById('city-favorite-btn');
  if (btn) {
    if (isFavorite(APP_STATE.currentCityId)) {
      btn.textContent = '❤️ 已收藏';
      btn.classList.add('favorited');
    } else {
      btn.textContent = '🤍 收藏城市';
      btn.classList.remove('favorited');
    }
  }
}

function doCheckIn() {
  const data = APP_STATE.weatherData;
  if (!data) return;

  const result = addCheckIn(data.city.id, data);
  
  if (result.success) {
    document.getElementById('check-in-btn').textContent = '今日已打卡 ✓';
    document.getElementById('check-in-btn').classList.add('checked-in');
    document.getElementById('check-in-btn').disabled = true;
    showToast('打卡成功！可以去收藏页面生成海报');
  } else {
    showToast(result.message);
  }
}

function generatePoster(checkInId) {
  const checkIn = APP_STATE.checkInHistory.find(c => c.id === checkInId);
  if (!checkIn) {
    showToast('未找到打卡记录');
    return;
  }

  const posterData = generatePosterData(checkIn);
  showPosterModal(posterData);
}

function showPosterModal(posterData) {
  const modal = document.getElementById('poster-modal');
  const posterContent = document.getElementById('poster-content');

  const seasonColors = {
    '春': 'linear-gradient(135deg, #a8e063 0%, #56ab2f 100%)',
    '夏': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    '秋': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    '冬': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };

  const season = posterData.solarTerm ? posterData.solarTerm.season : '春';
  const bgGradient = seasonColors[season] || seasonColors['春'];

  posterContent.innerHTML = `
    <div class="poster-preview" style="background: ${bgGradient}">
      <div class="poster-header">
        <div class="poster-title">🌍 地理天气小灵通</div>
        <div class="poster-subtitle">打卡记录</div>
      </div>
      <div class="poster-city-section">
        <div class="poster-city-name">${posterData.cityName}</div>
        <div class="poster-city-info">${posterData.province} · ${posterData.terrain}</div>
      </div>
      <div class="poster-weather-section">
        <div class="poster-weather-icon">${posterData.icon}</div>
        <div class="poster-temp">${posterData.temp}°C</div>
        <div class="poster-weather-text">${posterData.weather}</div>
      </div>
      <div class="poster-details">
        <div class="poster-detail-item">
          <span class="poster-detail-label">空气质量</span>
          <span class="poster-detail-value">AQI ${posterData.aqi}</span>
        </div>
        <div class="poster-detail-item">
          <span class="poster-detail-label">气候类型</span>
          <span class="poster-detail-value">${posterData.climateType}</span>
        </div>
        <div class="poster-detail-item">
          <span class="poster-detail-label">城市特色</span>
          <span class="poster-detail-value">${posterData.features}</span>
        </div>
      </div>
      ${posterData.solarTerm ? `
      <div class="poster-solar-term">
        <div class="poster-term-label">当前节气</div>
        <div class="poster-term-name">${posterData.solarTerm.name}</div>
        <div class="poster-term-desc">${posterData.solarTerm.desc}</div>
      </div>
      ` : ''}
      <div class="poster-footer">
        <div class="poster-datetime">${posterData.date} ${posterData.time}</div>
        <div class="poster-id">打卡ID: ${posterData.checkInId}</div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closePosterModal() {
  document.getElementById('poster-modal').style.display = 'none';
}

function renderSolarTerm() {
  const termInfo = WEATHER_DATA.getSolarTermInfo();
  
  const containers = document.querySelectorAll('.solar-term-section');
  containers.forEach(container => {
    if (termInfo.current) {
      container.innerHTML = `
        <div class="solar-term-card">
          <div class="term-icon">🌿</div>
          <div class="term-info">
            <div class="term-name">${termInfo.current.name}</div>
            <div class="term-desc">${termInfo.current.desc}</div>
          </div>
          <div class="term-next">
            <div class="next-label">下一节气</div>
            <div class="next-name">${termInfo.next ? termInfo.next.name : '-'}</div>
          </div>
        </div>
      `;
    }
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2000);
}

function addToCompare(cityId) {
  if (!APP_STATE.compareCity1) {
    APP_STATE.compareCity1 = cityId;
    showToast(`已选择 ${WEATHER_DATA.getCityById(cityId).name} 作为对比城市1`);
  } else if (!APP_STATE.compareCity2) {
    if (APP_STATE.compareCity1 === cityId) {
      showToast('请选择不同的城市');
      return;
    }
    APP_STATE.compareCity2 = cityId;
    showToast(`已选择 ${WEATHER_DATA.getCityById(cityId).name} 作为对比城市2，前往对比页查看`);
    navigateTo('compare');
  } else {
    APP_STATE.compareCity1 = APP_STATE.compareCity2;
    APP_STATE.compareCity2 = cityId;
    showToast(`已更新对比城市，前往对比页查看`);
    navigateTo('compare');
  }
}

function renderFavorites() {
  APP_STATE.favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  APP_STATE.checkInHistory = JSON.parse(localStorage.getItem('checkInHistory') || '[]');
}
