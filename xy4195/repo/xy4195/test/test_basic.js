// 基本功能测试
// 注意：这些测试需要在浏览器环境中运行，或者使用 Node.js 配合适当的测试框架

console.log('=== 展柜光照眩光排练板 - 基本功能测试 ===\n');

// 测试 1: 工具函数测试
function testUtils() {
    console.log('测试 1: 工具函数测试');
    
    // 角度转换
    const rad = Utils.degToRad(180);
    console.log(`  180度转弧度: ${rad} (预期: ${Math.PI})`);
    console.assert(Math.abs(rad - Math.PI) < 0.001, '角度转换失败');
    
    const deg = Utils.radToDeg(Math.PI);
    console.log(`  π转角度: ${deg} (预期: 180)`);
    console.assert(Math.abs(deg - 180) < 0.001, '弧度转换失败');
    
    // 距离计算
    const dist = Utils.distance(0, 0, 3, 4);
    console.log(`  距离计算 (0,0) 到 (3,4): ${dist} (预期: 5)`);
    console.assert(dist === 5, '距离计算失败');
    
    // 深拷贝
    const original = { a: 1, b: { c: 2 } };
    const cloned = Utils.deepClone(original);
    cloned.b.c = 999;
    console.log(`  深拷贝测试: original.b.c = ${original.b.c} (预期: 2)`);
    console.assert(original.b.c === 2, '深拷贝失败');
    
    console.log('  ✓ 工具函数测试通过\n');
}

// 测试 2: 数据解析测试
function testParser() {
    console.log('测试 2: 数据解析测试');
    
    // 测试 JSON 解析
    const caseJson = `{
        "cases": [
            {
                "id": "test_case",
                "width": 2.0,
                "height": 1.5,
                "depth": 0.8,
                "position": { "x": 0, "y": 0 }
            }
        ]
    }`;
    
    const caseResult = Parser.parseCaseJson(caseJson);
    console.log(`  JSON解析成功: ${caseResult.success}`);
    console.assert(caseResult.success === true, 'JSON解析失败');
    console.assert(caseResult.data.cases.length === 1, '展柜数量错误');
    console.assert(caseResult.data.cases[0].width === 2.0, '展柜宽度错误');
    
    // 测试 CSV 解析
    const lightsCsv = `id,位置X,位置Y,高度Z,水平角度,倾斜角度,光强,光束角
light_test,1.0,-2.0,2.5,90,60,1500,35`;
    
    const lightsResult = Parser.parseLightsCsv(lightsCsv);
    console.log(`  CSV解析成功: ${lightsResult.success}`);
    console.assert(lightsResult.success === true, 'CSV解析失败');
    console.assert(lightsResult.data.lights.length === 1, '灯具数量错误');
    console.assert(lightsResult.data.lights[0].intensity === 1500, '光强错误');
    
    // 测试 CSV 行解析
    const csvLine = '"值1,带逗号",值2,"值3""带引号"';
    const parsed = Parser.parseCsvLine(csvLine);
    console.log(`  CSV行解析: ${JSON.stringify(parsed)}`);
    console.assert(parsed.length === 3, 'CSV行解析数量错误');
    console.assert(parsed[0] === '值1,带逗号', 'CSV引号处理错误');
    console.assert(parsed[2] === '值3"带引号', 'CSV转义引号处理错误');
    
    console.log('  ✓ 数据解析测试通过\n');
}

