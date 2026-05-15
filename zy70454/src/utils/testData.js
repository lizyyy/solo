export function generateNormalTestData() {
  return [
    {
      supplier: {
        code: 'SUP001',
        name: '北京科技有限公司',
        tax_id: '91110101MA001ABCDE',
        contact_person: '张三',
        phone: '13800138001',
        email: 'zhangsan@bjtech.com',
        address: '北京市海淀区中关村大街1号'
      },
      material: {
        type: '资质证明',
        content: '营业执照副本复印件，统一社会信用代码：91110101MA001ABCDE，经营范围：技术开发、技术服务、技术咨询、技术转让，注册资本：1000万元人民币，成立日期：2020年1月1日，营业期限：长期。'
      }
    },
    {
      supplier: {
        code: 'SUP002',
        name: '上海贸易有限公司',
        tax_id: '91310101MA002FGHIJ',
        contact_person: '李四',
        phone: '13900139002',
        email: 'lisi@shtrade.com',
        address: '上海市浦东新区陆家嘴金融贸易区'
      },
      material: {
        type: '资质证明',
        content: '营业执照副本复印件，统一社会信用代码：91310101MA002FGHIJ，经营范围：货物进出口、技术进出口、国内贸易，注册资本：500万元人民币，成立日期：2019年6月15日，营业期限：20年。'
      }
    },
    {
      supplier: {
        code: 'SUP003',
        name: '广州制造有限公司',
        tax_id: '91440101MA003KLMNO',
        contact_person: '王五',
        phone: '13700137003',
        email: 'wangwu@gzmanufacture.com',
        address: '广州市天河区珠江新城'
      },
      material: {
        type: '资质证明',
        content: '营业执照副本复印件，统一社会信用代码：91440101MA003KLMNO，经营范围：机械设备制造、电子产品生产、销售，注册资本：2000万元人民币，成立日期：2018年3月20日，营业期限：长期。'
      }
    }
  ];
}

export function generateCacheIssueTestData() {
  return [
    {
      supplier: {
        code: 'SUP004',
        name: '深圳电子有限公司',
        tax_id: '91440301MA004PQRST',
        contact_person: '赵六',
        phone: '13600136004',
        email: 'zhaoliu@szelec.com',
        address: '深圳市南山区科技园'
      },
      material: {
        type: '资质证明',
        content: '营业执照副本复印件，统一社会信用代码：91440301MA004PQRST，经营范围：电子产品研发、生产、销售，注册资本：800万元人民币，成立日期：2021年5月10日，营业期限：长期。'
      },
      simulateCacheIssue: true
    }
  ];
}

export function generateMixedBatchData() {
  return [
    ...generateNormalTestData(),
    ...generateCacheIssueTestData()
  ];
}

export default {
  generateNormalTestData,
  generateCacheIssueTestData,
  generateMixedBatchData
};
