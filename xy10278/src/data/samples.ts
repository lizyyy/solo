import { Wall } from '../types';

export const normalWalls: Wall[] = [
  {
    id: 'wall-1',
    name: '主展厅A墙（推荐配置）',
    width: 1000,
    height: 400,
    artworks: [
      {
        id: 'art-1',
        name: '《星空》',
        width: 200,
        height: 150,
        x: 150,
        y: 120
      },
      {
        id: 'art-2',
        name: '《向日葵》',
        width: 180,
        height: 200,
        x: 600,
        y: 100
      }
    ],
    lights: [
      {
        id: 'light-1',
        name: '射灯A-1',
        x: 250,
        y: 10,
        angle: 270,
        intensity: 1000,
        spread: 60
      },
      {
        id: 'light-2',
        name: '射灯A-2',
        x: 690,
        y: 10,
        angle: 270,
        intensity: 1000,
        spread: 60
      }
    ]
  },
  {
    id: 'wall-2',
    name: '侧展厅B墙（多作品）',
    width: 1200,
    height: 450,
    artworks: [
      {
        id: 'art-3',
        name: '《呐喊》',
        width: 150,
        height: 180,
        x: 80,
        y: 135
      },
      {
        id: 'art-4',
        name: '《记忆的永恒》',
        width: 220,
        height: 130,
        x: 350,
        y: 160
      },
      {
        id: 'art-5',
        name: '《格尔尼卡》',
        width: 280,
        height: 160,
        x: 700,
        y: 145
      }
    ],
    lights: [
      {
        id: 'light-3',
        name: '射灯B-1',
        x: 155,
        y: 10,
        angle: 270,
        intensity: 900,
        spread: 50
      },
      {
        id: 'light-4',
        name: '射灯B-2',
        x: 460,
        y: 10,
        angle: 270,
        intensity: 900,
        spread: 50
      },
      {
        id: 'light-5',
        name: '射灯B-3',
        x: 840,
        y: 10,
        angle: 270,
        intensity: 900,
        spread: 50
      }
    ]
  },
  {
    id: 'wall-3',
    name: 'VIP展厅C墙（角度调整）',
    width: 800,
    height: 380,
    artworks: [
      {
        id: 'art-6',
        name: '《蒙娜丽莎》',
        width: 180,
        height: 240,
        x: 310,
        y: 70
      }
    ],
    lights: [
      {
        id: 'light-6',
        name: '主射灯',
        x: 400,
        y: 5,
        angle: 270,
        intensity: 1500,
        spread: 90
      },
      {
        id: 'light-7',
        name: '左辅助灯',
        x: 280,
        y: 5,
        angle: 260,
        intensity: 600,
        spread: 45
      },
      {
        id: 'light-8',
        name: '右辅助灯',
        x: 520,
        y: 5,
        angle: 280,
        intensity: 600,
        spread: 45
      }
    ]
  }
];

export const abnormalWalls: { name: string; description: string; wall: Wall }[] = [
  {
    name: '异常样例1：重复数据',
    description: '包含重复的作品ID和灯光名称，用于测试重复数据校验',
    wall: {
      id: 'wall-duplicate',
      name: '重复数据测试墙',
      width: 800,
      height: 400,
      artworks: [
        {
          id: 'art-dup-1',
          name: '重复作品1',
          width: 150,
          height: 120,
          x: 100,
          y: 140
        },
        {
          id: 'art-dup-1',
          name: '重复作品2',
          width: 150,
          height: 120,
          x: 400,
          y: 140
        }
      ],
      lights: [
        {
          id: 'light-dup-1',
          name: '同名射灯',
          x: 175,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 60
        },
        {
          id: 'light-dup-2',
          name: '同名射灯',
          x: 475,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 60
        }
      ]
    }
  },
  {
    name: '异常样例2：缺字段',
    description: '作品和灯光缺少必要字段（ID、名称、尺寸等）',
    wall: {
      id: 'wall-missing',
      name: '缺字段测试墙',
      width: 800,
      height: 400,
      artworks: [
        {
          id: '',
          name: '无ID作品',
          width: 150,
          height: 120,
          x: 100,
          y: 140
        },
        {
          id: 'art-missing-2',
          name: '',
          width: 150,
          height: 120,
          x: 400,
          y: 140
        }
      ],
      lights: [
        {
          id: '',
          name: '无ID灯光',
          x: 175,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 60
        },
        {
          id: 'light-missing-2',
          name: '',
          x: 475,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 60
        }
      ]
    }
  },
  {
    name: '异常样例3：人工改错',
    description: '包含各种人工输入错误：负数坐标、超出边界、无效参数',
    wall: {
      id: 'wall-manual-error',
      name: '人工改错测试墙',
      width: 800,
      height: 400,
      artworks: [
        {
          id: 'art-error-1',
          name: '负坐标作品',
          width: 150,
          height: 120,
          x: -50,
          y: 140
        },
        {
          id: 'art-error-2',
          name: '越界作品',
          width: 150,
          height: 120,
          x: 700,
          y: 300
        },
        {
          id: 'art-error-3',
          name: '无效尺寸',
          width: 0,
          height: -50,
          x: 350,
          y: 140
        }
      ],
      lights: [
        {
          id: 'light-error-1',
          name: '负强度灯光',
          x: 100,
          y: 10,
          angle: 270,
          intensity: -500,
          spread: 60
        },
        {
          id: 'light-error-2',
          name: '超角度灯光',
          x: 400,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 400
        },
        {
          id: 'light-error-3',
          name: '越界灯光',
          x: 900,
          y: 10,
          angle: 270,
          intensity: 1000,
          spread: 60
        }
      ]
    }
  }
];
