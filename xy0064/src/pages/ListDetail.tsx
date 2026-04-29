import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePackingList } from '../context/PackingListContext';
import { getCategoryName, getActivityName, getWeatherName } from '../data/templates';
import { calculateProgress, groupItemsByCategory, copyToClipboard } from '../utils';
import { Member, ItemCategory } from '../types';

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    lists, 
    getListById, 
    toggleItem, 
    addItem, 
    deleteItem,
    addMember, 
    removeMember,
    setCurrentMember,
    currentMember,
    generateShareCodeForList
  } = usePackingList();
  
  const [list, setList] = useState(lists.find(l => l.id === id));
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('other');
  const [newMemberName, setNewMemberName] = useState('');
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  
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
  
  const handleToggleItem = (itemId: string) => {
    toggleItem(list.id, itemId, currentMember?.id);
  };
  
  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    
    addItem(list.id, {
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: 1,
    });
    
    setNewItemName('');
    setNewItemCategory('other');
    setShowAddItem(false);
  };
  
  const handleDeleteItem = (itemId: string) => {
    if (window.confirm('确定要删除这个物品吗？')) {
      deleteItem(list.id, itemId);
    }
  };
  
  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    
    addMember(list.id, newMemberName.trim());
    setNewMemberName('');
    setShowAddMember(false);
  };
  
  const handleRemoveMember = (memberId: string) => {
    if (window.confirm('确定要移除这个成员吗？')) {
      removeMember(list.id, memberId);
      if (currentMember?.id === memberId) {
        setCurrentMember(null);
      }
    }
  };
  
  const handleGenerateShareCode = () => {
    const code = generateShareCodeForList(list.id);
    setShareCode(code);
    setShowShareModal(true);
    
    // 更新本地状态
    setList(prev => prev ? { ...prev, shareCode: code } : undefined);
  };
  
  const handleCopyShareCode = async () => {
    if (shareCode) {
      const success = await copyToClipboard(shareCode);
      if (success) {
        alert('分享码已复制到剪贴板！');
      }
    }
  };
  
  const handleSelectMember = (member: Member | null) => {
    setCurrentMember(member);
  };
  
  const getMemberById = (memberId?: string): Member | undefined => {
    return list.members.find(m => m.id === memberId);
  };
  
  return (
    <div className="list-detail-page">
      <nav className="navbar">
        <Link to="/" className="navbar-back">
          ← 返回
        </Link>
        <h1 className="navbar-title">📋 {list.title}</h1>
        <div style={{ width: '60px' }}></div>
      </nav>
      
      <div className="container">
        {/* 清单信息卡片 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
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
            </div>
          </div>
          
          {/* 进度条 */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px' 
            }}>
              <span style={{ fontWeight: '600', color: '#2c3e50' }}>
                打包进度
              </span>
              <span style={{ fontWeight: '600', color: '#3498db' }}>
                {progress}%
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '12px', 
              backgroundColor: '#ecf0f1',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${progress}%`, 
                height: '100%', 
                backgroundColor: progress === 100 ? '#27ae60' : '#3498db',
                borderRadius: '6px',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '14px', 
              color: '#7f8c8d' 
            }}>
              已完成 {list.items.filter(i => i.completed).length} / {list.items.length} 件物品
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            marginTop: '20px',
            flexWrap: 'wrap'
          }}>
            <button 
              className="btn btn-warning"
              onClick={handleGenerateShareCode}
              style={{ flex: 1, minWidth: '120px' }}
            >
              🔗 生成分享码
            </button>
            <button 
              className="btn btn-success"
              onClick={() => navigate(`/check/${list.id}`)}
              style={{ flex: 1, minWidth: '120px' }}
            >
              ✅ 出发前检查
            </button>
          </div>
        </div>
        
        {/* 成员管理卡片 */}
        <div className="card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>
              👥 多人协作
            </h3>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddMember(true)}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              + 添加成员
            </button>
          </div>
          
          {/* 当前选择的成员 */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '12px', 
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#7f8c8d', 
              marginBottom: '8px' 
            }}>
              当前身份：
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                onClick={() => handleSelectMember(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: currentMember === null ? '2px solid #3498db' : '2px solid #ecf0f1',
                  backgroundColor: currentMember === null ? '#e8f4f8' : 'white',
                  color: currentMember === null ? '#2980b9' : '#7f8c8d',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                我（所有者）
              </button>
              {list.members.map(member => (
                <button
                  key={member.id}
                  onClick={() => handleSelectMember(member)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: currentMember?.id === member.id ? `2px solid ${member.color}` : '2px solid #ecf0f1',
                    backgroundColor: currentMember?.id === member.id ? `${member.color}20` : 'white',
                    color: currentMember?.id === member.id ? member.color : '#7f8c8d',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* 成员列表 */}
          {list.members.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '12px', color: '#2c3e50' }}>成员列表</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.members.map(member => (
                  <li 
                    key={member.id}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        borderRadius: '50%', 
                        backgroundColor: member.color 
                      }}></div>
                      <span style={{ fontWeight: '600' }}>{member.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#e74c3c',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {list.members.length === 0 && (
            <p style={{ color: '#95a5a6', textAlign: 'center', padding: '20px' }}>
              暂无成员，添加成员后可以分工打包行李
            </p>
          )}
        </div>
        
        {/* 添加物品按钮 */}
        <button
          className="btn btn-primary"
          onClick={() => setShowAddItem(true)}
          style={{ 
            width: '100%', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          ➕ 添加物品
        </button>
        
        {/* 物品列表 */}
        {Object.entries(itemsByCategory).map(([category, items]) => (
          <div key={category} className="card">
            <h3 className="card-title">
              📦 {getCategoryName(category as ItemCategory)} 
              <span style={{ 
                fontSize: '14px', 
                color: '#95a5a6', 
                fontWeight: 'normal',
                marginLeft: '8px'
              }}>
                ({items.filter(i => i.completed).length}/{items.length})
              </span>
            </h3>
            
            <ul className="item-list">
              {items.map(item => {
                const completedBy = getMemberById(item.completedBy);
                
                return (
                  <li 
                    key={item.id}
                    className={`item ${item.completed ? 'item-completed' : ''}`}
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
                        {completedBy && (
                          <span 
                            className="member-tag"
                            style={{ 
                              backgroundColor: `${completedBy.color}20`,
                              color: completedBy.color
                            }}
                          >
                            {completedBy.name} 已打包
                          </span>
                        )}
                      </div>
                      <div className="item-category">
                        {getCategoryName(item.category)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#e74c3c',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px'
                      }}
                    >
                      🗑️
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        
        {list.items.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#95a5a6', fontSize: '18px' }}>
              暂无物品，点击上方按钮添加
            </p>
          </div>
        )}
      </div>
      
      {/* 添加物品弹窗 */}
      {showAddItem && (
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
            maxWidth: '400px'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>
              ➕ 添加物品
            </h3>
            
            <div className="form-group">
              <label className="form-label">物品名称</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="form-input"
                placeholder="例如：雨伞"
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">分类</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as ItemCategory)}
                className="form-select"
              >
                <option value="clothing">衣物</option>
                <option value="electronics">电子产品</option>
                <option value="toiletries">洗漱用品</option>
                <option value="documents">证件文件</option>
                <option value="medicine">药品</option>
                <option value="accessories">配饰</option>
                <option value="other">其他</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddItem(false)}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddItem}
                style={{ flex: 1 }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 添加成员弹窗 */}
      {showAddMember && (
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
            maxWidth: '400px'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>
              👥 添加成员
            </h3>
            
            <p style={{ color: '#7f8c8d', marginBottom: '16px' }}>
              成员可以通过分享码加入，也可以手动添加。添加后成员可以各自勾选自己负责的物品。
            </p>
            
            <div className="form-group">
              <label className="form-label">成员姓名</label>
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="form-input"
                placeholder="例如：爸爸、妈妈、小明"
                autoFocus
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddMember(false)}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddMember}
                style={{ flex: 1 }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 分享码弹窗 */}
      {showShareModal && shareCode && (
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
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '16px', color: '#2c3e50' }}>
              🔗 分享码
            </h3>
            
            <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
              将此分享码发送给朋友，他们可以通过分享码加入您的清单
            </p>
            
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#3498db',
              letterSpacing: '8px',
              backgroundColor: '#e8f4f8',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              {shareCode}
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCopyShareCode}
                style={{ flex: 1 }}
              >
                📋 复制分享码
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

export default ListDetail;
