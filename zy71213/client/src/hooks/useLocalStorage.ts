import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pension_calculator_data';

interface 存储数据 {
  参保人信息: any;
  参保记录: any[];
  补缴单: any[];
  领取地信息: any;
  年龄信息: any;
  试算结果: any;
  方案列表: any[];
  最后更新时间: string;
}

const 默认存储数据: 存储数据 = {
  参保人信息: { 姓名: '', 身份证号: '', 联系电话: '' },
  参保记录: [],
  补缴单: [],
  领取地信息: {
    id: 'default',
    城市: '北京市',
    省份: '北京市',
    户籍性质: '城镇',
    社会平均工资: 11082,
    计发基数: 11082,
    最低缴费基数: 6650,
    最高缴费基数: 33225
  },
  年龄信息: {
    出生日期: '',
    退休年月: '',
    性别: '男',
    工种: '普通',
    视同缴费年限: 0
  },
  试算结果: null,
  方案列表: [],
  最后更新时间: ''
};

export const useLocalStorage = () => {
  const [数据, set数据] = useState<存储数据>(默认存储数据);
  const [已加载, set已加载] = useState(false);

  useEffect(() => {
    const 存储数据 = localStorage.getItem(STORAGE_KEY);
    if (存储数据) {
      try {
        const 解析数据 = JSON.parse(存储数据);
        set数据({ ...默认存储数据, ...解析数据 });
      } catch (e) {
        console.error('加载本地存储数据失败:', e);
      }
    }
    set已加载(true);
  }, []);

  const 保存数据 = (新数据: Partial<存储数据>) => {
    const 更新后数据 = {
      ...数据,
      ...新数据,
      最后更新时间: new Date().toISOString()
    };
    set数据(更新后数据);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(更新后数据));
  };

  const 清除数据 = () => {
    set数据(默认存储数据);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    数据,
    保存数据,
    清除数据,
    已加载
  };
};

export default useLocalStorage;
