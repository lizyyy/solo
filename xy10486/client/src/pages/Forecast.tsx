import { useState, useEffect } from 'react';
import { getPredictions, createOrders, getOrders, getWeatherTags, getHolidays } from '../api';
import * as dayjs from 'dayjs';

const Forecast = () => {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<number, { adjustedQty: number; reason: string }>>({});
  const [orderDate, setOrderDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [deliveryDate, setDeliveryDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingOrders, setExistingOrders] = useState<any[]>([]);
  const [weatherTag, setWeatherTag] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [weatherTags, setWeatherTags] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [deliveryDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [predRes, ordersRes, weatherRes, holidayRes] = await Promise.all([
        getPredictions(deliveryDate),
        getOrders(),
        getWeatherTags(),
        getHolidays()
      ]);
      setPredictions(predRes.data);
      setExistingOrders(ordersRes.data.filter((o: any) => o.order_date === orderDate));
      setWeatherTags(weatherRes.data);
      setHolidays(holidayRes.data);
      
      const initialAdjustments: Record<number, { adjustedQty: number; reason: string }> = {};
      predRes.data.forEach((p: any) => {
        initialAdjustments[p.id] = { adjustedQty: p.suggestedQty, reason: '' };
      });
      setAdjustments(initialAdjustments);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentChange = (productId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAdjustments(prev => ({
      ...prev,
      [productId]: { ...prev[productId], adjustedQty: numValue }
    }));
  };

  const handleReasonChange = (productId: number, value: string) => {
    setAdjustments(prev => ({
      ...prev,
      [productId]: { ...prev[productId], reason: value }
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    
    try {
      const orders = predictions.map(p => ({
        productId: p.id,
        suggestedQty: p.suggestedQty,
        adjustedQty: adjustments[p.id]?.adjustedQty || p.suggestedQty,
        adjustmentReason: adjustments[p.id]?.reason || null
      }));

      const response = await createOrders({
        orders,
        orderDate,
        deliveryDate
      });

      alert('报货单提交成功！');
      loadData();
    } catch (err: any) {
      if (err.response?.data?.error === 'duplicate_order') {
        setError(err.response.data.message);
      } else {
        setError('提交失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const groupByCategory = (items: any[]) => {
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  };

  const categoryIcon = (category: string) => {
    switch (category) {
      case '叶菜': return '🥬';
      case '水果': return '🍎';
      case '肉类': return '🥩';
      default: return '📦';
    }
  };

  const getCategoryIconClass = (category: string) => {
    switch (category) {
      case '叶菜': return 'leaf';
      case '水果': return 'fruit';
      case '肉类': return 'meat';
      default: return '';
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const groupedPredictions = groupByCategory(predictions);

  return (
    <div>
      <div className="page-header">
        <h1>报货预测台</h1>
        <div className="actions">
          <button className="btn btn-outline btn-sm" onClick={loadData}>
            🔄 刷新预测
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {existingOrders.length > 0 && (
        <div className="alert-banner warning">
          <span>⚠️</span>
          <span>{orderDate} 已存在报货单，请不要重复报货。如确需重新报货，请先删除已有订单。</span>
        </div>
      )}

      <div className="card">
        <div className="card-title">报货设置</div>
        <div className="row">
          <div className="col-3">
            <div className="form-group">
              <label className="form-label">报货日期</label>
              <input
                type="date"
                className="form-input"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
              />
            </div>
          </div>
          <div className="col-3">
            <div className="form-group">
              <label className="form-label">预计到货日期</label>
              <input
                type="date"
                className="form-input"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {Object.entries(groupedPredictions).map(([category, items]) => (
        <div key={category} className="category-section">
          <div className="category-header">
            <span className={`category-icon ${getCategoryIconClass(category)}`}>
              {categoryIcon(category)}
            </span>
            <span className="category-name">{category}</span>
            <span style={{ fontSize: 14, color: '#6b7280' }}>
              共 {items.length} 个商品
            </span>
          </div>

          {items.map((product: any) => {
            const adj = adjustments[product.id];
            const diff = adj?.adjustedQty - product.suggestedQty;
            const hasAdjustment = diff !== 0;

            return (
              <div key={product.id} className="prediction-row">
                <div className="product-info">
                  <div className="product-name">{product.name}</div>
                  <div className="product-unit">单位：{product.unit}</div>
                </div>

                <div className="factors">
                  <div>📊 日均销量：{product.factors.avgSales} {product.unit}</div>
                  <div>📦 当前库存：{product.factors.stockOnHand} {product.unit}</div>
                  <div>
                    🌤️ 天气系数：{product.factors.weatherMultiplier.toFixed(2)}
                    {product.factors.weatherMultiplier < 1 && ' (雨天影响)'}
                  </div>
                  <div>
                    🎉 节假日系数：{product.factors.holidayMultiplier.toFixed(2)}
                    {product.factors.holidayMultiplier > 1 && ' (节假日加成)'}
                  </div>
                  <div>⚠️ 历史损耗：{product.factors.historicalWastage} {product.unit}</div>
                </div>

                <div className="suggestion">
                  <div className="suggestion-value">{product.suggestedQty}</div>
                  <div className="suggestion-label">建议报货量 ({product.unit})</div>
                </div>

                <div className="adjustment">
                  <div style={{ marginBottom: 8 }}>
                    <input
                      type="number"
                      className={`adjustment-input ${hasAdjustment ? (diff > 0 ? 'adjusted-higher' : 'adjusted-lower') : ''}`}
                      value={adj?.adjustedQty || product.suggestedQty}
                      onChange={e => handleAdjustmentChange(product.id, e.target.value)}
                      min="0"
                      step="0.5"
                    />
                  </div>
                  {hasAdjustment && (
                    <div style={{ fontSize: 12, textAlign: 'center' }}>
                      {diff > 0 ? '↑' : '↓'} {Math.abs(diff)} {product.unit}
                    </div>
                  )}
                </div>

                <div className="reason-input">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="如有调整请说明原因..."
                    value={adj?.reason || ''}
                    onChange={e => handleReasonChange(product.id, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="card" style={{ position: 'sticky', bottom: 24, zIndex: 10 }}>
        <div className="flex-between">
          <div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              共 {predictions.length} 个商品
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              建议总量：{predictions.reduce((sum, p) => sum + p.suggestedQty, 0)} 斤
              &nbsp;|&nbsp;
              调整总量：{predictions.reduce((sum, p) => sum + (adjustments[p.id]?.adjustedQty || p.suggestedQty), 0)} 斤
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || existingOrders.length > 0}
          >
            {submitting ? '提交中...' : '✅ 提交报货单'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Forecast;
