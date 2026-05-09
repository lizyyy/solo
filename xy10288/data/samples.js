const sampleData = {
    success: {
        vendors: [
            { id: 'v1', name: '张大爷', phone: '13800138001', category: '蔬菜', type: 'old' },
            { id: 'v2', name: '李大婶', phone: '13800138002', category: '蔬菜', type: 'old' },
            { id: 'v3', name: '王大叔', phone: '13800138003', category: '水果', type: 'old' },
            { id: 'v4', name: '赵阿姨', phone: '13800138004', category: '水果', type: 'old' },
            { id: 'v5', name: '刘师傅', phone: '13800138005', category: '服装', type: 'new' },
            { id: 'v6', name: '陈姐', phone: '13800138006', category: '服装', type: 'new' },
            { id: 'v7', name: '周大哥', phone: '13800138007', category: '水产', type: 'new' },
            { id: 'v8', name: '吴妈', phone: '13800138008', category: '水产', type: 'new' },
            { id: 'v9', name: '郑老板', phone: '13800138009', category: '熟食', type: 'old' },
            { id: 'v10', name: '孙小妹', phone: '13800138010', category: '熟食', type: 'new' }
        ],
        stalls: [
            { id: 's1', number: 'A1', zone: '东区', position: 1, status: 'available' },
            { id: 's2', number: 'A2', zone: '东区', position: 2, status: 'available' },
            { id: 's3', number: 'A3', zone: '东区', position: 3, status: 'available' },
            { id: 's4', number: 'A4', zone: '东区', position: 4, status: 'available' },
            { id: 's5', number: 'B1', zone: '西区', position: 5, status: 'available' },
            { id: 's6', number: 'B2', zone: '西区', position: 6, status: 'available' },
            { id: 's7', number: 'B3', zone: '西区', position: 7, status: 'available' },
            { id: 's8', number: 'B4', zone: '西区', position: 8, status: 'available' },
            { id: 's9', number: 'C1', zone: '南区', position: 9, status: 'available' },
            { id: 's10', number: 'C2', zone: '南区', position: 10, status: 'available' }
        ],
        categories: [
            { id: 'c1', name: '蔬菜' },
            { id: 'c2', name: '水果' },
            { id: 'c3', name: '服装' },
            { id: 'c4', name: '水产' },
            { id: 'c5', name: '熟食' }
        ],
        constraints: [
            { id: 'cons1', categoryA: '水产', categoryB: '服装' },
            { id: 'cons2', categoryA: '熟食', categoryB: '水产' }
        ],
        rules: {
            oldVendorPriority: true,
            categoryConstraint: true,
            randomize: true
        },
        results: [],
        isFrozen: false,
        lotteryLog: []
    },
    conflict: {
        vendors: [
            { id: 'v1', name: '张大爷', phone: '13800138001', category: '蔬菜', type: 'old' },
            { id: 'v2', name: '李大婶', phone: '13800138002', category: '蔬菜', type: 'old' },
            { id: 'v3', name: '王大叔', phone: '13800138003', category: '水果', type: 'old' },
            { id: 'v4', name: '赵阿姨', phone: '13800138004', category: '水果', type: 'old' },
            { id: 'v5', name: '刘师傅', phone: '13800138005', category: '服装', type: 'new' },
            { id: 'v6', name: '陈姐', phone: '13800138006', category: '服装', type: 'new' },
            { id: 'v7', name: '周大哥', phone: '13800138007', category: '水产', type: 'new' },
            { id: 'v8', name: '吴妈', phone: '13800138008', category: '水产', type: 'new' },
            { id: 'v9', name: '郑老板', phone: '13800138009', category: '熟食', type: 'old' },
            { id: 'v10', name: '孙小妹', phone: '13800138010', category: '熟食', type: 'new' },
            { id: 'v11', name: '钱哥', phone: '13800138011', category: '调料', type: 'new' },
            { id: 'v12', name: '黄姐', phone: '13800138012', category: '调料', type: 'old' }
        ],
        stalls: [
            { id: 's1', number: 'A1', zone: '东区', position: 1, status: 'available' },
            { id: 's2', number: 'A2', zone: '东区', position: 2, status: 'available' },
            { id: 's3', number: 'A3', zone: '东区', position: 3, status: 'available' },
            { id: 's4', number: 'A4', zone: '东区', position: 4, status: 'available' },
            { id: 's5', number: 'B1', zone: '西区', position: 5, status: 'available' },
            { id: 's6', number: 'B2', zone: '西区', position: 6, status: 'available' },
            { id: 's7', number: 'B3', zone: '西区', position: 7, status: 'available' },
            { id: 's8', number: 'B4', zone: '西区', position: 8, status: 'available' },
            { id: 's9', number: 'C1', zone: '南区', position: 9, status: 'available' },
            { id: 's10', number: 'C2', zone: '南区', position: 10, status: 'available' }
        ],
        categories: [
            { id: 'c1', name: '蔬菜' },
            { id: 'c2', name: '水果' },
            { id: 'c3', name: '服装' },
            { id: 'c4', name: '水产' },
            { id: 'c5', name: '熟食' },
            { id: 'c6', name: '调料' }
        ],
        constraints: [
            { id: 'cons1', categoryA: '水产', categoryB: '服装' },
            { id: 'cons2', categoryA: '熟食', categoryB: '水产' },
            { id: 'cons3', categoryA: '蔬菜', categoryB: '水果' },
            { id: 'cons4', categoryA: '调料', categoryB: '熟食' },
            { id: 'cons5', categoryA: '蔬菜', categoryB: '服装' }
        ],
        rules: {
            oldVendorPriority: true,
            categoryConstraint: true,
            randomize: true
        },
        results: [],
        isFrozen: false,
        lotteryLog: []
    }
};
