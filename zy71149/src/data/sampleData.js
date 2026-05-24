export const sampleFactoryLayout = {
  name: "化工厂区危化品转运演练场景",
  description: "典型化工厂区危化品运输路线规划演练场景，包含限速区、禁停区和洗消点",
  
  roads: [
    {
      id: "road1",
      name: "主干道",
      width: 6,
      points: [
        { x: -40, z: 0 },
        { x: 40, z: 0 }
      ]
    },
    {
      id: "road2",
      name: "东路",
      width: 5,
      points: [
        { x: 20, z: -30 },
        { x: 20, z: 30 }
      ]
    },
    {
      id: "road3",
      name: "西路",
      width: 5,
      points: [
        { x: -20, z: -30 },
        { x: -20, z: 30 }
      ]
    },
    {
      id: "road4",
      name: "北环路",
      width: 4,
      points: [
        { x: -30, z: 20 },
        { x: 30, z: 20 }
      ]
    },
    {
      id: "road5",
      name: "南环路",
      width: 4,
      points: [
        { x: -30, z: -20 },
        { x: 30, z: -20 }
      ]
    }
  ],
  
  zones: [
    {
      id: "speed1",
      type: "speedZone",
      name: "厂区入口限速区",
      speedLimit: 20,
      position: { x: -35, z: 0 },
      size: { width: 10, height: 12 }
    },
    {
      id: "speed2",
      type: "speedZone",
      name: "储罐区限速区",
      speedLimit: 15,
      position: { x: 0, z: 25 },
      size: { width: 20, height: 10 }
    },
    {
      id: "nostop1",
      type: "noStopZone",
      name: "反应装置区（禁停）",
      position: { x: 0, z: 0 },
      size: { width: 16, height: 16 }
    },
    {
      id: "nostop2",
      type: "noStopZone",
      name: "控制室（禁停）",
      position: { x: 30, z: -15 },
      size: { width: 12, height: 10 }
    },
    {
      id: "wash1",
      type: "washPoint",
      name: "一号洗消站",
      position: { x: -30, z: -20 },
      size: { radius: 4 }
    },
    {
      id: "wash2",
      type: "washPoint",
      name: "二号洗消站",
      position: { x: 30, z: 20 },
      size: { radius: 4 }
    }
  ],
  
  recommendedRoute: [
    { x: -30, z: -20 },
    { x: -20, z: -20 },
    { x: -20, z: 0 },
    { x: -20, z: 20 },
    { x: 0, z: 20 },
    { x: 20, z: 20 },
    { x: 30, z: 20 }
  ],
  
  badRoute: [
    { x: -30, z: -20 },
    { x: 0, z: -20 },
    { x: 0, z: 0 },
    { x: 0, z: 20 },
    { x: 30, z: 20 }
  ]
};

export const validationSettings = {
  maxWashDistance: 30,
  maxSegmentLength: 25
};

export const reportTemplate = {
  title: "危化品转运路线校验报告",
  generatedAt: "",
  factoryName: "",
  routeName: "",
  summary: {
    totalPoints: 0,
    totalDistance: 0,
    estimatedTime: 0,
    isValid: false,
    errors: 0,
    warnings: 0
  },
  details: [],
  recommendations: []
};
