import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePackingList } from '../context/PackingListContext';
import { templates } from '../data/templates';
import { getActivityName, getWeatherName } from '../data/templates';
import { Template } from '../types';

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const { createList } = usePackingList();
  
  const handleUseTemplate = (template: Template) => {
    // 使用模板创建清单
    const newList = createList({
      title: template.name,
      departureLocation: '本地',
      destination: '目的地',
      days: template.recommendedDays,
      weather: template.weather,
      activity: template.activity,
    });
    
    navigate(`/list/${newList.id}`);
  };
  
  return (
    <div className="templates-page">
      <nav className="navbar">
        <Link to="/" className="navbar-back">
          ← 返回
        </Link>
        <h1 className="navbar-title">📚 模板库</h1>
        <div style={{ width: '60px' }}></div>
      </nav>
      
      <div className="container">
        <h2 className="page-title">选择一个模板开始</h2>
        <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
          我们为您准备了多种常用旅行场景的模板，点击即可快速创建清单
        </p>
        
        <div className="templates-grid">
          {templates.map(template => (
            <div 
              key={template.id} 
              className="card"
              onClick={() => handleUseTemplate(template)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ 
                  fontSize: '40px', 
                  lineHeight: '1',
                  flexShrink: 0
                }}>
                  {template.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="card-title" style={{ marginBottom: '8px' }}>
                    {template.name}
                  </h3>
                  <p className="card-description" style={{ marginBottom: '12px' }}>
                    {template.description}
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ 
                      backgroundColor: '#e8f4f8', 
                      color: '#2980b9',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      🎯 {getActivityName(template.activity)}
                    </span>
                    <span style={{ 
                      backgroundColor: '#fef9e7', 
                      color: '#f39c12',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      🌤️ {getWeatherName(template.weather)}
                    </span>
                    <span style={{ 
                      backgroundColor: '#e8f6f3', 
                      color: '#1abc9c',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      📅 推荐 {template.recommendedDays} 天
                    </span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ 
                      fontSize: '14px', 
                      color: '#95a5a6'
                    }}>
                      包含 {template.defaultItems.length} 件物品
                    </span>
                    <span style={{ 
                      color: '#3498db', 
                      fontWeight: '600',
                      fontSize: '14px'
                    }}>
                      使用模板 →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="card" style={{ marginTop: '30px' }}>
          <h3 className="card-title">💡 模板说明</h3>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0,
            margin: 0
          }}>
            <li style={{ 
              padding: '12px 0',
              borderBottom: '1px solid #ecf0f1'
            }}>
              <strong>❄️ 冬季旅行：</strong> 包含羽绒服、厚毛衣、围巾等保暖物品
            </li>
            <li style={{ 
              padding: '12px 0',
              borderBottom: '1px solid #ecf0f1'
            }}>
              <strong>👨‍👩‍👧 亲子游：</strong> 包含儿童换洗衣物、玩具、零食等儿童用品
            </li>
            <li style={{ 
              padding: '12px 0',
              borderBottom: '1px solid #ecf0f1'
            }}>
              <strong>💼 商务出差：</strong> 包含西装、领带、笔记本电脑等商务用品
            </li>
            <li style={{ 
              padding: '12px 0',
              borderBottom: '1px solid #ecf0f1'
            }}>
              <strong>🏖️ 海滩度假：</strong> 包含泳衣、防晒霜、太阳镜等海滩用品
            </li>
            <li style={{ 
              padding: '12px 0'
            }}>
              <strong>⛰️ 登山徒步：</strong> 包含登山鞋、冲锋衣、急救包等户外装备
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Templates;
