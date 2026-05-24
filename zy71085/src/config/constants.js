'use strict'

const EXIT_CODES = {
  SUCCESS: 0,
  ERROR_INVALID_INPUT: 1,
  ERROR_FILE_NOT_FOUND: 2,
  ERROR_PARSE_FAILED: 3,
  ERROR_COMPARE_FAILED: 4,
  ERROR_OUTPUT_FAILED: 5,
  WARNING_PERMISSIONS_CHANGED: 10,
  WARNING_HIGH_RISK_ADDED: 11
}

const PERMISSION_GROUPS = {
  'android.permission-group.CALENDAR': {
    name: '日历',
    permissions: [
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR'
    ]
  },
  'android.permission-group.CAMERA': {
    name: '相机',
    permissions: [
      'android.permission.CAMERA'
    ]
  },
  'android.permission-group.CONTACTS': {
    name: '通讯录',
    permissions: [
      'android.permission.READ_CONTACTS',
      'android.permission.WRITE_CONTACTS',
      'android.permission.GET_ACCOUNTS'
    ]
  },
  'android.permission-group.LOCATION': {
    name: '位置信息',
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION'
    ]
  },
  'android.permission-group.MICROPHONE': {
    name: '麦克风',
    permissions: [
      'android.permission.RECORD_AUDIO'
    ]
  },
  'android.permission-group.PHONE': {
    name: '电话',
    permissions: [
      'android.permission.READ_PHONE_STATE',
      'android.permission.CALL_PHONE',
      'android.permission.READ_CALL_LOG',
      'android.permission.WRITE_CALL_LOG',
      'android.permission.ADD_VOICEMAIL',
      'android.permission.USE_SIP',
      'android.permission.PROCESS_OUTGOING_CALLS',
      'android.permission.ANSWER_PHONE_CALLS'
    ]
  },
  'android.permission-group.SENSORS': {
    name: '传感器',
    permissions: [
      'android.permission.BODY_SENSORS',
      'android.permission.ACTIVITY_RECOGNITION'
    ]
  },
  'android.permission-group.SMS': {
    name: '短信',
    permissions: [
      'android.permission.SEND_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_WAP_PUSH',
      'android.permission.RECEIVE_MMS'
    ]
  },
  'android.permission-group.STORAGE': {
    name: '存储',
    permissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.MANAGE_EXTERNAL_STORAGE'
    ]
  }
}

const RISK_LEVELS = {
  CRITICAL: {
    level: 0,
    name: '严重',
    color: 'red',
    description: '涉及隐私或安全的高危权限，可能导致严重安全事件'
  },
  HIGH: {
    level: 1,
    name: '高',
    color: 'magenta',
    description: '敏感权限，需要用户授权，可能被滥用'
  },
  MEDIUM: {
    level: 2,
    name: '中',
    color: 'yellow',
    description: '普通权限，存在一定安全风险'
  },
  LOW: {
    level: 3,
    name: '低',
    color: 'blue',
    description: '正常权限，基本无安全风险'
  },
  UNKNOWN: {
    level: 4,
    name: '未知',
    color: 'gray',
    description: '未知权限，需要人工评估'
  }
}

const PERMISSION_RISK_MAP = {
  'android.permission.READ_SMS': 'CRITICAL',
  'android.permission.SEND_SMS': 'CRITICAL',
  'android.permission.RECEIVE_SMS': 'CRITICAL',
  'android.permission.CALL_PHONE': 'CRITICAL',
  'android.permission.CAMERA': 'CRITICAL',
  'android.permission.RECORD_AUDIO': 'CRITICAL',
  'android.permission.READ_CONTACTS': 'CRITICAL',
  'android.permission.ACCESS_FINE_LOCATION': 'CRITICAL',
  'android.permission.ACCESS_BACKGROUND_LOCATION': 'CRITICAL',
  'android.permission.READ_PHONE_STATE': 'HIGH',
  'android.permission.READ_EXTERNAL_STORAGE': 'HIGH',
  'android.permission.WRITE_EXTERNAL_STORAGE': 'HIGH',
  'android.permission.MANAGE_EXTERNAL_STORAGE': 'HIGH',
  'android.permission.BODY_SENSORS': 'HIGH',
  'android.permission.READ_CALENDAR': 'MEDIUM',
  'android.permission.WRITE_CALENDAR': 'MEDIUM',
  'android.permission.GET_ACCOUNTS': 'MEDIUM',
  'android.permission.ACCESS_COARSE_LOCATION': 'MEDIUM',
  'android.permission.ACTIVITY_RECOGNITION': 'MEDIUM',
  'android.permission.INTERNET': 'LOW',
  'android.permission.ACCESS_NETWORK_STATE': 'LOW',
  'android.permission.ACCESS_WIFI_STATE': 'LOW',
  'android.permission.BLUETOOTH': 'LOW',
  'android.permission.NFC': 'LOW',
  'android.permission.VIBRATE': 'LOW',
  'android.permission.FLASHLIGHT': 'LOW',
  'android.permission.WAKE_LOCK': 'LOW'
}

const FEATURE_PERMISSION_MAP = {
  'android.hardware.camera': ['android.permission.CAMERA'],
  'android.hardware.camera.front': ['android.permission.CAMERA'],
  'android.hardware.camera.autofocus': ['android.permission.CAMERA'],
  'android.hardware.microphone': ['android.permission.RECORD_AUDIO'],
  'android.hardware.location': ['android.permission.ACCESS_COARSE_LOCATION'],
  'android.hardware.location.gps': ['android.permission.ACCESS_FINE_LOCATION'],
  'android.hardware.sensor.accelerometer': [],
  'android.hardware.sensor.compass': [],
  'android.hardware.telephony': ['android.permission.READ_PHONE_STATE'],
  'android.hardware.wifi': ['android.permission.ACCESS_WIFI_STATE'],
  'android.hardware.bluetooth': ['android.permission.BLUETOOTH']
}

const ANDROID_MANIFEST_NS = 'http://schemas.android.com/apk/res/android'

const SUPPORTED_INPUT_TYPES = ['.apk', '.xml', '.json']

const OUTPUT_FORMATS = {
  TERMINAL: 'terminal',
  JSON: 'json',
  MARKDOWN: 'markdown',
  ALL: 'all'
}

module.exports = {
  EXIT_CODES,
  PERMISSION_GROUPS,
  RISK_LEVELS,
  PERMISSION_RISK_MAP,
  FEATURE_PERMISSION_MAP,
  ANDROID_MANIFEST_NS,
  SUPPORTED_INPUT_TYPES,
  OUTPUT_FORMATS
}
