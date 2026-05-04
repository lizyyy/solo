import { useState } from 'react';
import axios from 'axios';

function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState({});
  const [messages, setMessages] = useState([]);

  const handleFileSelect = async (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`/api/import/${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResults((prev) => ({
        ...prev,
        [type]: response.data,
      }));

      addMessage('success', `${getTypeName(type)}导入完成`, response.data);
    } catch (error) {
      console.error('导入失败:', error);
      addMessage('error', `${getTypeName(type)}导入失败`, {
        detail: error.response?.data?.error || error.message,
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const addMessage = (type, title, data) => {
    const newMessage = {
      id: Date.now(),
      type,
      title,
      data,
    };
    setMessages((prev) => [newMessage, ...prev]);
  };

  const getTypeName = (type) => {
    const names = {
      customers: '客户数据',
      orders: '订单数据',
      taxonomy: '分类标签',
      calls: '通话纪要',
    };
    return names[type] || type;
  };

  const importTypes = [
    {
      key: 'customers',
      name: '客户数据',
      description: '导入 customers.csv，包含客户ID、姓名、电话、邮箱、地区等信息',
      accept: '.csv',
      icon: '👥',
    },
    {
      key: 'orders',
      name: '订单数据',
      description: '导入 orders.csv，包含订单号、客户ID、产品名称、分类、购买日期等',
      accept: '.csv',
      icon: '📋',
    },
    {
      key: 'taxonomy',
      name: '分类标签',
      description: '导入 taxonomy.json，自定义问题分类和关键词，用于智能归因',
      accept: '.json',
      icon: '🏷️',
    },
    {
      key: 'calls',
      name: '通话纪要',
      description: '导入 call-notes.csv，包含通话记录，系统将自动进行归因和承诺提取',
      accept: '.csv',
      icon: '📞',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">数据导入</h2>
        <p className="text-gray-600">
          导入客户、订单、分类标签和通话纪要数据。系统将自动对通话纪要进行文本分析、归因聚类和承诺提取。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {importTypes.map((type) => (
          <div key={type.key} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{type.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </div>
              {results[type.key] && (
                <span className="badge badge-success">
                  已导入 {results[type.key].success} 条
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className={`btn-primary flex items-center space-x-2 cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>📥</span>
                <span>选择文件</span>
                <input
                  type="file"
                  accept={type.accept}
                  className="hidden"
                  onChange={(e) => handleFileSelect(type.key, e)}
                  disabled={importing}
                />
              </label>
              <span className="text-xs text-gray-400">
                支持 {type.accept.toUpperCase()} 格式
              </span>
            </div>

            {results[type.key] && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold text-green-600">
                      {results[type.key].success}
                    </div>
                    <div className="text-xs text-gray-500">成功</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-yellow-600">
                      {results[type.key].warnings?.length || 0}
                    </div>
                    <div className="text-xs text-gray-500">警告</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-red-600">
                      {results[type.key].errors?.length || 0}
                    </div>
                    <div className="text-xs text-gray-500">错误</div>
                  </div>
                </div>

                {(results[type.key].warnings?.length > 0 || results[type.key].errors?.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {results[type.key].warnings?.slice(0, 5).map((w, idx) => (
                      <div key={idx} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                        <span className="font-medium">⚠️ 行 {w.row}:</span> {w.message}
                        {w.detail && <span className="text-xs"> ({w.detail})</span>}
                      </div>
                    ))}
                    {results[type.key].errors?.slice(0, 5).map((e, idx) => (
                      <div key={idx} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                        <span className="font-medium">❌ 行 {e.row}:</span> {e.message}
                        {e.detail && <span className="text-xs"> ({e.detail})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📋 导入说明</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">导入顺序建议</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>先导入 <strong>客户数据</strong> (customers.csv)</li>
              <li>再导入 <strong>订单数据</strong> (orders.csv)</li>
              <li>可选：导入 <strong>分类标签</strong> (taxonomy.json) 自定义问题分类</li>
              <li>最后导入 <strong>通话纪要</strong> (call-notes.csv) - 系统将自动进行归因分析</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">文件格式要求</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm font-medium text-gray-700 mb-2">customers.csv 字段：</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• customer_id / id (必填) - 客户唯一标识</li>
                  <li>• name (必填) - 客户姓名</li>
                  <li>• phone - 联系电话</li>
                  <li>• email - 电子邮箱</li>
                  <li>• region - 地区</li>
                  <li>• address - 地址</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm font-medium text-gray-700 mb-2">orders.csv 字段：</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• order_id / id (必填) - 订单号</li>
                  <li>• customer_id - 关联客户ID</li>
                  <li>• product_name (必填) - 产品名称</li>
                  <li>• category - 产品分类</li>
                  <li>• purchase_date - 购买日期</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm font-medium text-gray-700 mb-2">taxonomy.json 格式：</p>
                <pre className="text-xs text-gray-600 overflow-x-auto">
{`{
  "categories": [
    {
      "code": "install_misunderstand",
      "name": "安装误解",
      "keywords": "安装,不会装,说明书"
    }
  ]
}`}
                </pre>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm font-medium text-gray-700 mb-2">call-notes.csv 字段：</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• call_id / id (必填) - 通话唯一标识</li>
                  <li>• customer_id - 客户ID</li>
                  <li>• order_id - 订单号</li>
                  <li>• call_time / time - 通话时间</li>
                  <li>• agent_name / agent - 客服姓名</li>
                  <li>• raw_text / notes / content (必填) - 纪要内容</li>
                  <li>• product_category - 产品分类</li>
                  <li>• region - 地区</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">异常处理</h4>
            <p className="text-sm text-gray-600">
              系统会对导入数据进行校验，对于以下情况会给出警告或错误提示：
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
              <li>缺少必填字段 - 给出警告，使用默认值或跳过该行</li>
              <li>客户ID不存在 - 订单和通话仍可导入，但会标记警告</li>
              <li>订单号不存在 - 通话仍可导入，但会标记警告</li>
              <li>日期格式无效 - 支持多种格式，无法解析时给出警告</li>
              <li>ID重复 - 会更新现有记录而非跳过</li>
            </ul>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">导入历史</h3>
          <div className="space-y-2">
            {messages.slice(0, 10).map((msg) => (
              <div
                key={msg.id}
                className={`card ${
                  msg.type === 'success'
                    ? 'border-green-200'
                    : 'border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-xl mr-2">
                      {msg.type === 'success' ? '✅' : '❌'}
                    </span>
                    <span className="font-medium">{msg.title}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.id).toLocaleString('zh-CN')}
                  </span>
                </div>
                {msg.data && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span>成功: {msg.data.success || 0}</span>
                    {msg.data.warnings?.length > 0 && (
                      <span className="ml-4">警告: {msg.data.warnings.length}</span>
                    )}
                    {msg.data.errors?.length > 0 && (
                      <span className="ml-4">错误: {msg.data.errors.length}</span>
                    )}
                    {msg.data.detail && (
                      <p className="mt-1 text-red-600">{msg.data.detail}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportPage;
