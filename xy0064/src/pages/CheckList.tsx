import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePackingList } from '../context/PackingListContext';
import { getCategoryName, getActivityName, getWeatherName } from '../data/templates';
import { calculateProgress, groupItemsByCategory, generateTextList, copyToClipboard } from '../utils';
import { ItemCategory } from '../types';

const CheckList: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { lists, getListById, toggleItem, currentMember } = usePackingList();
  
  const [list, setList] = useState(lists.find(l => l.id === id));
  const [showShareModal, setShowShareModal] = useState(false);
  const [textList, setTextList] = useState('');
  const [copied, setCopied] = useState(false);
  
  // 从上下文中获取最新的清单数据
  useEffect(() => {
    const foundList = getListById(id || '');
    if (foundList) {
      setList(foundList);
    }
  }, [lists, id, getListById]);
  
  if (!list) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#e74c3c' }}>清单不存在</h2>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '20px' }}>
          返回首页
        </Link>
      </div>
    );
  }
  
  const progress = calculateProgress(list.items);
  const itemsByCategory = groupItemsByCategory(list.items);
  const uncompletedItems = list.items.filter(item => !item.completed);
  const completedItems = list.items.filter(item => item.completed);
  
  const handleToggleItem = (itemId: string) => {
    toggleItem(list.id, itemId, currentMember?.id);
  };
  
  const handleGenerateTextList = () => {
    const text = generateTextList(list);
    setTextList(text);
    setShowShareModal(true);
    setCopied(false);
  };
  
  const handleCopyTextList = async () => {
    const success = await copyToClipboard(textList);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleMarkAllAsCompleted = () => {
    if (window.confirm('确定要将所有物品标记为已完成吗？')) {
      list.items.forEach(item => {
        if (!item.completed) {
          toggleItem(list.id, item.id, currentMember?.id);
        }
      });
    }
  };
  
  const handleMarkAllAsIncomplete = () => {
    if (window.confirm('确定要将所有物品标记为未完成吗？')) {
      list.items.forEach(item => {
        if (item.completed) {
          toggleItem(list.id, item.id);
        }
      });
    }
  };
  
  return (
    <div className="check-list-page">
      <nav className="navbar">
        <Link to={`/list/${list.id}`} className="navbar-back">
          ← 返回
        </Link>
        <h1 className="navbar-title">✅ 出发前检查</h1>
        <div style={{ width: '60px' }}></div>
      </nav>
      
      <div className="container">
        {/* 清单信息卡片 */}
        <div className="card">
          <h2 className="page-title" style={{ marginBottom: '8px', fontSize: '20px' }}>
            {list.title}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <span style={{ 
              backgroundColor: '#e8f4f8', 
              color: '#2980b9',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              📍 {list.departureLocation} → {list.destination}
            </span>
            <span style={{ 
              backgroundColor: '#fef9e7', 
              color: '#f39c12',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              📅 {list.days} 天
            </span>
            <span style={{ 
              backgroundColor: '#e8f6f3', 
              color: '#1abc9c',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              🌤️ {getWeatherName(list.weather)}
            </span>
            <span style={{ 
              backgroundColor: '#f5eef8', 
              color: '#9b59b6',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              🎯 {getActivityName(list.activity)}
            </span>
          </div>
          
          {/* 进度条 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px' 
            }}>
              <span style={{ fontWeight: '600', color: '#2c3e50' }}>
                打包进度
              </span>
              <span style={{ 
                fontWeight: '700', 
                color: progress === 100 ? '#27ae60' : '#3498db',
                fontSize: '18px'
              }}>
                {progress}%
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '16px', 
              backgroundColor: '#ecf0f1',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${progress}%`, 
                height: '100%', 
                backgroundColor: progress === 100 ? '#27ae60' : '#3498db',
                borderRadius: '8px',
                transition: 'width 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {progress === 100 && '✓ 完成'}
              </div>
            </div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '14px', 
              color: '#7f8c8d',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>✅ 已完成：{completedItems.length} 件</span>
              <span>⬜ 未完成：{uncompletedItems.length} 件</span>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn btn-primary"
              onClick={handleGenerateTextList}
              style={{ flex: 1, minWidth: '120px' }}
            >
              📋 生成文字清单
            </button>
            {uncompletedItems.length > 0 && (
              <button 
                className="btn btn-success"
                onClick={handleMarkAllAsCompleted}
                style={{ flex: 1, minWidth: '120px' }}
              >
                ✓ 全部标记完成
              </button>
            )}
            {completedItems.length > 0 && (
              <button 
                className="btn btn-secondary"
                onClick={handleMarkAllAsIncomplete}
                style={{ flex: 1, minWidth: '120px' }}
              >
                ↩️ 重置
              </button>
            )}
          </div>
        </div>
        
        {/* 未完成物品（高亮显示） */}
        {uncompletedItems.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #e74c3c' }}>
            <h3 className="card-title" style={{ color: '#e74c3c' }}>
              ⚠️ 未完成物品（{uncompletedItems.length} 件）
            </h3>
            <p style={{ color: '#7f8c8d', marginBottom: '16px', fontSize: '14px' }}>
              以下物品还未打包，请尽快准备
            </p>
            
            <ul className="item-list">
              {uncompletedItems.map(item => (
                <li 
                  key={item.id}
                  className="item item-highlight"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleItem(item.id)}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleItem(item.id)}
                    className="item-checkbox"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="item-content">
                    <div className="item-name">
                      <strong>{item.name}</strong>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#95a5a6',
                        marginLeft: '8px'
                      }}>
                        ×{item.quantity}
                      </span>
                    </div>
                    <div className="item-category">
                      {getCategoryName(item.category)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleItem(item.id);
                    }}
                    style={{
                      backgroundColor: '#3498db',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    标记完成
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 已完成物品 */}
        {completedItems.length > 0 && (
          <div className="card">
            <h3 className="card-title" style={{ color: '#27ae60' }}>
              ✅ 已完成物品（{completedItems.length} 件）
            </h3>
            
            <ul className="item-list">
              {completedItems.map(item => (
                <li 
                  key={item.id}
                  className="item item-completed"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleItem(item.id)}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleItem(item.id)}
                    className="item-checkbox"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="item-content">
                    <div className="item-name">
                      {item.name}
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#95a5a6',
                        marginLeft: '8px'
                      }}>
                        ×{item.quantity}
                      </span>
                    </div>
                    <div className="item-category">
                      {getCategoryName(item.category)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 按分类查看 */}
        <div className="card">
          <h3 className="card-title">📦 按分类查看</h3>
          
          {Object.entries(itemsByCategory).map(([category, items]) => {
            const categoryCompleted = items.filter(i => i.completed).length;
            const categoryTotal = items.length;
            
            return (
              <div key={category} style={{ marginBottom: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <h4 style={{ margin: 0, color: '#2c3e50' }}>
                    {getCategoryName(category as ItemCategory)}
                  </h4>
                  <span style={{ 
                    fontSize: '14px', 
                    color: categoryCompleted === categoryTotal ? '#27ae60' : '#7f8c8d',
                    fontWeight: '600'
                  }}>
                    {categoryCompleted}/{categoryTotal}
                  </span>
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  backgroundColor: '#ecf0f1',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}>
                  <div style={{ 
                    width: `${(categoryCompleted / categoryTotal) * 100}%`, 
                    height: '100%', 
                    backgroundColor: categoryCompleted === categoryTotal ? '#27ae60' : '#3498db',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
                <ul className="item-list" style={{ paddingLeft: '0' }}>
                  {items.map(item => (
                    <li 
                      key={item.id}
                      className={`item ${item.completed ? 'item-completed' : ''}`}
                      style={{ cursor: 'pointer', padding: '10px 12px' }}
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleItem(item.id)}
                        className="item-checkbox"
                        style={{ width: '18px', height: '18px' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="item-content">
                        <div className="item-name" style={{ fontSize: '14px' }}>
                          {item.name} ×{item.quantity}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 分享文字清单弹窗 */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>
                📋 文字清单
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#95a5a6',
                  padding: '0 8px'
                }}
              >
                ×
              </button>
            </div>
            
            <p style={{ color: '#7f8c8d', marginBottom: '16px', fontSize: '14px' }}>
              点击下方按钮复制清单，然后可以分享给朋友或保存到备忘录
            </p>
            
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              overflow: 'auto',
              maxHeight: '400px',
              border: '1px solid #ecf0f1'
            }}>
              <pre style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                wordWrap: 'break-word',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#2c3e50'
              }}>
                {textList}
              </pre>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCopyTextList}
                style={{ flex: 1 }}
              >
                {copied ? '✓ 已复制' : '📋 复制到剪贴板'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowShareModal(false)}
                style={{ flex: 1 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckList;
