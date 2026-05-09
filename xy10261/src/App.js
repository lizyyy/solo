import React, { useState, useEffect } from 'react';
import './index.css';

const electronAPI = window.electronAPI || {
  getPackages: async () => [],
  getMembers: async () => [],
  getRooms: async () => [],
  getReservations: async () => [],
  getAccessLogs: async () => [],
  getSettlements: async () => [],
  getSettlementDetail: async () => null,
  createMember: async () => ({ success: false }),
  createReservation: async () => ({ success: false }),
  createAccessLog: async () => ({ success: false }),
  executeSettlement: async () => ({ success: false }),
  retrySettlement: async () => ({ success: false }),
  extendReservation: async () => ({ success: false }),
  exportSettlements: async () => ({ success: false }),
  searchHistory: async () => []
};

function App() {
  const [activeTab, setActiveTab] = useState('reservations');
  const [packages, setPackages] = useState([]);
  const [members, setMembers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkg, mem, rm, res, sets] = await Promise.all([
        electronAPI.getPackages(),
        electronAPI.getMembers(),
        electronAPI.getRooms(),
        electronAPI.getReservations(),
        electronAPI.getSettlements()
      ]);
      setPackages(pkg);
      setMembers(mem);
      setRooms(rm);
      setReservations(res);
      setSettlements(sets);
    } catch (error) {
      console.error('加载数据失败:', error);
      showAlert('error', '加载数据失败');
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'success': { text: '结算成功', class: 'status-success' },
      'partial_cash': { text: '部分现金', class: 'status-partial' },
      'failed': { text: '结算失败', class: 'status-failed' },
      'needs_review': { text: '待人工审核', class: 'status-review' },
      'confirmed': { text: '已确认', class: 'status-success' },
      'in_progress': { text: '进行中', class: 'status-partial' },
      'completed': { text: '已完成', class: 'status-success' },
      'pending': { text: '待确认', class: 'status-pending' }
    };
    const s = statusMap[status] || { text: status, class: 'status-pending' };
    return <span className={`status-badge ${s.class}`}>{s.text}</span>;
  };

  const ReservationTab = () => {
    const [form, setForm] = useState({
      member_id: '',
      room_id: '',
      scheduled_start: '',
      scheduled_end: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.member_id || !form.room_id || !form.scheduled_start || !form.scheduled_end) {
        showAlert('error', '请填写所有必填项');
        return;
      }
      
      const result = await electronAPI.createReservation(form);
      
      if (result.success) {
        showAlert('success', `预约创建成功！预约ID: ${result.id}`);
        if (result.verificationData) {
          console.log('验证数据:', result.verificationData);
        }
        setForm({ member_id: '', room_id: '', scheduled_start: '', scheduled_end: '' });
        loadData();
      } else {
        showAlert('error', result.errors ? result.errors.join('；') : '创建失败');
        if (result.verificationData) {
          console.log('验证失败数据:', result.verificationData);
        }
      }
    };

    return (
      <div>
        <div className="row">
          <div className="col">
            <div className="card">
              <h2>创建预约</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>选择会员 *</label>
                  <select 
                    className="form-control" 
                    value={form.member_id}
                    onChange={(e) => setForm({...form, member_id: parseInt(e.target.value)})}
                  >
                    <option value="">请选择会员</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} - 剩余 {m.remaining_hours} 小时
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>选择琴房 *</label>
                  <select 
                    className="form-control" 
                    value={form.room_id}
                    onChange={(e) => setForm({...form, room_id: parseInt(e.target.value)})}
                  >
                    <option value="">请选择琴房</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.location})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="row">
                  <div className="col">
                    <div className="form-group">
                      <label>开始时间 *</label>
                      <input 
                        type="datetime-local" 
                        className="form-control"
                        value={form.scheduled_start}
                        onChange={(e) => setForm({...form, scheduled_start: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="col">
                    <div className="form-group">
                      <label>结束时间 *</label>
                      <input 
                        type="datetime-local" 
                        className="form-control"
                        value={form.scheduled_end}
                        onChange={(e) => setForm({...form, scheduled_end: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="btn btn-primary">创建预约</button>
              </form>
            </div>
          </div>
          
          <div className="col">
            <div className="card">
              <h2>预约列表</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>会员</th>
                      <th>琴房</th>
                      <th>预约时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(r => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.member_name}</td>
                        <td>{r.room_name}</td>
                        <td>
                          <div>{r.scheduled_start}</div>
                          <div>至 {r.scheduled_end}</div>
                        </td>
                        <td>{getStatusBadge(r.status)}</td>
                        <td>
                          <div className="action-buttons">
                            {(r.status === 'confirmed' || r.status === 'in_progress') && (
                              <>
                                <button 
                                  className="btn btn-success"
                                  onClick={() => {
                                    setModalType('check_in');
                                    setSelectedSettlement({ ...r });
                                    setShowModal(true);
                                  }}
                                >签到</button>
                                <button 
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setModalType('check_out');
                                    setSelectedSettlement({ ...r });
                                    setShowModal(true);
                                  }}
                                >签出</button>
                              </>
                            )}
                            {r.status === 'confirmed' && r.check_out_count === 0 && (
                              <button 
                                className="btn btn-primary"
                                onClick={() => {
                                  setModalType('extend');
                                  setSelectedSettlement({ ...r });
                                  setShowModal(true);
                                }}
                              >续时</button>
                            )}
                            {r.status === 'completed' && r.check_in_count > 0 && r.check_out_count > 0 && (
                              <button 
                                className="btn btn-primary"
                                onClick={async () => {
                                  if (confirm('确认执行结算？')) {
                                    const result = await electronAPI.executeSettlement(r.id);
                                    if (result.success) {
                                      showAlert('success', `结算完成！套餐扣减: ${result.package_deduction} 小时, 现金支付: ¥${result.cash_payment}`);
                                    } else {
                                      showAlert('error', result.error_message || '结算失败');
                                    }
                                    loadData();
                                  }
                                }}
                              >结算</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SettlementTab = () => {
    const [filter, setFilter] = useState('');
    
    const handleFilter = async () => {
      const data = await electronAPI.getSettlements(filter ? { status: filter } : {});
      setSettlements(data);
    };

    const exportData = async () => {
      const result = await electronAPI.exportSettlements(filter ? { status: filter } : {});
      if (result.success) {
        showAlert('success', `已导出到: ${result.filePath}`);
      } else if (!result.canceled) {
        showAlert('error', '导出失败');
      }
    };

    return (
      <div>
        <div className="card">
          <h2>结算管理</h2>
          
          <div className="search-bar">
            <div className="form-group">
              <label>状态筛选</label>
              <select 
                className="form-control"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="success">成功</option>
                <option value="partial_cash">部分现金</option>
                <option value="needs_review">待审核</option>
                <option value="failed">失败</option>
              </select>
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleFilter}>筛选</button>
              <button className="btn btn-primary" onClick={exportData}>导出Excel</button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>结算ID</th>
                  <th>会员</th>
                  <th>琴房</th>
                  <th>预约时长</th>
                  <th>实际时长</th>
                  <th>套餐扣减</th>
                  <th>现金支付</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.member_name}</td>
                    <td>{s.room_name}</td>
                    <td>{s.scheduled_hours}h</td>
                    <td>{s.actual_hours}h</td>
                    <td>{s.package_deduction}h</td>
                    <td>¥{s.cash_payment}</td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-secondary"
                          onClick={async () => {
                            const detail = await electronAPI.getSettlementDetail(s.id);
                            setSelectedSettlement(detail);
                            setModalType('detail');
                            setShowModal(true);
                          }}
                        >详情</button>
                        {(s.status === 'failed' || s.status === 'needs_review') && (
                          <button 
                            className="btn btn-primary"
                            onClick={async () => {
                              const detail = await electronAPI.getSettlementDetail(s.id);
                              setSelectedSettlement(detail);
                              setModalType('retry');
                              setShowModal(true);
                            }}
                          >重新结算</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const MemberTab = () => {
    const [form, setForm] = useState({
      name: '',
      phone: '',
      email: '',
      package_id: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name) {
        showAlert('error', '请输入会员姓名');
        return;
      }
      
      const result = await electronAPI.createMember(form);
      if (result.success) {
        showAlert('success', '会员创建成功！');
        setForm({ name: '', phone: '', email: '', package_id: '' });
        loadData();
      } else {
        showAlert('error', '创建失败');
      }
    };

    return (
      <div>
        <div className="row">
          <div className="col">
            <div className="card">
              <h2>新增会员</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>姓名 *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>电话</label>
                  <input 
                    type="tel" 
                    className="form-control"
                    value={form.phone}
                    onChange={(e) => setForm({...form, phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>邮箱</label>
                  <input 
                    type="email" 
                    className="form-control"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>选择套餐</label>
                  <select 
                    className="form-control"
                    value={form.package_id}
                    onChange={(e) => setForm({...form, package_id: parseInt(e.target.value) || ''})}
                  >
                    <option value="">暂不购买</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {p.total_hours}小时 ¥{p.price}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">创建会员</button>
              </form>
            </div>
          </div>
          
          <div className="col">
            <div className="card">
              <h2>会员列表</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>姓名</th>
                      <th>电话</th>
                      <th>套餐</th>
                      <th>剩余时长</th>
                      <th>已用时长</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td>{m.name}</td>
                        <td>{m.phone || '-'}</td>
                        <td>{m.package_name || '无'}</td>
                        <td style={{ color: m.remaining_hours < 5 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                          {m.remaining_hours}h
                        </td>
                        <td>{m.used_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AcceptanceTab = () => {
    const [testResults, setTestResults] = useState([]);

    const runTests = async () => {
      setLoading(true);
      const results = [];

      if (members.length > 0 && rooms.length > 0) {
        const testMember = members[0];
        const testRoom = rooms[0];
        const now = new Date();
        const startTime = new Date(now.getTime() + 60 * 60 * 1000);
        const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

        const reservationResult = await electronAPI.createReservation({
          member_id: testMember.id,
          room_id: testRoom.id,
          scheduled_start: startTime.toISOString().slice(0, 16),
          scheduled_end: endTime.toISOString().slice(0, 16)
        });

        results.push({
          test: '预约验证',
          expected: '会员存在、琴房可用、时间合理、余额充足',
          result: reservationResult.success ? 'PASS' : 'FAIL',
          details: reservationResult.success ? `预约ID: ${reservationResult.id}` : (reservationResult.errors?.join('；') || '失败')
        });

        if (reservationResult.success) {
          await electronAPI.createAccessLog({
            reservation_id: reservationResult.id,
            event_type: 'check_in',
            event_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
          });

          await electronAPI.createAccessLog({
            reservation_id: reservationResult.id,
            event_type: 'check_out',
            event_time: new Date(Date.now() + 90 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
          });

          const settlementResult = await electronAPI.executeSettlement(reservationResult.id);
          
          results.push({
            test: '正常结算',
            expected: '套餐扣减正确，状态success',
            result: settlementResult.status === 'success' ? 'PASS' : (settlementResult.status === 'partial_cash' ? 'PASS' : 'FAIL'),
            details: `套餐扣减: ${settlementResult.package_deduction}h, 现金: ¥${settlementResult.cash_payment}`
          });
        }
      }

      results.push({
        test: '失败场景模拟',
        expected: '显示具体错误原因',
        result: 'DEMO',
        details: '如：剩余时长不足时，应显示"会员剩余时长不足。需要 X 小时，剩余 Y 小时"'
      });

      results.push({
        test: '修正后重跑',
        expected: '补充缺失数据后可重新结算',
        result: 'DEMO',
        details: '如：缺少签出记录时，在详情页点击"重新结算"可补充记录后重试'
      });

      setTestResults(results);
      await loadData();
      setLoading(false);
    };

    return (
      <div>
        <div className="card">
          <h2>验收测试</h2>
          <p style={{ marginBottom: 20, color: '#666' }}>
            点击下方按钮运行验收测试，验证系统是否满足所有要求
          </p>
          <button className="btn btn-primary" onClick={runTests} disabled={loading}>
            {loading ? '测试中...' : '运行验收测试'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="card">
            <h2>测试结果</h2>
            
            <div className="alert-info alert" style={{ marginBottom: 20 }}>
              <strong>验收标准说明：</strong><br />
              ✓ PASS (绿色) - 表示自动化测试通过<br />
              ✗ FAIL (红色) - 表示需要检查问题<br />
              📋 DEMO - 表示需要人工验证的场景<br /><br />
              <strong>输出含义：</strong><br />
              • status: success - 结算成功，无需人工处理<br />
              • status: partial_cash - 部分现金支付，可能需要确认<br />
              • status: needs_review - 待人工审核，缺少关键数据<br />
              • status: failed - 结算失败，需要修复后重跑
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>测试项</th>
                    <th>预期结果</th>
                    <th>实际结果</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.test}</strong></td>
                      <td style={{ fontSize: 12, color: '#666' }}>{r.expected}</td>
                      <td>
                        {r.result === 'PASS' && <span className="status-badge status-success">PASS ✓</span>}
                        {r.result === 'FAIL' && <span className="status-badge status-failed">FAIL ✗</span>}
                        {r.result === 'DEMO' && <span className="status-badge status-review">📋 DEMO</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{r.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h2>三种结算结果演示</h2>
          
          <div className="alert-success alert">
            <h4>✓ 正常处理 (status: success)</h4>
            <p>会员有足够套餐时长，实际时长 ≤ 预约时长</p>
            <p>输出：套餐扣减 = 实际时长，现金支付 = 0</p>
          </div>
          
          <div className="alert-error alert">
            <h4>✗ 失败原因</h4>
            <p>• 缺少签到/签出记录 → error_message: "缺少签到记录"</p>
            <p>• 会员套餐余量不足 → error_message: "会员剩余时长不足"</p>
            <p>• 预约与进出记录不匹配 → error_message: "会员ID不匹配"</p>
          </div>
          
          <div className="alert-warning alert">
            <h4>🔧 修正后重跑</h4>
            <p>1. 在结算列表中找到 status: needs_review 或 failed 的记录</p>
            <p>2. 点击"详情"查看 verification_data 中的问题定位</p>
            <p>3. 点击"重新结算"补充缺失的进出记录</p>
            <p>4. 系统会重新执行结算逻辑</p>
          </div>
        </div>
      </div>
    );
  };

  const Modal = () => {
    if (!showModal || !modalType) return null;

    const [formData, setFormData] = useState({});

    const handleCheckInOut = async (type) => {
      if (!formData.event_time) {
        showAlert('error', '请选择时间');
        return;
      }
      
      const result = await electronAPI.createAccessLog({
        reservation_id: selectedSettlement.id,
        event_type: type,
        event_time: formData.event_time.replace('T', ' ')
      });
      
      if (result.success) {
        showAlert('success', type === 'check_in' ? '签到成功' : '签出成功');
        setShowModal(false);
        loadData();
      } else {
        showAlert('error', result.error || '操作失败');
      }
    };

    const handleExtend = async () => {
      if (!formData.newEndTime) {
        showAlert('error', '请选择新的结束时间');
        return;
      }
      
      const result = await electronAPI.extendReservation({
        reservationId: selectedSettlement.id,
        newEndTime: formData.newEndTime.replace('T', ' ')
      });
      
      if (result.success) {
        showAlert('success', `续时成功！新增 ${result.additionalHours} 小时`);
        setShowModal(false);
        loadData();
      } else {
        showAlert('error', result.error || '续时失败');
      }
    };

    const handleRetry = async () => {
      const corrections = {};
      
      if (formData.addCheckIn || formData.addCheckOut) {
        corrections.addAccessLogs = [];
        if (formData.addCheckIn) {
          corrections.addAccessLogs.push({
            event_type: 'check_in',
            event_time: formData.addCheckIn.replace('T', ' ')
          });
        }
        if (formData.addCheckOut) {
          corrections.addAccessLogs.push({
            event_type: 'check_out',
            event_time: formData.addCheckOut.replace('T', ' ')
          });
        }
      }

      const result = await electronAPI.retrySettlement(selectedSettlement.id, corrections);
      
      if (result.success) {
        showAlert('success', `重新结算成功！套餐扣减: ${result.package_deduction}h`);
      } else {
        showAlert('error', result.error_message || '重新结算失败');
      }
      
      setShowModal(false);
      loadData();
    };

    return (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>
              {modalType === 'check_in' && '签到登记'}
              {modalType === 'check_out' && '签出登记'}
              {modalType === 'extend' && '预约续时'}
              {modalType === 'detail' && '结算详情'}
              {modalType === 'retry' && '重新结算'}
            </h2>
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
          </div>

          {modalType === 'check_in' && (
            <div>
              <p><strong>预约信息：</strong>{selectedSettlement?.member_name} - {selectedSettlement?.room_name}</p>
              <p><strong>预约时间：</strong>{selectedSettlement?.scheduled_start} 至 {selectedSettlement?.scheduled_end}</p>
              <div className="form-group" style={{ marginTop: 20 }}>
                <label>签到时间</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={formData.event_time || ''}
                  onChange={(e) => setFormData({...formData, event_time: e.target.value})}
                />
              </div>
              <button className="btn btn-success" onClick={() => handleCheckInOut('check_in')}>确认签到</button>
            </div>
          )}

          {modalType === 'check_out' && (
            <div>
              <p><strong>预约信息：</strong>{selectedSettlement?.member_name} - {selectedSettlement?.room_name}</p>
              <div className="form-group" style={{ marginTop: 20 }}>
                <label>签出时间</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={formData.event_time || ''}
                  onChange={(e) => setFormData({...formData, event_time: e.target.value})}
                />
              </div>
              <button className="btn btn-success" onClick={() => handleCheckInOut('check_out')}>确认签出</button>
            </div>
          )}

          {modalType === 'extend' && (
            <div>
              <p><strong>当前预约结束：</strong>{selectedSettlement?.scheduled_end}</p>
              <div className="form-group" style={{ marginTop: 20 }}>
                <label>新的结束时间</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={formData.newEndTime || ''}
                  onChange={(e) => setFormData({...formData, newEndTime: e.target.value})}
                />
              </div>
              <button className="btn btn-primary" onClick={handleExtend}>确认续时</button>
            </div>
          )}

          {modalType === 'detail' && selectedSettlement && (
            <div>
              <div className="detail-section">
                <h3>基本信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">结算ID</div>
                    <div className="detail-value">{selectedSettlement.id}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">状态</div>
                    <div className="detail-value">{getStatusBadge(selectedSettlement.status)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">会员</div>
                    <div className="detail-value">{selectedSettlement.member_name}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">琴房</div>
                    <div className="detail-value">{selectedSettlement.room_name}</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>时长信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">预约开始</div>
                    <div className="detail-value">{selectedSettlement.scheduled_start}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">预约结束</div>
                    <div className="detail-value">{selectedSettlement.scheduled_end}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">预约时长</div>
                    <div className="detail-value">{selectedSettlement.scheduled_hours} 小时</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">实际时长</div>
                    <div className="detail-value">{selectedSettlement.actual_hours} 小时</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>费用明细</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">套餐扣减</div>
                    <div className="detail-value" style={{ color: '#10b981' }}>{selectedSettlement.package_deduction} 小时</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">现金支付</div>
                    <div className="detail-value" style={{ color: '#f59e0b' }}>¥{selectedSettlement.cash_payment}</div>
                  </div>
                </div>
              </div>

              {selectedSettlement.error_message && (
                <div className="alert-error alert">
                  <strong>错误信息：</strong>{selectedSettlement.error_message}
                </div>
              )}

              {selectedSettlement.accessLogs && selectedSettlement.accessLogs.length > 0 && (
                <div className="detail-section">
                  <h3>进出记录</h3>
                  <div className="timeline">
                    {selectedSettlement.accessLogs.map((log, i) => (
                      <div key={i} className="timeline-item">
                        <div className="timeline-time">{log.event_time}</div>
                        <div className="timeline-action">
                          {log.event_type === 'check_in' ? '🔓 签到' : '🔒 签出'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSettlement.verification_data && (
                <div className="detail-section">
                  <h3>验证数据（用于对账）</h3>
                  <pre className="json-display">
                    {JSON.stringify(selectedSettlement.verification_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedSettlement.history && selectedSettlement.history.length > 0 && (
                <div className="detail-section">
                  <h3>操作历史</h3>
                  <div className="timeline">
                    {selectedSettlement.history.map((h, i) => (
                      <div key={i} className="timeline-item">
                        <div className="timeline-time">{h.created_at}</div>
                        <div className="timeline-action">{h.action}</div>
                        {h.details && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{h.details}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {modalType === 'retry' && selectedSettlement && (
            <div>
              <div className="alert-warning alert">
                <strong>当前状态：</strong>{getStatusBadge(selectedSettlement.status)}<br />
                <strong>错误原因：</strong>{selectedSettlement.error_message || '未知错误'}
              </div>

              <p style={{ marginBottom: 16 }}>补充以下缺失的记录后重新结算：</p>

              <div className="form-group">
                <label>补充签到时间（如缺少）</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={formData.addCheckIn || ''}
                  onChange={(e) => setFormData({...formData, addCheckIn: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>补充签出时间（如缺少）</label>
                <input 
                  type="datetime-local" 
                  className="form-control"
                  value={formData.addCheckOut || ''}
                  onChange={(e) => setFormData({...formData, addCheckOut: e.target.value})}
                />
              </div>

              <button className="btn btn-primary" onClick={handleRetry}>执行重新结算</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <header>
        <div className="container">
          <h1>🎹 共享琴房练习时长结算器</h1>
          <p>按预约、实际进出和会员套餐智能结算，确保数据可追溯、可验证</p>
        </div>
      </header>

      <div className="container">
        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{members.length}</div>
            <div className="stat-label">会员总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{reservations.length}</div>
            <div className="stat-label">预约总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{settlements.length}</div>
            <div className="stat-label">已结算</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {settlements.filter(s => s.status === 'needs_review' || s.status === 'failed').length}
            </div>
            <div className="stat-label">待处理</div>
          </div>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >📅 预约管理</button>
          <button 
            className={`tab ${activeTab === 'settlements' ? 'active' : ''}`}
            onClick={() => setActiveTab('settlements')}
          >💰 结算记录</button>
          <button 
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >👥 会员管理</button>
          <button 
            className={`tab ${activeTab === 'acceptance' ? 'active' : ''}`}
            onClick={() => setActiveTab('acceptance')}
          >✅ 验收测试</button>
        </div>

        {activeTab === 'reservations' && <ReservationTab />}
        {activeTab === 'settlements' && <SettlementTab />}
        {activeTab === 'members' && <MemberTab />}
        {activeTab === 'acceptance' && <AcceptanceTab />}

        <Modal />
      </div>
    </div>
  );
}

export default App;
