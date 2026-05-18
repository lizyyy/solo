const { run, get, beginTransaction, commit, rollback } = require('../database/db');

const maintenanceTeams = [
    {
        team_code: 'TEAM-001',
        team_name: '绿苑第一养护队',
        leader_name: '张建国',
        leader_phone: '13800138001',
        responsible_area: '东区公园、市民广场'
    },
    {
        team_code: 'TEAM-002',
        team_name: '绿苑第二养护队',
        leader_name: '李秀英',
        leader_phone: '13800138002',
        responsible_area: '西区绿化带、滨江路'
    }
];

const greenPlants = [
    {
        plant_code: 'PLANT-E001',
        plant_name: '香樟树',
        plant_type: '乔木',
        location_area: '东区公园A区',
        location_detail: '主入口左侧第3棵',
        planting_date: '2018-03-15',
        maintenance_level: 'A级',
        status: '正常'
    },
    {
        plant_code: 'PLANT-E002',
        plant_name: '桂花树',
        plant_type: '乔木',
        location_area: '东区公园B区',
        location_detail: '人工湖北岸',
        planting_date: '2019-05-20',
        maintenance_level: 'B级',
        status: '需关注'
    },
    {
        plant_code: 'PLANT-W001',
        plant_name: '法国梧桐',
        plant_type: '乔木',
        location_area: '滨江路中段',
        location_detail: '路灯编号B023-B025之间',
        planting_date: '2017-11-08',
        maintenance_level: 'A级',
        status: '正常'
    }
];

const inspectionRecords = [
    {
        record_no: 'INS-20240510-001',
        team_code: 'TEAM-001',
        plant_code: 'PLANT-E001',
        inspector_name: '王大明',
        inspection_date: '2024-05-10',
        inspection_time: '09:30:00',
        weather_condition: '晴',
        temperature: 25.5,
        plant_health_status: '健康',
        issue_type: null,
        issue_description: null,
        issue_severity: '一般',
        recurrence_count: 0,
        upgrade_flag: false,
        last_recurrence_date: null,
        treatment_measure: '常规浇水、除草',
        treatment_person: '王大明',
        follow_up_date: '2024-05-17',
        record_status: '已完成',
        board_sync_status: '已同步',
        data_source: '巡检APP',
        import_batch_no: null
    },
    {
        record_no: 'INS-20240512-002',
        team_code: 'TEAM-001',
        plant_code: 'PLANT-E002',
        inspector_name: '刘小花',
        inspection_date: '2024-05-12',
        inspection_time: '14:15:00',
        weather_condition: '多云',
        temperature: 23.0,
        plant_health_status: '异常',
        issue_type: '病虫害-叶斑病',
        issue_description: '发现约15%叶片出现黄褐色斑点，集中在树冠中下部',
        issue_severity: '一般',
        recurrence_count: 1,
        upgrade_flag: false,
        last_recurrence_date: '2024-05-12',
        treatment_measure: '喷施多菌灵溶液，比例1:800',
        treatment_person: '刘小花',
        follow_up_date: '2024-05-15',
        record_status: '处理中',
        board_sync_status: '已同步',
        data_source: '巡检APP',
        import_batch_no: null
    },
    {
        record_no: 'INS-20240515-003',
        team_code: 'TEAM-001',
        plant_code: 'PLANT-E002',
        inspector_name: '刘小花',
        inspection_date: '2024-05-15',
        inspection_time: '10:00:00',
        weather_condition: '阴',
        temperature: 21.5,
        plant_health_status: '异常',
        issue_type: '病虫害-叶斑病',
        issue_description: '复查发现病斑扩大，新增感染叶片约10%，病情未得到控制',
        issue_severity: '严重',
        recurrence_count: 2,
        upgrade_flag: false,
        last_recurrence_date: '2024-05-15',
        treatment_measure: '建议升级处理方案，请植保专家会诊',
        treatment_person: '刘小花',
        follow_up_date: '2024-05-18',
        record_status: '待升级',
        board_sync_status: '未同步',
        data_source: '巡检APP',
        import_batch_no: null
    }
];

async function initTeams() {
    for (const team of maintenanceTeams) {
        const exists = await get('SELECT id FROM maintenance_teams WHERE team_code = ?', [team.team_code]);
        if (!exists) {
            await run(
                'INSERT INTO maintenance_teams (team_code, team_name, leader_name, leader_phone, responsible_area) VALUES (?, ?, ?, ?, ?)',
                [team.team_code, team.team_name, team.leader_name, team.leader_phone, team.responsible_area]
            );
            console.log(`已添加养护队: ${team.team_name}`);
        }
    }
}

async function initPlants() {
    for (const plant of greenPlants) {
        const exists = await get('SELECT id FROM green_plants WHERE plant_code = ?', [plant.plant_code]);
        if (!exists) {
            await run(
                'INSERT INTO green_plants (plant_code, plant_name, plant_type, location_area, location_detail, planting_date, maintenance_level, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [plant.plant_code, plant.plant_name, plant.plant_type, plant.location_area, plant.location_detail, plant.planting_date, plant.maintenance_level, plant.status]
            );
            console.log(`已添加绿植: ${plant.plant_name}`);
        }
    }
}

async function initInspections() {
    for (const record of inspectionRecords) {
        const exists = await get('SELECT id FROM inspection_records WHERE record_no = ?', [record.record_no]);
        if (!exists) {
            const team = await get('SELECT id FROM maintenance_teams WHERE team_code = ?', [record.team_code]);
            const plant = await get('SELECT id FROM green_plants WHERE plant_code = ?', [record.plant_code]);
            
            if (team && plant) {
                await run(
                    `INSERT INTO inspection_records 
                    (record_no, team_id, plant_id, inspector_name, inspection_date, inspection_time, 
                     weather_condition, temperature, plant_health_status, issue_type, issue_description, 
                     issue_severity, recurrence_count, upgrade_flag, last_recurrence_date, treatment_measure, 
                     treatment_person, follow_up_date, record_status, board_sync_status, data_source, import_batch_no) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        record.record_no, team.id, plant.id, record.inspector_name, record.inspection_date, record.inspection_time,
                        record.weather_condition, record.temperature, record.plant_health_status, record.issue_type, record.issue_description,
                        record.issue_severity, record.recurrence_count, record.upgrade_flag, record.last_recurrence_date, record.treatment_measure,
                        record.treatment_person, record.follow_up_date, record.record_status, record.board_sync_status, record.data_source, record.import_batch_no
                    ]
                );
                console.log(`已添加巡检记录: ${record.record_no}`);
            }
        }
    }
}

async function initAllData() {
    try {
        await beginTransaction();
        await initTeams();
        await initPlants();
        await initInspections();
        await commit();
        console.log('所有初始化数据导入完成!');
    } catch (error) {
        await rollback();
        console.error('数据初始化失败:', error);
        throw error;
    }
}

module.exports = { initAllData, maintenanceTeams, greenPlants, inspectionRecords };
