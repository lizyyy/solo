import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePackingList } from '../context/PackingListContext';
import { ActivityType, WeatherType } from '../types';

const CreateList: React.FC = () => {
  const navigate = useNavigate();
  const { createList } = usePackingList();
  
  const [formData, setFormData] = useState({
    title: '',
    departureLocation: '',
    destination: '',
    days: 3,
    weather: 'sunny' as WeatherType,
    activity: 'city' as ActivityType,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 1 : value,
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    // 模拟生成过程
    setTimeout(() => {
      const newList = createList({
        title: formData.title || `${formData.destination}旅行清单`,
        departureLocation: formData.departureLocation,
        destination: formData.destination,
        days: formData.days,
        weather: formData.weather,
        activity: formData.activity,
      });
      
      setIsGenerating(false);
      navigate(`/list/${newList.id}`);
    }, 1000);
  };
  
  return (
    <div className="create-list-page">
      <nav className="navbar">
        <Link to="/" className="navbar-back">
          ← 返回
        </Link>
        <h1 className="navbar-title">🧳 智能生成清单</h1>
        <div style={{ width: '60px' }}></div>
      </nav>
      
      <div className="container">
        <h2 className="page-title">创建新的行李清单</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="card">
            <h3 className="card-title">📝 基本信息</h3>
            
            <div className="form-group">
              <label className="form-label">清单标题（可选）</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="form-input"
                placeholder="例如：三亚海滩度假"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">出发地</label>
              <input
                type="text"
                name="departureLocation"
                value={formData.departureLocation}
                onChange={handleInputChange}
                className="form-input"
                placeholder="例如：北京"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">目的地</label>
              <input
                type="text"
                name="destination"
                value={formData.destination}
                onChange={handleInputChange}
                className="form-input"
                placeholder="例如：三亚"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">旅行天数</label>
              <input
                type="number"
                name="days"
                value={formData.days}
                onChange={handleInputChange}
                className="form-input"
                min="1"
                max="30"
                required
              />
            </div>
          </div>
          
          <div className="card">
            <h3 className="card-title">🌤️ 天气情况</h3>
            
            <div className="form-group">
              <label className="form-label">目的地天气</label>
              <select
                name="weather"
                value={formData.weather}
                onChange={handleInputChange}
                className="form-select"
                required
              >
                <option value="sunny">☀️ 晴天</option>
                <option value="cloudy">☁️ 多云</option>
                <option value="rainy">🌧️ 雨天</option>
                <option value="cold">❄️ 寒冷</option>
                <option value="cool">🍃 凉爽</option>
                <option value="warm">🌤️ 温暖</option>
                <option value="hot">🔥 炎热</option>
                <option value="windy">💨 大风</option>
                <option value="snowy">❄️ 雪天</option>
                <option value="foggy">🌫️ 雾天</option>
              </select>
            </div>
          </div>
          
          <div className="card">
            <h3 className="card-title">🎯 活动类型</h3>
            <p className="card-description">
              根据您的活动类型，我们将智能推荐所需物品
            </p>
            
            <div className="form-group">
              <label className="form-label">主要活动</label>
              <select
                name="activity"
                value={formData.activity}
                onChange={handleInputChange}
                className="form-select"
                required
              >
                <option value="business">💼 商务出差</option>
                <option value="beach">🏖️ 海滩度假</option>
                <option value="mountain">⛰️ 登山徒步</option>
                <option value="city">🏙️ 城市观光</option>
                <option value="family">👨‍👩‍👧 亲子游</option>
              </select>
            </div>
            
            <div style={{ 
              backgroundColor: '#e8f4f8', 
              padding: '12px', 
              borderRadius: '8px',
              marginTop: '16px'
            }}>
              <p style={{ 
                fontSize: '14px', 
                color: '#2980b9',
                margin: 0
              }}>
                💡 提示：例如选择"海滩度假"，我们会自动添加泳衣、防晒霜等物品；
                选择"商务出差"，则会添加西装、充电宝等物品。
              </p>
            </div>
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isGenerating}
            style={{ 
              width: '100%', 
              fontSize: '18px',
              padding: '16px',
              marginTop: '20px'
            }}
          >
            {isGenerating ? '🔄 智能生成中...' : '✨ 生成行李清单'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateList;
