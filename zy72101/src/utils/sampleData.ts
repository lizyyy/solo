export const SAMPLE_SENSOR_LOG = `timestamp,frequency,soundPressure,unit
2026-05-20T10:00:00,31.5,0.18,Pa
2026-05-20T10:00:01,50,0.35,Pa
2026-05-20T10:00:02,80,0.12,Pa
2026-05-20T10:00:03,125,0.22,Pa
2026-05-20T10:00:04,200,0.15,Pa
2026-05-20T10:00:05,63,,Pa
2026-05-20T10:00:05,63,0.55,Pa
2026-05-20T10:00:15,40,0.72,Pa
2026-05-20T10:00:16,31.5,1.8,Pa
2026-05-20T10:00:17,50,88,dB
2026-05-20T10:00:18,80,0.58,Pa`

export const SAMPLE_SUPPLEMENT_LOG = `timestamp,frequency,soundPressure,unit
2026-04-15T14:30:00,31.5,0.25,Pa
2026-04-15T14:30:01,50,0.40,Pa
2026-04-15T14:30:02,80,0.15,Pa
2026-04-15T14:30:03,125,0.28,Pa
2026-04-15T14:30:04,200,0.18,Pa`

export const SAMPLE_ROOM_DIMENSIONS = {
  length: 15,
  width: 10,
  height: 6,
}

export const EXPECTED_DIAGNOSIS_NOTES = {
  smoothRecord: '顺利通过 — 采样完整、单位统一、所有指标在安全范围内',
  borderlineRecord: '需人工确认 — 采样有缺口、声压接近警告阈值、单位需换算',
  dangerRecord: '超安全阈值 — 某低频段声压级明显超过危险阈值',
  supplementRecord: '补录旧口径 — 从传感器日志补入的历史数据',
}
