import { useState } from 'react';

const SAMPLE_LOST_TEXT = `[
  {
    "description": "今天上午8点半在1号线人民广场站丢了一个黑色的苹果手机，外壳是蓝色的"
  },
  {
    "description": "昨天下午在2号线虹桥火车站丢失黑色皮质钱包，里面有身份证和银行卡"
  },
  {
    "description": "昨天10点在3号线中山公园站丢失一个灰色的双肩背包，里面有笔记本电脑"
  }
]`;

const SAMPLE_FOUND_TEXT = `[
  {
    "description": "今天早上在1号线人民广场站发现一部黑色苹果手机，蓝色保护壳",
    "finder": "张师傅"
  },
  {
    "description": "昨天在2号线虹桥站捡到一个黑色钱包，内有身份证件",
    "finder": "李阿姨"
  },
  {
    "description": "今天在3号线中山公园捡到灰色双肩包一个，内有电脑",
    "finder": "王同学"
  }
]`;

interface Props {
  onRun: (lostItems: any[], foundItems: any[]) => void;
  onLoadSample: () => void;
  loading: boolean;
}

export function DataImportPanel({ onRun, onLoadSample, loading }: Props) {
  const [lostText, setLostText] = useState('');
  const [foundText, setFoundText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const handleRun = () => {
    setParseError(null);
    
    try {
      let lostItems: any[] = [];
      let foundItems: any[] = [];
      
      if (lostText.trim()) {
        lostItems = JSON.parse(lostText);
        if (!Array.isArray(lostItems)) {
          throw new Error('失物数据必须是数组格式');
        }
      }
      
      if (foundText.trim()) {
        foundItems = JSON.parse(foundText);
        if (!Array.isArray(foundItems)) {
          throw new Error('招领数据必须是数组格式');
        }
      }
      
      if (lostItems.length === 0 && foundItems.length === 0) {
        throw new Error('请至少输入一条失物或招领数据');
      }
      
      onRun(lostItems, foundItems);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const handleLoadSample = () => {
    setLostText(SAMPLE_LOST_TEXT);
    setFoundText(SAMPLE_FOUND_TEXT);
    setParseError(null);
  };

  const handleClear = () => {
    setLostText('');
    setFoundText('');
    setParseError(null);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📥 导入数据</div>
        <div className="button-group">
          <button className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
            加载示例
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClear}>
            清空
          </button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="form-section">
          <label className="form-label">
            📝 失物描述 (乘客报失文本)
          </label>
          <textarea
            className="form-textarea"
            placeholder={`[
  { "description": "今天在1号线人民广场站丢了黑色苹果手机" }
]`}
            value={lostText}
            onChange={(e) => setLostText(e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
            JSON 数组格式，每条记录至少需要 description 字段
          </div>
        </div>
        
        <div className="form-section">
          <label className="form-label">
            🔍 招领描述 (失物招领信息)
          </label>
          <textarea
            className="form-textarea"
            placeholder={`[
  { "description": "捡到黑色手机一部", "finder": "张师傅" }
]`}
            value={foundText}
            onChange={(e) => setFoundText(e.target.value)}
          />
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
            JSON 数组格式，可选 finder 字段记录捡拾人
          </div>
        </div>
      </div>
      
      {parseError && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: '#fee2e2', 
          color: '#dc2626', 
          borderRadius: '6px',
          fontSize: '0.85rem'
        }}>
          ⚠️ 解析错误: {parseError}
        </div>
      )}
      
      <div className="card" style={{ marginTop: '1.5rem', marginBottom: 0, background: '#f9fafb' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>💡 数据格式说明</div>
        <div style={{ fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.7' }}>
          <p><strong>系统会自动从文本中提取以下信息：</strong></p>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li><strong>物品分类：</strong>手机、钱包、证件、箱包、电子产品等</li>
            <li><strong>颜色特征：</strong>黑、白、红、蓝等颜色描述</li>
            <li><strong>地铁线路：</strong>1号线、2号线等线路信息</li>
            <li><strong>站点信息：</strong>人民广场站、虹桥站等站点名称</li>
            <li><strong>时间信息：</strong>今天、昨天、8点半等时间描述</li>
          </ul>
          <p style={{ marginTop: '0.75rem' }}>
            即使描述口径不一致（如"黑色苹果手机" vs "黑色手机"），系统也会尝试匹配。
          </p>
        </div>
      </div>
      
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleRun}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="loading"></span> 处理中...
            </span>
          ) : (
            '🚀 开始匹配处理'
          )}
        </button>
      </div>
    </div>
  );
}
