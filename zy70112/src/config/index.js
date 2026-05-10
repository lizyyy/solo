module.exports = {
    port: process.env.PORT || 3000,
    dbPath: process.env.DB_PATH || './data/reports.db',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    business: {
        validCropTypes: ['小麦', '玉米', '水稻', '大豆', '棉花', '油菜', '花生', '蔬菜'],
        validDisasterTypes: ['洪涝', '干旱', '冰雹', '台风', '暴雨', '低温冻害', '病虫害', '其他'],
        reportStatuses: {
            DRAFT: '草稿',
            SUBMITTED: '已提交',
            DISPATCHED: '已派工',
            INSPECTED: '已查勘',
            APPROVED: '已赔付',
            REJECTED: '已驳回',
            CLOSED: '已结案'
        },
        photoTypes: ['灾害全景', '作物特写', '地块边界', '灾害细节', '对比照片'],
        dispatchStatuses: ['PENDING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
        statusTransitions: {
            DRAFT: ['SUBMITTED'],
            SUBMITTED: ['DISPATCHED', 'REJECTED'],
            DISPATCHED: ['INSPECTED', 'REJECTED'],
            INSPECTED: ['APPROVED', 'REJECTED'],
            APPROVED: ['CLOSED'],
            REJECTED: ['SUBMITTED', 'CLOSED'],
            CLOSED: []
        }
    }
};
