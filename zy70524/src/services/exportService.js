const { Parser } = require('json2csv');
const { all, get } = require('../config/database');
const moment = require('moment');

const EXPORT_FIELDS = [
  { label: '事件ID', value: 'id' },
  { label: '账号', value: 'account_no' },
  { label: '用户名', value: 'username' },
  { label: '部门', value: 'department' },
  { label: '事件类型', value: 'event_type' },
  { label: '风险分数', value: 'risk_score' },
  { label: '风险等级', value: 'risk_level' },
  { label: '状态', value: 'status' },
  { label: '源IP', value: 'source_ip' },
  { label: '登录国家', value: 'location_country' },
  { label: '登录省份', value: 'location_province' },
  { label: '登录城市', value: 'location_city' },
  { label: '设备平台', value: 'device_platform' },
  { label: '用户代理', value: 'device_user_agent' },
  { label: '失败原因', value: 'failure_reason' },
  { label: '最终结论', value: 'final_conclusion' },
  { label: '检测时间', value: 'detected_at_formatted' },
  { label: '创建时间', value: 'created_at_formatted' },
  { label: '更新时间', value: 'updated_at_formatted' }
];

const formatEventForExport = (event) => {
  return {
    ...event,
    detected_at_formatted: moment(event.detected_at).format('YYYY-MM-DD HH:mm:ss'),
    created_at_formatted: moment(event.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at_formatted: moment(event.updated_at).format('YYYY-MM-DD HH:mm:ss')
  };
};

const exportToCSV = async (filters = {}) => {
  let sql = `
    SELECT 
      re.*,
      a.account_no,
      a.username,
      a.department,
      ll.country as location_country,
      ll.province as location_province,
      ll.city as location_city,
      df.user_agent as device_user_agent,
      df.platform as device_platform
    FROM risk_events re
    LEFT JOIN accounts a ON re.account_id = a.id
    LEFT JOIN login_locations ll ON re.source_location_id = ll.id
    LEFT JOIN device_fingerprints df ON re.device_fingerprint_id = df.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.account_no) {
    sql += ' AND a.account_no = ?';
    params.push(filters.account_no);
  }

  if (filters.risk_level) {
    sql += ' AND re.risk_level = ?';
    params.push(filters.risk_level);
  }

  if (filters.status) {
    sql += ' AND re.status = ?';
    params.push(filters.status);
  }

  if (filters.start_time) {
    sql += ' AND re.created_at >= ?';
    params.push(filters.start_time);
  }

  if (filters.end_time) {
    sql += ' AND re.created_at <= ?';
    params.push(filters.end_time);
  }

  sql += ' ORDER BY re.created_at DESC';

  const events = await all(sql, params);
  const formattedEvents = events.map(formatEventForExport);

  const json2csvParser = new Parser({ fields: EXPORT_FIELDS });
  return json2csvParser.parse(formattedEvents);
};

const getExportDetail = async (eventId) => {
  const event = await get(
    `SELECT 
      re.*,
      a.account_no,
      a.username,
      a.department,
      a.role,
      ll.country as location_country,
      ll.province as location_province,
      ll.city as location_city,
      ll.district as location_district,
      ll.latitude as location_latitude,
      ll.longitude as location_longitude,
      ll.isp as location_isp,
      df.fingerprint_hash as device_fingerprint_hash,
      df.user_agent as device_user_agent,
      df.screen_resolution as device_screen_resolution,
      df.timezone as device_timezone,
      df.language as device_language,
      df.platform as device_platform,
      df.canvas_fingerprint as device_canvas,
      df.webgl_fingerprint as device_webgl,
      df.ip_address as device_ip
    FROM risk_events re
    LEFT JOIN accounts a ON re.account_id = a.id
    LEFT JOIN login_locations ll ON re.source_location_id = ll.id
    LEFT JOIN device_fingerprints df ON re.device_fingerprint_id = df.id
    WHERE re.id = ?`,
    [eventId]
  );

  if (!event) return null;

  const [dispositions, history, review] = await Promise.all([
    all('SELECT * FROM disposition_actions WHERE risk_event_id = ? ORDER BY executed_at DESC', [eventId]),
    all('SELECT * FROM event_history WHERE risk_event_id = ? ORDER BY changed_at DESC', [eventId]),
    get('SELECT * FROM review_conclusions WHERE risk_event_id = ?', [eventId])
  ]);

  return {
    event: formatEventForExport(event),
    dispositions,
    history,
    review
  };
};

module.exports = {
  exportToCSV,
  getExportDetail,
  EXPORT_FIELDS
};
