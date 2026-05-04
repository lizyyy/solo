const seedLevels = [
  {
    id: 'playground',
    name: '校园操场',
    description: '标准400米跑道环绕的操场区域，有多个藏身点在看台和器材区附近。',
    center_lat: 39.9087,
    center_lng: 116.3975,
    radius: 200,
    config: JSON.stringify({
      timeLimit: 300,
      scanRadius: 5,
      requiredContinuousSamples: 3,
      baseAccuracy: 10
    }),
    hidingSpots: [
      {
        name: '主席台后方',
        lat: 39.9089,
        lng: 116.3973,
        radius: 8,
        points: 100,
        difficulty: 'easy'
      },
      {
        name: '足球门柱旁',
        lat: 39.9085,
        lng: 116.3978,
        radius: 6,
        points: 150,
        difficulty: 'medium'
      },
      {
        name: '器材室角落',
        lat: 39.9091,
        lng: 116.3976,
        radius: 5,
        points: 200,
        difficulty: 'hard'
      }
    ],
    interferenceZones: [
      {
        name: '高压电线区',
        lat: 39.9083,
        lng: 116.3972,
        radius: 25,
        drift_multiplier: 2.5
      }
    ]
  },
  {
    id: 'library',
    name: '图书馆',
    description: '图书馆内及周边区域，藏身点分布在不同楼层和阅览室附近。',
    center_lat: 39.9092,
    center_lng: 116.3980,
    radius: 150,
    config: JSON.stringify({
      timeLimit: 240,
      scanRadius: 4,
      requiredContinuousSamples: 4,
      baseAccuracy: 8
    }),
    hidingSpots: [
      {
        name: '自习室窗边',
        lat: 39.9093,
        lng: 116.3982,
        radius: 7,
        points: 120,
        difficulty: 'easy'
      },
      {
        name: '古籍阅览室',
        lat: 39.9090,
        lng: 116.3979,
        radius: 5,
        points: 180,
        difficulty: 'medium'
      },
      {
        name: '屋顶花园',
        lat: 39.9094,
        lng: 116.3977,
        radius: 4,
        points: 250,
        difficulty: 'hard'
      }
    ],
    interferenceZones: [
      {
        name: '电梯井旁',
        lat: 39.9091,
        lng: 116.3981,
        radius: 20,
        drift_multiplier: 3.0
      },
      {
        name: '地下室入口',
        lat: 39.9088,
        lng: 116.3978,
        radius: 15,
        drift_multiplier: 2.0
      }
    ]
  },
  {
    id: 'lake_path',
    name: '湖边小路',
    description: '风景优美的湖边步道，藏身点隐藏在树木和亭子之间。',
    center_lat: 39.9080,
    center_lng: 116.3985,
    radius: 250,
    config: JSON.stringify({
      timeLimit: 360,
      scanRadius: 6,
      requiredContinuousSamples: 3,
      baseAccuracy: 12
    }),
    hidingSpots: [
      {
        name: '柳树荫下',
        lat: 39.9082,
        lng: 116.3987,
        radius: 10,
        points: 80,
        difficulty: 'easy'
      },
      {
        name: '湖心亭',
        lat: 39.9078,
        lng: 116.3983,
        radius: 6,
        points: 160,
        difficulty: 'medium'
      },
      {
        name: '假山山洞',
        lat: 39.9085,
        lng: 116.3981,
        radius: 4,
        points: 220,
        difficulty: 'hard'
      },
      {
        name: '石桥桥洞',
        lat: 39.9076,
        lng: 116.3988,
        radius: 5,
        points: 200,
        difficulty: 'medium'
      }
    ],
    interferenceZones: [
      {
        name: '茂密树林区',
        lat: 39.9083,
        lng: 116.3984,
        radius: 30,
        drift_multiplier: 2.0
      },
      {
        name: '水面反射区',
        lat: 39.9079,
        lng: 116.3986,
        radius: 35,
        drift_multiplier: 1.8
      }
    ]
  }
];

module.exports = seedLevels;
