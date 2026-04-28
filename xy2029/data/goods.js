const goodsData = {
  '3k': {
    tier: '3k',
    title: '平价好物推荐',
    description: '性价比优先，便宜又好用',
    categories: [
      {
        name: '护肤彩妆',
        items: [
          {
            id: 1,
            name: '大宝SOD蜜',
            price: '19.9元',
            originalPrice: '29.9元',
            description: '国民润肤乳，滋润不油腻，全身可用',
            reason: '便宜大碗，保湿效果好，老品牌值得信赖',
            buyLink: '各大超市、电商平台',
            rating: 4.8,
            sales: '100万+'
          },
          {
            id: 2,
            name: '百雀羚甘油一号',
            price: '15.9元',
            originalPrice: '25.9元',
            description: '纯甘油，保湿效果超级好',
            reason: '便宜、保湿、不粘腻，可以当身体乳、护手霜',
            buyLink: '电商平台',
            rating: 4.9,
            sales: '50万+'
          },
          {
            id: 3,
            name: '旁氏米粹洁面乳',
            price: '19.9元',
            originalPrice: '39.9元',
            description: '氨基酸洁面，温和不刺激',
            reason: '便宜的氨基酸洁面，清洁力适中，适合各种肤质',
            buyLink: '电商平台、超市',
            rating: 4.7,
            sales: '200万+'
          },
          {
            id: 4,
            name: '美宝莲眼唇卸',
            price: '29.9元',
            originalPrice: '59.9元',
            description: '卸妆力强，温和不刺激',
            reason: '便宜大碗，卸妆干净，眼唇可用',
            buyLink: '电商平台、屈臣氏',
            rating: 4.8,
            sales: '150万+'
          }
        ]
      },
      {
        name: '生活用品',
        items: [
          {
            id: 5,
            name: '名创优品牙刷',
            price: '10元3支',
            originalPrice: '15元',
            description: '软毛牙刷，清洁力好',
            reason: '便宜，软毛不伤牙龈，三个月一换不心疼',
            buyLink: '名创优品门店',
            rating: 4.5,
            sales: '500万+'
          },
          {
            id: 6,
            name: '拼多多收纳盒',
            price: '5-10元',
            originalPrice: '20元',
            description: '各种尺寸的收纳盒，整理房间神器',
            reason: '便宜，款式多，让房间更整洁',
            buyLink: '拼多多',
            rating: 4.6,
            sales: '1000万+'
          },
          {
            id: 7,
            name: '宜家密封罐',
            price: '9.9元',
            originalPrice: '19.9元',
            description: '食品级密封罐，保鲜防潮',
            reason: '便宜，质量好，可以装五谷杂粮、零食',
            buyLink: '宜家、电商平台',
            rating: 4.7,
            sales: '300万+'
          }
        ]
      },
      {
        name: '美食零食',
        items: [
          {
            id: 8,
            name: '拼多多临期零食',
            price: '3-5折',
            originalPrice: '原价',
            description: '临期但未过期的品牌零食',
            reason: '便宜，品牌零食，性价比超高',
            buyLink: '拼多多临期食品店',
            rating: 4.4,
            sales: '200万+'
          },
          {
            id: 9,
            name: '永辉超市自有品牌',
            price: '比品牌便宜30%',
            originalPrice: '品牌价格',
            description: '超市自有品牌的食品、日用品',
            reason: '质量不差，价格便宜很多',
            buyLink: '永辉超市',
            rating: 4.3,
            sales: '未知'
          }
        ]
      }
    ]
  },
  
  '9k': {
    tier: '9k',
    title: '性价比好物推荐',
    description: '追求品质，但不盲目追求品牌',
    categories: [
      {
        name: '护肤彩妆',
        items: [
          {
            id: 10,
            name: '珂润保湿面霜',
            price: '150元左右',
            originalPrice: '188元',
            description: '敏感肌友好，保湿效果好',
            reason: '成分安全，保湿效果好，适合敏感肌',
            buyLink: '电商平台、屈臣氏',
            rating: 4.9,
            sales: '500万+'
          },
          {
            id: 11,
            name: '欧莱雅精华',
            price: '200-300元',
            originalPrice: '350元',
            description: '玻色因成分，抗初老',
            reason: '大厂出品，成分靠谱，价格适中',
            buyLink: '电商平台、专柜',
            rating: 4.8,
            sales: '300万+'
          },
          {
            id: 12,
            name: 'MAC口红',
            price: '170元',
            originalPrice: '170元',
            description: '色号多，显色度好',
            reason: '色号全，显色度好，持久度不错',
            buyLink: '专柜、电商平台',
            rating: 4.7,
            sales: '1000万+'
          }
        ]
      },
      {
        name: '穿搭服饰',
        items: [
          {
            id: 13,
            name: '优衣库U系列',
            price: '199-299元',
            originalPrice: '299-399元',
            description: '设计感强，基础款也时尚',
            reason: '大牌设计师合作款，价格亲民',
            buyLink: '优衣库门店、电商平台',
            rating: 4.6,
            sales: '限量款'
          },
          {
            id: 14,
            name: '阿迪达斯/Nike基础款',
            price: '300-500元',
            originalPrice: '500-800元',
            description: '运动鞋，舒适耐穿',
            reason: '打折时购买，性价比很高',
            buyLink: '奥特莱斯、电商平台大促',
            rating: 4.8,
            sales: '500万+'
          }
        ]
      },
      {
        name: '数码家电',
        items: [
          {
            id: 15,
            name: '小米手环',
            price: '200-300元',
            originalPrice: '299元',
            description: '功能齐全，续航长',
            reason: '便宜，功能全，续航14天+',
            buyLink: '小米商城、电商平台',
            rating: 4.7,
            sales: '1亿+'
          },
          {
            id: 16,
            name: '网易严选/淘宝心选',
            price: '品牌的50-70%',
            originalPrice: '品牌价格',
            description: 'ODM模式，同厂不同牌',
            reason: '代工厂和大牌一样，价格便宜很多',
            buyLink: '网易严选、淘宝心选',
            rating: 4.5,
            sales: '未知'
          }
        ]
      }
    ]
  },
  
  '3w': {
    tier: '3w',
    title: '品质好物推荐',
    description: '追求品质和体验，开始注重品牌',
    categories: [
      {
        name: '护肤彩妆',
        items: [
          {
            id: 17,
            name: 'SK-II神仙水',
            price: '1500元/230ml',
            originalPrice: '1590元',
            description: '调节肌肤状态，维稳效果好',
            reason: '成分简单但有效，适合油皮混油皮',
            buyLink: '专柜、日上免税',
            rating: 4.9,
            sales: '1000万+'
          },
          {
            id: 18,
            name: '雅诗兰黛小棕瓶',
            price: '760元/50ml',
            originalPrice: '850元',
            description: '抗初老精华，修护效果好',
            reason: '经典款，修护维稳，适合各种肤质',
            buyLink: '专柜、免税店',
            rating: 4.8,
            sales: '500万+'
          },
          {
            id: 19,
            name: '香奈儿/迪奥香水',
            price: '800-1500元',
            originalPrice: '1000+',
            description: '经典香氛，提升气质',
            reason: '品牌经典款，持香久，提升生活品质',
            buyLink: '专柜、免税店',
            rating: 4.7,
            sales: '300万+'
          }
        ]
      },
      {
        name: '穿搭服饰',
        items: [
          {
            id: 20,
            name: 'Coach/MK包包',
            price: '2000-5000元',
            originalPrice: '4000-8000元',
            description: '轻奢品牌，设计经典',
            reason: '奥特莱斯或代购，价格合适，品质不错',
            buyLink: '奥特莱斯、代购',
            rating: 4.6,
            sales: '100万+'
          },
          {
            id: 21,
            name: 'Lululemon运动服',
            price: '500-1000元',
            originalPrice: '800-1500元',
            description: '舒适有型，健身日常都可穿',
            reason: '面料舒适，设计有型，健身日常两穿',
            buyLink: '门店、电商平台',
            rating: 4.9,
            sales: '200万+'
          }
        ]
      },
      {
        name: '数码家电',
        items: [
          {
            id: 22,
            name: '戴森吸尘器',
            price: '3000-5000元',
            originalPrice: '4000-6000元',
            description: '吸力强，续航久，清洁神器',
            reason: '提升生活品质，打扫变成享受',
            buyLink: '电商平台大促',
            rating: 4.8,
            sales: '500万+'
          },
          {
            id: 23,
            name: '苹果手机/手表',
            price: '5000-10000元',
            originalPrice: '原价',
            description: '系统流畅，生态联动',
            reason: '耐用，系统流畅，用3-5年不成问题',
            buyLink: '官网、电商平台',
            rating: 4.9,
            sales: '10亿+'
          }
        ]
      }
    ]
  }
}

const tierGoods = {
  '3k': goodsData['3k'],
  '9k': goodsData['9k'],
  '3w': goodsData['3w'],
  '5w': goodsData['3w'],
  '10w': goodsData['3w']
}

module.exports = {
  goodsData,
  tierGoods
}
