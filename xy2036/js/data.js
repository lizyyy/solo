const WEATHER_DATA = {
  cities: [
    {
      id: 'beijing',
      name: '北京',
      province: '北京市',
      lat: 39.9042,
      lng: 116.4074,
      elevation: 43.5,
      terrain: '平原',
      terrainDesc: '华北平原西北边缘，背靠燕山山脉',
      climateType: '温带季风气候',
      climateDesc: '夏季高温多雨，冬季寒冷干燥，春秋短促',
      features: '首都，历史文化名城，多风沙天气',
      naturalDisasters: ['沙尘暴', '干旱', '冰雹', '高温'],
      disasterReasons: {
        '沙尘暴': '春季蒙古高原沙尘随西北风南下',
        '干旱': '春夏季降水偏少，蒸发量大',
        '冰雹': '夏季强对流天气',
        '高温': '夏季副热带高压影响'
      }
    },
    {
      id: 'shanghai',
      name: '上海',
      province: '上海市',
      lat: 31.2304,
      lng: 121.4737,
      elevation: 4,
      terrain: '平原',
      terrainDesc: '长江三角洲冲积平原，地势低平',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，夏季炎热潮湿，冬季温和湿润',
      features: '国际化大都市，沿海港口城市',
      naturalDisasters: ['台风', '暴雨', '高温', '寒潮'],
      disasterReasons: {
        '台风': '夏秋季节西北太平洋台风登陆影响',
        '暴雨': '梅雨季节强降水，台风带来暴雨',
        '高温': '夏季副热带高压控制',
        '寒潮': '冬季强冷空气南下'
      }
    },
    {
      id: 'guangzhou',
      name: '广州',
      province: '广东省',
      lat: 23.1291,
      lng: 113.2644,
      elevation: 11,
      terrain: '丘陵平原',
      terrainDesc: '珠江三角洲北部，东江、西江、北江汇流处',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，长夏短冬，雨量充沛',
      features: '千年商都，岭南文化中心',
      naturalDisasters: ['台风', '暴雨', '高温', '雷电'],
      disasterReasons: {
        '台风': '夏秋季节南海及西北太平洋台风频繁登陆',
        '暴雨': '前汛期锋面降水，后汛期台风雨',
        '高温': '夏季副热带高压及热带系统影响',
        '雷电': '强对流天气频发'
      }
    },
    {
      id: 'chengdu',
      name: '成都',
      province: '四川省',
      lat: 30.5728,
      lng: 104.0668,
      elevation: 500,
      terrain: '盆地',
      terrainDesc: '四川盆地西部，成都平原腹地',
      climateType: '亚热带季风气候',
      climateDesc: '气候温和，四季分明，多云雾，少日照',
      features: '天府之国，美食之都，熊猫故乡',
      naturalDisasters: ['暴雨', '洪涝', '地质灾害', '高温'],
      disasterReasons: {
        '暴雨': '夏季西南暖湿气流与地形抬升',
        '洪涝': '盆地地形排水不畅，强降水集中',
        '地质灾害': '周边山区滑坡、泥石流易发',
        '高温': '夏季盆地地形热量不易散发'
      }
    },
    {
      id: 'chongqing',
      name: '重庆',
      province: '重庆市',
      lat: 29.4316,
      lng: 106.9123,
      elevation: 237,
      terrain: '山地丘陵',
      terrainDesc: '川东平行岭谷，长江与嘉陵江交汇处',
      climateType: '亚热带季风气候',
      climateDesc: '夏季炎热，冬季温暖，多雨雾',
      features: '山城，火锅之都，长江上游经济中心',
      naturalDisasters: ['高温', '暴雨', '地质灾害', '雷电'],
      disasterReasons: {
        '高温': '夏季副热带高压，盆地地形聚热',
        '暴雨': '地形抬升形成强降水',
        '地质灾害': '山地地形，暴雨引发滑坡、泥石流',
        '雷电': '山区强对流天气'
      }
    },
    {
      id: 'xian',
      name: '西安',
      province: '陕西省',
      lat: 34.3416,
      lng: 108.9398,
      elevation: 405,
      terrain: '平原',
      terrainDesc: '关中平原中部，渭河沿岸',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '十三朝古都，历史文化名城',
      naturalDisasters: ['干旱', '暴雨', '冰雹', '寒潮'],
      disasterReasons: {
        '干旱': '大陆性气候，降水偏少且集中',
        '暴雨': '夏季地形雨及锋面雨',
        '冰雹': '夏季强对流天气',
        '寒潮': '冬季西北冷空气直下'
      }
    },
    {
      id: 'hangzhou',
      name: '杭州',
      province: '浙江省',
      lat: 30.2741,
      lng: 120.1551,
      elevation: 19,
      terrain: '平原丘陵',
      terrainDesc: '钱塘江下游北岸，京杭大运河南端',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，雨量充沛，夏季湿热',
      features: '人间天堂，西湖名胜，电商之都',
      naturalDisasters: ['台风', '暴雨', '高温', '寒潮'],
      disasterReasons: {
        '台风': '夏秋季节台风登陆影响',
        '暴雨': '梅雨季节及台风雨',
        '高温': '夏季副热带高压控制',
        '寒潮': '冬季冷空气南下'
      }
    },
    {
      id: 'nanjing',
      name: '南京',
      province: '江苏省',
      lat: 32.0603,
      lng: 118.7969,
      elevation: 15,
      terrain: '平原',
      terrainDesc: '长江下游沿岸，宁镇丘陵西缘',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，夏季炎热，冬季寒冷',
      features: '六朝古都，民国旧址，江南佳丽地',
      naturalDisasters: ['梅雨', '暴雨', '高温', '寒潮'],
      disasterReasons: {
        '梅雨': '江淮准静止锋控制，阴雨连绵',
        '暴雨': '梅雨期及台风带来强降水',
        '高温': '夏季副热带高压，形成火炉天气',
        '寒潮': '冬季强冷空气侵袭'
      }
    },
    {
      id: 'wuhan',
      name: '武汉',
      province: '湖北省',
      lat: 30.5928,
      lng: 114.3055,
      elevation: 23,
      terrain: '平原',
      terrainDesc: '江汉平原东部，长江与汉江交汇处',
      climateType: '亚热带季风气候',
      climateDesc: '夏季炎热潮湿，冬季湿冷，四季分明',
      features: '九省通衢，江城，火炉城市之一',
      naturalDisasters: ['暴雨', '高温', '洪涝', '寒潮'],
      disasterReasons: {
        '暴雨': '夏季西南暖湿气流与冷空气交汇',
        '高温': '夏季副热带高压，河网密布湿度大',
        '洪涝': '长江流域降水集中，地势低平',
        '寒潮': '冬季冷空气南下，无山脉阻挡'
      }
    },
    {
      id: 'shenzhen',
      name: '深圳',
      province: '广东省',
      lat: 22.5431,
      lng: 114.0579,
      elevation: 52,
      terrain: '丘陵平原',
      terrainDesc: '珠江口东岸，南临南海',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，长夏短冬，雨量充沛',
      features: '经济特区，科技创新中心',
      naturalDisasters: ['台风', '暴雨', '高温', '雷电'],
      disasterReasons: {
        '台风': '夏秋季节南海台风频繁登陆',
        '暴雨': '前汛期锋面降水，后汛期台风雨',
        '高温': '夏季副热带高压及热带系统',
        '雷电': '强对流天气频发'
      }
    },
    {
      id: 'tianjin',
      name: '天津',
      province: '天津市',
      lat: 39.0842,
      lng: 117.2009,
      elevation: 3,
      terrain: '平原',
      terrainDesc: '华北平原东北部，渤海西岸',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '直辖市，北方港口城市',
      naturalDisasters: ['干旱', '暴雨', '寒潮', '风暴潮'],
      disasterReasons: {
        '干旱': '春旱频发，降水偏少',
        '暴雨': '夏季集中降水',
        '寒潮': '冬季强冷空气',
        '风暴潮': '渤海湾天文大潮叠加风暴'
      }
    },
    {
      id: 'suzhou',
      name: '苏州',
      province: '江苏省',
      lat: 31.2989,
      lng: 120.5853,
      elevation: 4,
      terrain: '平原',
      terrainDesc: '太湖东岸，长江三角洲中部',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，雨量充沛，夏季湿热',
      features: '园林之城，东方威尼斯，江南水乡',
      naturalDisasters: ['梅雨', '台风', '暴雨', '高温'],
      disasterReasons: {
        '梅雨': '江淮准静止锋',
        '台风': '夏秋台风影响',
        '暴雨': '梅雨及台风雨',
        '高温': '夏季副热带高压'
      }
    },
    {
      id: 'zhengzhou',
      name: '郑州',
      province: '河南省',
      lat: 34.7466,
      lng: 113.6254,
      elevation: 110,
      terrain: '平原',
      terrainDesc: '华北平原南部，黄河下游南岸',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '中原腹地，交通枢纽，商都遗址',
      naturalDisasters: ['干旱', '暴雨', '洪涝', '寒潮'],
      disasterReasons: {
        '干旱': '大陆性气候，降水不均',
        '暴雨': '夏季强降水集中',
        '洪涝': '黄河流域降水集中',
        '寒潮': '冬季冷空气直下'
      }
    },
    {
      id: 'jinan',
      name: '济南',
      province: '山东省',
      lat: 36.6766,
      lng: 116.9946,
      elevation: 58,
      terrain: '平原丘陵',
      terrainDesc: '鲁中丘陵北缘，南依泰山，北跨黄河',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '泉城，山东省会，历史文化名城',
      naturalDisasters: ['干旱', '暴雨', '冰雹', '寒潮'],
      disasterReasons: {
        '干旱': '春旱频发，降水偏少',
        '暴雨': '夏季地形雨及锋面雨',
        '冰雹': '夏季强对流',
        '寒潮': '冬季冷空气'
      }
    },
    {
      id: 'shenyang',
      name: '沈阳',
      province: '辽宁省',
      lat: 41.8057,
      lng: 123.4315,
      elevation: 45,
      terrain: '平原',
      terrainDesc: '辽河平原中部，浑河沿岸',
      climateType: '温带季风气候',
      climateDesc: '冬季严寒漫长，夏季温暖短促，春秋多风',
      features: '东北重镇，工业基地，历史文化名城',
      naturalDisasters: ['寒潮', '暴雪', '干旱', '大风'],
      disasterReasons: {
        '寒潮': '冬季西伯利亚强冷空气',
        '暴雪': '冬季冷暖空气交汇',
        '干旱': '春季降水少，蒸发大',
        '大风': '春秋季蒙古气旋影响'
      }
    },
    {
      id: 'qingdao',
      name: '青岛',
      province: '山东省',
      lat: 36.0671,
      lng: 120.3826,
      elevation: 77,
      terrain: '丘陵',
      terrainDesc: '山东半岛东南部，黄海之滨',
      climateType: '温带季风气候',
      climateDesc: '海洋性特征明显，夏季凉爽，冬季温和',
      features: '海滨城市，啤酒之都，帆船之都',
      naturalDisasters: ['台风', '暴雨', '风暴潮', '寒潮'],
      disasterReasons: {
        '台风': '夏秋季节台风北上影响',
        '暴雨': '夏季锋面雨及台风雨',
        '风暴潮': '台风及天文大潮',
        '寒潮': '冬季强冷空气'
      }
    },
    {
      id: 'xiamen',
      name: '厦门',
      province: '福建省',
      lat: 24.4798,
      lng: 118.0894,
      elevation: 63,
      terrain: '丘陵海岛',
      terrainDesc: '闽南沿海，台湾海峡西岸',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，长夏无冬，雨量充沛',
      features: '经济特区，海滨花园城市，闽南文化',
      naturalDisasters: ['台风', '暴雨', '风暴潮', '高温'],
      disasterReasons: {
        '台风': '夏秋季节西北太平洋台风频繁登陆',
        '暴雨': '台风雨及锋面雨',
        '风暴潮': '台风增水叠加天文大潮',
        '高温': '夏季副热带高压'
      }
    },
    {
      id: 'dali',
      name: '大理',
      province: '云南省',
      lat: 25.6067,
      lng: 100.2679,
      elevation: 1975,
      terrain: '高原盆地',
      terrainDesc: '云贵高原西部，洱海沿岸，苍山脚下',
      climateType: '低纬高原季风气候',
      climateDesc: '四季温差小，干湿季分明，气候宜人',
      features: '风花雪月，白族文化，旅游胜地',
      naturalDisasters: ['干旱', '暴雨', '地质灾害', '低温'],
      disasterReasons: {
        '干旱': '冬春季节降水偏少',
        '暴雨': '夏季地形抬升降水集中',
        '地质灾害': '山区地形，暴雨引发滑坡泥石流',
        '低温': '冬季冷空气影响，海拔高气温低'
      }
    },
    {
      id: 'kunming',
      name: '昆明',
      province: '云南省',
      lat: 25.0389,
      lng: 102.7183,
      elevation: 1891,
      terrain: '高原',
      terrainDesc: '云贵高原中部，滇池沿岸',
      climateType: '低纬高原季风气候',
      climateDesc: '四季如春，干湿季分明，气候宜人',
      features: '春城，云南省会，四季如春',
      naturalDisasters: ['干旱', '暴雨', '地质灾害', '低温'],
      disasterReasons: {
        '干旱': '冬春降水少，蒸发旺盛',
        '暴雨': '夏季地形抬升降水',
        '地质灾害': '山区地形复杂',
        '低温': '高海拔冬季降温'
      }
    },
    {
      id: 'lhasa',
      name: '拉萨',
      province: '西藏自治区',
      lat: 29.6548,
      lng: 91.1395,
      elevation: 3656,
      terrain: '高原谷地',
      terrainDesc: '青藏高原中部，雅鲁藏布江支流拉萨河中游河谷',
      climateType: '高原温带半干旱季风气候',
      climateDesc: '全年多晴朗天气，降雨稀少，冬无严寒，夏无酷暑',
      features: '日光城，高原明珠，藏传佛教圣地',
      naturalDisasters: ['干旱', '暴雪', '大风', '低温'],
      disasterReasons: {
        '干旱': '高原降水稀少，蒸发量大',
        '暴雪': '冬季强降雪',
        '大风': '春季高空风动量下传',
        '低温': '高海拔气温低'
      }
    },
    {
      id: 'urumqi',
      name: '乌鲁木齐',
      province: '新疆维吾尔自治区',
      lat: 43.8256,
      lng: 87.6168,
      elevation: 830,
      terrain: '盆地边缘',
      terrainDesc: '天山北麓，准噶尔盆地南缘',
      climateType: '温带大陆性干旱气候',
      climateDesc: '昼夜温差大，降水稀少，气候干燥',
      features: '亚心之都，新疆首府，多民族聚居',
      naturalDisasters: ['干旱', '大风', '沙尘暴', '暴雪'],
      disasterReasons: {
        '干旱': '深居内陆，降水稀少',
        '大风': '地形狭管效应，冷空气活动频繁',
        '沙尘暴': '戈壁沙漠沙尘被大风卷起',
        '暴雪': '冬季山区降雪'
      }
    },
    {
      id: 'haikou',
      name: '海口',
      province: '海南省',
      lat: 20.0440,
      lng: 110.1999,
      elevation: 14,
      terrain: '平原',
      terrainDesc: '海南岛北部，琼州海峡南岸',
      climateType: '热带季风气候',
      climateDesc: '长夏无冬，雨量充沛，干湿季分明',
      features: '椰城，海南省会，热带海滨城市',
      naturalDisasters: ['台风', '暴雨', '高温', '雷电'],
      disasterReasons: {
        '台风': '夏秋季节南海台风频繁登陆',
        '暴雨': '台风雨及对流雨',
        '高温': '热带气候，太阳辐射强',
        '雷电': '热带对流天气频发'
      }
    },
    {
      id: 'sanya',
      name: '三亚',
      province: '海南省',
      lat: 18.2528,
      lng: 109.5120,
      elevation: 7,
      terrain: '平原丘陵',
      terrainDesc: '海南岛最南端，南海沿岸',
      climateType: '热带季风气候',
      climateDesc: '全年温暖，长夏无冬，雨量充沛',
      features: '天涯海角，国际旅游城市，热带海滨度假胜地',
      naturalDisasters: ['台风', '暴雨', '高温', '风暴潮'],
      disasterReasons: {
        '台风': '夏秋季节南海及西北太平洋台风正面登陆',
        '暴雨': '台风雨及热带辐合带降水',
        '高温': '热带气候，太阳高度角大',
        '风暴潮': '台风增水叠加天文大潮'
      }
    },
    {
      id: 'harbin',
      name: '哈尔滨',
      province: '黑龙江省',
      lat: 45.8038,
      lng: 126.5350,
      elevation: 142,
      terrain: '平原',
      terrainDesc: '东北平原北部，松花江中游',
      climateType: '中温带大陆性季风气候',
      climateDesc: '冬季严寒漫长，夏季温暖短促，四季分明',
      features: '冰城，东方莫斯科，冰雪旅游胜地',
      naturalDisasters: ['暴雪', '寒潮', '低温冻害', '干旱'],
      disasterReasons: {
        '暴雪': '冬季冷暖空气交汇降雪量大',
        '寒潮': '西伯利亚强冷空气频繁南下',
        '低温冻害': '冬季气温极低，春季终霜晚',
        '干旱': '春季降水偏少'
      }
    },
    {
      id: 'changsha',
      name: '长沙',
      province: '湖南省',
      lat: 28.2282,
      lng: 112.9388,
      elevation: 64,
      terrain: '平原丘陵',
      terrainDesc: '湘江下游，长浏盆地西缘，湘江穿城而过',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，春夏多雨，秋冬晴燥，夏季炎热',
      features: '星城，岳麓山下，橘子洲头，湘菜发源地',
      naturalDisasters: ['暴雨', '洪涝', '高温', '寒潮'],
      disasterReasons: {
        '暴雨': '春夏之交冷暖空气交汇形成梅雨',
        '洪涝': '湘江流域降水集中，地势低平',
        '高温': '夏季副热带高压控制，形成火炉天气',
        '寒潮': '冬季强冷空气南下，南岭阻挡减弱'
      }
    },
    {
      id: 'hefei',
      name: '合肥',
      province: '安徽省',
      lat: 31.8206,
      lng: 117.2272,
      elevation: 20,
      terrain: '平原',
      terrainDesc: '江淮丘陵中部，巢湖之滨，长江淮河之间',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，气候温和，雨量适中',
      features: '三国故地，包拯家乡，江淮首郡',
      naturalDisasters: ['梅雨', '暴雨', '高温', '寒潮'],
      disasterReasons: {
        '梅雨': '江淮准静止锋控制，阴雨连绵',
        '暴雨': '梅雨期及台风带来强降水',
        '高温': '夏季副热带高压控制',
        '寒潮': '冬季冷空气南下'
      }
    },
    {
      id: 'fuzhou',
      name: '福州',
      province: '福建省',
      lat: 26.0745,
      lng: 119.2965,
      elevation: 84,
      terrain: '盆地',
      terrainDesc: '闽江下游，福州盆地，东临台湾海峡',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，夏长冬短，雨量充沛',
      features: '榕城，有福之州，海上丝绸之路门户',
      naturalDisasters: ['台风', '暴雨', '高温', '洪涝'],
      disasterReasons: {
        '台风': '夏秋季节西北太平洋台风频繁登陆',
        '暴雨': '台风雨及地形抬升降水',
        '高温': '夏季副热带高压控制',
        '洪涝': '闽江流域降水集中'
      }
    },
    {
      id: 'nanning',
      name: '南宁',
      province: '广西壮族自治区',
      lat: 22.8170,
      lng: 108.3665,
      elevation: 72,
      terrain: '平原',
      terrainDesc: '邕江沿岸，南宁盆地，广西南部',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，雨量充沛，夏长冬短',
      features: '绿城，广西首府，东盟博览会永久举办地',
      naturalDisasters: ['台风', '暴雨', '高温', '洪涝'],
      disasterReasons: {
        '台风': '夏秋季节南海台风登陆影响',
        '暴雨': '西南暖湿气流与地形抬升',
        '高温': '夏季副热带高压及热带系统',
        '洪涝': '邕江流域降水集中'
      }
    },
    {
      id: 'guiyang',
      name: '贵阳',
      province: '贵州省',
      lat: 26.6470,
      lng: 106.6302,
      elevation: 1071,
      terrain: '高原',
      terrainDesc: '云贵高原东部，乌江流域',
      climateType: '亚热带季风气候',
      climateDesc: '气候温和，四季分明，多雨少晴',
      features: '林城，贵州首府，避暑胜地',
      naturalDisasters: ['暴雨', '地质灾害', '低温', '干旱'],
      disasterReasons: {
        '暴雨': '西南暖湿气流与地形抬升',
        '地质灾害': '喀斯特地貌，山体滑坡泥石流',
        '低温': '高海拔冬季降温',
        '干旱': '冬春降水偏少'
      }
    },
    {
      id: 'lanzhou',
      name: '兰州',
      province: '甘肃省',
      lat: 36.0611,
      lng: 103.8343,
      elevation: 1520,
      terrain: '河谷',
      terrainDesc: '黄河上游，黄土高原西部，河谷地带',
      climateType: '温带大陆性气候',
      climateDesc: '干旱少雨，昼夜温差大，四季分明',
      features: '黄河之都，丝路重镇，牛肉面之乡',
      naturalDisasters: ['干旱', '沙尘暴', '暴雨', '地质灾害'],
      disasterReasons: {
        '干旱': '深居内陆，降水稀少',
        '沙尘暴': '西北沙漠沙尘随大风南下',
        '暴雨': '夏季强对流天气',
        '地质灾害': '黄土高原土质疏松，水土流失'
      }
    },
    {
      id: 'huhehaote',
      name: '呼和浩特',
      province: '内蒙古自治区',
      lat: 40.8414,
      lng: 111.7519,
      elevation: 1063,
      terrain: '高原',
      terrainDesc: '内蒙古高原南部，大青山南麓',
      climateType: '温带大陆性季风气候',
      climateDesc: '四季分明，寒暑变化剧烈，干燥少雨',
      features: '青城，内蒙古首府，草原门户',
      naturalDisasters: ['干旱', '沙尘暴', '暴雪', '寒潮'],
      disasterReasons: {
        '干旱': '深居内陆，降水稀少',
        '沙尘暴': '蒙古高原沙尘随西北风南下',
        '暴雪': '冬季冷暖空气交汇',
        '寒潮': '西伯利亚强冷空气直下'
      }
    },
    {
      id: 'yinchuan',
      name: '银川',
      province: '宁夏回族自治区',
      lat: 38.4872,
      lng: 106.2309,
      elevation: 1111,
      terrain: '平原',
      terrainDesc: '宁夏平原中部，黄河西岸',
      climateType: '温带大陆性气候',
      climateDesc: '干旱少雨，日照充足，昼夜温差大',
      features: '塞上湖城，宁夏首府，西夏古都',
      naturalDisasters: ['干旱', '沙尘暴', '低温', '大风'],
      disasterReasons: {
        '干旱': '深居内陆，降水稀少',
        '沙尘暴': '西北沙漠沙尘影响',
        '低温': '高海拔冬季寒冷',
        '大风': '春季冷空气活动频繁'
      }
    },
    {
      id: 'xining',
      name: '西宁',
      province: '青海省',
      lat: 36.6171,
      lng: 101.7782,
      elevation: 2261,
      terrain: '高原谷地',
      terrainDesc: '青藏高原东北部，湟水谷地',
      climateType: '高原大陆性气候',
      climateDesc: '冬季寒冷，夏季凉爽，昼夜温差大',
      features: '夏都，青海首府，青藏高原门户',
      naturalDisasters: ['干旱', '暴雪', '大风', '低温'],
      disasterReasons: {
        '干旱': '高原降水稀少',
        '暴雪': '冬季山区降雪',
        '大风': '春季高空风动量下传',
        '低温': '高海拔气温低'
      }
    },
    {
      id: 'shijiazhuang',
      name: '石家庄',
      province: '河北省',
      lat: 38.0428,
      lng: 114.5149,
      elevation: 80,
      terrain: '平原',
      terrainDesc: '华北平原西部，太行山东麓',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '河北省会，铁路枢纽，华北重镇',
      naturalDisasters: ['干旱', '暴雨', '高温', '沙尘暴'],
      disasterReasons: {
        '干旱': '春旱频发，降水偏少',
        '暴雨': '夏季地形雨及锋面雨',
        '高温': '夏季副热带高压控制',
        '沙尘暴': '春季西北沙尘南下'
      }
    },
    {
      id: 'taiyuan',
      name: '太原',
      province: '山西省',
      lat: 37.8706,
      lng: 112.5489,
      elevation: 778,
      terrain: '盆地',
      terrainDesc: '太原盆地北部，汾河沿岸',
      climateType: '温带季风气候',
      climateDesc: '四季分明，夏季炎热多雨，冬季寒冷干燥',
      features: '龙城，山西省会，历史文化名城',
      naturalDisasters: ['干旱', '暴雨', '地质灾害', '寒潮'],
      disasterReasons: {
        '干旱': '大陆性气候，降水偏少',
        '暴雨': '夏季地形抬升降水',
        '地质灾害': '黄土高原土质疏松',
        '寒潮': '冬季冷空气直下'
      }
    },
    {
      id: 'nanchang',
      name: '南昌',
      province: '江西省',
      lat: 28.6820,
      lng: 115.8579,
      elevation: 24,
      terrain: '平原',
      terrainDesc: '赣江下游，鄱阳湖平原',
      climateType: '亚热带季风气候',
      climateDesc: '四季分明，夏季炎热，冬季温和',
      features: '英雄城，江西省会，滕王阁所在地',
      naturalDisasters: ['暴雨', '洪涝', '高温', '寒潮'],
      disasterReasons: {
        '暴雨': '梅雨期及台风雨',
        '洪涝': '赣江及鄱阳湖流域降水集中',
        '高温': '夏季副热带高压控制',
        '寒潮': '冬季冷空气南下'
      }
    },
    {
      id: 'wenzhou',
      name: '温州',
      province: '浙江省',
      lat: 28.0006,
      lng: 120.6994,
      elevation: 14,
      terrain: '丘陵',
      terrainDesc: '浙江南部，瓯江下游，东海沿岸',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，四季分明，雨量充沛',
      features: '鹿城，温州模式发源地，商贸名城',
      naturalDisasters: ['台风', '暴雨', '高温', '风暴潮'],
      disasterReasons: {
        '台风': '夏秋季节台风频繁登陆',
        '暴雨': '台风雨及地形雨',
        '高温': '夏季副热带高压',
        '风暴潮': '台风增水叠加天文大潮'
      }
    },
    {
      id: 'dongguan',
      name: '东莞',
      province: '广东省',
      lat: 23.0207,
      lng: 113.7518,
      elevation: 20,
      terrain: '平原丘陵',
      terrainDesc: '珠江口东岸，东江下游',
      climateType: '亚热带季风气候',
      climateDesc: '温暖湿润，长夏短冬，雨量充沛',
      features: '世界工厂，制造业名城，篮球城市',
      naturalDisasters: ['台风', '暴雨', '高温', '雷电'],
      disasterReasons: {
        '台风': '夏秋季节南海台风登陆',
        '暴雨': '前汛期锋面降水，后汛期台风雨',
        '高温': '夏季副热带高压',
        '雷电': '强对流天气频发'
      }
    }
  ],

  weatherIcons: {
    '晴': '☀️',
    '多云': '⛅',
    '阴': '☁️',
    '小雨': '🌧️',
    '中雨': '🌧️',
    '大雨': '🌧️',
    '暴雨': '⛈️',
    '雷阵雨': '⛈️',
    '小雪': '🌨️',
    '中雪': '🌨️',
    '大雪': '🌨️',
    '雾': '🌫️',
    '霾': '🌫️',
    '沙尘暴': '💨'
  },

  getCityById: function(id) {
    return this.cities.find(city => city.id === id);
  },

  searchCities: function(query) {
    if (!query) return [];
    query = query.toLowerCase();
    return this.cities.filter(city => 
      city.name.toLowerCase().includes(query) ||
      city.province.toLowerCase().includes(query) ||
      city.id.toLowerCase().includes(query)
    );
  },

  generateWeatherData: function(cityId) {
    const city = this.getCityById(cityId);
    if (!city) return null;

    const lat = city.lat;
    const month = new Date().getMonth() + 1;
    
    let baseTemp;
    if (lat > 40) {
      baseTemp = month >= 5 && month <= 9 ? 22 : -10;
    } else if (lat > 35) {
      baseTemp = month >= 5 && month <= 9 ? 28 : 5;
    } else if (lat > 25) {
      baseTemp = month >= 5 && month <= 9 ? 32 : 15;
    } else {
      baseTemp = month >= 5 && month <= 9 ? 33 : 20;
    }

    if (city.elevation > 1000) {
      baseTemp -= (city.elevation - 1000) / 100 * 0.6;
    }

    const tempVariation = Math.random() * 6 - 3;
    const currentTemp = Math.round(baseTemp + tempVariation);
    const highTemp = currentTemp + Math.floor(Math.random() * 5 + 2);
    const lowTemp = currentTemp - Math.floor(Math.random() * 5 + 3);

    const weatherTypes = ['晴', '多云', '阴', '小雨', '中雨'];
    if (month >= 6 && month <= 8) {
      weatherTypes.push('雷阵雨', '大雨');
    }
    if (lat > 35 && (month <= 2 || month >= 11)) {
      weatherTypes.push('小雪', '中雪');
    }
    if (city.id === 'beijing' && (month === 3 || month === 4)) {
      weatherTypes.push('沙尘暴');
    }

    const currentWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];

    const hour24 = [];
    for (let i = 0; i < 24; i++) {
      const hour = (new Date().getHours() + i) % 24;
      const hourTemp = Math.round(currentTemp + Math.sin((hour - 6) * Math.PI / 12) * 5);
      hour24.push({
        hour: hour,
        temp: hourTemp,
        weather: hour >= 6 && hour <= 18 ? currentWeather : '晴',
        icon: this.weatherIcons[hour >= 6 && hour <= 18 ? currentWeather : '晴'] || '☀️'
      });
    }

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const forecast7 = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayVariation = (Math.random() - 0.5) * 8;
      const dayHigh = Math.round(highTemp + dayVariation);
      const dayLow = Math.round(lowTemp + dayVariation * 0.5);
      const dayWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      
      forecast7.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        weekday: weekDays[date.getDay()],
        high: dayHigh,
        low: dayLow,
        weather: dayWeather,
        icon: this.weatherIcons[dayWeather] || '☀️'
      });
    }

    const aqiLevels = [
      { level: '优', min: 0, max: 50, color: 'bg-green-500' },
      { level: '良', min: 51, max: 100, color: 'bg-yellow-500' },
      { level: '轻度污染', min: 101, max: 150, color: 'bg-orange-500' },
      { level: '中度污染', min: 151, max: 200, color: 'bg-red-500' }
    ];
    
    let aqiBase;
    if (city.id === 'lhasa' || city.id === 'xiamen' || city.id === 'sanya') {
      aqiBase = 30;
    } else if (city.id === 'beijing' || city.id === 'tianjin' || city.id === 'shijiazhuang') {
      aqiBase = 90;
    } else {
      aqiBase = 60;
    }
    
    const aqi = Math.round(aqiBase + Math.random() * 40);
    const aqiInfo = aqiLevels.find(l => aqi >= l.min && aqi <= l.max) || aqiLevels[0];

    const warnings = [];
    if (city.id === 'beijing' && (month === 3 || month === 4) && Math.random() > 0.5) {
      warnings.push({
        type: '沙尘暴',
        level: '黄色预警',
        message: '受蒙古气旋影响，预计未来12小时将出现沙尘天气，请注意防范。',
        icon: '💨'
      });
    }
    
    if (month >= 6 && month <= 9 && ['guangzhou', 'shenzhen', 'xiamen', 'sanya', 'haikou'].includes(city.id) && Math.random() > 0.6) {
      warnings.push({
        type: '台风',
        level: '蓝色预警',
        message: '受热带气旋影响，预计未来24小时将有强风和暴雨，请远离海滨区域。',
        icon: '🌀'
      });
    }

    if (month >= 6 && month <= 8 && Math.random() > 0.7) {
      warnings.push({
        type: '高温',
        level: '橙色预警',
        message: `预计未来24小时最高气温将达${highTemp}℃以上，请注意防暑降温。`,
        icon: '🌡️'
      });
    }

    const terrainAnalysis = this.generateTerrainAnalysis(city, currentWeather, currentTemp);

    return {
      city: city,
      current: {
        temp: currentTemp,
        high: highTemp,
        low: lowTemp,
        weather: currentWeather,
        icon: this.weatherIcons[currentWeather] || '☀️',
        humidity: Math.round(40 + Math.random() * 50),
        windSpeed: Math.round(2 + Math.random() * 10),
        windDirection: ['北风', '南风', '东风', '西风'][Math.floor(Math.random() * 4)],
        pressure: Math.round(1000 + Math.random() * 30),
        visibility: Math.round(5 + Math.random() * 15),
        uvIndex: Math.round(Math.random() * 10)
      },
      hour24: hour24,
      forecast7: forecast7,
      aqi: {
        value: aqi,
        level: aqiInfo.level,
        color: aqiInfo.color
      },
      warnings: warnings,
      terrainAnalysis: terrainAnalysis
    };
  },

  generateTerrainAnalysis: function(city, weather, temp) {
    const analyses = [];
    
    analyses.push({
      title: '地理位置影响',
      content: `${city.name}位于${city.terrainDesc}，海拔${city.elevation}米。这种地形特点使其气候具有明显的${city.terrain === '高原' ? '高原气候特征，气温较低，昼夜温差大' : city.terrain === '盆地' ? '盆地气候特征，热量不易散发，夏季闷热' : city.terrain === '山地' ? '山地气候特征，气候垂直差异明显' : '平原气候特征，气候相对稳定'}。`
    });

    if (weather.includes('雨') || weather.includes('雷')) {
      if (city.terrain === '山地' || city.terrain.includes('丘')) {
        analyses.push({
          title: '地形雨成因分析',
          content: `今日${weather}天气可能与地形抬升有关。${city.name}地处${city.terrainDesc}，暖湿气流遇到山地被迫抬升，冷却凝结形成降水。这种地形雨是该地区降水的重要形式之一。`
        });
      } else if (city.terrain === '平原') {
        analyses.push({
          title: '锋面雨成因分析',
          content: `今日${weather}天气主要由锋面活动引起。${city.name}地处平原地区，冷暖气流交汇时容易形成大范围降水。平原地形使天气系统移动较为顺畅，降水分布相对均匀。`
        });
      }
    }

    if (temp > 30) {
      if (city.terrain === '盆地') {
        analyses.push({
          title: '高温地形成因',
          content: `今日气温${temp}℃，属于高温天气。${city.name}位于盆地地形，四周环山，夏季热量不易散发，容易形成持续高温。这种"焚风效应"使得盆地地区成为夏季高温中心。`
        });
      } else {
        analyses.push({
          title: '高温天气分析',
          content: `今日气温${temp}℃，受副热带高压控制或热带系统影响。${city.terrain === '平原' ? '平原地区地形开阔，有利于热量的积聚和扩散。' : '沿海地区的高温通常伴有较高的湿度，体感温度会更高。'}`
        });
      }
    }

    if (weather === '晴') {
      analyses.push({
        title: '晴朗天气分析',
        content: `今日天气晴朗，主要受高压系统控制。${city.terrain === '高原' ? '高原地区空气稀薄，大气透明度高，日照强烈。' : city.terrain === '盆地' ? '盆地地区晴朗天气时容易形成辐射逆温，早晨可能有雾。' : '平原地区晴朗天气时风力通常较小，能见度较高。'}`
      });
    }

    return analyses;
  },

  getOutfitSuggestion: function(temp, weather) {
    let suggestions = {
      tops: [],
      bottoms: [],
      outerwear: [],
      accessories: [],
      tips: []
    };

    if (temp >= 30) {
      suggestions.tops = ['短袖T恤', '无袖上衣', '透气衬衫'];
      suggestions.bottoms = ['短裤', '轻薄长裤', '半身裙'];
      suggestions.outerwear = ['无需外套'];
      suggestions.accessories = ['遮阳帽', '太阳镜', '防晒霜'];
      suggestions.tips.push('高温天气，建议穿着透气轻薄的衣物');
      suggestions.tips.push('注意防晒，避免在烈日下长时间活动');
      suggestions.tips.push('多喝水，补充水分');
    } else if (temp >= 20) {
      suggestions.tops = ['长袖T恤', '薄衬衫', '针织衫'];
      suggestions.bottoms = ['长裤', '牛仔裤', '半身裙'];
      suggestions.outerwear = ['薄外套', '开衫', '夹克'];
      suggestions.accessories = ['墨镜', '薄围巾'];
      suggestions.tips.push('温度适宜，春秋装最为合适');
      suggestions.tips.push('早晚可能较凉，建议携带薄外套');
    } else if (temp >= 10) {
      suggestions.tops = ['长袖衬衫', '毛衣', '保暖内衣'];
      suggestions.bottoms = ['厚长裤', '牛仔裤', '加绒裤'];
      suggestions.outerwear = ['风衣', '厚夹克', '呢大衣'];
      suggestions.accessories = ['围巾', '帽子', '手套'];
      suggestions.tips.push('天气转凉，注意保暖');
      suggestions.tips.push('可以采用叠穿方式，方便随时增减衣物');
    } else if (temp >= 0) {
      suggestions.tops = ['保暖内衣', '毛衣', '厚针织衫'];
      suggestions.bottoms = ['加绒裤', '厚牛仔裤', '棉裤'];
      suggestions.outerwear = ['羽绒服', '棉服', '厚呢大衣'];
      suggestions.accessories = ['围巾', '帽子', '手套', '暖宝宝'];
      suggestions.tips.push('气温较低，注意防寒保暖');
      suggestions.tips.push('外出时注意保护耳朵、手脚等容易冻伤的部位');
    } else {
      suggestions.tops = ['保暖内衣套装', '厚毛衣', '羽绒内胆'];
      suggestions.bottoms = ['棉裤', '加绒厚裤', '羽绒裤'];
      suggestions.outerwear = ['厚羽绒服', '极地防寒服'];
      suggestions.accessories = ['厚围巾', '防寒帽', '厚手套', '雪地靴'];
      suggestions.tips.push('严寒天气，务必做好全面保暖措施');
      suggestions.tips.push('尽量减少户外活动时间');
      suggestions.tips.push('注意室内外温差，预防感冒');
    }

    if (weather.includes('雨')) {
      suggestions.outerwear.push('雨衣/防水外套');
      suggestions.accessories.push('雨伞');
      suggestions.tips.push('雨天出行建议携带雨具');
      suggestions.tips.push('穿着防水鞋，避免鞋袜浸湿');
    }

    if (weather === '沙尘暴') {
      suggestions.accessories.push('口罩', '防风眼镜');
      suggestions.tips.push('沙尘天气建议佩戴口罩和眼镜');
      suggestions.tips.push('减少户外活动，关闭门窗');
    }

    if (weather.includes('雪')) {
      suggestions.accessories.push('雪地靴', '防滑鞋');
      suggestions.tips.push('雪天路滑，注意防滑');
      suggestions.tips.push('穿着防水防滑的鞋子');
    }

    return suggestions;
  },

  getSolarTermInfo: function() {
    const solarTerms = [
      { name: '立春', date: '2月4日左右', desc: '春季开始，气温回升，万物复苏', season: '春' },
      { name: '雨水', date: '2月19日左右', desc: '降水增多，春雨绵绵，利于农耕', season: '春' },
      { name: '惊蛰', date: '3月5日左右', desc: '春雷惊醒蛰伏动物，气温回升加快', season: '春' },
      { name: '春分', date: '3月20日左右', desc: '昼夜平分，春季过半，气候温和', season: '春' },
      { name: '清明', date: '4月5日左右', desc: '天气晴朗温暖，草木繁茂，踏青时节', season: '春' },
      { name: '谷雨', date: '4月20日左右', desc: '雨水滋润谷物，降水增多，春播旺季', season: '春' },
      { name: '立夏', date: '5月5日左右', desc: '夏季开始，气温升高，雷雨增多', season: '夏' },
      { name: '小满', date: '5月21日左右', desc: '夏熟作物籽粒开始饱满，尚未成熟', season: '夏' },
      { name: '芒种', date: '6月5日左右', desc: '麦类等有芒作物成熟，夏播开始', season: '夏' },
      { name: '夏至', date: '6月21日左右', desc: '一年中白天最长，阳气最盛，酷暑开始', season: '夏' },
      { name: '小暑', date: '7月7日左右', desc: '开始炎热，但未到最热，初伏前后', season: '夏' },
      { name: '大暑', date: '7月23日左右', desc: '一年中最热，三伏天，高温多雨', season: '夏' },
      { name: '立秋', date: '8月7日左右', desc: '秋季开始，气温逐渐下降，收获季节', season: '秋' },
      { name: '处暑', date: '8月23日左右', desc: '炎热结束，气温下降，秋老虎', season: '秋' },
      { name: '白露', date: '9月7日左右', desc: '天气转凉，露凝而白，早晚温差大', season: '秋' },
      { name: '秋分', date: '9月23日左右', desc: '昼夜平分，秋季过半，秋高气爽', season: '秋' },
      { name: '寒露', date: '10月8日左右', desc: '露水已寒，气温更低，秋意渐浓', season: '秋' },
      { name: '霜降', date: '10月23日左右', desc: '开始降霜，气温骤降，初霜出现', season: '秋' },
      { name: '立冬', date: '11月7日左右', desc: '冬季开始，气温下降，收藏季节', season: '冬' },
      { name: '小雪', date: '11月22日左右', desc: '开始降雪，雪量较小，初雪', season: '冬' },
      { name: '大雪', date: '12月7日左右', desc: '降雪增多，雪量较大，气温更低', season: '冬' },
      { name: '冬至', date: '12月22日左右', desc: '一年中白天最短，数九寒天开始', season: '冬' },
      { name: '小寒', date: '1月5日左右', desc: '开始寒冷，三九前后，一年最冷', season: '冬' },
      { name: '大寒', date: '1月20日左右', desc: '一年中最冷，严寒至极，春节前后', season: '冬' }
    ];

    const month = new Date().getMonth() + 1;
    const day = new Date().getDate();

    let currentTerm;
    let nextTerm;

    for (let i = 0; i < solarTerms.length; i++) {
      const term = solarTerms[i];
      const termMonth = parseInt(term.date.match(/\d+/)[0]);
      const termDay = parseInt(term.date.match(/(\d+)日/)[1]);

      if (month === termMonth && day >= termDay) {
        currentTerm = term;
        nextTerm = solarTerms[(i + 1) % solarTerms.length];
      }
    }

    if (!currentTerm) {
      for (let i = solarTerms.length - 1; i >= 0; i--) {
        const term = solarTerms[i];
        const termMonth = parseInt(term.date.match(/\d+/)[0]);
        if (termMonth <= month) {
          currentTerm = term;
          nextTerm = solarTerms[(i + 1) % solarTerms.length];
          break;
        }
      }
    }

    return {
      current: currentTerm,
      next: nextTerm,
      all: solarTerms
    };
  },

  getCityCardInfo: function(cityId) {
    const city = this.getCityById(cityId);
    if (!city) return null;

    const weatherData = this.generateWeatherData(cityId);

    let terrainIcon;
    switch (city.terrain) {
      case '高原':
      case '高原谷地':
      case '高原盆地':
        terrainIcon = '🏔️';
        break;
      case '山地':
      case '山地丘陵':
        terrainIcon = '⛰️';
        break;
      case '盆地':
        terrainIcon = '🏕️';
        break;
      case '丘陵':
      case '丘陵平原':
      case '平原丘陵':
        terrainIcon = '🌄';
        break;
      default:
        if (city.id === 'sanya' || city.id === 'haikou' || city.id === 'xiamen' || city.id === 'qingdao') {
          terrainIcon = '🌊';
        } else {
          terrainIcon = '🌳';
        }
    }

    const disasterIcons = {
      '沙尘暴': '💨',
      '干旱': '☀️',
      '暴雨': '🌧️',
      '洪涝': '🌊',
      '台风': '🌀',
      '高温': '🌡️',
      '寒潮': '❄️',
      '暴雪': '❄️',
      '地质灾害': '🪨',
      '雷电': '⚡',
      '冰雹': '🧊',
      '低温': '🥶',
      '大风': '💨',
      '风暴潮': '🌊'
    };

    const disasterInfo = city.naturalDisasters.map(disaster => ({
      name: disaster,
      icon: disasterIcons[disaster] || '⚠️',
      reason: city.disasterReasons[disaster] || '地形气候因素导致'
    }));

    return {
      city: city,
      weather: weatherData.current,
      terrainIcon: terrainIcon,
      disasterInfo: disasterInfo,
      cardBg: this.getCardBackground(city.terrain)
    };
  },

  getCardBackground: function(terrain) {
    const backgrounds = {
      '高原': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      '高原谷地': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      '高原盆地': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      '山地': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      '山地丘陵': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      '盆地': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      '平原': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      '丘陵': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      '丘陵平原': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      '平原丘陵': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      '盆地边缘': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    return backgrounds[terrain] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
};

const APP_STATE = {
  currentPage: 'home',
  currentCityId: 'beijing',
  searchQuery: '',
  searchResults: [],
  compareCity1: null,
  compareCity2: null,
  favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
  checkInHistory: JSON.parse(localStorage.getItem('checkInHistory') || '[]'),
  userLocation: null,
  weatherData: null
};

function saveFavorites() {
  localStorage.setItem('favorites', JSON.stringify(APP_STATE.favorites));
}

function saveCheckInHistory() {
  localStorage.setItem('checkInHistory', JSON.stringify(APP_STATE.checkInHistory));
}

function toggleFavorite(cityId) {
  const index = APP_STATE.favorites.indexOf(cityId);
  if (index > -1) {
    APP_STATE.favorites.splice(index, 1);
  } else {
    APP_STATE.favorites.push(cityId);
  }
  saveFavorites();
  return index === -1;
}

function isFavorite(cityId) {
  return APP_STATE.favorites.includes(cityId);
}

function addCheckIn(cityId, weatherData) {
  const today = new Date().toISOString().split('T')[0];
  const existingCheckIn = APP_STATE.checkInHistory.find(
    c => c.cityId === cityId && c.date === today
  );

  if (existingCheckIn) {
    return { success: false, message: '今日已在该城市打卡' };
  }

  const checkIn = {
    id: Date.now(),
    cityId: cityId,
    cityName: weatherData.city.name,
    date: today,
    time: new Date().toLocaleTimeString('zh-CN'),
    weather: weatherData.current.weather,
    temp: weatherData.current.temp,
    icon: weatherData.current.icon,
    aqi: weatherData.aqi.value,
    terrain: weatherData.city.terrain
  };

  APP_STATE.checkInHistory.unshift(checkIn);
  saveCheckInHistory();
  return { success: true, data: checkIn };
}

function getTodayCheckIn(cityId) {
  const today = new Date().toISOString().split('T')[0];
  return APP_STATE.checkInHistory.find(
    c => c.cityId === cityId && c.date === today
  );
}

function generatePosterData(checkIn) {
  const city = WEATHER_DATA.getCityById(checkIn.cityId);
  const solarTerm = WEATHER_DATA.getSolarTermInfo();

  return {
    cityName: checkIn.cityName,
    date: checkIn.date,
    time: checkIn.time,
    weather: checkIn.weather,
    temp: checkIn.temp,
    icon: checkIn.icon,
    aqi: checkIn.aqi,
    terrain: checkIn.terrain,
    province: city.province,
    climateType: city.climateType,
    solarTerm: solarTerm.current,
    features: city.features,
    checkInId: checkIn.id
  };
}
