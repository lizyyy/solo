const { InspectionSession, SensorRecord, RECORD_STATUS, SAFETY_LEVEL } = require('./models');

class DemoData {
  static createDemoSession() {
    const session = new InspectionSession({
      id: 'demo-session-2024-06-01',
      date: '2024-06-01',
      inspector: '老岑',
      location: 'A区生产线-3号机组',
      status: 'imported',
      photos: [
        {
          id: 'photo-1',
          path: '/photos/spring-A001-20240601.jpg',
          description: '弹簧A001工况照片，表面无明显锈蚀',
          timestamp: '2024-06-01T09:15:00Z'
        },
        {
          id: 'photo-2',
          path: '/photos/spring-A002-20240601.jpg',
          description: '弹簧A002工况照片，底部有轻微磨损',
          timestamp: '2024-06-01T09:20:00Z'
        },
        {
          id: 'photo-3',
          path: '/photos/spring-A003-20240601.jpg',
          description: '弹簧A003工况照片，需对照旧记录',
          timestamp: '2024-06-01T09:25:00Z'
        }
      ],
      manualNotes: [
        {
          id: 'note-1',
          recordId: 'record-3',
          content: '5月28日手写记录：弹簧A003原传感器SNS-0031损坏，已更换新传感器SNS-0031-NEW，疲劳值按旧口径修正为42',
          author: '老岑',
          timestamp: '2024-06-01T10:30:00Z',
          correctedFatigueValue: 42
        }
      ]
    });

    const records = [
      new SensorRecord({
        id: 'record-1',
        sensorId: 'SNS-0015',
        originalSensorId: 'SNS-0015',
        timestamp: '2024-06-01T09:15:00Z',
        springId: 'A001',
        fatigueValue: 25,
        temperature: 35.2,
        vibration: 0.12,
        status: RECORD_STATUS.NORMAL,
        photoPath: '/photos/spring-A001-20240601.jpg',
        manualNote: null,
        sensorRestartDetected: false,
        runCount: 1,
        history: [
          {
            action: 'photo_import',
            timestamp: '2024-06-01T09:15:00Z',
            data: { source: 'photo', fatigueValue: 25 }
          }
        ]
      }),
      new SensorRecord({
        id: 'record-2',
        sensorId: 'SNS-0022-NEW',
        originalSensorId: 'SNS-0022',
        timestamp: '2024-06-01T09:20:00Z',
        springId: 'A002',
        fatigueValue: 45,
        temperature: 38.5,
        vibration: 0.18,
        status: RECORD_STATUS.PENDING_REVIEW,
        photoPath: '/photos/spring-A002-20240601.jpg',
        manualNote: null,
        sensorRestartDetected: true,
        runCount: 1,
        history: [
          {
            action: 'photo_import',
            timestamp: '2024-06-01T09:20:00Z',
            data: { source: 'photo', fatigueValue: 45 }
          },
          {
            action: 'sensor_restart_detected',
            timestamp: '2024-06-01T09:20:05Z',
            data: { oldSensorId: 'SNS-0022', newSensorId: 'SNS-0022-NEW' }
          }
        ]
      }),
      new SensorRecord({
        id: 'record-3',
        sensorId: 'SNS-0031-NEW',
        originalSensorId: 'SNS-0031',
        timestamp: '2024-06-01T09:25:00Z',
        springId: 'A003',
        fatigueValue: 78,
        temperature: 42.1,
        vibration: 0.25,
        status: RECORD_STATUS.FROM_MANUAL_NOTE,
        photoPath: '/photos/spring-A003-20240601.jpg',
        manualNote: {
          content: '5月28日手写记录：弹簧A003原传感器SNS-0031损坏，已更换新传感器SNS-0031-NEW，疲劳值按旧口径修正为42',
          author: '老岑',
          timestamp: '2024-06-01T10:30:00Z'
        },
        sensorRestartDetected: true,
        correctedFatigueValue: 42,
        runCount: 2,
        history: [
          {
            action: 'photo_import',
            timestamp: '2024-06-01T09:25:00Z',
            data: { source: 'photo', fatigueValue: 78 }
          },
          {
            action: 'sensor_restart_detected',
            timestamp: '2024-06-01T09:25:05Z',
            data: { oldSensorId: 'SNS-0031', newSensorId: 'SNS-0031-NEW' }
          },
          {
            action: 'manual_note_applied',
            timestamp: '2024-06-01T10:30:00Z',
            data: { correctedFatigueValue: 42, source: 'handwritten_note' }
          },
          {
            action: 'rerun_analysis',
            timestamp: '2024-06-01T10:35:00Z',
            data: { runCount: 2 }
          }
        ],
        reviewedBy: '老岑',
        reviewedAt: '2024-06-01T10:40:00Z',
        reviewComment: '已对照手写巡检记录确认，传感器更换后数据需按旧口径折算，修正后数值正常'
      })
    ];

    records.forEach(r => session.addRecord(r.toJSON()));

    return session;
  }

