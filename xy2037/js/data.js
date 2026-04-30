const DB = {
    STORAGE_KEYS: {
        USERS: 'lost_found_users',
        LOST_ITEMS: 'lost_found_lost_items',
        FOUND_ITEMS: 'lost_found_found_items',
        MATCHES: 'lost_found_matches',
        CLAIMS: 'lost_found_claims',
        HANDOVERS: 'lost_found_handovers',
        POSTS: 'lost_found_posts',
        COMMENTS: 'lost_found_comments',
        LIKES: 'lost_found_likes',
        CURRENT_USER: 'lost_found_current_user',
        APP_VERSION: 'lost_found_version',
        CURRENT_CITY: 'lost_found_city'
    },

    APP_VERSION: '1.0.3',

    CITIES: {
        beijing: {
            name: '北京',
            centerLat: 39.908765,
            centerLng: 116.400000,
            hotspots: {
                '国贸': { lat: 39.916667, lng: 116.483333 },
                '中关村': { lat: 39.983334, lng: 116.316666 },
                '三里屯': { lat: 39.933334, lng: 116.450000 },
                '东直门': { lat: 39.941667, lng: 116.433334 },
                '西站': { lat: 39.894736, lng: 116.322451 },
                '天安门': { lat: 39.908765, lng: 116.400000 },
                '颐和园': { lat: 39.990000, lng: 116.270000 },
                '天坛': { lat: 39.860000, lng: 116.370000 },
                '朝阳大悦城': { lat: 39.935000, lng: 116.510000 },
                '海淀黄庄': { lat: 39.980000, lng: 116.310000 }
            }
        },
        shanghai: {
            name: '上海',
            centerLat: 31.230416,
            centerLng: 121.473701,
            hotspots: {
                '南京路': { lat: 31.235000, lng: 121.475000 },
                '外滩': { lat: 31.238000, lng: 121.490000 },
                '陆家嘴': { lat: 31.240000, lng: 121.501000 },
                '人民广场': { lat: 31.230000, lng: 121.473000 },
                '静安寺': { lat: 31.225000, lng: 121.448000 },
                '徐家汇': { lat: 31.195000, lng: 121.437000 },
                '虹桥站': { lat: 31.194000, lng: 121.321000 },
                '浦东机场': { lat: 31.144000, lng: 121.808000 },
                '迪士尼': { lat: 31.141000, lng: 121.657000 },
                '豫园': { lat: 31.222000, lng: 121.490000 }
            }
        },
        guangzhou: {
            name: '广州',
            centerLat: 23.129110,
            centerLng: 113.264385,
            hotspots: {
                '天河城': { lat: 23.137000, lng: 113.329000 },
                '珠江新城': { lat: 23.120000, lng: 113.330000 },
                '北京路': { lat: 23.125000, lng: 113.265000 },
                '广州站': { lat: 23.151000, lng: 113.256000 },
                '广州南站': { lat: 22.992000, lng: 113.206000 },
                '白云机场': { lat: 23.392000, lng: 113.299000 },
                '体育西路': { lat: 23.132000, lng: 113.328000 },
                '岗顶': { lat: 23.136000, lng: 113.352000 },
                '客村': { lat: 23.096000, lng: 113.329000 },
                '长隆': { lat: 23.004000, lng: 113.320000 }
            }
        },
        shenzhen: {
            name: '深圳',
            centerLat: 22.543096,
            centerLng: 114.057865,
            hotspots: {
                '福田': { lat: 22.522000, lng: 114.053000 },
                '南山': { lat: 22.536000, lng: 113.929000 },
                '罗湖': { lat: 22.543000, lng: 114.130000 },
                '宝安': { lat: 22.560000, lng: 113.883000 },
                '龙华': { lat: 22.653000, lng: 114.013000 },
                '深圳北站': { lat: 22.610000, lng: 114.030000 },
                '宝安机场': { lat: 22.635000, lng: 113.811000 },
                '科技园': { lat: 22.545000, lng: 113.952000 },
                '华强北': { lat: 22.546000, lng: 114.085000 },
                '世界之窗': { lat: 22.535000, lng: 113.971000 }
            }
        },
        hangzhou: {
            name: '杭州',
            centerLat: 30.274084,
            centerLng: 120.155070,
            hotspots: {
                '西湖': { lat: 30.250000, lng: 120.144000 },
                '武林广场': { lat: 30.267000, lng: 120.160000 },
                '湖滨': { lat: 30.253000, lng: 120.159000 },
                '杭州东站': { lat: 30.291000, lng: 120.213000 },
                '萧山机场': { lat: 30.229000, lng: 120.435000 },
                '阿里巴巴': { lat: 30.278000, lng: 120.022000 },
                '浙江大学': { lat: 30.305000, lng: 120.086000 },
                '河坊街': { lat: 30.243000, lng: 120.162000 },
                '钱江新城': { lat: 30.245000, lng: 120.202000 },
                '西溪湿地': { lat: 30.274000, lng: 120.049000 }
            }
        },
        chengdu: {
            name: '成都',
            centerLat: 30.572816,
            centerLng: 104.066801,
            hotspots: {
                '春熙路': { lat: 30.657000, lng: 104.082000 },
                '太古里': { lat: 30.655000, lng: 104.085000 },
                '天府广场': { lat: 30.659000, lng: 104.063000 },
                '成都东站': { lat: 30.621000, lng: 104.145000 },
                '双流机场': { lat: 30.570000, lng: 103.947000 },
                '天府机场': { lat: 30.315000, lng: 104.445000 },
                '锦里': { lat: 30.646000, lng: 104.048000 },
                '宽窄巷子': { lat: 30.664000, lng: 104.043000 },
                '环球中心': { lat: 30.567000, lng: 104.062000 },
                '大熊猫基地': { lat: 30.720000, lng: 104.100000 }
            }
        }
    },

    getCurrentCity() {
        const savedCity = this.load(this.STORAGE_KEYS.CURRENT_CITY);
        return savedCity || 'beijing';
    },

    setCurrentCity(cityKey) {
        if (this.CITIES[cityKey]) {
            this.save(this.STORAGE_KEYS.CURRENT_CITY, cityKey);
            return true;
        }
        return false;
    },

    getCityInfo(cityKey = null) {
        const city = cityKey || this.getCurrentCity();
        return this.CITIES[city] || this.CITIES['beijing'];
    },

    getAllCities() {
        return Object.entries(this.CITIES).map(([key, value]) => ({
            key,
            name: value.name
        }));
    },

    getLocationCoords(location, cityKey = null) {
        const city = this.getCityInfo(cityKey);
        
        for (const [key, coords] of Object.entries(city.hotspots)) {
            if (location.includes(key)) {
                return coords;
            }
        }

        return {
            lat: city.centerLat + (Math.random() - 0.5) * 0.1,
            lng: city.centerLng + (Math.random() - 0.5) * 0.15
        };
    },

    init() {
        const savedVersion = this.load(this.STORAGE_KEYS.APP_VERSION);
        const hasUsers = localStorage.getItem(this.STORAGE_KEYS.USERS) !== null;
        const hasLostItems = localStorage.getItem(this.STORAGE_KEYS.LOST_ITEMS) !== null;
        const hasFoundItems = localStorage.getItem(this.STORAGE_KEYS.FOUND_ITEMS) !== null;

        const needsInitialization = !hasUsers || !hasLostItems || !hasFoundItems || 
                                      savedVersion !== this.APP_VERSION;

        if (needsInitialization) {
            console.log('初始化数据...');
            this.initializeDemoData();
            this.save(this.STORAGE_KEYS.APP_VERSION, this.APP_VERSION);
        } else {
            console.log('数据已存在，跳过初始化');
        }

        if (!this.load(this.STORAGE_KEYS.CURRENT_CITY)) {
            this.save(this.STORAGE_KEYS.CURRENT_CITY, 'beijing');
        }
    },

    initializeDemoData() {
        const demoUsers = [
            { id: 'user_001', name: '张三', phone: '138****1234', avatar: '张', createTime: Date.now() },
            { id: 'user_002', name: '李四', phone: '139****5678', avatar: '李', createTime: Date.now() },
            { id: 'user_003', name: '王五', phone: '137****9012', avatar: '王', createTime: Date.now() }
        ];

        const demoLostItems = [
            {
                id: 'lost_001',
                userId: 'user_001',
                userName: '张三',
                title: '黑色皮质钱包',
                category: 'wallet',
                city: 'beijing',
                location: '北京市朝阳区国贸购物中心B1层',
                locationLat: 39.916667,
                locationLng: 116.483333,
                time: Date.now() - 86400000 * 2,
                description: '黑色Gucci皮质钱包，内有身份证、银行卡3张，现金约500元。钱包内侧有我的名字缩写"ZS"',
                features: ['黑色', 'Gucci', '皮质', '有姓名缩写'],
                images: [],
                question: '钱包内有多少现金？',
                answer: '500',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 2
            },
            {
                id: 'lost_002',
                userId: 'user_002',
                userName: '李四',
                title: 'iPhone 14 Pro 深空黑',
                category: 'electronics',
                city: 'beijing',
                location: '北京市海淀区中关村地铁站A口',
                locationLat: 39.983334,
                locationLng: 116.316666,
                time: Date.now() - 86400000,
                description: 'iPhone 14 Pro 256GB，深空黑色，手机壳是透明的，屏幕有轻微划痕。锁屏壁纸是一只猫。',
                features: ['iPhone 14 Pro', '深空黑', '透明手机壳', '猫壁纸'],
                images: [],
                question: '锁屏壁纸是什么？',
                answer: '猫',
                status: 'matched',
                matchedId: 'match_001',
                createTime: Date.now() - 86400000
            },
            {
                id: 'lost_003',
                userId: 'user_003',
                userName: '王五',
                title: '身份证',
                category: 'wallet',
                city: 'beijing',
                location: '北京市西城区北京西站南广场',
                locationLat: 39.894736,
                locationLng: 116.322451,
                time: Date.now() - 86400000 * 3,
                description: '身份证丢失，姓名王五，身份证号110101199001011234',
                features: ['身份证', '姓名王五'],
                images: [],
                question: '我的生日是哪天？',
                answer: '1990年1月1日',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 3
            },
            {
                id: 'lost_004',
                userId: 'user_001',
                userName: '张三',
                title: 'LV经典老花手袋',
                category: 'bag',
                city: 'shanghai',
                location: '上海市黄浦区南京东路步行街',
                locationLat: 31.235000,
                locationLng: 121.475000,
                time: Date.now() - 86400000 * 1,
                description: 'LV经典老花手提包，包内有化妆品和少量现金，包角有轻微磨损。',
                features: ['LV', '老花', '手提包'],
                images: [],
                question: '包内有什么？',
                answer: '化妆品',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 1
            },
            {
                id: 'lost_005',
                userId: 'user_002',
                userName: '李四',
                title: '黑色皮质公文包',
                category: 'bag',
                city: 'guangzhou',
                location: '广州市天河区天河城购物中心',
                locationLat: 23.137000,
                locationLng: 113.329000,
                time: Date.now() - 86400000 * 2,
                description: '黑色公文包，内有笔记本电脑和工作文件，对我非常重要。',
                features: ['黑色', '公文包', '有电脑'],
                images: [],
                question: '包内电脑是什么品牌？',
                answer: 'ThinkPad',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 2
            },
            {
                id: 'lost_006',
                userId: 'user_003',
                userName: '王五',
                title: '华为Mate 40 Pro',
                category: 'electronics',
                city: 'shenzhen',
                location: '深圳市南山区科技园南区',
                locationLat: 22.545000,
                locationLng: 113.952000,
                time: Date.now() - 86400000 * 0.5,
                description: '华为Mate 40 Pro，白色，手机壳是蓝色的，锁屏是家人照片。',
                features: ['华为', 'Mate 40 Pro', '白色', '蓝色手机壳'],
                images: [],
                question: '手机壳是什么颜色？',
                answer: '蓝色',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 0.5
            },
            {
                id: 'lost_007',
                userId: 'user_001',
                userName: '张三',
                title: '黑色折叠伞',
                category: 'other',
                city: 'hangzhou',
                location: '杭州市西湖区西湖景区',
                locationLat: 30.250000,
                locationLng: 120.144000,
                time: Date.now() - 86400000 * 1.5,
                description: '黑色折叠伞，品牌是蕉下，手柄有轻微磨损。',
                features: ['黑色', '折叠伞', '蕉下'],
                images: [],
                question: '雨伞是什么品牌？',
                answer: '蕉下',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 1.5
            },
            {
                id: 'lost_008',
                userId: 'user_002',
                userName: '李四',
                title: '银色机械键盘',
                category: 'electronics',
                city: 'chengdu',
                location: '成都市锦江区春熙路IFS',
                locationLat: 30.657000,
                locationLng: 104.082000,
                time: Date.now() - 86400000 * 3,
                description: 'FILCO圣手二代机械键盘，银轴，键盘底部有我的名字缩写。',
                features: ['FILCO', '机械键盘', '银轴'],
                images: [],
                question: '键盘是什么轴？',
                answer: '银轴',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 3
            },
            {
                id: 'lost_009',
                userId: 'user_001',
                userName: '张三',
                title: '黑色皮质钱包',
                category: 'wallet',
                city: 'beijing',
                location: '北京市朝阳区国贸购物中心B1层',
                locationLat: 39.916667,
                locationLng: 116.483333,
                time: Date.now() - 86400000 * 0.5,
                description: '黑色皮质钱包，品牌是Gucci，内有身份证、银行卡3张，现金约500元。钱包内侧有我的名字缩写"ZS"。',
                features: ['黑色', 'Gucci', '皮质', '有姓名缩写'],
                images: [],
                question: '钱包内有多少现金？',
                answer: '500',
                status: 'pending',
                matchedId: null,
                createTime: Date.now() - 86400000 * 0.5
            }
        ];

        const demoFoundItems = [
            {
                id: 'found_001',
                userId: 'user_003',
                userName: '王五',
                title: 'iPhone 14 Pro',
                category: 'electronics',
                city: 'beijing',
                location: '北京市海淀区中关村地铁站',
                locationLat: 39.984000,
                locationLng: 116.317000,
                time: Date.now() - 86400000 * 0.5,
                description: '在地铁站座椅上捡到一部手机，黑色，透明壳。',
                features: ['黑色', 'iPhone', '透明壳'],
                images: [],
                question: '锁屏壁纸是什么？',
                answer: '猫',
                documentType: null,
                documentNumber: null,
                maskedDescription: '在地铁站座椅上捡到一部手机，颜色**，品牌**，手机壳**。',
                status: 'matched',
                matchedId: 'match_001',
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 0.5
            },
            {
                id: 'found_002',
                userId: 'user_002',
                userName: '李四',
                title: '身份证一张',
                category: 'wallet',
                city: 'beijing',
                location: '北京市朝阳区三里屯太古里',
                locationLat: 39.933334,
                locationLng: 116.450000,
                time: Date.now() - 86400000 * 1.5,
                description: '在餐厅座位上捡到身份证一张，姓名：张**，身份证号部分显示。',
                features: ['身份证'],
                images: [],
                question: '身份证上的姓名是什么？',
                answer: '张三',
                documentType: 'id_card',
                documentNumber: '110101199001015678',
                maskedDocumentNumber: '110101********5678',
                maskedDescription: '在餐厅座位上捡到身份证一张，姓名：***，身份证号已打码保护。',
                status: 'pending',
                matchedId: null,
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 1.5
            },
            {
                id: 'found_003',
                userId: 'user_001',
                userName: '张三',
                title: '黑色双肩包',
                category: 'bag',
                city: 'beijing',
                location: '北京市东城区东直门地铁站',
                locationLat: 39.941667,
                locationLng: 116.433334,
                time: Date.now() - 86400000 * 4,
                description: '捡到黑色双肩包一个，品牌Nike，内有笔记本电脑和一些文件。',
                features: ['黑色', 'Nike', '双肩包'],
                images: [],
                question: '包内有什么品牌的电脑？',
                answer: 'MacBook',
                documentType: null,
                documentNumber: null,
                maskedDescription: '捡到**双肩包一个，品牌**，内有笔记本电脑和一些文件。',
                status: 'completed',
                matchedId: 'match_002',
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 4
            },
            {
                id: 'found_004',
                userId: 'user_003',
                userName: '王五',
                title: '卡地亚蓝气球手表',
                category: 'jewelry',
                city: 'shanghai',
                location: '上海市浦东新区陆家嘴',
                locationLat: 31.240000,
                locationLng: 121.501000,
                time: Date.now() - 86400000 * 1,
                description: '在商场卫生间捡到一块手表，银色表带，表盘有蓝色指针。',
                features: ['手表', '银色', '卡地亚'],
                images: [],
                question: '表盘指针是什么颜色？',
                answer: '蓝色',
                documentType: null,
                documentNumber: null,
                maskedDescription: '在商场捡到一块手表，表带颜色**，品牌**。',
                status: 'pending',
                matchedId: null,
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 1
            },
            {
                id: 'found_005',
                userId: 'user_001',
                userName: '张三',
                title: '棕色钱包',
                category: 'wallet',
                city: 'guangzhou',
                location: '广州市天河区珠江新城',
                locationLat: 23.120000,
                locationLng: 113.330000,
                time: Date.now() - 86400000 * 2,
                description: '在写字楼大堂捡到一个钱包，棕色皮质，内有银行卡几张。',
                features: ['棕色', '皮质', '钱包'],
                images: [],
                question: '钱包是什么颜色？',
                answer: '棕色',
                documentType: null,
                documentNumber: null,
                maskedDescription: '在写字楼捡到一个钱包，颜色**，材质**。',
                status: 'pending',
                matchedId: null,
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 2
            },
            {
                id: 'found_006',
                userId: 'user_002',
                userName: '李四',
                title: 'MacBook Pro 14寸',
                category: 'electronics',
                city: 'shenzhen',
                location: '深圳市南山区科技园',
                locationLat: 22.545000,
                locationLng: 113.952000,
                time: Date.now() - 86400000 * 0.5,
                description: '在咖啡厅捡到一台笔记本电脑，银色，外壳有贴纸。',
                features: ['MacBook', '银色', '有贴纸'],
                images: [],
                question: '电脑外壳有什么？',
                answer: '贴纸',
                documentType: null,
                documentNumber: null,
                maskedDescription: '在咖啡厅捡到一台笔记本电脑，颜色**，品牌**。',
                status: 'pending',
                matchedId: null,
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 0.5
            },
            {
                id: 'found_007',
                userId: 'user_002',
                userName: '李四',
                title: '黑色皮质钱包',
                category: 'wallet',
                city: 'beijing',
                location: '北京市朝阳区国贸购物中心B2层美食城',
                locationLat: 39.916600,
                locationLng: 116.483400,
                time: Date.now() - 86400000 * 0.3,
                description: '在美食城座位上捡到一个黑色皮质钱包，看起来是Gucci品牌，内有身份证、银行卡等物品。',
                features: ['黑色', 'Gucci', '皮质', '钱包'],
                images: [],
                question: '钱包内有多少现金？',
                answer: '500',
                documentType: null,
                documentNumber: null,
                maskedDescription: '在美食城捡到一个**皮质钱包，品牌**，内有身份证、银行卡等物品。',
                status: 'pending',
                matchedId: null,
                verifiedClaimants: [],
                createTime: Date.now() - 86400000 * 0.3
            }
        ];

        const demoMatches = [
            {
                id: 'match_001',
                lostItemId: 'lost_002',
                foundItemId: 'found_001',
                score: 92,
                matchFactors: {
                    category: 100,
                    location: 95,
                    time: 85,
                    keywords: 90
                },
                status: 'pending_verification',
                createTime: Date.now() - 43200000
            },
            {
                id: 'match_002',
                lostItemId: 'lost_004',
                foundItemId: 'found_003',
                score: 88,
                matchFactors: {
                    category: 100,
                    location: 80,
                    time: 90,
                    keywords: 85
                },
                status: 'completed',
                createTime: Date.now() - 86400000 * 3
            }
        ];

        const demoPosts = [
            {
                id: 'post_001',
                userId: 'user_001',
                userName: '张三',
                userAvatar: '张',
                type: 'thanks',
                title: '感谢好心人帮我找回钱包',
                content: '非常感谢李四同学在国贸购物中心捡到我的钱包并归还给我！钱包里的证件和现金都完好无损。在这里提醒大家出门一定要保管好自己的随身物品，同时也要向这位拾金不昧的好心人学习！',
                images: [],
                relatedItemId: null,
                likes: 24,
                comments: 5,
                shares: 3,
                canGeneratePoster: false,
                createTime: Date.now() - 86400000 * 2
            },
            {
                id: 'post_002',
                userId: 'user_003',
                userName: '王五',
                userAvatar: '王',
                type: 'found_story',
                title: '在地铁站捡到一部iPhone',
                content: '今天在中关村地铁站等车的时候，在座椅上发现了一部iPhone 14 Pro。手机还在开机状态，我一直原地等待了约30分钟，但没有人前来认领。现在已经交给地铁站服务中心，希望失主看到后能尽快联系认领。',
                images: [],
                relatedItemId: 'found_001',
                likes: 56,
                comments: 12,
                shares: 8,
                canGeneratePoster: true,
                createTime: Date.now() - 86400000
            },
            {
                id: 'post_003',
                userId: 'user_002',
                userName: '李四',
                userAvatar: '李',
                type: 'tip',
                title: '春节将至，分享几个防丢小技巧',
                content: '春节期间大家出行较多，分享几个实用的防丢小技巧：\n\n1. 重要证件（身份证、护照等）拍照备份到云端\n2. 在手机壳内侧放置写有联系方式的纸条\n3. 贵重物品放在视线可及的地方\n4. 使用蓝牙防丢器追踪贵重物品\n5. 离开座位时养成回头检查的习惯\n\n祝大家都能过一个安心愉快的春节！',
                images: [],
                relatedItemId: null,
                likes: 89,
                comments: 23,
                shares: 45,
                canGeneratePoster: false,
                createTime: Date.now() - 86400000 * 5
            }
        ];

        const demoComments = [
            {
                id: 'comment_001',
                postId: 'post_001',
                userId: 'user_002',
                userName: '李四',
                content: '拾金不昧是应该的，希望更多人能这样做！',
                createTime: Date.now() - 86400000 * 1.5
            },
            {
                id: 'comment_002',
                postId: 'post_001',
                userId: 'user_003',
                userName: '王五',
                content: '正能量满满！',
                createTime: Date.now() - 86400000
            },
            {
                id: 'comment_003',
                postId: 'post_002',
                userId: 'user_001',
                userName: '张三',
                content: '好人有好报！',
                createTime: Date.now() - 43200000
            }
        ];

        const demoLikes = [
            { id: 'like_001', postId: 'post_001', userId: 'user_002', createTime: Date.now() - 86400000 },
            { id: 'like_002', postId: 'post_001', userId: 'user_003', createTime: Date.now() - 43200000 },
            { id: 'like_003', postId: 'post_002', userId: 'user_001', createTime: Date.now() - 21600000 }
        ];

        const demoHandovers = [
            {
                id: 'handover_001',
                matchId: 'match_002',
                lostItemId: 'lost_004',
                foundItemId: 'found_003',
                lostUserId: 'user_004',
                foundUserId: 'user_001',
                location: '北京市东城区东直门地铁站服务中心',
                locationLat: 39.941667,
                locationLng: 116.433334,
                scheduledTime: Date.now() - 86400000 * 2,
                actualTime: Date.now() - 86400000 * 2,
                status: 'completed',
                confirmByLostUser: true,
                confirmByFoundUser: true,
                createTime: Date.now() - 86400000 * 3
            }
        ];

        this.save(this.STORAGE_KEYS.USERS, demoUsers);
        this.save(this.STORAGE_KEYS.LOST_ITEMS, demoLostItems);
        this.save(this.STORAGE_KEYS.FOUND_ITEMS, demoFoundItems);
        this.save(this.STORAGE_KEYS.MATCHES, demoMatches);
        this.save(this.STORAGE_KEYS.POSTS, demoPosts);
        this.save(this.STORAGE_KEYS.COMMENTS, demoComments);
        this.save(this.STORAGE_KEYS.LIKES, demoLikes);
        this.save(this.STORAGE_KEYS.HANDOVERS, demoHandovers);
        this.save(this.STORAGE_KEYS.CURRENT_USER, demoUsers[0]);
    },

    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    getCurrentUser() {
        return this.load(this.STORAGE_KEYS.CURRENT_USER);
    },

    setCurrentUser(user) {
        this.save(this.STORAGE_KEYS.CURRENT_USER, user);
    },

    getUsers() {
        return this.load(this.STORAGE_KEYS.USERS) || [];
    },

    getUserById(id) {
        const users = this.getUsers();
        return users.find(u => u.id === id);
    },

    getLostItems() {
        return this.load(this.STORAGE_KEYS.LOST_ITEMS) || [];
    },

    getLostItemById(id) {
        const items = this.getLostItems();
        return items.find(item => item.id === id);
    },

    saveLostItem(item) {
        const items = this.getLostItems();
        const existingIndex = items.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
            items[existingIndex] = item;
        } else {
            item.id = this.generateId('lost');
            item.createTime = Date.now();
            item.status = 'pending';
            item.matchedId = null;
            item.city = this.getCurrentCity();
            items.push(item);
        }
        this.save(this.STORAGE_KEYS.LOST_ITEMS, items);
        return item;
    },

    getLostItemsByCity(cityKey = null) {
        const items = this.getLostItems();
        if (!cityKey) {
            cityKey = this.getCurrentCity();
        }
        return items.filter(item => item.city === cityKey);
    },

    getFoundItems() {
        return this.load(this.STORAGE_KEYS.FOUND_ITEMS) || [];
    },

    getFoundItemsByCity(cityKey = null) {
        const items = this.getFoundItems();
        if (!cityKey) {
            cityKey = this.getCurrentCity();
        }
        return items.filter(item => item.city === cityKey);
    },

    getFoundItemById(id) {
        const items = this.getFoundItems();
        return items.find(item => item.id === id);
    },

    saveFoundItem(item) {
        const items = this.getFoundItems();
        const existingIndex = items.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
            items[existingIndex] = item;
        } else {
            item.id = this.generateId('found');
            item.createTime = Date.now();
            item.status = 'pending';
            item.matchedId = null;
            item.verifiedClaimants = item.verifiedClaimants || [];
            item.city = this.getCurrentCity();
            items.push(item);
        }
        this.save(this.STORAGE_KEYS.FOUND_ITEMS, items);
        return item;
    },

    getMatches() {
        return this.load(this.STORAGE_KEYS.MATCHES) || [];
    },

    getMatchById(id) {
        const matches = this.getMatches();
        return matches.find(m => m.id === id);
    },

    saveMatch(match) {
        const matches = this.getMatches();
        const existingIndex = matches.findIndex(m => m.id === match.id);
        if (existingIndex >= 0) {
            matches[existingIndex] = match;
        } else {
            match.id = this.generateId('match');
            match.createTime = Date.now();
            matches.push(match);
        }
        this.save(this.STORAGE_KEYS.MATCHES, matches);
        return match;
    },

    getMatchesByItem(itemId, itemType) {
        const matches = this.getMatches();
        if (itemType === 'lost') {
            return matches.filter(m => m.lostItemId === itemId);
        } else {
            return matches.filter(m => m.foundItemId === itemId);
        }
    },

    getHandovers() {
        return this.load(this.STORAGE_KEYS.HANDOVERS) || [];
    },

    getHandoverById(id) {
        const handovers = this.getHandovers();
        return handovers.find(h => h.id === id);
    },

    getHandoverByMatchId(matchId) {
        const handovers = this.getHandovers();
        return handovers.find(h => h.matchId === matchId);
    },

    saveHandover(handover) {
        const handovers = this.getHandovers();
        const existingIndex = handovers.findIndex(h => h.id === handover.id);
        if (existingIndex >= 0) {
            handovers[existingIndex] = handover;
        } else {
            handover.id = this.generateId('handover');
            handover.createTime = Date.now();
            handovers.push(handover);
        }
        this.save(this.STORAGE_KEYS.HANDOVERS, handovers);
        return handover;
    },

    getPosts() {
        return this.load(this.STORAGE_KEYS.POSTS) || [];
    },

    getPostById(id) {
        const posts = this.getPosts();
        return posts.find(p => p.id === id);
    },

    savePost(post) {
        const posts = this.getPosts();
        const existingIndex = posts.findIndex(p => p.id === post.id);
        if (existingIndex >= 0) {
            posts[existingIndex] = post;
        } else {
            post.id = this.generateId('post');
            post.createTime = Date.now();
            post.likes = 0;
            post.comments = 0;
            post.shares = 0;
            posts.unshift(post);
        }
        this.save(this.STORAGE_KEYS.POSTS, posts);
        return post;
    },

    getComments() {
        return this.load(this.STORAGE_KEYS.COMMENTS) || [];
    },

    getCommentsByPostId(postId) {
        const comments = this.getComments();
        return comments.filter(c => c.postId === postId);
    },

    saveComment(comment) {
        const comments = this.getComments();
        comment.id = this.generateId('comment');
        comment.createTime = Date.now();
        comments.push(comment);
        this.save(this.STORAGE_KEYS.COMMENTS, comments);

        const posts = this.getPosts();
        const postIndex = posts.findIndex(p => p.id === comment.postId);
        if (postIndex >= 0) {
            posts[postIndex].comments += 1;
            this.save(this.STORAGE_KEYS.POSTS, posts);
        }
        return comment;
    },

    getLikes() {
        return this.load(this.STORAGE_KEYS.LIKES) || [];
    },

    getLikesByPostId(postId) {
        const likes = this.getLikes();
        return likes.filter(l => l.postId === postId);
    },

    toggleLike(postId, userId) {
        const likes = this.getLikes();
        const existingIndex = likes.findIndex(l => l.postId === postId && l.userId === userId);
        
        const posts = this.getPosts();
        const postIndex = posts.findIndex(p => p.id === postId);
        
        if (existingIndex >= 0) {
            likes.splice(existingIndex, 1);
            if (postIndex >= 0) {
                posts[postIndex].likes -= 1;
            }
            this.save(this.STORAGE_KEYS.LIKES, likes);
            this.save(this.STORAGE_KEYS.POSTS, posts);
            return false;
        } else {
            likes.push({
                id: this.generateId('like'),
                postId,
                userId,
                createTime: Date.now()
            });
            if (postIndex >= 0) {
                posts[postIndex].likes += 1;
            }
            this.save(this.STORAGE_KEYS.LIKES, likes);
            this.save(this.STORAGE_KEYS.POSTS, posts);
            return true;
        }
    },

    hasUserLiked(postId, userId) {
        const likes = this.getLikes();
        return likes.some(l => l.postId === postId && l.userId === userId);
    },

    getStats() {
        const lostItems = this.getLostItems();
        const foundItems = this.getFoundItems();
        const matches = this.getMatches();
        const handovers = this.getHandovers();

        return {
            lostCount: lostItems.length,
            foundCount: foundItems.length,
            matchedCount: matches.filter(m => m.status !== 'pending').length,
            completedCount: handovers.filter(h => h.status === 'completed').length
        };
    },

    getHeatmapData(cityKey = null) {
        const city = this.getCityInfo(cityKey);
        const lostItems = this.getLostItems();
        const foundItems = this.getFoundItems();
        
        const allItems = [...lostItems, ...foundItems];
        const heatmapData = [];
        
        const locationGroups = {};
        allItems.forEach(item => {
            if (item.locationLat && item.locationLng) {
                const key = `${item.locationLat.toFixed(3)}_${item.locationLng.toFixed(3)}`;
                if (!locationGroups[key]) {
                    locationGroups[key] = {
                        lat: item.locationLat,
                        lng: item.locationLng,
                        count: 0
                    };
                }
                locationGroups[key].count += 1;
            }
        });

        const counts = [15, 12, 10, 8, 6, 20, 14, 9, 7, 11];
        let countIndex = 0;
        Object.values(city.hotspots).forEach(coords => {
            heatmapData.push([coords.lat, coords.lng, counts[countIndex % counts.length]]);
            countIndex++;
        });

        Object.values(locationGroups).forEach(group => {
            const existing = heatmapData.find(d => 
                Math.abs(d[0] - group.lat) < 0.01 && Math.abs(d[1] - group.lng) < 0.01
            );
            if (!existing) {
                heatmapData.push([group.lat, group.lng, group.count]);
            }
        });

        return heatmapData;
    }
};

DB.init();
