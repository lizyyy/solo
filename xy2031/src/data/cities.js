export const PROVINCES = [
  {
    id: 'prov_001',
    name: '北京市',
    shortName: '京',
    capital: '北京市',
    cities: [
      {
        id: 'city_001',
        name: '北京市',
        provinceId: 'prov_001',
        description: '中华人民共和国首都，历史文化名城，拥有丰富的文化遗产和现代建筑',
        image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800',
        landmarks: [
          {
            id: 'landmark_001',
            name: '天安门广场',
            description: '世界上最大的城市广场之一，是中华人民共和国的象征',
            image: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=600',
            address: '北京市东城区长安街',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史遗迹'
          },
          {
            id: 'landmark_002',
            name: '故宫博物院',
            description: '明清两代的皇家宫殿，世界上现存规模最大的木质结构建筑群',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '北京市东城区景山前街4号',
            rating: 4.9,
            ticketPrice: '60元',
            openTime: '8:30-17:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_003',
            name: '八达岭长城',
            description: '明长城中保存最好的一段，也是最具代表性的一段',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '北京市延庆区八达岭镇',
            rating: 4.8,
            ticketPrice: '45元',
            openTime: '6:30-19:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_004',
            name: '颐和园',
            description: '中国清朝时期皇家园林，前身为清漪园',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '北京市海淀区新建宫门路19号',
            rating: 4.8,
            ticketPrice: '50元',
            openTime: '6:30-18:00',
            category: '园林景观'
          },
          {
            id: 'landmark_005',
            name: '天坛',
            description: '明清两代皇帝祭祀皇天、祈五谷丰登的场所',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '北京市东城区天坛内东里7号',
            rating: 4.7,
            ticketPrice: '35元',
            openTime: '6:00-22:00',
            category: '历史遗迹'
          }
        ],
        featuredProducts: ['prod_001', 'prod_002', 'prod_003']
      }
    ]
  },
  {
    id: 'prov_002',
    name: '上海市',
    shortName: '沪',
    capital: '上海市',
    cities: [
      {
        id: 'city_002',
        name: '上海市',
        provinceId: 'prov_002',
        description: '中国最大的城市，国际大都市，东方明珠，经济金融中心',
        image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800',
        landmarks: [
          {
            id: 'landmark_006',
            name: '东方明珠广播电视塔',
            description: '上海标志性文化景观之一，塔高约468米',
            image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600',
            address: '上海市浦东新区世纪大道1号',
            rating: 4.7,
            ticketPrice: '160元',
            openTime: '8:00-21:30',
            category: '现代建筑'
          },
          {
            id: 'landmark_007',
            name: '外滩',
            description: '上海最著名的观光景点之一，黄浦江畔的万国建筑博览群',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '上海市黄浦区中山东一路',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '城市风光'
          },
          {
            id: 'landmark_008',
            name: '豫园',
            description: '江南古典园林，始建于明代嘉靖、万历年间',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '上海市黄浦区福佑路168号',
            rating: 4.7,
            ticketPrice: '40元',
            openTime: '8:30-17:00',
            category: '园林景观'
          },
          {
            id: 'landmark_009',
            name: '上海迪士尼度假区',
            description: '中国内地首座迪士尼主题乐园',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '上海市浦东新区川沙镇黄赵路310号',
            rating: 4.8,
            ticketPrice: '435元起',
            openTime: '8:30-20:30',
            category: '主题乐园'
          },
          {
            id: 'landmark_010',
            name: '南京路步行街',
            description: '中国第一商业街，上海最繁华的商业街',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '上海市黄浦区南京东路',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '商业街区'
          }
        ],
        featuredProducts: ['prod_004', 'prod_005', 'prod_006']
      }
    ]
  },
  {
    id: 'prov_003',
    name: '广东省',
    shortName: '粤',
    capital: '广州市',
    cities: [
      {
        id: 'city_003',
        name: '广州市',
        provinceId: 'prov_003',
        description: '广东省省会，千年商都，岭南文化中心，美食天堂',
        image: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800',
        landmarks: [
          {
            id: 'landmark_011',
            name: '广州塔',
            description: '又称"小蛮腰"，广州新城市中轴线地标，高600米',
            image: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=600',
            address: '广州市海珠区阅江西路222号',
            rating: 4.8,
            ticketPrice: '150元起',
            openTime: '9:30-22:30',
            category: '现代建筑'
          },
          {
            id: 'landmark_012',
            name: '长隆旅游度假区',
            description: '集主题公园、野生动物世界、水上乐园于一体的大型旅游度假区',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '广州市番禺区汉溪大道东299号',
            rating: 4.9,
            ticketPrice: '250元起',
            openTime: '9:30-19:00',
            category: '主题乐园'
          },
          {
            id: 'landmark_013',
            name: '白云山风景名胜区',
            description: '广州市著名的风景名胜区，有"羊城第一秀"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '广州市白云区广园中路白云山南门',
            rating: 4.6,
            ticketPrice: '5元',
            openTime: '6:00-22:00',
            category: '自然风光'
          },
          {
            id: 'landmark_014',
            name: '沙面岛',
            description: '广州著名的外国租界遗址，欧式建筑群',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '广州市荔湾区沙面大街',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史建筑'
          },
          {
            id: 'landmark_015',
            name: '陈家祠',
            description: '广东现存规模最大、装饰华丽、保存完好的传统岭南祠堂式建筑',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '广州市荔湾区中山七路恩龙里34号',
            rating: 4.7,
            ticketPrice: '10元',
            openTime: '9:00-17:30',
            category: '历史建筑'
          }
        ],
        featuredProducts: ['prod_007', 'prod_008', 'prod_009']
      },
      {
        id: 'city_004',
        name: '深圳市',
        provinceId: 'prov_003',
        description: '中国经济特区，创新之都，现代化国际都市',
        image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800',
        landmarks: [
          {
            id: 'landmark_016',
            name: '世界之窗',
            description: '把世界奇观、历史遗迹、古今名胜、民间歌舞表演融为一体的人造主题公园',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '深圳市南山区深南大道9037号',
            rating: 4.6,
            ticketPrice: '220元',
            openTime: '9:00-21:30',
            category: '主题乐园'
          },
          {
            id: 'landmark_017',
            name: '深圳湾公园',
            description: '深圳市最大的滨海休闲带，集休闲娱乐、健身运动、观光旅游于一体',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '深圳市南山区滨海大道',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '城市公园'
          }
        ],
        featuredProducts: ['prod_010']
      }
    ]
  },
  {
    id: 'prov_004',
    name: '云南省',
    shortName: '云',
    capital: '昆明市',
    cities: [
      {
        id: 'city_005',
        name: '大理市',
        provinceId: 'prov_004',
        description: '风花雪月，苍山洱海，白族文化发源地，浪漫旅游胜地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_018',
            name: '洱海',
            description: '云南省第二大淡水湖，大理"风花雪月"四景之一',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '大理白族自治州大理市',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_019',
            name: '大理古城',
            description: '云南省历史文化名城，白族建筑风格的古城',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '大理白族自治州大理市复兴路',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_020',
            name: '崇圣寺三塔',
            description: '大理最为著名的佛教建筑群，是大理的标志和象征',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '大理白族自治州大理市三塔路',
            rating: 4.7,
            ticketPrice: '121元',
            openTime: '8:00-19:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_021',
            name: '苍山',
            description: '大理"风花雪月"四景之一，以云、雪、泉、石著称',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '大理白族自治州大理市',
            rating: 4.8,
            ticketPrice: '35元',
            openTime: '8:30-16:00',
            category: '自然风光'
          },
          {
            id: 'landmark_022',
            name: '双廊古镇',
            description: '洱海东岸的白族渔村古镇，有"苍洱风光第一镇"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '大理白族自治州洱源县双廊镇',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          }
        ],
        featuredProducts: ['prod_011', 'prod_012', 'prod_013']
      },
      {
        id: 'city_006',
        name: '丽江市',
        provinceId: 'prov_004',
        description: '世界文化遗产，纳西文化之乡，艳遇之都，雪山脚下的浪漫古城',
        image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=800',
        landmarks: [
          {
            id: 'landmark_023',
            name: '丽江古城',
            description: '世界文化遗产，中国历史文化名城，纳西族聚居地',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '丽江市古城区大研镇',
            rating: 4.9,
            ticketPrice: '50元（维护费）',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_024',
            name: '玉龙雪山',
            description: '北半球最南的大雪山，纳西族的神山',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '丽江市玉龙纳西族自治县',
            rating: 4.9,
            ticketPrice: '100元',
            openTime: '7:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: ['prod_014', 'prod_015']
      }
    ]
  },
  {
    id: 'prov_005',
    name: '新疆维吾尔自治区',
    shortName: '新',
    capital: '乌鲁木齐市',
    cities: [
      {
        id: 'city_007',
        name: '乌鲁木齐市',
        provinceId: 'prov_005',
        description: '新疆首府，亚心之都，多民族文化交融的国际大都市',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_025',
            name: '新疆国际大巴扎',
            description: '世界上最大的巴扎（集市），新疆旅游业产品的汇集地和展示中心',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '乌鲁木齐市天山区解放南路8号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '10:00-23:00',
            category: '商业街区'
          },
          {
            id: 'landmark_026',
            name: '红山公园',
            description: '乌鲁木齐市的地标性公园，可俯瞰乌鲁木齐全城',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '乌鲁木齐市水磨沟区红山路',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '6:00-22:00',
            category: '城市公园'
          }
        ],
        featuredProducts: ['prod_016', 'prod_017']
      },
      {
        id: 'city_008',
        name: '伊犁哈萨克自治州',
        provinceId: 'prov_005',
        description: '塞外江南，薰衣草之乡，赛里木湖，那拉提草原',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_027',
            name: '赛里木湖',
            description: '新疆海拔最高、面积最大的高山湖泊，有"大西洋最后一滴眼泪"之称',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '博尔塔拉蒙古自治州博乐市',
            rating: 4.9,
            ticketPrice: '70元',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_028',
            name: '那拉提草原',
            description: '世界四大草原之一的亚高山草甸植物区，有"空中草原"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '伊犁哈萨克自治州新源县那拉提镇',
            rating: 4.8,
            ticketPrice: '95元',
            openTime: '8:00-20:00',
            category: '自然风光'
          },
          {
            id: 'landmark_029',
            name: '喀拉峻草原',
            description: '世界自然遗产地，"中国巅峰自然美"的形象代表',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '伊犁哈萨克自治州特克斯县',
            rating: 4.8,
            ticketPrice: '70元',
            openTime: '8:00-20:00',
            category: '自然风光'
          },
          {
            id: 'landmark_030',
            name: '霍城薰衣草',
            description: '中国薰衣草之乡，与法国普罗旺斯、日本北海道并称世界三大薰衣草产地',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '伊犁哈萨克自治州霍城县',
            rating: 4.7,
            ticketPrice: '35元',
            openTime: '6月-7月',
            category: '自然风光'
          }
        ],
        featuredProducts: ['prod_018', 'prod_019', 'prod_020']
      }
    ]
  },
  {
    id: 'prov_006',
    name: '天津市',
    shortName: '津',
    capital: '天津市',
    cities: [
      {
        id: 'city_009',
        name: '天津市',
        provinceId: 'prov_006',
        description: '中国直辖市，北方重要港口城市，中西合璧的历史文化名城',
        image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800',
        landmarks: [
          {
            id: 'landmark_031',
            name: '天津之眼',
            description: '跨海河连接河北区与红桥区，是一座跨河建设、桥轮合一的摩天轮',
            image: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=600',
            address: '天津市红桥区三岔河口永乐桥',
            rating: 4.8,
            ticketPrice: '70元',
            openTime: '9:30-21:30',
            category: '现代建筑'
          },
          {
            id: 'landmark_032',
            name: '五大道',
            description: '由马场道、西康路、贵州路、成都道、南京路五条街道组成的历史风貌街区',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '天津市和平区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_033',
            name: '古文化街',
            description: '仿清代商业步行街，以"中国味、天津味、文化味、古味"为经营特色',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '天津市南开区东北角',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '9:00-22:00',
            category: '历史街区'
          },
          {
            id: 'landmark_034',
            name: '瓷房子',
            description: '用多件古董装修而成的法式洋楼，被称为"中国古瓷博物馆"',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '天津市和平区赤峰道72号',
            rating: 4.5,
            ticketPrice: '50元',
            openTime: '9:00-18:00',
            category: '历史建筑'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_007',
    name: '重庆市',
    shortName: '渝',
    capital: '重庆市',
    cities: [
      {
        id: 'city_010',
        name: '重庆市',
        provinceId: 'prov_007',
        description: '中国直辖市，山城，雾都，火锅之都，8D魔幻城市',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
        landmarks: [
          {
            id: 'landmark_035',
            name: '洪崖洞',
            description: '具有巴渝传统建筑特色的"吊脚楼"建筑群，网红打卡圣地',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '重庆市渝中区嘉陵江滨江路88号',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史建筑'
          },
          {
            id: 'landmark_036',
            name: '解放碑',
            description: '重庆的地标性建筑，纪念抗日战争胜利',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '重庆市渝中区民权路177号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史遗迹'
          },
          {
            id: 'landmark_037',
            name: '磁器口古镇',
            description: '重庆古城的缩影和象征，有"小重庆"之称',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '重庆市沙坪坝区磁器口南街1号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_038',
            name: '长江索道',
            description: '重庆的第二条空中走廊，被誉为"山城空中公共汽车"',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '重庆市渝中区新华路153号',
            rating: 4.6,
            ticketPrice: '30元',
            openTime: '7:30-22:30',
            category: '现代建筑'
          },
          {
            id: 'landmark_039',
            name: '武隆天生三桥',
            description: '世界规模最大、最高的串珠式天生桥群',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '重庆市武隆区仙女山镇',
            rating: 4.8,
            ticketPrice: '125元',
            openTime: '8:30-16:30',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_008',
    name: '河北省',
    shortName: '冀',
    capital: '石家庄市',
    cities: [
      {
        id: 'city_011',
        name: '承德市',
        provinceId: 'prov_008',
        description: '国家历史文化名城，避暑胜地，清代皇家园林所在地',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
        landmarks: [
          {
            id: 'landmark_040',
            name: '承德避暑山庄',
            description: '清代皇帝夏天避暑和处理政务的场所，中国四大名园之一',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '承德市双桥区山庄东路6号',
            rating: 4.8,
            ticketPrice: '130元',
            openTime: '7:00-18:00',
            category: '园林景观'
          },
          {
            id: 'landmark_041',
            name: '外八庙',
            description: '承德避暑山庄周围的藏传佛教寺庙群，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '承德市双桥区',
            rating: 4.7,
            ticketPrice: '联票180元',
            openTime: '8:00-17:30',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_012',
        name: '秦皇岛市',
        provinceId: 'prov_008',
        description: '海滨旅游城市，天下第一关山海关所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_042',
            name: '山海关',
            description: '明长城东端的起点，有"天下第一关"之称',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '秦皇岛市山海关区',
            rating: 4.7,
            ticketPrice: '50元',
            openTime: '7:30-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_043',
            name: '北戴河',
            description: '中国著名的海滨度假胜地',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '秦皇岛市北戴河区',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_009',
    name: '山西省',
    shortName: '晋',
    capital: '太原市',
    cities: [
      {
        id: 'city_013',
        name: '大同市',
        provinceId: 'prov_009',
        description: '国家历史文化名城，中国九大古都之一',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_044',
            name: '云冈石窟',
            description: '中国四大石窟之一，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '大同市云冈区',
            rating: 4.9,
            ticketPrice: '120元',
            openTime: '8:30-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_045',
            name: '悬空寺',
            description: '建在悬崖峭壁上的千年古刹，恒山十八景中"第一胜景"',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '大同市浑源县',
            rating: 4.8,
            ticketPrice: '115元',
            openTime: '8:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_046',
            name: '平遥古城',
            description: '世界文化遗产，中国现存最完整的古代县城',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '晋中市平遥县',
            rating: 4.9,
            ticketPrice: '125元',
            openTime: '全天开放',
            category: '历史古城'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_014',
        name: '忻州市',
        provinceId: 'prov_009',
        description: '五台山所在地，佛教名山',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_047',
            name: '五台山',
            description: '中国四大佛教名山之首，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '忻州市五台县',
            rating: 4.9,
            ticketPrice: '135元',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_048',
            name: '乔家大院',
            description: '清代著名商业金融资本家乔致庸的宅第',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '晋中市祁县',
            rating: 4.6,
            ticketPrice: '115元',
            openTime: '8:00-18:30',
            category: '历史建筑'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_010',
    name: '内蒙古自治区',
    shortName: '内蒙古',
    capital: '呼和浩特市',
    cities: [
      {
        id: 'city_015',
        name: '呼伦贝尔市',
        provinceId: 'prov_010',
        description: '世界四大草原之一，中国最大的草原',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_049',
            name: '呼伦贝尔大草原',
            description: '世界四大草原之一，中国现存最丰美的草原',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '呼伦贝尔市陈巴尔虎旗',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_050',
            name: '额尔古纳湿地',
            description: '亚洲第一湿地，中国目前保持原状态最完好的湿地',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '呼伦贝尔市额尔古纳市',
            rating: 4.8,
            ticketPrice: '65元',
            openTime: '8:00-17:30',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_011',
    name: '辽宁省',
    shortName: '辽',
    capital: '沈阳市',
    cities: [
      {
        id: 'city_016',
        name: '沈阳市',
        provinceId: 'prov_011',
        description: '辽宁省省会，国家历史文化名城，清朝发祥地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_051',
            name: '沈阳故宫',
            description: '清朝入关前的皇宫，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '沈阳市沈河区沈阳路171号',
            rating: 4.8,
            ticketPrice: '60元',
            openTime: '8:30-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_052',
            name: '张氏帅府',
            description: '北洋军阀张作霖及其长子张学良的官邸和私宅',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '沈阳市沈河区朝阳街少帅府巷46号',
            rating: 4.7,
            ticketPrice: '60元',
            openTime: '8:30-17:30',
            category: '历史建筑'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_017',
        name: '大连市',
        provinceId: 'prov_011',
        description: '北方明珠，浪漫之都，海滨旅游城市',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_053',
            name: '老虎滩海洋公园',
            description: '中国最大的一座现代化海滨游乐场',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '大连市中山区虎滩街3号',
            rating: 4.7,
            ticketPrice: '198元',
            openTime: '8:00-17:00',
            category: '主题乐园'
          },
          {
            id: 'landmark_054',
            name: '金石滩',
            description: '国家级旅游度假区，海滨地质公园',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '大连市金州区金石滩国家旅游度假区',
            rating: 4.8,
            ticketPrice: '160元',
            openTime: '8:30-17:30',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_012',
    name: '吉林省',
    shortName: '吉',
    capital: '长春市',
    cities: [
      {
        id: 'city_018',
        name: '长春市',
        provinceId: 'prov_012',
        description: '吉林省省会，中国汽车城，电影城',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_055',
            name: '伪满皇宫博物院',
            description: '伪满洲国傀儡皇帝爱新觉罗·溥仪的宫殿',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '长春市宽城区光复北路5号',
            rating: 4.7,
            ticketPrice: '70元',
            openTime: '8:30-17:20',
            category: '历史遗迹'
          },
          {
            id: 'landmark_056',
            name: '净月潭',
            description: '有"台湾日月潭姊妹潭"之称',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '长春市南关区净月大街5840号',
            rating: 4.8,
            ticketPrice: '30元',
            openTime: '6:00-21:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_019',
        name: '延边朝鲜族自治州',
        provinceId: 'prov_012',
        description: '朝鲜族聚居地，长白山所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_057',
            name: '长白山天池',
            description: '中国最大的火山湖，世界上最深的高山湖泊',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '延边朝鲜族自治州安图县',
            rating: 4.9,
            ticketPrice: '105元',
            openTime: '7:00-17:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_013',
    name: '黑龙江省',
    shortName: '黑',
    capital: '哈尔滨市',
    cities: [
      {
        id: 'city_020',
        name: '哈尔滨市',
        provinceId: 'prov_013',
        description: '冰城夏都，东方莫斯科，东方小巴黎',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_058',
            name: '中央大街',
            description: '哈尔滨最繁华的商业街，欧式建筑云集',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '哈尔滨市道里区',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_059',
            name: '圣索菲亚大教堂',
            description: '远东地区最大的东正教堂',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '哈尔滨市道里区透笼街88号',
            rating: 4.7,
            ticketPrice: '20元',
            openTime: '8:30-17:00',
            category: '历史建筑'
          },
          {
            id: 'landmark_060',
            name: '冰雪大世界',
            description: '世界上最大的冰雪主题公园',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '哈尔滨市松北区松北大道西侧',
            rating: 4.8,
            ticketPrice: '290元',
            openTime: '11:00-21:30',
            category: '主题乐园'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_014',
    name: '江苏省',
    shortName: '苏',
    capital: '南京市',
    cities: [
      {
        id: 'city_021',
        name: '南京市',
        provinceId: 'prov_014',
        description: '江苏省省会，六朝古都，历史文化名城',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_061',
            name: '中山陵',
            description: '中国近代民主革命先行者孙中山先生的陵寝',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '南京市玄武区石象路7号',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '8:30-17:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_062',
            name: '夫子庙秦淮风光带',
            description: '中国第一历史文化名河，十里秦淮',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '南京市秦淮区贡院街',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_063',
            name: '明孝陵',
            description: '明朝开国皇帝朱元璋和皇后马氏的合葬陵墓',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '南京市玄武区紫金山南麓',
            rating: 4.8,
            ticketPrice: '70元',
            openTime: '6:30-18:30',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_022',
        name: '苏州市',
        provinceId: 'prov_014',
        description: '人间天堂，园林之城，东方威尼斯',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
        landmarks: [
          {
            id: 'landmark_064',
            name: '拙政园',
            description: '中国四大名园之首，苏州最大的古典园林',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '苏州市姑苏区东北街178号',
            rating: 4.9,
            ticketPrice: '80元',
            openTime: '7:30-17:30',
            category: '园林景观'
          },
          {
            id: 'landmark_065',
            name: '虎丘',
            description: '苏州的标志，有"吴中第一名胜"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '苏州市姑苏区虎丘山门内8号',
            rating: 4.8,
            ticketPrice: '70元',
            openTime: '7:30-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_066',
            name: '周庄古镇',
            description: '中国第一水乡，江南六大古镇之首',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '苏州市昆山市周庄镇',
            rating: 4.7,
            ticketPrice: '100元',
            openTime: '8:00-21:00',
            category: '历史古城'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_023',
        name: '扬州市',
        provinceId: 'prov_014',
        description: '淮左名都，竹西佳处，世界美食之都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_067',
            name: '瘦西湖',
            description: '扬州最著名的景点，有"园林之盛，甲于天下"之誉',
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
            address: '扬州市邗江区大虹桥路28号',
            rating: 4.8,
            ticketPrice: '100元',
            openTime: '7:30-17:30',
            category: '园林景观'
          },
          {
            id: 'landmark_068',
            name: '个园',
            description: '中国四大名园之一，以竹石取胜',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '扬州市广陵区盐阜东路10号',
            rating: 4.7,
            ticketPrice: '45元',
            openTime: '7:30-17:30',
            category: '园林景观'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_015',
    name: '浙江省',
    shortName: '浙',
    capital: '杭州市',
    cities: [
      {
        id: 'city_024',
        name: '杭州市',
        provinceId: 'prov_015',
        description: '浙江省省会，人间天堂，电子商务之都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_069',
            name: '西湖',
            description: '中国大陆首批国家重点风景名胜区和中国十大风景名胜之一',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '杭州市西湖区',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_070',
            name: '灵隐寺',
            description: '杭州最早的名刹，中国佛教禅宗十大古刹之一',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '杭州市西湖区灵隐路法云弄1号',
            rating: 4.8,
            ticketPrice: '75元',
            openTime: '7:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_071',
            name: '千岛湖',
            description: '新安江水库，世界上岛屿最多的湖',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '杭州市淳安县',
            rating: 4.8,
            ticketPrice: '130元',
            openTime: '8:00-17:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_025',
        name: '宁波市',
        provinceId: 'prov_015',
        description: '东方大港，书藏古今，港通天下',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
        landmarks: [
          {
            id: 'landmark_072',
            name: '天一阁',
            description: '亚洲现存最古老的私人藏书楼',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '宁波市海曙区天一街10号',
            rating: 4.7,
            ticketPrice: '30元',
            openTime: '8:30-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_073',
            name: '溪口雪窦山',
            description: '弥勒佛道场，国家级风景名胜区',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '宁波市奉化区溪口镇',
            rating: 4.8,
            ticketPrice: '230元',
            openTime: '8:00-17:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_026',
        name: '温州市',
        provinceId: 'prov_015',
        description: '东南山水甲天下，中国民营经济发祥地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_074',
            name: '雁荡山',
            description: '中国十大名山之一，素有"海上名山、寰中绝胜"之誉',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '温州市乐清市',
            rating: 4.8,
            ticketPrice: '50元',
            openTime: '8:00-17:30',
            category: '自然风光'
          },
          {
            id: 'landmark_075',
            name: '楠溪江',
            description: '国家重点风景名胜区，以水秀、岩奇、瀑多、村古、滩林美著称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '温州市永嘉县',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_016',
    name: '安徽省',
    shortName: '皖',
    capital: '合肥市',
    cities: [
      {
        id: 'city_027',
        name: '黄山市',
        provinceId: 'prov_016',
        description: '世界文化与自然双重遗产，天下第一奇山',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_076',
            name: '黄山风景区',
            description: '世界文化与自然双重遗产，以"奇松、怪石、云海、温泉"四绝著称',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '黄山市黄山区',
            rating: 4.9,
            ticketPrice: '190元',
            openTime: '6:00-17:30',
            category: '自然风光'
          },
          {
            id: 'landmark_077',
            name: '宏村',
            description: '世界文化遗产，中国画里的乡村',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '黄山市黟县',
            rating: 4.8,
            ticketPrice: '104元',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_078',
            name: '西递',
            description: '世界文化遗产，桃花源里人家',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '黄山市黟县西递镇',
            rating: 4.7,
            ticketPrice: '104元',
            openTime: '全天开放',
            category: '历史古城'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_017',
    name: '福建省',
    shortName: '闽',
    capital: '福州市',
    cities: [
      {
        id: 'city_028',
        name: '厦门市',
        provinceId: 'prov_017',
        description: '海上花园，海滨城市，钢琴之岛',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_079',
            name: '鼓浪屿',
            description: '世界文化遗产，素有"海上花园"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '厦门市思明区',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_080',
            name: '厦门大学',
            description: '中国最美大学之一，南方之强',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '厦门市思明区思明南路422号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '周末开放',
            category: '城市风光'
          },
          {
            id: 'landmark_081',
            name: '南普陀寺',
            description: '闽南佛教圣地，香火鼎盛',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '厦门市思明区思明南路515号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '4:30-18:30',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_029',
        name: '泉州市',
        provinceId: 'prov_017',
        description: '海上丝绸之路起点，世界文化遗产',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_082',
            name: '开元寺',
            description: '福建省内规模最大的佛教寺院',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '泉州市鲤城区西街',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '6:30-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_083',
            name: '清源山',
            description: '国家重点风景名胜区，道教圣地',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '泉州市丰泽区',
            rating: 4.6,
            ticketPrice: '70元',
            openTime: '7:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_018',
    name: '江西省',
    shortName: '赣',
    capital: '南昌市',
    cities: [
      {
        id: 'city_030',
        name: '九江市',
        provinceId: 'prov_018',
        description: '庐山所在地，中国魅力城市',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_084',
            name: '庐山',
            description: '世界文化遗产，匡庐奇秀甲天下',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '九江市庐山市',
            rating: 4.9,
            ticketPrice: '160元',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_085',
            name: '鄱阳湖',
            description: '中国第一大淡水湖，候鸟王国',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '九江市永修县',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_031',
        name: '景德镇市',
        provinceId: 'prov_018',
        description: '世界瓷都，千年瓷都',
        image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=800',
        landmarks: [
          {
            id: 'landmark_086',
            name: '古窑民俗博览区',
            description: '全国首家以陶瓷文化为主题的5A级旅游景区',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '景德镇市昌江区瓷都大道古窑路1号',
            rating: 4.7,
            ticketPrice: '95元',
            openTime: '8:00-17:00',
            category: '主题乐园'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_019',
    name: '山东省',
    shortName: '鲁',
    capital: '济南市',
    cities: [
      {
        id: 'city_032',
        name: '济南市',
        provinceId: 'prov_019',
        description: '泉城，七十二泉，天下第一泉风景区',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_087',
            name: '趵突泉',
            description: '天下第一泉，济南七十二名泉之冠',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '济南市历下区趵突泉南路1号',
            rating: 4.7,
            ticketPrice: '40元',
            openTime: '7:00-19:00',
            category: '自然风光'
          },
          {
            id: 'landmark_088',
            name: '大明湖',
            description: '泉城明珠，中国第一泉水湖',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '济南市历下区明湖路271号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_033',
        name: '泰安市',
        provinceId: 'prov_019',
        description: '五岳之首泰山所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_089',
            name: '泰山',
            description: '五岳之首，世界自然与文化双重遗产',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '泰安市泰山区',
            rating: 4.9,
            ticketPrice: '115元',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_034',
        name: '青岛市',
        provinceId: 'prov_019',
        description: '海滨城市，啤酒之城，帆船之都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_090',
            name: '崂山',
            description: '海上第一名山，道教名山',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '青岛市崂山区',
            rating: 4.8,
            ticketPrice: '130元',
            openTime: '6:00-19:00',
            category: '自然风光'
          },
          {
            id: 'landmark_091',
            name: '栈桥',
            description: '青岛标志性建筑，百年历史',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '青岛市市南区太平路14号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '现代建筑'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_020',
    name: '河南省',
    shortName: '豫',
    capital: '郑州市',
    cities: [
      {
        id: 'city_035',
        name: '洛阳市',
        provinceId: 'prov_020',
        description: '十三朝古都，牡丹花城',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_092',
            name: '龙门石窟',
            description: '中国四大石窟之一，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '洛阳市洛龙区龙门中街13号',
            rating: 4.8,
            ticketPrice: '90元',
            openTime: '8:00-18:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_093',
            name: '白马寺',
            description: '中国第一古刹，佛教传入中国后兴建的第一座官办寺院',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '洛阳市洛龙区白马寺镇',
            rating: 4.7,
            ticketPrice: '35元',
            openTime: '7:30-19:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_094',
            name: '洛阳牡丹园',
            description: '洛阳牡丹甲天下，每年4月牡丹文化节',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '洛阳市老城区机场路与310国道交叉口',
            rating: 4.6,
            ticketPrice: '50元',
            openTime: '4月-5月',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_036',
        name: '开封市',
        provinceId: 'prov_020',
        description: '八朝古都，北宋都城',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_095',
            name: '清明上河园',
            description: '以《清明上河图》为蓝本建造的大型宋代历史文化主题公园',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '开封市龙亭区龙亭西路5号',
            rating: 4.7,
            ticketPrice: '120元',
            openTime: '9:00-22:00',
            category: '主题乐园'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_021',
    name: '湖北省',
    shortName: '鄂',
    capital: '武汉市',
    cities: [
      {
        id: 'city_037',
        name: '武汉市',
        provinceId: 'prov_021',
        description: '江城，九省通衢，黄鹤楼所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_096',
            name: '黄鹤楼',
            description: '天下江山第一楼，江南三大名楼之一',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '武汉市武昌区蛇山西山坡特1号',
            rating: 4.7,
            ticketPrice: '70元',
            openTime: '8:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_097',
            name: '武汉长江大桥',
            description: '万里长江第一桥',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '武汉市武昌区临江大道',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '现代建筑'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_038',
        name: '宜昌市',
        provinceId: 'prov_021',
        description: '三峡大坝所在地，世界水电之都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_098',
            name: '三峡大坝',
            description: '世界上最大的水利枢纽工程',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '宜昌市夷陵区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '8:30-17:30',
            category: '现代建筑'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_022',
    name: '湖南省',
    shortName: '湘',
    capital: '长沙市',
    cities: [
      {
        id: 'city_039',
        name: '长沙市',
        provinceId: 'prov_022',
        description: '娱乐之都，山水洲城，湖南卫视所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_099',
            name: '橘子洲',
            description: '湘江中长岛，毛泽东青年艺术雕塑所在地',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '长沙市岳麓区橘子洲头2号',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_100',
            name: '岳麓山',
            description: '南岳衡山七十二峰之一，岳麓书院所在地',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '长沙市岳麓区登高路58号',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_040',
        name: '张家界市',
        provinceId: 'prov_022',
        description: '世界自然遗产，阿凡达取景地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_101',
            name: '张家界国家森林公园',
            description: '中国第一个国家森林公园，世界自然遗产',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '张家界市武陵源区',
            rating: 4.9,
            ticketPrice: '228元',
            openTime: '7:00-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_102',
            name: '天门山',
            description: '张家界之魂，湘西第一神山',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '张家界市永定区',
            rating: 4.8,
            ticketPrice: '278元',
            openTime: '8:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_041',
        name: '湘西土家族苗族自治州',
        provinceId: 'prov_022',
        description: '凤凰古城所在地，沈从文故乡',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_103',
            name: '凤凰古城',
            description: '国家历史文化名城，沈从文笔下的边城',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '湘西土家族苗族自治州凤凰县',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_023',
    name: '四川省',
    shortName: '川',
    capital: '成都市',
    cities: [
      {
        id: 'city_042',
        name: '成都市',
        provinceId: 'prov_023',
        description: '天府之国，美食之都，休闲城市',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_104',
            name: '都江堰',
            description: '世界文化遗产，全世界至今为止年代最久、唯一留存、仍在一直使用的宏大水利工程',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '成都市都江堰市公园路',
            rating: 4.8,
            ticketPrice: '80元',
            openTime: '8:00-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_105',
            name: '青城山',
            description: '世界文化遗产，中国四大道教名山之一',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '成都市都江堰市西南',
            rating: 4.7,
            ticketPrice: '80元',
            openTime: '8:00-17:30',
            category: '自然风光'
          },
          {
            id: 'landmark_106',
            name: '锦里古街',
            description: '成都著名的商业步行街，体验成都民俗的好去处',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '成都市武侯区武侯祠大街231号',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_107',
            name: '宽窄巷子',
            description: '成都三大历史文化保护区之一，由宽巷子、窄巷子、井巷子平行排列组成',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '成都市青羊区长顺上街127号',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_108',
            name: '成都大熊猫繁育研究基地',
            description: '世界著名的大熊猫迁地保护基地、科研繁育基地、公众教育基地和教育旅游基地',
            image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600',
            address: '成都市成华区外北熊猫大道1375号',
            rating: 4.8,
            ticketPrice: '55元',
            openTime: '7:30-18:00',
            category: '主题乐园'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_043',
        name: '阿坝藏族羌族自治州',
        provinceId: 'prov_023',
        description: '九寨沟、黄龙、四姑娘山所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_109',
            name: '九寨沟',
            description: '世界自然遗产，以翠海、叠瀑、彩林、雪峰、藏情、蓝冰"六绝"著称于世',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '阿坝藏族羌族自治州九寨沟县',
            rating: 4.9,
            ticketPrice: '190元',
            openTime: '7:00-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_110',
            name: '黄龙',
            description: '世界自然遗产，以彩池、雪山、峡谷、森林"四绝"著称于世',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '阿坝藏族羌族自治州松潘县',
            rating: 4.8,
            ticketPrice: '170元',
            openTime: '8:00-17:30',
            category: '自然风光'
          },
          {
            id: 'landmark_111',
            name: '四姑娘山',
            description: '东方阿尔卑斯山，中国十大登山名山',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '阿坝藏族羌族自治州小金县',
            rating: 4.8,
            ticketPrice: '80元',
            openTime: '7:00-17:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_044',
        name: '乐山市',
        provinceId: 'prov_023',
        description: '乐山大佛所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_112',
            name: '乐山大佛',
            description: '世界文化与自然双重遗产，世界上最大的石刻弥勒佛坐像',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '乐山市市中区凌云路2435号',
            rating: 4.8,
            ticketPrice: '80元',
            openTime: '7:30-18:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_113',
            name: '峨眉山',
            description: '世界文化与自然双重遗产，中国四大佛教名山之一',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '乐山市峨眉山市',
            rating: 4.9,
            ticketPrice: '160元',
            openTime: '6:00-17:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_024',
    name: '贵州省',
    shortName: '黔',
    capital: '贵阳市',
    cities: [
      {
        id: 'city_045',
        name: '贵阳市',
        provinceId: 'prov_024',
        description: '林城，避暑之都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_114',
            name: '青岩古镇',
            description: '贵州四大古镇之一，明清时期的建筑',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '贵阳市花溪区青岩镇',
            rating: 4.7,
            ticketPrice: '60元',
            openTime: '8:00-18:00',
            category: '历史古城'
          },
          {
            id: 'landmark_115',
            name: '甲秀楼',
            description: '贵阳的标志性建筑，始建于明代',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '贵阳市南明区翠微巷8号',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史建筑'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_046',
        name: '安顺市',
        provinceId: 'prov_024',
        description: '黄果树瀑布所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_116',
            name: '黄果树瀑布',
            description: '亚洲最大的瀑布，世界著名大瀑布之一',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '安顺市镇宁布依族苗族自治县',
            rating: 4.9,
            ticketPrice: '160元',
            openTime: '7:00-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_117',
            name: '龙宫',
            description: '世界上水旱溶洞最多、最集中的景区',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '安顺市西秀区龙宫镇',
            rating: 4.7,
            ticketPrice: '150元',
            openTime: '8:00-17:30',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_047',
        name: '黔东南苗族侗族自治州',
        provinceId: 'prov_024',
        description: '千户苗寨所在地，民族风情浓郁',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_118',
            name: '西江千户苗寨',
            description: '世界上最大的苗族聚居村寨',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '黔东南苗族侗族自治州雷山县',
            rating: 4.8,
            ticketPrice: '90元',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_119',
            name: '肇兴侗寨',
            description: '全国最大的侗族村寨之一',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '黔东南苗族侗族自治州黎平县',
            rating: 4.7,
            ticketPrice: '80元',
            openTime: '全天开放',
            category: '历史古城'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_025',
    name: '陕西省',
    shortName: '陕',
    capital: '西安市',
    cities: [
      {
        id: 'city_048',
        name: '西安市',
        provinceId: 'prov_025',
        description: '十三朝古都，丝绸之路起点，世界历史名城',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_120',
            name: '秦始皇兵马俑',
            description: '世界第八大奇迹，世界文化遗产',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '西安市临潼区秦陵北路',
            rating: 4.9,
            ticketPrice: '120元',
            openTime: '8:30-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_121',
            name: '大雁塔',
            description: '唐代著名高僧玄奘法师译经之地，西安的标志性建筑',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '西安市雁塔区慈恩路1号',
            rating: 4.7,
            ticketPrice: '40元',
            openTime: '8:00-18:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_122',
            name: '回民街',
            description: '西安著名的美食街，回族风情浓郁',
            image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600',
            address: '西安市莲湖区北院门',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_123',
            name: '西安城墙',
            description: '中国现存规模最大、保存最完整的古代城垣',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '西安市碑林区南大街2号',
            rating: 4.8,
            ticketPrice: '54元',
            openTime: '8:00-22:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_124',
            name: '华清宫',
            description: '唐代皇家温泉宫殿，杨贵妃洗浴的地方',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '西安市临潼区华清路38号',
            rating: 4.7,
            ticketPrice: '120元',
            openTime: '7:00-19:00',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_049',
        name: '延安市',
        provinceId: 'prov_025',
        description: '革命圣地，红色旅游城市',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_125',
            name: '黄帝陵',
            description: '中华民族始祖轩辕黄帝的陵寝',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '延安市黄陵县桥山',
            rating: 4.8,
            ticketPrice: '75元',
            openTime: '7:30-18:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_126',
            name: '壶口瀑布',
            description: '黄河上最大的瀑布，世界上最大的黄色瀑布',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '延安市宜川县壶口镇',
            rating: 4.8,
            ticketPrice: '90元',
            openTime: '7:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_050',
        name: '渭南市',
        provinceId: 'prov_025',
        description: '华山所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_127',
            name: '华山',
            description: '五岳之一的西岳，以险峻著称',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '渭南市华阴市',
            rating: 4.9,
            ticketPrice: '160元',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_026',
    name: '甘肃省',
    shortName: '甘',
    capital: '兰州市',
    cities: [
      {
        id: 'city_051',
        name: '兰州市',
        provinceId: 'prov_026',
        description: '黄河之都，丝路重镇',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_128',
            name: '黄河铁桥',
            description: '黄河上第一座现代桥梁，有"天下黄河第一桥"之称',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '兰州市城关区滨河路中段北侧',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '现代建筑'
          },
          {
            id: 'landmark_129',
            name: '白塔山公园',
            description: '因山顶有一座白塔寺而得名',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '兰州市城关区北滨河中路',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '6:30-20:00',
            category: '城市公园'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_052',
        name: '敦煌市',
        provinceId: 'prov_026',
        description: '丝路明珠，莫高窟所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_130',
            name: '莫高窟',
            description: '世界文化遗产，东方艺术明珠',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '酒泉市敦煌市东南25公里处',
            rating: 4.9,
            ticketPrice: '238元',
            openTime: '8:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_131',
            name: '鸣沙山月牙泉',
            description: '沙漠奇观，千年不枯的泉水',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '酒泉市敦煌市城南5公里处',
            rating: 4.8,
            ticketPrice: '110元',
            openTime: '6:00-19:30',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_053',
        name: '嘉峪关市',
        provinceId: 'prov_026',
        description: '天下第一雄关所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_132',
            name: '嘉峪关',
            description: '明长城最西端的关口，天下第一雄关',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '嘉峪关市峪泉镇',
            rating: 4.8,
            ticketPrice: '110元',
            openTime: '8:30-18:00',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_054',
        name: '张掖市',
        provinceId: 'prov_026',
        description: '丹霞地貌所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_133',
            name: '张掖丹霞国家地质公园',
            description: '中国最美的七大丹霞之一，彩色丘陵',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '张掖市临泽县倪家营乡',
            rating: 4.8,
            ticketPrice: '74元',
            openTime: '7:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_027',
    name: '广西壮族自治区',
    shortName: '桂',
    capital: '南宁市',
    cities: [
      {
        id: 'city_055',
        name: '桂林市',
        provinceId: 'prov_027',
        description: '山水甲天下，喀斯特地貌典型代表',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_134',
            name: '漓江',
            description: '桂林山水的精华，有"百里漓江、百里画廊"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '桂林市灵川县',
            rating: 4.9,
            ticketPrice: '210元',
            openTime: '7:00-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_135',
            name: '象鼻山',
            description: '桂林的城徽山，酷似一头驻足漓江边临流饮水的大象',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '桂林市象山区民主路1号',
            rating: 4.7,
            ticketPrice: '75元',
            openTime: '7:00-18:30',
            category: '自然风光'
          },
          {
            id: 'landmark_136',
            name: '阳朔',
            description: '桂林山水甲天下，阳朔堪称甲桂林',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '桂林市阳朔县',
            rating: 4.8,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史古城'
          },
          {
            id: 'landmark_137',
            name: '龙脊梯田',
            description: '梯田世界之冠，有"梯田世界之冠"的美誉',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '桂林市龙胜各族自治县和平乡',
            rating: 4.8,
            ticketPrice: '80元',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_056',
        name: '北海市',
        provinceId: 'prov_027',
        description: '海滨旅游城市，银滩所在地',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_138',
            name: '北海银滩',
            description: '中国第一滩，以滩长平、沙细白、水温净著称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '北海市银海区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_139',
            name: '涠洲岛',
            description: '中国地质年龄最年轻的火山岛',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '北海市海城区涠洲镇',
            rating: 4.8,
            ticketPrice: '98元',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_028',
    name: '海南省',
    shortName: '琼',
    capital: '海口市',
    cities: [
      {
        id: 'city_057',
        name: '三亚市',
        provinceId: 'prov_028',
        description: '东方夏威夷，热带海滨旅游城市',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_140',
            name: '天涯海角',
            description: '三亚的标志性景点，以美丽的热带自然海滨风光和悠久的历史文化闻名',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '三亚市天涯区天涯镇',
            rating: 4.6,
            ticketPrice: '81元',
            openTime: '7:30-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_141',
            name: '亚龙湾',
            description: '天下第一湾，中国最美的八大海岸之首',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '三亚市吉阳区',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_142',
            name: '蜈支洲岛',
            description: '中国的马尔代夫，被誉为"中国第一潜水基地"',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '三亚市海棠区',
            rating: 4.8,
            ticketPrice: '144元',
            openTime: '8:00-17:30',
            category: '自然风光'
          },
          {
            id: 'landmark_143',
            name: '南山文化旅游区',
            description: '中国最南端的佛教圣地，有高达108米的南海观音圣像',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '三亚市崖州区',
            rating: 4.8,
            ticketPrice: '122元',
            openTime: '8:00-17:30',
            category: '历史遗迹'
          },
          {
            id: 'landmark_144',
            name: '大东海',
            description: '三亚最早被开发的热带滨海度假区',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '三亚市吉阳区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_058',
        name: '海口市',
        provinceId: 'prov_028',
        description: '海南省省会，椰城',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_145',
            name: '骑楼老街',
            description: '海口市一处最具特色的街道景观',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '海口市龙华区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_146',
            name: '假日海滩',
            description: '海口市最具代表性的海滨旅游休闲胜地',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '海口市秀英区',
            rating: 4.6,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_029',
    name: '西藏自治区',
    shortName: '藏',
    capital: '拉萨市',
    cities: [
      {
        id: 'city_059',
        name: '拉萨市',
        provinceId: 'prov_029',
        description: '日光城，雪域圣地，藏传佛教中心',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_147',
            name: '布达拉宫',
            description: '世界文化遗产，西藏最庞大、最完整的古代宫堡建筑群',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '拉萨市城关区北京中路35号',
            rating: 4.9,
            ticketPrice: '200元',
            openTime: '9:00-15:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_148',
            name: '大昭寺',
            description: '藏传佛教最神圣的寺庙，供奉着释迦牟尼12岁等身像',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '拉萨市城关区八廓街',
            rating: 4.8,
            ticketPrice: '85元',
            openTime: '9:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_149',
            name: '八廓街',
            description: '围绕大昭寺的转经道，拉萨最古老的街道',
            image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=600',
            address: '拉萨市城关区',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '历史街区'
          },
          {
            id: 'landmark_150',
            name: '纳木错',
            description: '西藏第二大湖泊，中国第三大咸水湖，西藏三大圣湖之一',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '拉萨市当雄县',
            rating: 4.9,
            ticketPrice: '120元',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_060',
        name: '日喀则市',
        provinceId: 'prov_029',
        description: '珠峰所在地，后藏重镇',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_151',
            name: '珠穆朗玛峰',
            description: '世界第一高峰，地球之巅',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '日喀则市定日县',
            rating: 4.9,
            ticketPrice: '180元',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_152',
            name: '扎什伦布寺',
            description: '历代班禅的驻锡地，西藏日喀则地区最大的寺庙',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '日喀则市桑珠孜区',
            rating: 4.8,
            ticketPrice: '100元',
            openTime: '9:00-17:00',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_061',
        name: '林芝市',
        provinceId: 'prov_029',
        description: '西藏江南，雅鲁藏布大峡谷所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_153',
            name: '雅鲁藏布大峡谷',
            description: '世界上最深的峡谷，世界第一大峡谷',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '林芝市米林县',
            rating: 4.9,
            ticketPrice: '240元',
            openTime: '6:00-18:00',
            category: '自然风光'
          },
          {
            id: 'landmark_154',
            name: '南迦巴瓦峰',
            description: '中国最美的十大名山之首，西藏最古老的佛教"雍仲本教"的神山',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '林芝市米林县',
            rating: 4.9,
            ticketPrice: '免费',
            openTime: '全天开放',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_030',
    name: '青海省',
    shortName: '青',
    capital: '西宁市',
    cities: [
      {
        id: 'city_062',
        name: '西宁市',
        provinceId: 'prov_030',
        description: '夏都，青藏高原东方门户',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_155',
            name: '塔尔寺',
            description: '中国藏传佛教格鲁派六大寺院之一，青海省首屈一指的名胜古迹',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '西宁市湟中区鲁沙尔镇',
            rating: 4.8,
            ticketPrice: '70元',
            openTime: '8:00-17:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_156',
            name: '东关清真大寺',
            description: '青海省最大的清真寺，西北地区四大清真寺之一',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '西宁市城东区东关大街',
            rating: 4.7,
            ticketPrice: '免费',
            openTime: '8:00-18:00',
            category: '历史遗迹'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_063',
        name: '海西蒙古族藏族自治州',
        provinceId: 'prov_030',
        description: '青海湖、茶卡盐湖所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_157',
            name: '青海湖',
            description: '中国最大的内陆湖、咸水湖，中国最美的五大湖之首',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '海南藏族自治州共和县',
            rating: 4.9,
            ticketPrice: '90元',
            openTime: '全天开放',
            category: '自然风光'
          },
          {
            id: 'landmark_158',
            name: '茶卡盐湖',
            description: '中国的天空之镜，中国最美的星空',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '海西蒙古族藏族自治州乌兰县',
            rating: 4.8,
            ticketPrice: '60元',
            openTime: '8:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  },
  {
    id: 'prov_031',
    name: '宁夏回族自治区',
    shortName: '宁',
    capital: '银川市',
    cities: [
      {
        id: 'city_064',
        name: '银川市',
        provinceId: 'prov_031',
        description: '塞上湖城，西夏古都',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        landmarks: [
          {
            id: 'landmark_159',
            name: '西夏王陵',
            description: '西夏历代帝王陵以及皇家陵墓，有"东方金字塔"之称',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '银川市西夏区',
            rating: 4.7,
            ticketPrice: '85元',
            openTime: '8:00-18:00',
            category: '历史遗迹'
          },
          {
            id: 'landmark_160',
            name: '镇北堡西部影城',
            description: '中国西部最著名的影视城，《大话西游》取景地',
            image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
            address: '银川市西夏区镇北堡',
            rating: 4.7,
            ticketPrice: '80元',
            openTime: '8:00-18:00',
            category: '主题乐园'
          }
        ],
        featuredProducts: []
      },
      {
        id: 'city_065',
        name: '中卫市',
        provinceId: 'prov_031',
        description: '沙坡头所在地',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        landmarks: [
          {
            id: 'landmark_161',
            name: '沙坡头',
            description: '中国四大沙漠之一腾格里沙漠的东南边缘，集大漠、黄河、高山、绿洲为一处',
            image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
            address: '中卫市沙坡头区',
            rating: 4.8,
            ticketPrice: '100元',
            openTime: '8:00-18:00',
            category: '自然风光'
          }
        ],
        featuredProducts: []
      }
    ]
  }
];

export function getProvinceById(id) {
  return PROVINCES.find(p => p.id === id);
}

export function getCityById(id) {
  for (const province of PROVINCES) {
    const city = province.cities.find(c => c.id === id);
    if (city) return { city, province };
  }
  return null;
}

export function getLandmarkById(id) {
  for (const province of PROVINCES) {
    for (const city of province.cities) {
      const landmark = city.landmarks.find(l => l.id === id);
      if (landmark) return { landmark, city, province };
    }
  }
  return null;
}

export function searchCities(keyword) {
  const results = [];
  const lowerKeyword = keyword.toLowerCase();

  for (const province of PROVINCES) {
    if (province.name.toLowerCase().includes(lowerKeyword)) {
      results.push({
        type: 'province',
        ...province
      });
    }

    for (const city of province.cities) {
      if (city.name.toLowerCase().includes(lowerKeyword) ||
          city.description.toLowerCase().includes(lowerKeyword)) {
        results.push({
          type: 'city',
          province,
          ...city
        });
      }

      for (const landmark of city.landmarks) {
        if (landmark.name.toLowerCase().includes(lowerKeyword) ||
            landmark.description.toLowerCase().includes(lowerKeyword)) {
          results.push({
            type: 'landmark',
            province,
            city,
            ...landmark
          });
        }
      }
    }
  }

  return results;
}
