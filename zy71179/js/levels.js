const LEVELS = [
    {
        id: 'level1',
        name: '入门：独幕短剧',
        description: '学习基础排程，只有一幕戏',
        difficulty: 1,
        duration: 180,
        maxScore: 100,
        scenes: [
            { id: 'scene1', name: '第一幕：开场', startTime: 0, endTime: 180 }
        ],
        sceneChanges: [],
        tracks: [
            { id: 'light1', name: '灯光 主光', type: 'light' },
            { id: 'prop1', name: '道具 舞台左侧', type: 'prop' },
            { id: 'actor1', name: '演员入口 A', type: 'actor', config: { entranceId: 'A' } }
        ],
        events: [
            { id: 'l1', type: 'light', name: '开场暖光', duration: 10, config: { order: 1, lightGroupId: 'main' } },
            { id: 'l2', type: 'light', name: '聚焦舞台', duration: 15, config: { order: 2, lightGroupId: 'main' } },
            { id: 'p1', type: 'prop', name: '摆放桌子', duration: 8, config: { blockEntrance: false } },
            { id: 'p2', type: 'prop', name: '放置椅子', duration: 5, config: { blockEntrance: false } },
            { id: 'a1', type: 'actor', name: '主角入场', duration: 3, config: { entranceId: 'A' } },
            { id: 'a2', type: 'actor', name: '配角入场', duration: 3, config: { entranceId: 'A' } }
        ],
        requiredEventIds: ['l1', 'l2', 'p1', 'p2', 'a1', 'a2'],
        hints: [
            '灯光必须按顺序排列：开场暖光 → 聚焦舞台',
            '演员需要从入口A入场，确保道具不挡路',
            '在时间10-30秒内完成所有换景准备'
        ]
    },
    {
        id: 'level2',
        name: '进阶：两幕切换',
        description: '处理场景切换，注意换景时间',
        difficulty: 2,
        duration: 300,
        maxScore: 150,
        scenes: [
            { id: 'scene1', name: '第一幕：客厅', startTime: 0, endTime: 120 },
            { id: 'scene2', name: '第二幕：花园', startTime: 120, endTime: 300 }
        ],
        sceneChanges: [
            { fromScene: 'scene1', toScene: 'scene2', startTime: 120, maxDuration: 30 }
        ],
        tracks: [
            { id: 'light1', name: '灯光 主光', type: 'light' },
            { id: 'light2', name: '灯光 氛围', type: 'light' },
            { id: 'prop1', name: '道具 入口A侧', type: 'prop', config: { blockEntrance: true, entranceId: 'A' } },
            { id: 'prop2', name: '道具 入口B侧', type: 'prop', config: { blockEntrance: true, entranceId: 'B' } },
            { id: 'actor1', name: '演员入口 A', type: 'actor', config: { entranceId: 'A' } },
            { id: 'actor2', name: '演员入口 B', type: 'actor', config: { entranceId: 'B' } }
        ],
        events: [
            { id: 'l1', type: 'light', name: '客厅冷光', duration: 8, config: { order: 1, lightGroupId: 'scene1' } },
            { id: 'l2', type: 'light', name: '客厅聚光', duration: 10, config: { order: 2, lightGroupId: 'scene1' } },
            { id: 'l3', type: 'light', name: '花园暖光', duration: 8, config: { order: 1, lightGroupId: 'scene2' } },
            { id: 'l4', type: 'light', name: '花园柔光', duration: 12, config: { order: 2, lightGroupId: 'scene2' } },
            { id: 'l5', type: 'light', name: '黑场过渡', duration: 5, config: { order: 0, lightGroupId: 'transition' } },
            { id: 'p1', type: 'prop', name: '沙发入场', duration: 12, config: { blockEntrance: true, entranceId: 'A' } },
            { id: 'p2', type: 'prop', name: '茶几入场', duration: 8, config: { blockEntrance: true, entranceId: 'B' } },
            { id: 'p3', type: 'prop', name: '沙发退场', duration: 10, config: { blockEntrance: true, entranceId: 'A' } },
            { id: 'p4', type: 'prop', name: '花草入场', duration: 8, config: { blockEntrance: true, entranceId: 'B' } },
            { id: 'a1', type: 'actor', name: '男主入场', duration: 3, config: { entranceId: 'A' } },
            { id: 'a2', type: 'actor', name: '女主入场', duration: 3, config: { entranceId: 'B' } },
            { id: 'a3', type: 'actor', name: '仆人入场', duration: 3, config: { entranceId: 'A' } },
            { id: 'a4', type: 'actor', name: '全员退场', duration: 5, config: { entranceId: 'A' } }
        ],
        requiredEventIds: ['l1', 'l2', 'l3', 'l4', 'l5', 'p1', 'p2', 'p3', 'p4', 'a1', 'a2', 'a3', 'a4'],
        hints: [
            '120秒处必须完成场景切换，换景时间不能超过30秒',
            '道具会阻塞对应入口，注意入场顺序',
            '黑场过渡(l5)应该放在两幕之间'
        ]
    },
    {
        id: 'level3',
        name: '挑战：三幕大戏',
        description: '多场景复杂切换，考验节奏把控',
        difficulty: 3,
        duration: 480,
        maxScore: 250,
        scenes: [
            { id: 'scene1', name: '第一幕：宫殿', startTime: 0, endTime: 150 },
            { id: 'scene2', name: '第二幕：森林', startTime: 150, endTime: 300 },
            { id: 'scene3', name: '第三幕：战场', startTime: 300, endTime: 480 }
        ],
        sceneChanges: [
            { fromScene: 'scene1', toScene: 'scene2', startTime: 150, maxDuration: 25 },
            { fromScene: 'scene2', toScene: 'scene3', startTime: 300, maxDuration: 35 }
        ],
        tracks: [
            { id: 'light1', name: '灯光 主光', type: 'light' },
            { id: 'light2', name: '灯光 侧光', type: 'light' },
            { id: 'light3', name: '灯光 特效', type: 'light' },
            { id: 'prop1', name: '道具 左侧', type: 'prop', config: { blockEntrance: true, entranceId: 'L' } },
            { id: 'prop2', name: '道具 中央', type: 'prop', config: { blockEntrance: true, entranceId: 'C' } },
            { id: 'prop3', name: '道具 右侧', type: 'prop', config: { blockEntrance: true, entranceId: 'R' } },
            { id: 'actor1', name: '演员入口 左', type: 'actor', config: { entranceId: 'L' } },
            { id: 'actor2', name: '演员入口 中', type: 'actor', config: { entranceId: 'C' } },
            { id: 'actor3', name: '演员入口 右', type: 'actor', config: { entranceId: 'R' } }
        ],
        events: [
            { id: 'l1', type: 'light', name: '宫殿金光', duration: 10, config: { order: 1, lightGroupId: 's1_main' } },
            { id: 'l2', type: 'light', name: '王座聚光', duration: 8, config: { order: 2, lightGroupId: 's1_main' } },
            { id: 'l3', type: 'light', name: '烛火摇曳', duration: 12, config: { order: 3, lightGroupId: 's1_side' } },
            { id: 'l4', type: 'light', name: '森林绿光', duration: 10, config: { order: 1, lightGroupId: 's2_main' } },
            { id: 'l5', type: 'light', name: '月光洒落', duration: 15, config: { order: 2, lightGroupId: 's2_side' } },
            { id: 'l6', type: 'light', name: '迷雾效果', duration: 8, config: { order: 3, lightGroupId: 's2_fx' } },
            { id: 'l7', type: 'light', name: '战场红光', duration: 10, config: { order: 1, lightGroupId: 's3_main' } },
            { id: 'l8', type: 'light', name: '闪电特效', duration: 5, config: { order: 2, lightGroupId: 's3_fx' } },
            { id: 'l9', type: 'light', name: '黑场1-2', duration: 4, config: { order: 0, lightGroupId: 'trans1' } },
            { id: 'l10', type: 'light', name: '黑场2-3', duration: 4, config: { order: 0, lightGroupId: 'trans2' } },
            { id: 'p1', type: 'prop', name: '王座入场', duration: 15, config: { blockEntrance: true, entranceId: 'C' } },
            { id: 'p2', type: 'prop', name: '柱廊布置', duration: 10, config: { blockEntrance: true, entranceId: 'L' } },
            { id: 'p3', type: 'prop', name: '帷幕布置', duration: 8, config: { blockEntrance: true, entranceId: 'R' } },
            { id: 'p4', type: 'prop', name: '王座退场', duration: 12, config: { blockEntrance: true, entranceId: 'C' } },
            { id: 'p5', type: 'prop', name: '大树入场', duration: 15, config: { blockEntrance: true, entranceId: 'L' } },
            { id: 'p6', type: 'prop', name: '灌木布置', duration: 8, config: { blockEntrance: true, entranceId: 'R' } },
            { id: 'p7', type: 'prop', name: '森林清场', duration: 10, config: { blockEntrance: true, entranceId: 'C' } },
            { id: 'p8', type: 'prop', name: '战车入场', duration: 18, config: { blockEntrance: true, entranceId: 'L' } },
            { id: 'p9', type: 'prop', name: '旗帜布置', duration: 6, config: { blockEntrance: true, entranceId: 'R' } },
            { id: 'a1', type: 'actor', name: '国王入场', duration: 4, config: { entranceId: 'C' } },
            { id: 'a2', type: 'actor', name: '大臣入场', duration: 3, config: { entranceId: 'L' } },
            { id: 'a3', type: 'actor', name: '公主入场', duration: 3, config: { entranceId: 'R' } },
            { id: 'a4', type: 'actor', name: '精灵入场', duration: 4, config: { entranceId: 'L' } },
            { id: 'a5', type: 'actor', name: '猎人入场', duration: 3, config: { entranceId: 'R' } },
            { id: 'a6', type: 'actor', name: '将军入场', duration: 5, config: { entranceId: 'C' } },
            { id: 'a7', type: 'actor', name: '士兵入场', duration: 8, config: { entranceId: 'L' } },
            { id: 'a8', type: 'actor', name: '第一幕谢幕', duration: 6, config: { entranceId: 'C' } },
            { id: 'a9', type: 'actor', name: '第二幕谢幕', duration: 6, config: { entranceId: 'C' } }
        ],
        requiredEventIds: ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10','p1','p2','p3','p4','p5','p6','p7','p8','p9','a1','a2','a3','a4','a5','a6','a7','a8','a9'],
        hints: [
            '两次换景时间限制：25秒和35秒',
            '三个入口(L/C/R)都可能被道具阻塞',
            '灯光组内必须按order顺序排列',
            '合理安排道具和演员的入场顺序'
        ]
    },
    {
        id: 'level4',
        name: '大师：歌剧之夜',
        description: '极限时间压力，完美节奏的考验',
        difficulty: 4,
        duration: 600,
        maxScore: 400,
        scenes: [
            { id: 'scene1', name: '序曲', startTime: 0, endTime: 90 },
            { id: 'scene2', name: '第一幕：酒馆', startTime: 90, endTime: 210 },
            { id: 'scene3', name: '第二幕：街头', startTime: 210, endTime: 360 },
            { id: 'scene4', name: '第三幕：决斗', startTime: 360, endTime: 480 },
            { id: 'scene5', name: '终曲', startTime: 480, endTime: 600 }
        ],
        sceneChanges: [
            { fromScene: 'scene1', toScene: 'scene2', startTime: 90, maxDuration: 20 },
            { fromScene: 'scene2', toScene: 'scene3', startTime: 210, maxDuration: 20 },
            { fromScene: 'scene3', toScene: 'scene4', startTime: 360, maxDuration: 25 },
            { fromScene: 'scene4', toScene: 'scene5', startTime: 480, maxDuration: 15 }
        ],
        tracks: [
            { id: 'light1', name: '灯光 主光', type: 'light' },
            { id: 'light2', name: '灯光 侧光', type: 'light' },
            { id: 'light3', name: '灯光 逆光', type: 'light' },
            { id: 'light4', name: '灯光 特效', type: 'light' },
            { id: 'prop1', name: '道具 1区', type: 'prop', config: { blockEntrance: true, entranceId: 'E1' } },
            { id: 'prop2', name: '道具 2区', type: 'prop', config: { blockEntrance: true, entranceId: 'E2' } },
            { id: 'prop3', name: '道具 3区', type: 'prop', config: { blockEntrance: true, entranceId: 'E3' } },
            { id: 'prop4', name: '道具 4区', type: 'prop', config: { blockEntrance: true, entranceId: 'E4' } },
            { id: 'actor1', name: '演员入口 E1', type: 'actor', config: { entranceId: 'E1' } },
            { id: 'actor2', name: '演员入口 E2', type: 'actor', config: { entranceId: 'E2' } },
            { id: 'actor3', name: '演员入口 E3', type: 'actor', config: { entranceId: 'E3' } },
            { id: 'actor4', name: '演员入口 E4', type: 'actor', config: { entranceId: 'E4' } }
        ],
        events: generateLevel4Events(),
        requiredEventIds: generateLevel4RequiredIds(),
        hints: [
            '四次换景，时间都非常紧张',
            '四个入口，任何一个被堵都可能失败',
            '灯光组繁多，注意order顺序',
            '道具频繁进出，精确到秒的排程'
        ]
    }
];

