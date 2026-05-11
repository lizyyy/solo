import { db } from './database';
import * as dayjs from 'dayjs';

interface PredictionParams {
  productId: number;
  targetDate: string;
  daysToConsider?: number;
}

export const calculatePrediction = (params: PredictionParams) => {
  return new Promise<{
    suggestedQty: number;
    factors: {
      avgSales: number;
      stockOnHand: number;
      forecastDemand: number;
      weatherMultiplier: number;
      holidayMultiplier: number;
      historicalWastage: number;
    };
  }>((resolve, reject) => {
    const { productId, targetDate, daysToConsider = 14 } = params;
    const targetDay = dayjs(targetDate);
    const startDate = targetDay.subtract(daysToConsider, 'day').format('YYYY-MM-DD');

    db.serialize(() => {
      db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product: any) => {
        if (err) return reject(err);
        if (!product) return reject(new Error('Product not found'));

        db.all(
          `SELECT sh.quantity, sh.date, sh.weather_tag, sh.is_holiday, sr.closing_stock, sr.wastage
           FROM sales_history sh
           LEFT JOIN stock_records sr ON sh.product_id = sr.product_id AND sh.date = sr.date
           WHERE sh.product_id = ? AND sh.date >= ?
           ORDER BY sh.date DESC`,
          [productId, startDate],
          (err, history: any[]) => {
            if (err) return reject(err);

            const totalSales = history.reduce((sum, h) => sum + (h.quantity || 0), 0);
            const avgSales = totalSales / (history.length || 1);
            
            const totalWastage = history.reduce((sum, h) => sum + (h.wastage || 0), 0);
            const historicalWastage = history.length > 0 ? totalWastage / history.length : product.avg_demand * 0.05;

            const latestStock = history.length > 0 && history[0].closing_stock !== null 
              ? history[0].closing_stock 
              : product.safety_stock;

            db.get('SELECT tag FROM weather_tags WHERE date = ?', [targetDate], (err, weather: any) => {
              if (err) return reject(err);

              db.get('SELECT date FROM holidays WHERE date = ?', [targetDate], (err, holiday: any) => {
                if (err) return reject(err);

                const weatherTag = weather?.tag || '晴';
                const isHoliday = !!holiday;

                let weatherMultiplier = 1;
                if (weatherTag.includes('雨')) {
                  weatherMultiplier = weatherTag.includes('大') || weatherTag.includes('暴') ? 0.5 : 0.7;
                }
                if (weatherTag.includes('暴') || weatherTag.includes('雨')) {
                  if (product.category === '叶菜') {
                    weatherMultiplier *= 0.6;
                  }
                }

                let holidayMultiplier = 1;
                if (isHoliday) {
                  holidayMultiplier = product.category === '肉类' ? 1.8 : 1.5;
                }

                const forecastDemand = avgSales * weatherMultiplier * holidayMultiplier;
                const safetyStock = product.safety_stock;
                
                let suggestedQty = forecastDemand + safetyStock - latestStock + historicalWastage;
                suggestedQty = Math.max(suggestedQty, product.min_order);
                suggestedQty = Math.round(suggestedQty * 10) / 10;

                resolve({
                  suggestedQty,
                  factors: {
                    avgSales: Math.round(avgSales * 100) / 100,
                    stockOnHand: latestStock,
                    forecastDemand: Math.round(forecastDemand * 100) / 100,
                    weatherMultiplier,
                    holidayMultiplier,
                    historicalWastage: Math.round(historicalWastage * 100) / 100
                  }
                });
              });
            });
          }
        );
      });
    });
  });
};

export const getRiskProducts = () => {
  return new Promise<any[]>((resolve, reject) => {
    db.all(
      `SELECT 
        p.id,
        p.name,
        p.category,
        p.unit,
        AVG(o.wastage_qty) / AVG(o.actual_qty) as avg_wastage_rate,
        COUNT(CASE WHEN o.wastage_qty / o.actual_qty > 0.15 THEN 1 END) as high_wastage_count,
        AVG(o.actual_qty) / AVG(o.adjusted_qty) as avg_delivery_rate
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id
      GROUP BY p.id
      HAVING avg_wastage_rate > 0.10 OR avg_delivery_rate < 0.8
      ORDER BY avg_wastage_rate DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};
