const GIS_DATA = {
    buildings: [
        {
            id: 'building-1',
            name: '研发中心A座',
            floors: [1, 2, 3],
            position: { x: 100, y: 100 },
            width: 600,
            height: 400
        }
    ],
    devices: [
        {
            id: 'gis-cam-001',
            name: '摄像头-001',
            type: 'camera',
            floor: 1,
            position: { x: 200, y: 200 },
            coords: { lat: 39.9042, lng: 116.4074 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-01-15'
        },
        {
            id: 'gis-cam-002',
            name: '摄像头-002',
            type: 'camera',
            floor: 1,
            position: { x: 400, y: 200 },
            coords: { lat: 39.9043, lng: 116.4075 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-01-16'
        },
        {
            id: 'gis-sensor-001',
            name: '传感器-001',
            type: 'sensor',
            floor: 2,
            position: { x: 300, y: 300 },
            coords: { lat: 39.9044, lng: 116.4076 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-01-20'
        },
        {
            id: 'gis-gateway-001',
            name: '网关-A1',
            type: 'gateway',
            floor: 2,
            position: { x: 500, y: 250 },
            coords: { lat: 39.9045, lng: 116.4077 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-02-01'
        },
        {
            id: 'gis-cam-003',
            name: '摄像头-003',
            type: 'camera',
            floor: 3,
            position: { x: 250, y: 350 },
            coords: { lat: 39.9046, lng: 116.4078 },
            status: 'offline',
            hasPhoto: true,
            installDate: '2024-02-10'
        },
        {
            id: 'gis-sensor-002',
            name: '传感器-002',
            type: 'sensor',
            floor: 3,
            position: { x: 450, y: 200 },
            coords: { lat: 39.9047, lng: 116.4079 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-02-12'
        }
    ]
};

const IMPORT_DATA = {
    devices: [
        {
            id: 'imp-cam-001',
            name: 'CAM-001',
            type: 'camera',
            floor: 1,
            position: { x: 210, y: 210 },
            coords: { lat: 39.90425, lng: 116.40745 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-01-15',
            detectedAnomalies: ['temperature']
        },
        {
            id: 'imp-cam-002',
            name: '摄像头-002',
            type: 'camera',
            floor: 1,
            position: { x: 400, y: 200 },
            coords: { lat: 39.9043, lng: 116.4075 },
            status: 'warning',
            hasPhoto: false,
            installDate: '2024-01-16',
            detectedAnomalies: ['no-photo']
        },
        {
            id: 'imp-sensor-001',
            name: '传感器-001',
            type: 'sensor',
            floor: 2,
            position: { x: 300, y: 300 },
            coords: { lat: 39.9044, lng: 116.4076 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-01-20',
            detectedAnomalies: ['cross-floor']
        },
        {
            id: 'imp-gateway-001',
            name: '网关-A1',
            type: 'gateway',
            floor: 2,
            position: { x: 500, y: 250 },
            coords: { lat: 39.9045, lng: 116.4077 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-02-01',
            detectedAnomalies: []
        },
        {
            id: 'imp-cam-003',
            name: '摄像头-003',
            type: 'camera',
            floor: 3,
            position: { x: 250, y: 350 },
            coords: { lat: 39.9046, lng: 116.4078 },
            status: 'offline',
            hasPhoto: true,
            installDate: '2024-02-10',
            detectedAnomalies: ['offline']
        },
        {
            id: 'imp-sensor-002',
            name: '传感器-002-B',
            type: 'sensor',
            floor: 3,
            position: { x: 450, y: 200 },
            coords: { lat: 39.9047, lng: 116.4079 },
            status: 'online',
            hasPhoto: true,
            installDate: '2024-02-12',
            detectedAnomalies: ['name-mismatch']
        }
    ]
};

const ANOMALIES = [
    {
        id: 'anomaly-001',
        type: 'coordinate-offset',
        level: 'warning',
        title: '坐标偏移',
        description: 'CAM-001 坐标存在偏移，GIS与导入数据偏差约5米',
        deviceId: 'imp-cam-001',
        gisDeviceId: 'gis-cam-001',
        floor: 1,
        affectedPositions: [
            { x: 200, y: 200 },
            { x: 210, y: 210 }
        ]
    },
    {
        id: 'anomaly-002',
        type: 'name-mismatch',
        level: 'warning',
        title: '设备命名不一致',
        description: '同一设备存在两个名称："传感器-002" 和 "传感器-002-B"',
        deviceId: 'imp-sensor-002',
        gisDeviceId: 'gis-sensor-002',
        floor: 3,
        affectedPositions: [{ x: 450, y: 200 }]
    },
    {
        id: 'anomaly-003',
        type: 'no-photo',
        level: 'info',
        title: '缺少现场照片',
        description: '摄像头-002 缺少现场验收照片',
        deviceId: 'imp-cam-002',
        gisDeviceId: 'gis-cam-002',
        floor: 1,
        affectedPositions: [{ x: 400, y: 200 }]
    },
    {
        id: 'anomaly-004',
        type: 'cross-floor',
        level: 'critical',
        title: '跨楼层异常连接',
        description: '检测到传感器-001（2层）与摄像头-003（3层）存在异常数据链路',
        deviceId: 'imp-sensor-001',
        gisDeviceId: 'gis-sensor-001',
        floor: 2,
        targetFloor: 3,
        affectedPositions: [
            { x: 300, y: 300, floor: 2 },
            { x: 250, y: 350, floor: 3 }
        ]
    },
    {
        id: 'anomaly-005',
        type: 'offline',
        level: 'critical',
        title: '设备离线',
        description: '摄像头-003 已离线超过72小时',
        deviceId: 'imp-cam-003',
        gisDeviceId: 'gis-cam-003',
        floor: 3,
        affectedPositions: [{ x: 250, y: 350 }]
    }
];

const DATA_CONFLICTS = [
    {
        id: 'conflict-001',
        type: 'coordinate',
        title: '坐标数据冲突',
        description: 'CAM-001 坐标信息不一致',
        gisData: {
            name: '摄像头-001',
            position: { x: 200, y: 200 },
            coords: { lat: 39.9042, lng: 116.4074 }
        },
        importData: {
            name: 'CAM-001',
            position: { x: 210, y: 210 },
            coords: { lat: 39.90425, lng: 116.40745 }
        },
        suggestions: [
            '建议现场复核，使用高精度GPS重新测量',
            '可暂时以GIS底图为准，标注待复核',
            '检查导入数据的坐标系统（WGS84/GCJ02）'
        ]
    },
    {
        id: 'conflict-002',
        type: 'name',
        title: '设备命名冲突',
        description: '传感器-002 命名不一致',
        gisData: {
            name: '传感器-002',
            id: 'gis-sensor-002'
        },
        importData: {
            name: '传感器-002-B',
            id: 'imp-sensor-002'
        },
        suggestions: [
            '建议统一设备命名规范',
            '确认是否为同一设备的不同编号',
            '检查设备管理系统中的主数据'
        ]
    },
    {
        id: 'conflict-003',
        type: 'photo',
        title: '照片状态冲突',
        description: '摄像头-002 照片状态不一致',
        gisData: {
            hasPhoto: true,
            lastUpdate: '2024-01-16'
        },
        importData: {
            hasPhoto: false,
            lastUpdate: '2024-06-01'
        },
        suggestions: [
            '建议近期重新拍摄并上传照片',
            'GIS数据可能未及时更新',
            '可标记为待补录'
        ]
    }
];
