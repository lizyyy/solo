import { useAppStore } from '@/store';
import { generateUUID } from '@/utils/coordinate';
import type { InspectionTask, InspectionMark, OriginalNote, FloorSketch, ConflictRecord, ZAxisAbnormal, SelfCheckReport } from '@/types';

export function loadSampleData(): void {
  const taskId = generateUUID();
  const now = new Date().toISOString();

  const sampleMarks: InspectionMark[] = [
    {
      id: generateUUID(),
      taskId,
      x: 0, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      isObstacle: false,
      sequenceNo: 1,
      materialType: 'normal',
      originalNotes: [],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 10, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      obstacleType: '阀门',
      isObstacle: true,
      sequenceNo: 2,
      materialType: 'normal',
      originalNotes: [
        {
          id: generateUUID(),
          markId: '',
          content: '此处阀门疑似漏水？待现场确认',
          noteType: 'ambiguous',
          sourceFile: 'normal_material.csv',
          lineNumber: 3,
          isAmbiguous: true,
          createdAt: now
        }
      ],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 20, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      isObstacle: false,
      sequenceNo: 3,
      materialType: 'normal',
      originalNotes: [],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 30, y: 0, z: 5.5,
      pipelineType: '给水管道',
      diameter: '200',
      obstacleType: '异径接头',
      isObstacle: true,
      sequenceNo: 4,
      materialType: 'normal',
      originalNotes: [
        {
          id: generateUUID(),
          markId: '',
          content: 'Z轴按旧习惯写反，应为-5.5',
          noteType: 'handwritten',
          sourceFile: 'normal_material.csv',
          lineNumber: 5,
          isAmbiguous: false,
          createdAt: now
        }
      ],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 40, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '150',
      isObstacle: false,
      sequenceNo: 5,
      materialType: 'wrong_diameter',
      originalNotes: [
        {
          id: generateUUID(),
          markId: '',
          content: '错口径，应为200mm，现场记录有误',
          noteType: 'typed',
          sourceFile: 'wrong_diameter.csv',
          lineNumber: 6,
          isAmbiguous: true,
          createdAt: now
        }
      ],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 50, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      obstacleType: '弯头',
      isObstacle: true,
      sequenceNo: 6,
      materialType: 'normal',
      originalNotes: [],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 60, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      isObstacle: false,
      sequenceNo: 7,
      materialType: 'supplementary',
      originalNotes: [
        {
          id: generateUUID(),
          markId: '',
          content: '补录数据，2024-01-15现场补充测量',
          noteType: 'typed',
          sourceFile: 'supplementary.csv',
          lineNumber: 8,
          isAmbiguous: false,
          createdAt: now
        }
      ],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 70, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      obstacleType: '三通',
      isObstacle: true,
      sequenceNo: 8,
      materialType: 'normal',
      originalNotes: [],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 80, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      isObstacle: false,
      sequenceNo: 9,
      materialType: 'normal',
      originalNotes: [],
      createdAt: now
    },
    {
      id: generateUUID(),
      taskId,
      x: 90, y: 0, z: -5.2,
      pipelineType: '给水管道',
      diameter: '200',
      obstacleType: '减压阀',
      isObstacle: true,
      sequenceNo: 10,
      materialType: 'normal',
      originalNotes: [
        {
          id: generateUUID(),
          markId: '',
          content: '此处有障碍物，与草图不符，待许工确认',
          noteType: 'handwritten',
          sourceFile: 'normal_material.csv',
          lineNumber: 11,
          isAmbiguous: true,
          createdAt: now
        }
      ],
      createdAt: now
    }
  ];

  sampleMarks.forEach(mark => {
    mark.originalNotes.forEach(note => {
      note.markId = mark.id;
    });
  });

  const sampleSketch: FloorSketch = {
    id: generateUUID(),
    taskId,
    floorLevel: 'B2层',
    sketchData: 'B2层管线布置图',
    referencePoints: [
      { x: 0, y: 0, z: -5.2, label: '起点' },
      { x: 10, y: 0, z: -5.2, label: '阀门（正常）' },
      { x: 30, y: 0, z: -5.2, label: '异径接头' },
      { x: 90, y: 0, z: -5.2, label: '无障碍物' },
      { x: 50, y: 0, z: -5.2, label: '管径200mm' }
    ],
    uploadedAt: now
  };

  const sampleConflicts: ConflictRecord[] = [
    {
      id: generateUUID(),
      markId: sampleMarks[9].id,
      sketchId: sampleSketch.id,
      conflictType: 'obstacle_mismatch',
      evidenceFromMark: '巡检标记：障碍物"减压阀"，位置(90.00, 0.00, -5.20)，原始备注：此处有障碍物，与草图不符，待许工确认',
      evidenceFromSketch: '楼层剖面草图(B2层)：参考点"无障碍物"，位置(90.00, 0.00, -5.20)',
      status: 'pending',
      detectedAt: now
    },
    {
      id: generateUUID(),
      markId: sampleMarks[4].id,
      sketchId: sampleSketch.id,
      conflictType: 'diameter_mismatch',
      evidenceFromMark: '巡检标记：管径 150mm',
      evidenceFromSketch: '楼层剖面草图(B2层)：管径200mm',
      status: 'pending',
      detectedAt: now
    }
  ];

  const sampleAbnormalities: ZAxisAbnormal[] = [
    {
      id: generateUUID(),
      markId: sampleMarks[3].id,
      detectedZ: 5.5,
      expectedZ: -5.5,
      suspicionReason: 'Z轴值为正(5.50)，可能按旧习惯(向下为正)写反，新标准向上为正',
      reviewStatus: 'pending',
      detectedAt: now
    }
  ];

  const sampleSelfChecks: SelfCheckReport[] = [
    {
      id: generateUUID(),
      taskId,
      checkType: 'duplicate_import',
      result: 'pass',
      details: '共 10 条记录，未发现重复导入',
      rawDataSnapshot: { markCount: 10 },
      executedAt: now
    },
    {
      id: generateUUID(),
      taskId,
      checkType: 'z_axis_check',
      result: 'warning',
      details: '检测到 1 条Z轴方向可能按旧习惯写反的记录，已标记待现场复核',
      rawDataSnapshot: {
        abnormalities: [{
          sequenceNo: 4,
          detectedZ: 5.5,
          expectedZ: -5.5,
          reason: 'Z轴值为正(5.50)，可能按旧习惯(向下为正)写反，新标准向上为正'
        }]
      },
      executedAt: now
    }
  ];

  const sampleTask: InspectionTask = {
    id: taskId,
    taskNo: 'TASK-SAMPLE-001',
    projectName: '水下管线巡检样例项目',
    inspectionDate: '2024-01-15',
    inspector: '许工',
    status: 'imported',
    rawMaterials: [
      {
        id: generateUUID(),
        fileType: 'csv',
        fileName: 'normal_material.csv',
        materialType: 'normal',
        uploadedAt: now,
        rawContent: '样例正常材料数据'
      },
      {
        id: generateUUID(),
        fileType: 'csv',
        fileName: 'wrong_diameter.csv',
        materialType: 'wrong_diameter',
        uploadedAt: now,
        rawContent: '样例错口径材料数据'
      },
      {
        id: generateUUID(),
        fileType: 'csv',
        fileName: 'supplementary.csv',
        materialType: 'supplementary',
        uploadedAt: now,
        rawContent: '样例补录材料数据'
      }
    ],
    marks: sampleMarks,
    sketches: [sampleSketch],
    conflicts: sampleConflicts,
    abnormalities: sampleAbnormalities,
    selfCheckReports: sampleSelfChecks,
    createdAt: now,
    updatedAt: now
  };

  const setCurrentTask = useAppStore.getState().setCurrentTask;
  const tasks = useAppStore.getState().tasks;

  useAppStore.setState({
    tasks: [...tasks, sampleTask],
    currentTaskId: taskId
  });

  setCurrentTask(taskId);
}