// 测试 3: 几何计算测试
function testGeometry() {
    console.log('测试 3: 几何计算测试');
    
    // 测试灯束计算
    const testLight = {
        id: 'test_light',
        position: { x: 0, y: -2, z: 2.5 },
        angle: { x: 60, y: 90, z: 0 },
        intensity: 1500,
        beamAngle: 35
    };
    
    const beamPlan = Geometry.calculateLightBeam(testLight, 'plan');
    console.log(`  平面图灯束计算: 存在=${!!beamPlan}, 最大距离=${beamPlan.maxDistance.toFixed(2)}`);
    console.assert(beamPlan !== null, '平面图灯束计算失败');
    console.assert(beamPlan.polygon.length === 3, '灯束多边形顶点数错误');
    
    const beamSection = Geometry.calculateLightBeam(testLight, 'section');
    console.log(`  侧视图灯束计算: 存在=${!!beamSection}`);
    console.assert(beamSection !== null, '侧视图灯束计算失败');
    
    // 测试照度计算
    const targetPoint = { x: 0, y: 0, z: 0.5 };
    const illuminance = Geometry.calculateIlluminance(testLight, targetPoint);
    console.log(`  照度计算: ${illuminance.toFixed(2)} lux`);
    console.assert(illuminance >= 0, '照度计算不应为负数');
    
    console.log('  ✓ 几何计算测试通过\n');
}

// 测试 4: 导出功能测试
function testExport() {
    console.log('测试 4: 导出功能测试');
    
    // 测试风险数据
    const testRisks = [
        {
            type: 'illuminance',
            severity: 'high',
            description: '文物照度超标',
            illuminance: 200,
            maxIlluminance: 50,
            lightId: 'light_1',
            artifactId: 'artifact_1'
        },
        {
            type: 'reflection',
            severity: 'medium',
            description: '玻璃反射眩光',
            lightId: 'light_2',
            caseId: 'case_1'
        }
    ];
    
    const testData = {
        cases: [{ id: 'case_1', name: '测试展柜' }],
        lights: [{ id: 'light_1' }, { id: 'light_2' }],
        artifacts: [{ id: 'artifact_1' }]
    };
    
    // 测试 CSV 导出
    const csv = Export.exportRiskCsv(testRisks);
    const lines = csv.trim().split('\n');
    console.log(`  CSV导出: 行数=${lines.length}`);
    console.assert(lines.length > 1, 'CSV导出至少需要表头和一行数据');
    console.assert(lines[0].includes('序号'), 'CSV表头应包含"序号"');
    
    // 测试 Markdown 导出
    const suggestions = Geometry.generateAdjustmentSuggestions(testRisks, testData);
    const markdown = Export.exportMarkdownSuggestions(testRisks, testData, suggestions);
    console.log(`  Markdown导出: 长度=${markdown.length} 字符`);
    console.assert(markdown.length > 0, 'Markdown导出不应为空');
    console.assert(markdown.includes('# 展柜光照眩光调整建议'), 'Markdown应包含标题');
    
    // 测试 JSON 导出
    const auditPackage = Export.exportAuditPackage(testData, testRisks, { name: '测试方案' });
    const auditObj = JSON.parse(auditPackage);
    console.log(`  JSON导出: 版本=${auditObj.version}, 风险数=${auditObj.summary.totalRisks}`);
    console.assert(auditObj.version === '1.0', 'JSON导出版本错误');
    console.assert(auditObj.summary.totalRisks === 2, 'JSON导出风险数错误');
    
    console.log('  ✓ 导出功能测试通过\n');
}

// 运行所有测试
function runAllTests() {
    console.log('开始运行基本功能测试...\n');
    
    try {
        testUtils();
        testParser();
        testGeometry();
        testExport();
        
        console.log('=== 所有测试通过！ ===\n');
        return true;
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error(error.stack);
        return false;
    }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
    window.runBasicTests = runAllTests;
    console.log('在浏览器控制台输入 runBasicTests() 运行测试');
}

// 如果在 Node.js 环境中运行（简化版，不依赖 DOM）
if (typeof module !== 'undefined' && module.exports) {
    // 模拟必要的全局对象
    global.Utils = {
        degToRad: (d) => d * Math.PI / 180,
        radToDeg: (r) => r * 180 / Math.PI,
        distance: (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
        deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
        escapeCsv: (str) => {
            if (typeof str !== 'string') str = String(str);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }
    };
    
    module.exports = { runAllTests };
}