  static getPhotoImportData() {
    return [
      {
        sensorId: 'SNS-0015',
        springId: 'A001',
        timestamp: '2024-06-01T09:15:00Z',
        fatigueValue: 25,
        temperature: 35.2,
        vibration: 0.12,
        path: '/photos/spring-A001-20240601.jpg'
      },
      {
        sensorId: 'SNS-0022-NEW',
        springId: 'A002',
        timestamp: '2024-06-01T09:20:00Z',
        fatigueValue: 45,
        temperature: 38.5,
        vibration: 0.18,
        path: '/photos/spring-A002-20240601.jpg'
      },
      {
        sensorId: 'SNS-0031-NEW',
        springId: 'A003',
        timestamp: '2024-06-01T09:25:00Z',
        fatigueValue: 78,
        temperature: 42.1,
        vibration: 0.25,
        path: '/photos/spring-A003-20240601.jpg'
      }
    ];
  }

  static getBaselineSensors() {
    return new Map([
      ['A001', 'SNS-0015'],
      ['A002', 'SNS-0022'],
      ['A003', 'SNS-0031']
    ]);
  }

  static getStepByStepDemo() {
    return {
      step1: {
        title: '第一步：工况照片导入',
        description: '从现场拍摄的工况照片中提取传感器数据，系统自动读取照片中的OCR数据',
        data: this.getPhotoImportData()
      },
      step2: {
        title: '第二步：系统自动检测',
        description: '系统对比基线传感器编号，检测到A002和A003的传感器编号发生变化，标记为待复核状态，不急着归正常',
        detections: [
          { springId: 'A002', old: 'SNS-0022', new: 'SNS-0022-NEW' },
          { springId: 'A003', old: 'SNS-0031', new: 'SNS-0031-NEW' }
        ]
      },
      step3: {
        title: '第三步：维修师傅补看手写巡检备注',
        description: '老岑翻出手写巡检本，发现A003的传感器确实在5月28日更换过，按旧口径折算疲劳值应为42而非78',
        manualNote: {
          springId: 'A003',
          content: '5月28日手写记录：弹簧A003原传感器SNS-0031损坏，已更换新传感器SNS-0031-NEW，疲劳值按旧口径修正为42',
          correctedFatigueValue: 42
        }
      },
      step4: {
        title: '第四步：安全员复核',
        description: '安全员复核A002记录，确认传感器重启后数据暂时可信，但需持续观察',
        reviewResult: {
          springId: 'A002',
          comment: '传感器重启后数据偏差在可接受范围内，标记为需持续监测',
          status: 'reviewed'
        }
      },
      step5: {
        title: '第五步：安全提醒更新',
        description: '所有复核完成后，安全提醒从"警告"更新为"需关注"，反映最新状态',
        before: { level: SAFETY_LEVEL.WARNING, title: '传感器异常需复核' },
        after: { level: SAFETY_LEVEL.WARNING, title: '存在需关注的弹簧' }
      }
    };
  }
}

module.exports = {
  DemoData
};