function generateLevel4Events() {
    const events = [];
    const lightGroups = ['s1', 's2', 's3', 's4', 's5', 't1', 't2', 't3', 't4'];
    let lightId = 1;
    
    ['序曲灯光', '酒馆暖光', '酒馆聚光', '街头冷光', '街灯效果', 
     '决斗红光', '决斗背光', '终曲金光', '终曲柔光'].forEach((name, idx) => {
        const group = lightGroups[idx];
        events.push({
            id: 'l' + lightId++,
            type: 'light',
            name: name,
            duration: 6 + (idx % 3) * 2,
            config: { order: 1, lightGroupId: group }
        });
        if (idx < 5) {
            events.push({
                id: 'l' + lightId++,
                type: 'light',
                name: name + ' 侧光',
                duration: 4 + (idx % 2) * 3,
                config: { order: 2, lightGroupId: group }
            });
        }
    });
    
    ['黑场1', '黑场2', '黑场3', '黑场4'].forEach((name, idx) => {
        events.push({
            id: 'l' + lightId++,
            type: 'light',
            name: name,
            duration: 3,
            config: { order: 0, lightGroupId: 'trans' + (idx + 1) }
        });
    });

    const props = [
        { name: '吧台', dur: 12, ent: 'E2' },
        { name: '桌椅x3', dur: 10, ent: 'E1' },
        { name: '酒架', dur: 8, ent: 'E3' },
        { name: '吧台清场', dur: 10, ent: 'E2' },
        { name: '桌椅退场', dur: 8, ent: 'E1' },
        { name: '路灯', dur: 15, ent: 'E3' },
        { name: '摊车', dur: 10, ent: 'E4' },
        { name: '建筑立面', dur: 12, ent: 'E1' },
        { name: '街头清场', dur: 12, ent: 'E2' },
        { name: '路灯退场', dur: 10, ent: 'E3' },
        { name: '摊车退场', dur: 8, ent: 'E4' },
        { name: '建筑退场', dur: 10, ent: 'E1' },
        { name: '武器架', dur: 8, ent: 'E2' },
        { name: '沙地平台', dur: 15, ent: 'E3' },
        { name: '观众围栏', dur: 10, ent: 'E4' },
        { name: '决斗清场', dur: 10, ent: 'E1' },
        { name: '武器退场', dur: 6, ent: 'E2' },
        { name: '沙地退场', dur: 12, ent: 'E3' },
        { name: '围栏退场', dur: 8, ent: 'E4' },
        { name: '谢幕花台', dur: 10, ent: 'E1' }
    ];
    
    props.forEach((p, idx) => {
        events.push({
            id: 'p' + (idx + 1),
            type: 'prop',
            name: p.name,
            duration: p.dur,
            config: { blockEntrance: true, entranceId: p.ent }
        });
    });

    const actors = [
        { name: '男主 卡门', ent: 'E1' },
        { name: '女主 米卡埃拉', ent: 'E2' },
        { name: '男配 斗牛士', ent: 'E3' },
        { name: '女配 弗拉斯基塔', ent: 'E4' },
        { name: '配角 梅塞德斯', ent: 'E1' },
        { name: '配角 莱蒙达托', ent: 'E2' },
        { name: '配角 丹凯罗', ent: 'E3' },
        { name: '配角 莫拉莱斯', ent: 'E4' },
        { name: '配角 祖尼加', ent: 'E1' },
        { name: '合唱队A', ent: 'E2' },
        { name: '合唱队B', ent: 'E3' },
        { name: '舞者队', ent: 'E4' },
        { name: '第一幕谢幕', ent: 'E1' },
        { name: '第二幕谢幕', ent: 'E2' },
        { name: '第三幕谢幕', ent: 'E3' },
        { name: '终曲谢幕', ent: 'E4' },
        { name: '斗牛士登场', ent: 'E1' },
        { name: '卡门退场', ent: 'E2' }
    ];
    
    actors.forEach((a, idx) => {
        events.push({
            id: 'a' + (idx + 1),
            type: 'actor',
            name: a.name,
            duration: 3 + (idx % 3),
            config: { entranceId: a.ent }
        });
    });

    return events;
}

function generateLevel4RequiredIds() {
    const ids = [];
    for (let i = 1; i <= 16; i++) ids.push('l' + i);
    for (let i = 1; i <= 20; i++) ids.push('p' + i);
    for (let i = 1; i <= 18; i++) ids.push('a' + i);
    return ids;
}

function getLevelById(id) {
    return LEVELS.find(l => l.id === id) || null;
}

function createLevelState(levelData) {
    const state = new GameState();
    state.currentLevel = levelData.id;
    state.maxTime = levelData.duration;

    state.scenes = levelData.scenes.map(s => 
        new Scene(s.id, s.name, s.startTime, s.endTime)
    );

    state.sceneChanges = levelData.sceneChanges.map(sc => 
        new SceneChange(sc.fromScene, sc.toScene, sc.startTime, sc.maxDuration)
    );

    state.tracks = levelData.tracks.map(t => 
        new Track(t.id, t.name, t.type, t.config || {})
    );

    state.eventPool = levelData.events.map(e => 
        new GameEvent(e.id, e.type, e.name, e.duration, e.config || {})
    );

    return state;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LEVELS, getLevelById, createLevelState };
}
