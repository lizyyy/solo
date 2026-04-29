import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePackingList } from '../context/PackingListContext';
import { calculateProgress, formatDate } from '../utils';
import { getActivityName } from '../data/templates';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { lists, deleteList, joinListByShareCode } = usePackingList();
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [joinError, setJoinError] = useState('');
  
  const handleDeleteList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个清单吗？此操作不可恢复。')) {
      deleteList(id);
    }
  };
  
  const handleJoinList = () => {
    setJoinError('');
    
    if (!shareCode.trim()) {
      setJoinError('请输入分享码');
      return;
    }
    
    if (!memberName.trim()) {
      setJoinError('请输入您的姓名');
      return;
    }
    
    const list = joinListByShareCode(shareCode.toUpperCase(), memberName.trim());
    
    if (list) {
      setShowJoinModal(false);
      setShareCode('');
      setMemberName('');
      navigate(`/list/${list.id}`);
    } else {
      setJoinError('分享码无效，请检查后重试');
    }
  };
  
  return (
    <div className="home-page">
      <nav className="navbar">
        <h1 className="navbar-title">🧳 旅行行李清单</h1>
        <div style={{ width: '60px' }}></div>
      </nav>
      
      <div className="container">
        {/* 快速操作卡片 */}
        <div className="card">
          <h2 className="page-title" style={{ marginBottom: '16px', fontSize: '20px' }}>
            开始您的旅行准备
          </h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/create')}
              style={{ flex: 1, minWidth: '140px' }}
            >
              ✨ 智能生成清单
            </button>
            <button 
              className="btn btn-success"
              onClick={() => navigate('/templates')}
              style={{ flex: 1, minWidth: '140px' }}
            >
              📚 使用模板
            </button>
            <button 
              className="btn btn-warning"
              onClick={() => setShowJoinModal(true)}
              style={{ flex: 1, minWidth: '140px' }}
            >
              🔗 加入他人清单
            </button>
          </div>
        </div>
        
        {/* 功能说明 */}
        <div className="card">
          <h3 className="card-title">💡 应用功能</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ 
              backgroundColor: '#e8f4f8', 
              padding: '16px', 
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
              <h4 style={{ marginBottom: '4px', color: '#2c3e50' }}>智能生成</h4>
              <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                输入出发地、目的地、天数、天气、活动类型，智能推荐所需物品
              </p>
            </div>
            <div style={{ 
              backgroundColor: '#fef9e7', 
              padding: '16px', 
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📚</div>
              <h4 style={{ marginBottom: '4px', color: '#2c3e50' }}>模板库</h4>
              <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                提供冬季旅行、亲子游、商务出差等多种常用模板
              </p>
            </div>
            <div style={{ 
              backgroundColor: '#e8f6f3', 
              padding: '16px', 
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
              <h4 style={{ marginBottom: '4px', color: '#2c3e50' }}>多人协作</h4>
              <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                生成分享码，家庭成员各自勾选自己带的物品，避免重复
              </p>
            </div>
            <div style={{ 
              backgroundColor: '#f5eef8', 
              padding: '16px', 
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <h4 style={{ marginBottom: '4px', color: '#2c3e50' }}>出发前检查</h4>
              <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                未勾选项高亮显示，支持一键生成文字清单分享给朋友
              </p>
            </div>
          </div>
        </div>
        
        {/* 我的清单列表 */}
        <div style={{ marginTop: '30px' }}>
          <h2 className="page-title" style={{ marginBottom: '16px', fontSize: '20px' }}>
            📋 我的清单
          </h2>
          
          {lists.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <h3 style={{ marginBottom: '8px', color: '#2c3e50' }}>暂无清单</h3>
              <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
                点击上方按钮创建您的第一个行李清单
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/create')}
              >
                ✨ 创建清单
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lists.map(list => {
                const progress = calculateProgress(list.items);
                
                return (
                  <div 
                    key={list.id}
                    className="card"
                    style={{ cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => navigate(`/list/${list.id}`)}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          marginBottom: '8px', 
                          color: '#2c3e50',
                          fontSize: '18px'
                        }}>
                          {list.title}
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
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
                            🎯 {getActivityName(list.activity)}
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#95a5a6' 
                        }}>
                          创建于：{formatDate(list.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteList(list.id, e)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#e74c3c',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '8px',
                          marginLeft: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {/* 进度条 */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '6px' 
                      }}>
                        <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
                          打包进度
                        </span>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '600', 
                          color: progress === 100 ? '#27ae60' : '#3498db'
                        }}>
                          {progress}%
                        </span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '10px', 
                        backgroundColor: '#ecf0f1',
                        borderRadius: '5px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${progress}%`, 
                          height: '100%', 
                          backgroundColor: progress === 100 ? '#27ae60' : '#3498db',
                          borderRadius: '5px',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                      <div style={{ 
                        marginTop: '6px', 
                        fontSize: '12px', 
                        color: '#7f8c8d',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>✅ {list.items.filter(i => i.completed).length} 已完成</span>
                        <span>⬜ {list.items.filter(i => !i.completed).length} 未完成</span>
                        <span>📦 共 {list.items.length} 件</span>
                      </div>
                    </div>
                    
                    {/* 成员信息 */}
                    {list.members.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid #ecf0f1'
                      }}>
                        <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
                          👥 协作成员：
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {list.members.map(member => (
                            <span 
                              key={member.id}
                              style={{ 
                                backgroundColor: `${member.color}20`,
                                color: member.color,
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              {member.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 分享码 */}
                    {list.shareCode && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginTop: list.members.length > 0 ? '8px' : '12px',
                        paddingTop: list.members.length > 0 ? '0' : '12px',
                        borderTop: list.members.length > 0 ? 'none' : '1px solid #ecf0f1'
                      }}>
                        <span style={{ fontSize: '14px', color: '#7f8c8d' }}>
                          🔗 分享码：
                        </span>
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '700', 
                          color: '#9b59b6',
                          letterSpacing: '2px'
                        }}>
                          {list.shareCode}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* 加入清单弹窗 */}
      {showJoinModal && (
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
            <h3 style={{ marginBottom: '8px', color: '#2c3e50' }}>
              🔗 加入他人清单
            </h3>
            <p style={{ color: '#7f8c8d', marginBottom: '20px', fontSize: '14px' }}>
              输入朋友分享的6位分享码，加入他们的行李清单协作
            </p>
            
            {joinError && (
              <div style={{ 
                backgroundColor: '#fdf2f2', 
                color: '#e74c3c', 
                padding: '12px', 
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                ⚠️ {joinError}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">分享码</label>
              <input
                type="text"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                className="form-input"
                placeholder="例如：ABC123"
                maxLength={6}
                autoFocus
                style={{ 
                  fontSize: '20px', 
                  letterSpacing: '8px',
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">您的姓名</label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="form-input"
                placeholder="例如：小明"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowJoinModal(false);
                  setShareCode('');
                  setMemberName('');
                  setJoinError('');
                }}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleJoinList}
                style={{ flex: 1 }}
              >
                加入清单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
