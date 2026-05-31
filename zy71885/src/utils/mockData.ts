import type { CalibrationEntry, Record } from "@/types";

export function generateCalibrationTable(
  focalLength: number,
  measuredFocalLength: number
): CalibrationEntry[] {
  const baseTime = new Date().toISOString();
  const distances = [150, 200, 250, 300, 350];
  return distances.map((u, idx) => {
    const theoreticalImageDist = (u * focalLength) / (u - focalLength);
    const drift = (Math.random() - 0.5) * 0.04;
    const measuredImageDist = theoreticalImageDist + drift;
    const error = measuredImageDist - theoreticalImageDist;
    return {
      id: "",
      label: `测量点${idx + 1} (u=${u}mm)`,
      theoreticalValue: parseFloat(theoreticalImageDist.toFixed(3)),
      measuredValue: parseFloat(measuredImageDist.toFixed(3)),
      error: parseFloat(error.toFixed(3)),
      createdAt: baseTime,
      updatedAt: baseTime,
    };
  });
}

export function generateMockRecords(operatorId: string): Omit<
  Record,
  "id" | "status" | "pendingReason" | "createdAt" | "updatedAt"
>[] {
  const baseRecords = [
    {
      experimentName: "凸透镜焦距测量-甲组",
      studentId: "202401001",
      studentName: "张三",
      focalLength: 100,
      measuredFocalLength: 99.985,
      objectDistance: 200,
      imageDistance: 200.032,
      zeroDrift: 0.015,
      error: 0.032,
    },
    {
      experimentName: "凸透镜焦距测量-乙组",
      studentId: "202401002",
      studentName: "李四",
      focalLength: 100,
      measuredFocalLength: 99.972,
      objectDistance: 250,
      imageDistance: 166.698,
      zeroDrift: -0.028,
      error: 0.031,
    },
    {
      experimentName: "凹透镜焦距测量-丙组",
      studentId: "202401003",
      studentName: "王五",
      focalLength: -150,
      measuredFocalLength: -149.961,
      objectDistance: 300,
      imageDistance: -99.983,
      zeroDrift: 0.039,
      error: 0.05,
    },
    {
      experimentName: "透镜组合焦距测量-丁组",
      studentId: "202401004",
      studentName: "赵六",
      focalLength: 75,
      measuredFocalLength: 74.988,
      objectDistance: 180,
      imageDistance: 122.756,
      zeroDrift: -0.012,
      error: -0.021,
    },
    {
      experimentName: "厚透镜主点测量-戊组",
      studentId: "202401005",
      studentName: "孙七",
      focalLength: 120,
      measuredFocalLength: 119.955,
      objectDistance: 240,
      imageDistance: 240.089,
      zeroDrift: -0.045,
      error: 0.078,
    },
  ];
  return baseRecords.map((r) => ({
    ...r,
    operatorId,
    source: "sensor" as const,
    sensorLogId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    calibrationTable: generateCalibrationTable(r.focalLength, r.measuredFocalLength),
  }));
}

export const sampleSensorLogCsv = `sensor_log_id,experiment_name,student_id,student_name,focal_length,measured_focal_length,object_distance,image_distance,zero_drift,error
LOG-SAMPLE-001,凸透镜焦距测量-甲组,202401001,张三,100,99.985,200,200.032,0.015,0.032
LOG-SAMPLE-002,凸透镜焦距测量-乙组,202401002,李四,100,99.972,250,166.698,-0.028,0.031
LOG-SAMPLE-003,凹透镜焦距测量-丙组,202401003,王五,-150,-149.961,300,-99.983,0.039,0.050
`;

export const sampleSensorLogJson = [
  {
    sensor_log_id: "LOG-SAMPLE-001",
    experiment_name: "凸透镜焦距测量-甲组",
    student_id: "202401001",
    student_name: "张三",
    focal_length: 100,
    measured_focal_length: 99.985,
    object_distance: 200,
    image_distance: 200.032,
    zero_drift: 0.015,
    error: 0.032,
  },
  {
    sensor_log_id: "LOG-SAMPLE-002",
    experiment_name: "凸透镜焦距测量-乙组",
    student_id: "202401002",
    student_name: "李四",
    focal_length: 100,
    measured_focal_length: 99.972,
    object_distance: 250,
    image_distance: 166.698,
    zero_drift: -0.028,
    error: 0.031,
  },
];
