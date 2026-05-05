import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

import {
  getRooms,
  getTimeline,
  assessAllCourses,
  updateAssessmentOverride,
  importSensorData,
  importVentilationData,
  importCourseData,
  importCleaningData,
  clearRoomData,
  exportJSON,
  exportMarkdown
} from './api';

dayjs.locale('zh-cn');

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const THRESHOLDS = {
  co2: { warning: 1000, danger: 1500 },
  pm25: { warning: 35, danger: 75 },
  tvoc: { warning: 0.6, danger: 3.0 }
};

function getRiskLevel(value, type) {
  if (value === null || value === undefined) return 'safe';
  const threshold = THRESHOLDS[type];
  if (value >= threshold.danger) return 'danger';
  if (value >= threshold.warning) return 'warning';
  return 'safe';
}

function ImportSection({ selectedRoom, onImport }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const handleFileUpload = async (type, e, fileInputRef) => {
    const files = e.target?.files || e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setLoading(prev => ({ ...prev, [type]: true }));
    
    try {
      let result;
      switch(type) {
        case 'sensor':
          result = await importSensorData(file, selectedRoom);
          break;
        case 'ventilation':
          result = await importVentilationData(file, selectedRoom);
          break;
        case 'course':
          result = await importCourseData(file, selectedRoom);
          break;
        case 'cleaning':
          result = await importCleaningData(file, selectedRoom);
          break;
        default:
          return;
      }
      
      setResults(prev => ({ ...prev, [type]: { success: true, count: result.count } }));
      onImport();
    } catch (err) {
      setResults(prev => ({ ...prev, [type]: { success: false, error: err.response?.data?.error || err.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
      if (fileInputRef?.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const FileUploadCard = ({ type, title, subtitle, icon, fileInputRef }) => (
    <div className="import-card">
      <div className="import-card-header">
        <div className={`import-card-icon ${type}`}>{icon}</div>
        <div>
          <div className="import-card-title">{title}</div>
          <div className="import-card-subtitle">{subtitle}</div>
        </div>
      </div>
      
      <label className="file-upload">
        <input 
          type="file" 
          accept=".csv" 
          ref={fileInputRef}
          onChange={(e) => handleFileUpload(type, e, fileInputRef)}
        />
        <div className="file-upload-icon">{loading[type] ? '⏳' : '📁'}</div>
        <div className="file-upload-text">
          {loading[type] ? '导入中...' : '点击或拖拽上传 CSV 文件'}
        </div>
        <div className="file-upload-hint">仅支持 .csv 格式</div>
      </label>
      
      {results[type] && (
        <div className={`import-result ${results[type].success ? 'success' : 'error'}`}>
          {results[type].success 
            ? `✅ 成功导入 ${results[type].count} 条记录`
            : `❌ 导入失败: ${results[type].error}`
          }
        </div>
      )}
    </div>
  );

  const sensorRef = React.useRef(null);
  const ventilationRef = React.useRef(null);
  const courseRef = React.useRef(null);
  const cleaningRef = React.useRef(null);

  return (
    <div className="section">
      <h2 className="section-title">数据导入</h2>
      <div className="import-grid">
        <FileUploadCard 
          type="sensor" 
          title="传感器数据" 
          subtitle="CO2, PM2.5, TVOC 浓度" 
          icon="📊"
          fileInputRef={sensorRef}
        />
        <FileUploadCard 
          type="ventilation" 
          title="通风记录" 
          subtitle="开窗/新风操作记录" 
          icon="🌬️"
          fileInputRef={ventilationRef}
        />
        <FileUploadCard 
          type="course" 
          title="课程预约" 
          subtitle="每日课程安排" 
          icon="📅"
          fileInputRef={courseRef}
        />
        <FileUploadCard 
          type="cleaning" 
          title="清洁消毒" 
          subtitle="清洁消毒操作记录" 
          icon="🧹"
          fileInputRef={cleaningRef}
        />
      </div>
    </div>
  );
}

function ChartSection({ timeline }) {
  const { sensorData, ventilationData, courses, thresholds } = timeline;
  
  if (!sensorData || sensorData.length === 0) {
    return (
      <div className="section">
        <h2 className="section-title">空气质量趋势</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-text">暂无传感器数据，请先导入传感器 CSV 文件</div>
        </div>
      </div>
    );
  }

  const timeLabels = sensorData.map(d => dayjs(d.timestamp).format('HH:mm'));
  
  const co2Data = sensorData.map(d => d.co2);
  const pm25Data = sensorData.map(d => d.pm25);
  const tvocData = sensorData.map(d => d.tvoc);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '时间'
        }
      }
    }
  };

  const co2ChartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'CO2 (ppm)',
        data: co2Data,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const pm25ChartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'PM2.5 (μg/m³)',
        data: pm25Data,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const tvocChartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'TVOC (mg/m³)',
        data: tvocData,
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const co2ThresholdLines = [
    { value: THRESHOLDS.co2.warning, color: 'rgba(245, 158, 11, 0.5)', label: '警告线' },
    { value: THRESHOLDS.co2.danger, color: 'rgba(239, 68, 68, 0.5)', label: '危险线' }
  ];

  const pm25ThresholdLines = [
    { value: THRESHOLDS.pm25.warning, color: 'rgba(245, 158, 11, 0.5)', label: '警告线' },
    { value: THRESHOLDS.pm25.danger, color: 'rgba(239, 68, 68, 0.5)', label: '危险线' }
  ];

  const tvocThresholdLines = [
    { value: THRESHOLDS.tvoc.warning, color: 'rgba(245, 158, 11, 0.5)', label: '警告线' },
    { value: THRESHOLDS.tvoc.danger, color: 'rgba(239, 68, 68, 0.5)', label: '危险线' }
  ];

  const ChartWithThresholds = ({ data, options, thresholds }) => {
    const maxValue = Math.max(...data.datasets[0].data.filter(v => v !== null));
    const allThresholds = thresholds.map(t => t.value);
    const suggestedMax = Math.max(maxValue * 1.1, ...allThresholds) + 10;
    
    return (
      <div className="chart-container">
        <Line 
          data={data} 
          options={{
            ...options,
            scales: {
              ...options.scales,
              y: {
                display: true,
                title: {
                  display: true,
                  text: '数值'
                },
                suggestedMax: suggestedMax
              }
            }
          }}
        />
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          justifyContent: 'center', 
          marginTop: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          {thresholds.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ 
                width: '20px', 
                height: '2px', 
                backgroundColor: t.color,
                border: '1px dashed ' + t.color
              }} />
              {t.label}: {t.value}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="section">
      <h2 className="section-title">空气质量趋势</h2>
      
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#555' }}>
          CO₂ 浓度趋势
        </h3>
        <ChartWithThresholds data={co2ChartData} options={chartOptions} thresholds={co2ThresholdLines} />
      </div>
      
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#555' }}>
          PM2.5 浓度趋势
        </h3>
        <ChartWithThresholds data={pm25ChartData} options={chartOptions} thresholds={pm25ThresholdLines} />
      </div>
      
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#555' }}>
          TVOC 浓度趋势
        </h3>
        <ChartWithThresholds data={tvocChartData} options={chartOptions} thresholds={tvocThresholdLines} />
      </div>
      
      <div className="alert alert-info" style={{ marginTop: '24px' }}>
        <strong>阈值说明：</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>CO₂: 警告 {THRESHOLDS.co2.warning} ppm, 危险 {THRESHOLDS.co2.danger} ppm</li>
          <li>PM2.5: 警告 {THRESHOLDS.pm25.warning} μg/m³, 危险 {THRESHOLDS.pm25.danger} μg/m³</li>
          <li>TVOC: 警告 {THRESHOLDS.tvoc.warning} mg/m³, 危险 {THRESHOLDS.tvoc.danger} mg/m³</li>
        </ul>
      </div>
    </div>
  );
}

function AssessmentModal({ assessment, course, onClose, onSave }) {
  const [canProceed, setCanProceed] = useState(assessment?.can_proceed ? true : false);
  const [overrideReason, setOverrideReason] = useState(assessment?.override_reason || '');
  const [notes, setNotes] = useState(assessment?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(assessment.id, canProceed, overrideReason, notes);
      onClose();
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">人工改判 - {course?.course_name}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>当前评估状态</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={`status-badge ${assessment?.can_proceed ? 'status-allow' : 'status-deny'}`}>
                {assessment?.can_proceed ? '✅ 自动放行' : '❌ 自动拒绝'}
              </span>
              {assessment?.manual_override && (
                <span style={{ fontSize: '13px', color: '#666' }}>(已人工改判)</span>
              )}
            </div>
          </div>
          
          <div className="form-group">
            <label>改判结果</label>
            <div className="radio-group">
              <label className={`radio-item allow ${canProceed ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="proceed" 
                  checked={canProceed === true}
                  onChange={() => setCanProceed(true)}
                />
                ✅ 放行
              </label>
              <label className={`radio-item deny ${canProceed === false ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="proceed" 
                  checked={canProceed === false}
                  onChange={() => setCanProceed(false)}
                />
                ❌ 拒绝
              </label>
            </div>
          </div>
          
          <div className="form-group">
            <label>改判原因</label>
            <textarea 
              className="textarea-control"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="请输入改判原因（如：已紧急开窗通风、临时调整课程时间等）"
            />
          </div>
          
          <div className="form-group">
            <label>备注</label>
            <textarea 
              className="textarea-control"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="其他备注信息"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '确认改判'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssessmentSection({ timeline, selectedRoom, selectedDate, onRefresh }) {
  const { courses, assessments, ventilationData, cleaningRecords, sensorData } = timeline;
  const [showModal, setShowModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assessing, setAssessing] = useState(false);

  const handleOpenModal = (assessment, course) => {
    setSelectedAssessment(assessment);
    setSelectedCourse(course);
    setShowModal(true);
  };

  const handleSaveOverride = async (assessmentId, canProceed, overrideReason, notes) => {
    await updateAssessmentOverride(assessmentId, canProceed, overrideReason, notes);
    onRefresh();
  };

  const handleAssessAll = async () => {
    setAssessing(true);
    try {
      await assessAllCourses(selectedRoom, selectedDate);
      onRefresh();
    } catch (err) {
      console.error('评估失败:', err);
    } finally {
      setAssessing(false);
    }
  };

  if (!courses || courses.length === 0) {
    return (
      <div className="section">
        <h2 className="section-title">课程放行评估</h2>
        <div className="btn-group" style={{ marginBottom: '20px' }}>
          <button className="btn btn-primary" onClick={handleAssessAll} disabled={assessing}>
            {assessing ? '评估中...' : '执行评估'}
          </button>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">暂无课程数据，请先导入课程预约 CSV 文件</div>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2 className="section-title">课程放行评估</h2>
      
      <div className="btn-group" style={{ marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={handleAssessAll} disabled={assessing}>
          {assessing ? '评估中...' : '重新评估所有课程'}
        </button>
      </div>
      
      {courses.map((course, index) => {
        const assessment = assessments?.find(a => a.course_id === course.id);
        const hasAssessment = assessment !== undefined;
        
        return (
          <div key={course.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{index + 1}. {course.course_name}</div>
                <div className="card-time">
                  {dayjs(course.start_time).format('HH:mm')} - {dayjs(course.end_time).format('HH:mm')}
                  {course.teacher && ` | 教师: ${course.teacher}`}
                  {course.students_count && ` | 学生: ${course.students_count}人`}
                </div>
              </div>
              <div>
                {hasAssessment ? (
                  <span className={`status-badge ${assessment.can_proceed ? 'status-allow' : 'status-deny'}`}>
                    {assessment.manual_override ? (assessment.can_proceed ? '✅ 人工放行' : '❌ 人工拒绝') : (assessment.can_proceed ? '✅ 自动放行' : '❌ 自动拒绝')}
                  </span>
                ) : (
                  <span className="risk-badge risk-warning">⏳ 待评估</span>
                )}
              </div>
            </div>
            
            {hasAssessment && (
              <>
                <div className="card-content">
                  <div className="metric">
                    <div className="metric-label">当前 CO₂</div>
                    <div className={`metric-value ${getRiskLevel(assessment.co2_level, 'co2')}`}>
                      {assessment.co2_level !== null ? assessment.co2_level : '-'}
                      <span className="metric-unit">ppm</span>
                    </div>
                  </div>
                  
                  <div className="metric">
                    <div className="metric-label">当前 PM2.5</div>
                    <div className={`metric-value ${getRiskLevel(assessment.pm25_level, 'pm25')}`}>
                      {assessment.pm25_level !== null ? assessment.pm25_level : '-'}
                      <span className="metric-unit">μg/m³</span>
                    </div>
                  </div>
                  
                  <div className="metric">
                    <div className="metric-label">当前 TVOC</div>
                    <div className={`metric-value ${getRiskLevel(assessment.tvoc_level, 'tvoc')}`}>
                      {assessment.tvoc_level !== null ? assessment.tvoc_level : '-'}
                      <span className="metric-unit">mg/m³</span>
                    </div>
                  </div>
                  
                  <div className="metric">
                    <div className="metric-label">风险等级</div>
                    <div className={`metric-value ${assessment.risk_level}`}>
                      <span className={`risk-badge risk-${assessment.risk_level}`}>
                        {assessment.risk_level === 'safe' ? '🟢 安全' : assessment.risk_level === 'warning' ? '🟡 警告' : '🔴 危险'}
                      </span>
                    </div>
                  </div>
                  
                  {assessment.ventilation_recovery_minutes !== null && (
                    <div className="metric">
                      <div className="metric-label">预估通风恢复时间</div>
                      <div className={`metric-value ${assessment.ventilation_recovery_minutes > 15 ? 'warning' : 'safe'}`}>
                        {assessment.ventilation_recovery_minutes}
                        <span className="metric-unit">分钟</span>
                      </div>
                    </div>
                  )}
                  
                  {assessment.peak_co2 !== null && (
                    <div className="metric">
                      <div className="metric-label">峰值 CO₂</div>
                      <div className={`metric-value ${getRiskLevel(assessment.peak_co2, 'co2')}`}>
                        {assessment.peak_co2}
                        <span className="metric-unit">ppm</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {assessment.risk_reasons && (
                  <div className="notes-section">
                    <span className="notes-label">风险原因</span>
                    <div className="notes-text">{assessment.risk_reasons}</div>
                  </div>
                )}
                
                {assessment.notes && (
                  <div className="notes-section">
                    <span className="notes-label">备注</span>
                    <div className="notes-text">{assessment.notes}</div>
                  </div>
                )}
              </>
            )}
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e9ecef' }}>
              <button 
                className="btn btn-primary btn-small"
                onClick={() => handleOpenModal(assessment, course)}
              >
                ✏️ 人工改判 / 添加备注
              </button>
            </div>
          </div>
        );
      })}
      
      {showModal && selectedAssessment && (
        <AssessmentModal 
          assessment={selectedAssessment}
          course={selectedCourse}
          onClose={() => setShowModal(false)}
          onSave={handleSaveOverride}
        />
      )}
    </div>
  );
}

function TimelineSection({ timeline }) {
  const { ventilationData, cleaningRecords, courses } = timeline;
  
  const allEvents = [];
  
  courses?.forEach(course => {
    allEvents.push({
      time: course.start_time,
      type: 'course',
      title: course.course_name,
      description: `${dayjs(course.start_time).format('HH:mm')} - ${dayjs(course.end_time).format('HH:mm')}`,
      start: course.start_time,
      end: course.end_time
    });
  });
  
  ventilationData?.forEach(vent => {
    allEvents.push({
      time: vent.start_time,
      type: 'ventilation',
      title: vent.type === 'window' ? '开窗通风' : '新风系统',
      description: vent.end_time 
        ? `${dayjs(vent.start_time).format('HH:mm')} - ${dayjs(vent.end_time).format('HH:mm')}`
        : `从 ${dayjs(vent.start_time).format('HH:mm')} 开始（进行中）`
    });
  });
  
  cleaningRecords?.forEach(record => {
    allEvents.push({
      time: record.timestamp,
      type: 'cleaning',
      title: record.type === 'cleaning' ? '清洁' : '消毒',
      description: record.staff ? `操作人员: ${record.staff}` : (record.notes || '')
    });
  });
  
  allEvents.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf());
  
  if (allEvents.length === 0) {
    return null;
  }
  
  return (
    <div className="section">
      <h2 className="section-title">今日时间线</h2>
      <div className="timeline-container">
        <div className="timeline-line"></div>
        {allEvents.map((event, index) => (
          <div key={index} className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-time">{dayjs(event.time).format('HH:mm')}</div>
            <div className={`timeline-content ${event.type}`}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{event.title}</div>
              {event.description && (
                <div style={{ fontSize: '13px', color: '#666' }}>{event.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportSection({ selectedRoom, selectedDate, onClear }) {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!window.confirm(`确定要清空教室 "${selectedRoom}" 的所有数据吗？此操作不可恢复。`)) {
      return;
    }
    
    setClearing(true);
    try {
      await clearRoomData(selectedRoom);
      onClear();
    } catch (err) {
      console.error('清空数据失败:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">数据导出与管理</h2>
      <div className="btn-group">
        <button 
          className="btn btn-success"
          onClick={() => exportMarkdown(selectedRoom, selectedDate)}
        >
          📄 导出 Markdown 放行单
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => exportJSON(selectedRoom, selectedDate)}
        >
          📋 导出 JSON 明细
        </button>
        <button 
          className="btn btn-danger"
          onClick={handleClear}
          disabled={clearing}
        >
          {clearing ? '清除中...' : '🗑️ 清空当前教室数据'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [rooms, setRooms] = useState(['默认教室']);
  const [selectedRoom, setSelectedRoom] = useState('默认教室');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTimeline(selectedRoom, selectedDate);
      setTimeline(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedDate]);

  useEffect(() => {
    const init = async () => {
      try {
        const roomsData = await getRooms();
        if (roomsData && roomsData.length > 0) {
          setRooms(roomsData);
        }
      } catch (err) {
        console.error('获取教室列表失败:', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDataChange = () => {
    fetchData();
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🏠 室内儿童活动室空气放行看板</h1>
        <p>CO₂ / PM2.5 / TVOC 实时监测与课程放行评估系统</p>
      </div>
      
      <div className="section">
        <div className="filters">
          <div className="filter-item">
            <label>选择教室</label>
            <select 
              className="form-control select-control"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
            >
              {rooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>选择日期</label>
            <input 
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="filter-item" style={{ justifyContent: 'flex-end', alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
              {loading ? '加载中...' : '🔄 刷新数据'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="alert alert-danger">
            ❌ {error}
          </div>
        )}
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 数据看板
        </button>
        <button 
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📁 数据导入
        </button>
        <button 
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📄 导出与管理
        </button>
      </div>
      
      {activeTab === 'import' && (
        <ImportSection 
          selectedRoom={selectedRoom}
          onImport={handleDataChange}
        />
      )}
      
      {activeTab === 'dashboard' && (
        <>
          {loading ? (
            <div className="section">
              <div className="loading">
                <div className="spinner"></div>
                加载中...
              </div>
            </div>
          ) : timeline ? (
            <>
              <AssessmentSection 
                timeline={timeline}
                selectedRoom={selectedRoom}
                selectedDate={selectedDate}
                onRefresh={handleDataChange}
              />
              <ChartSection timeline={timeline} />
              <TimelineSection timeline={timeline} />
            </>
          ) : null}
        </>
      )}
      
      {activeTab === 'export' && (
        <ExportSection 
          selectedRoom={selectedRoom}
          selectedDate={selectedDate}
          onClear={handleDataChange}
        />
      )}
    </div>
  );
}