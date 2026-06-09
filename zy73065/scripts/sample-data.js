const dayjs = require('dayjs');

function ts(offsetHour = 0) {
  return dayjs().subtract(offsetHour, 'hour').format('YYYY-MM-DD HH:mm:ss');
}

function genSensorLogs(baseTime, count, options = {}) {
  const logs = [];
  const { hasAnomaly = false, hasBoundary = false, normalMean = { vibration: 3.5, pitch: 15, temp: 45 } } = options;
  for (let i = 0; i < count; i++) {
    const t = dayjs(baseTime).add(i * 10, 'minute').format('YYYY-MM-DD HH:mm:ss');
    const vibration = normalMean.vibration + (Math.random() - 0.5) * 1.2;
    const pitch = normalMean.pitch + (Math.random() - 0.5) * 4;
    const temp = normalMean.temp + (Math.random() - 0.5) * 8;
    logs.push({ log_time: t, vibration: +vibration.toFixed(2), pitch: +pitch.toFixed(2), temp: +temp.toFixed(2) });
  }
  if (hasAnomaly) {
    const spikeIdx = Math.floor(count * 0.7);
    logs[spikeIdx] = {
      log_time: dayjs(baseTime).add(spikeIdx * 10, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      vibration: 9.2, pitch: 33.5, temp: 81.2, remark: '起风瞬间振动突增(异常样本)'
    };
    const dipIdx = Math.floor(count * 0.3);
    logs[dipIdx] = {
      log_time: dayjs(baseTime).add(dipIdx * 10, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      vibration: 0.15, pitch: -3.2, temp: -18.5, remark: '停机瞬间传感器读数异常(下边界异常)'
    };
  }
  if (hasBoundary) {
    const idx = Math.floor(count * 0.5);
    logs[idx] = {
      log_time: dayjs(baseTime).add(idx * 10, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      vibration: 8.4, pitch: 31.8, temp: 77.5, is_boundary: true, remark: '额定最大风速附近(边界样本-现场毛边)'
    };
  }
  return logs;
}

function buildLegacyRows() {
  const base1 = ts(720);
  const base2 = ts(560);
  const base3 = ts(400);
  const base4 = ts(240);
  const base5 = ts(96);

  return [
    {
      workorder_id: 'WO_B001_202601',
      blade_no: '叶片#A-0127',
      wind_farm: '内蒙古乌兰察布二场',
      created_at: base1,
      status: 'confirmed',
      confirm_note: '运维组张工现场复核通过,数据完整',
      sensor_logs: genSensorLogs(base1, 48, { hasAnomaly: false }),
      parts: [
        { original_model: 'FAG-22317-E1', quantity: 1, status: 'original' },
        { original_model: 'SKF-6320-2RS', quantity: 2, status: 'original' }
      ]
    },
    {
      workorder_id: 'WO_B002_202602',
      blade_no: '叶片#B-0359',
      wind_farm: '甘肃酒泉东场',
      created_at: base2,
      status: 'returned',
      return_reason: '传感器校准证书过期,退回原厂重新标定',
      sensor_logs: genSensorLogs(base2, 36, { hasAnomaly: true, normalMean: { vibration: 4.1, pitch: 17, temp: 48 } }),
      parts: [
        { original_model: 'INA-NK28/20', quantity: 3, status: 'original' }
      ]
    },
    {
      workorder_id: 'WO_B003_202603',
      blade_no: '叶片#C-0088',
      wind_farm: '河北张家口北场',
      created_at: base3,
      status: 'pending_part',
      sensor_logs: genSensorLogs(base3, 60, { hasAnomaly: true, hasBoundary: true, normalMean: { vibration: 3.9, pitch: 16, temp: 50 } }),
      parts: [
        {
          original_model: 'TIMKEN-32220',
          replacement_model: 'NSK-HR32220J',
          quantity: 2,
          status: 'replaced',
          replaced_at: ts(350),
          replace_source_line: '采购单PO-2026-0412 第17行',
          replace_impact_scope: '主轴后轴承及配套密封环,影响下次排程B-0359/B-0360',
          replace_operator: '库房-刘姐'
        },
        {
          original_model: '叶片前缘护板-EPOXY-LH',
          quantity: 1,
          status: 'pending_replace'
        }
      ]
    },
    {
      workorder_id: 'WO_B004_202604',
      blade_no: '叶片#A-0521',
      wind_farm: '新疆哈密一场',
      created_at: base4,
      status: 'pending',
      sensor_logs: genSensorLogs(base4, 24, { normalMean: { vibration: 3.2, pitch: 14, temp: 42 } }),
      parts: [
        { original_model: 'FAG-6218-C3', quantity: 1, status: 'original' }
      ]
    },
    {
      workorder_id: 'WO_B005_202605',
      blade_no: '叶片#D-0203',
      wind_farm: '宁夏吴忠三场',
      created_at: base5,
      status: 'pending',
      sensor_logs: genSensorLogs(base5, 12, { hasAnomaly: false, normalMean: { vibration: 3.7, pitch: 15.5, temp: 47 } }),
      parts: [
        { original_model: '叶片螺栓-M30x280-10.9', quantity: 8, status: 'original' }
      ]
    }
  ];
}

const BOUNDARY_SAMPLE_TO_APPEND = {
  log_time: ts(0),
  vibration: 8.6,
  pitch: 32.1,
  temp: 78.3,
  source_file: '2026-06-10_现场补采.csv',
  remark: '2026-06-10 午后阵风9级,运维现场补采(边界样本-接近停机阈值)'
};

if (require.main === module) {
  console.log(JSON.stringify({
    legacy_file: 'legacy_workorders_2026H1.json',
    rows: buildLegacyRows(),
    boundary_to_append: {
      target_workorder: 'WO_B003_202603',
      log: BOUNDARY_SAMPLE_TO_APPEND
    }
  }, null, 2));
}

module.exports = { buildLegacyRows, BOUNDARY_SAMPLE_TO_APPEND };
