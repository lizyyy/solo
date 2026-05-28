import { Item } from './types';

export const contrabandItems: Omit<Item, 'id'>[] = [
  {
    name: '打火机',
    icon: '🔥',
    riskLevel: 'high',
    isContraband: true,
    description: '易燃易爆物品，严禁携带入场'
  },
  {
    name: '瓶装水',
    icon: '💧',
    riskLevel: 'medium',
    isContraband: true,
    description: '外带饮料禁止入场，场内有售'
  },
  {
    name: '管制刀具',
    icon: '🔪',
    riskLevel: 'high',
    isContraband: true,
    description: '危险管制刀具，立即没收'
  },
  {
    name: '酒精饮料',
    icon: '🍺',
    riskLevel: 'medium',
    isContraband: true,
    description: '酒精饮料禁止携带入场'
  },
  {
    name: '烟花爆竹',
    icon: '🎆',
    riskLevel: 'high',
    isContraband: true,
    description: '易燃易爆危险品，严禁入场'
  },
  {
    name: '自拍杆',
    icon: '📸',
    riskLevel: 'low',
    isContraband: true,
    description: '自拍杆可能影响他人，建议寄存'
  },
  {
    name: '专业相机',
    icon: '📷',
    riskLevel: 'low',
    isContraband: true,
    description: '专业摄影设备需特别许可'
  },
  {
    name: '激光笔',
    icon: '🔦',
    riskLevel: 'high',
    isContraband: true,
    description: '激光笔可能伤害表演者眼睛'
  }
];

export const safeItems: Omit<Item, 'id'>[] = [
  {
    name: '手机',
    icon: '📱',
    riskLevel: 'safe',
    isContraband: false,
    description: '普通个人物品'
  },
  {
    name: '钱包',
    icon: '👛',
    riskLevel: 'safe',
    isContraband: false,
    description: '普通个人物品'
  },
  {
    name: '门票',
    icon: '🎫',
    riskLevel: 'safe',
    isContraband: false,
    description: '入场凭证'
  },
  {
    name: '雨伞',
    icon: '☂️',
    riskLevel: 'safe',
    isContraband: false,
    description: '折叠雨伞可携带'
  },
  {
    name: '外套',
    icon: '🧥',
    riskLevel: 'safe',
    isContraband: false,
    description: '个人衣物'
  },
  {
    name: '钥匙',
    icon: '🔑',
    riskLevel: 'safe',
    isContraband: false,
    description: '普通个人物品'
  },
  {
    name: '纸巾',
    icon: '🧻',
    riskLevel: 'safe',
    isContraband: false,
    description: '普通个人物品'
  },
  {
    name: '充电宝',
    icon: '🔋',
    riskLevel: 'safe',
    isContraband: false,
    description: '小型充电宝可携带'
  }
];

export const chineseNames = [
  '张伟', '王芳', '李娜', '刘洋', '陈明', '杨静',
  '赵敏', '黄磊', '周杰', '吴婷', '徐鹏', '孙悦',
  '马超', '朱琳', '胡军', '郭涛', '何炅', '林峰',
  '唐嫣', '罗晋', '韩雪', '曹颖', '邓超', '孙俪',
  '肖战', '王一博', '杨紫', '张一山', '关晓彤',
  '易烊千玺', '王俊凯', '王源', '蔡徐坤', '陈立农'
];

export const avatars = ['😊', '😄', '🙂', '😀', '😃', '😁', '🤗', '😎', '🤩', '🥳'];

export const specialAvatars = {
  elderly: '👴',
  child: '👶',
  disabled: '♿'
};
