"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleScenarios = void 0;
exports.getAllSampleData = getAllSampleData;
const BASE_TIME = Date.now();
function minutesBefore(minutes) {
    return BASE_TIME - minutes * 60 * 1000;
}
function minutesAfter(base, minutes) {
    return base + minutes * 60 * 1000;
}
exports.sampleScenarios = [
    {
        name: '超时申诉 - 商家出餐晚',
        description: '骑手按时接单，但商家出餐慢导致超时',
        orders: [{
                orderNo: 'ORDER-TIMEOUT-001',
                riderId: 'RIDER-001',
                riderName: '张三',
                merchantId: 'MERCHANT-001',
                merchantName: '老北京炸酱面馆',
                userId: 'USER-001',
                userName: '李先生',
                merchantAddress: '北京市朝阳区建国路88号',
                deliveryAddress: '北京市朝阳区万达广场A座1501',
                estimatedDeliveryTime: 30 * 60 * 1000,
                actualDeliveryTime: minutesAfter(minutesBefore(120), 55),
                promisedTime: minutesBefore(120) + 45 * 60 * 1000,
                createTime: minutesBefore(120),
                acceptTime: minutesBefore(118),
                arriveMerchantTime: minutesBefore(112),
                pickUpTime: minutesBefore(95),
                deliverTime: minutesAfter(minutesBefore(120), 55),
                status: 'completed'
            }],
        trajectories: (() => {
            const orderStart = minutesBefore(118);
            const points = [];
            for (let i = 0; i <= 55; i += 2) {
                points.push({
                    orderNo: 'ORDER-TIMEOUT-001',
                    riderId: 'RIDER-001',
                    timestamp: minutesAfter(orderStart, i),
                    latitude: 39.9042 + i * 0.001,
                    longitude: 116.4074 + i * 0.001,
                    speed: i > 0 && i < 25 ? 0 : 15,
                    eventType: i > 0 && i < 25 ? 'idle' : 'moving'
                });
            }
            return points;
        })(),
        merchantMeals: [{
                orderNo: 'ORDER-TIMEOUT-001',
                merchantId: 'MERCHANT-001',
                expectedReadyTime: minutesAfter(minutesBefore(120), 12),
                actualReadyTime: minutesAfter(minutesBefore(120), 25),
                prepareStartTime: minutesAfter(minutesBefore(120), 10),
                note: '高峰期出餐缓慢'
            }],
        weatherEvents: [],
        penalties: [{
                orderNo: 'ORDER-TIMEOUT-001',
                riderId: 'RIDER-001',
                penaltyType: 'timeout',
                penaltyAmount: 50.00,
                penaltyReason: '超时10分钟，影响用户体验',
                createTime: minutesBefore(100),
                status: 'active'
            }],
        appeals: [{
                orderNo: 'ORDER-TIMEOUT-001',
                riderId: 'RIDER-001',
                appealType: 'timeout',
                appealReason: '商家出餐慢，我已经及时到店等待，不是我的责任',
                submitTime: minutesBefore(90)
            }]
    },
    {
        name: '超时申诉 - 暴雨天气',
        description: '配送过程中遭遇暴雨，配送延误',
        orders: [{
                orderNo: 'ORDER-TIMEOUT-002',
                riderId: 'RIDER-002',
                riderName: '李四',
                merchantId: 'MERCHANT-002',
                merchantName: '上海小笼包',
                userId: 'USER-002',
                userName: '王女士',
                merchantAddress: '上海市浦东新区陆家嘴环路1000号',
                deliveryAddress: '上海市浦东新区世纪公园附近',
                estimatedDeliveryTime: 25 * 60 * 1000,
                actualDeliveryTime: minutesAfter(minutesBefore(80), 70),
                promisedTime: minutesBefore(80) + 40 * 60 * 1000,
                createTime: minutesBefore(80),
                acceptTime: minutesBefore(78),
                arriveMerchantTime: minutesBefore(72),
                pickUpTime: minutesBefore(68),
                deliverTime: minutesAfter(minutesBefore(80), 70),
                status: 'completed'
            }],
        trajectories: (() => {
            const orderStart = minutesBefore(78);
            const points = [];
            for (let i = 0; i <= 70; i += 3) {
                points.push({
                    orderNo: 'ORDER-TIMEOUT-002',
                    riderId: 'RIDER-002',
                    timestamp: minutesAfter(orderStart, i),
                    latitude: 31.2304 + i * 0.0008,
                    longitude: 121.4737 + i * 0.0008,
                    speed: i > 20 && i < 50 ? 5 : 15,
                    eventType: 'moving',
                    accuracy: i > 20 && i < 50 ? 50 : 10
                });
            }
            return points;
        })(),
        merchantMeals: [{
                orderNo: 'ORDER-TIMEOUT-002',
                merchantId: 'MERCHANT-002',
                expectedReadyTime: minutesAfter(minutesBefore(80), 10),
                actualReadyTime: minutesAfter(minutesBefore(80), 12),
                prepareStartTime: minutesAfter(minutesBefore(80), 5)
            }],
        weatherEvents: [{
                city: '上海',
                region: '浦东新区',
                startTime: minutesBefore(90),
                endTime: minutesBefore(10),
                weatherType: 'heavy_rain',
                description: '雷暴红色预警，短时强降雨',
                intensity: 'heavy'
            }],
        penalties: [{
                orderNo: 'ORDER-TIMEOUT-002',
                riderId: 'RIDER-002',
                penaltyType: 'timeout',
                penaltyAmount: 30.00,
                penaltyReason: '超时30分钟',
                createTime: minutesBefore(5),
                status: 'active'
            }],
        appeals: [{
                orderNo: 'ORDER-TIMEOUT-002',
                riderId: 'RIDER-002',
                appealType: 'timeout',
                appealReason: '配送途中遭遇特大暴雨，无法正常行驶，有天气记录为证',
                submitTime: minutesBefore(3)
            }]
    },
    {
        name: '差评申诉',
        description: '用户给差评，但责任在商家出餐慢',
        orders: [{
                orderNo: 'ORDER-REVIEW-001',
                riderId: 'RIDER-003',
                riderName: '王五',
                merchantId: 'MERCHANT-003',
                merchantName: '川味火锅外卖',
                userId: 'USER-003',
                userName: '陈先生',
                merchantAddress: '广州市天河区体育西路',
                deliveryAddress: '广州市天河区珠江新城',
                estimatedDeliveryTime: 35 * 60 * 1000,
                actualDeliveryTime: minutesAfter(minutesBefore(150), 65),
                promisedTime: minutesBefore(150) + 50 * 60 * 1000,
                createTime: minutesBefore(150),
                acceptTime: minutesBefore(148),
                arriveMerchantTime: minutesBefore(140),
                pickUpTime: minutesBefore(115),
                deliverTime: minutesAfter(minutesBefore(150), 65),
                status: 'completed'
            }],
        trajectories: (() => {
            const orderStart = minutesBefore(148);
            const points = [];
            for (let i = 0; i <= 65; i += 2) {
                points.push({
                    orderNo: 'ORDER-REVIEW-001',
                    riderId: 'RIDER-003',
                    timestamp: minutesAfter(orderStart, i),
                    latitude: 23.1291 + i * 0.001,
                    longitude: 113.2644 + i * 0.001,
                    speed: i > 8 && i < 33 ? 0 : 18,
                    eventType: i > 8 && i < 33 ? 'idle' : 'moving'
                });
            }
            return points;
        })(),
        merchantMeals: [{
                orderNo: 'ORDER-REVIEW-001',
                merchantId: 'MERCHANT-003',
                expectedReadyTime: minutesAfter(minutesBefore(150), 15),
                actualReadyTime: minutesAfter(minutesBefore(150), 35),
                prepareStartTime: minutesAfter(minutesBefore(150), 8),
                note: '高峰期，火锅准备时间长'
            }],
        weatherEvents: [],
        penalties: [{
                orderNo: 'ORDER-REVIEW-001',
                riderId: 'RIDER-003',
                penaltyType: 'bad_review',
                penaltyAmount: 100.00,
                penaltyReason: '用户差评，投诉配送慢',
                createTime: minutesBefore(80),
                status: 'active'
            }],
        appeals: [{
                orderNo: 'ORDER-REVIEW-001',
                riderId: 'RIDER-003',
                appealType: 'bad_review',
                appealReason: '用户差评是因为商家出餐太慢，我到店等了25分钟才拿到餐，取餐后配送正常',
                submitTime: minutesBefore(75)
            }]
    },
    {
        name: '取消单申诉',
        description: '用户取消订单，不是骑手责任',
        orders: [{
                orderNo: 'ORDER-CANCEL-001',
                riderId: 'RIDER-004',
                riderName: '赵六',
                merchantId: 'MERCHANT-004',
                merchantName: '日式料理寿司店',
                userId: 'USER-004',
                userName: '刘女士',
                merchantAddress: '深圳市南山区科技园',
                deliveryAddress: '深圳市南山区深圳大学',
                estimatedDeliveryTime: 30 * 60 * 1000,
                promisedTime: minutesBefore(200) + 45 * 60 * 1000,
                createTime: minutesBefore(200),
                acceptTime: minutesBefore(198),
                arriveMerchantTime: minutesBefore(190),
                status: 'cancelled',
                cancelReason: '用户不想吃了，主动取消',
                cancelTime: minutesBefore(175),
                cancelInitiator: 'user'
            }],
        trajectories: (() => {
            const orderStart = minutesBefore(198);
            const points = [];
            for (let i = 0; i <= 23; i += 1) {
                points.push({
                    orderNo: 'ORDER-CANCEL-001',
                    riderId: 'RIDER-004',
                    timestamp: minutesAfter(orderStart, i),
                    latitude: 22.5431 + i * 0.0015,
                    longitude: 114.0579 + i * 0.0015,
                    speed: 18,
                    eventType: 'moving'
                });
            }
            return points;
        })(),
        merchantMeals: [{
                orderNo: 'ORDER-CANCEL-001',
                merchantId: 'MERCHANT-004',
                expectedReadyTime: minutesAfter(minutesBefore(200), 12),
                actualReadyTime: minutesAfter(minutesBefore(200), 11),
                prepareStartTime: minutesAfter(minutesBefore(200), 5)
            }],
        weatherEvents: [],
        penalties: [{
                orderNo: 'ORDER-CANCEL-001',
                riderId: 'RIDER-004',
                penaltyType: 'cancellation',
                penaltyAmount: 20.00,
                penaltyReason: '订单取消',
                createTime: minutesBefore(170),
                status: 'active'
            }],
        appeals: [{
                orderNo: 'ORDER-CANCEL-001',
                riderId: 'RIDER-004',
                appealType: 'cancellation',
                appealReason: '用户主动取消订单，我已经在前往商家的路上，没有任何责任',
                submitTime: minutesBefore(165)
            }]
    },
    {
        name: '失败案例 - 无证据超时申诉',
        description: '骑手申诉超时，但缺少轨迹和商家数据，无法证明非己责任',
        orders: [{
                orderNo: 'ORDER-FAIL-001',
                riderId: 'RIDER-005',
                riderName: '孙七',
                merchantId: 'MERCHANT-005',
                merchantName: '中式快餐店',
                userId: 'USER-005',
                userName: '周先生',
                merchantAddress: '杭州市西湖区文三路',
                deliveryAddress: '杭州市西湖区古墩路',
                estimatedDeliveryTime: 20 * 60 * 1000,
                actualDeliveryTime: minutesAfter(minutesBefore(50), 45),
                promisedTime: minutesBefore(50) + 30 * 60 * 1000,
                createTime: minutesBefore(50),
                acceptTime: minutesBefore(48),
                deliverTime: minutesAfter(minutesBefore(50), 45),
                status: 'completed'
            }],
        trajectories: [],
        merchantMeals: [],
        weatherEvents: [],
        penalties: [{
                orderNo: 'ORDER-FAIL-001',
                riderId: 'RIDER-005',
                penaltyType: 'timeout',
                penaltyAmount: 25.00,
                penaltyReason: '超时15分钟',
                createTime: minutesBefore(5),
                status: 'active'
            }],
        appeals: [{
                orderNo: 'ORDER-FAIL-001',
                riderId: 'RIDER-005',
                appealType: 'timeout',
                appealReason: '不是我慢，是商家出餐慢',
                submitTime: minutesBefore(3)
            }]
    }
];
function getAllSampleData() {
    const allOrders = [];
    const allTrajectories = [];
    const allMeals = [];
    const allWeather = [];
    const allPenalties = [];
    const allAppeals = [];
    exports.sampleScenarios.forEach(scenario => {
        allOrders.push(...scenario.orders);
        allTrajectories.push(...scenario.trajectories);
        allMeals.push(...scenario.merchantMeals);
        allWeather.push(...scenario.weatherEvents);
        allPenalties.push(...scenario.penalties);
        allAppeals.push(...scenario.appeals);
    });
    return {
        orders: allOrders,
        trajectories: allTrajectories,
        merchantMeals: allMeals,
        weatherEvents: allWeather,
        penalties: allPenalties,
        appeals: allAppeals,
        scenarios: exports.sampleScenarios
    };
}
//# sourceMappingURL=sampleData.js.map