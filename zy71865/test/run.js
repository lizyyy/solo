const { execSync } = require('child_process');
const path = require('path');

const projectName = 'demo-2026-midterm';
const samplesDir = path.join(__dirname, '../samples');

function run(cmd) {
  console.log(`\n>>> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    return true;
  } catch (e) {
    console.log(`命令执行失败: ${e.message}`);
    return false;
  }
}

console.log('='.repeat(60));
console.log('  线性规划讲评 - 完整工作流演示');
console.log('='.repeat(60));

console.log('\n【步骤1】导入题库表');
run(`node bin/index.js import questions ${projectName} ${samplesDir}/questions.json`);

console.log('\n【步骤2】导入学生错题');
run(`node bin/index.js import mistakes ${projectName} ${samplesDir}/mistakes.json`);

console.log('\n【步骤3】导入备注');
run(`node bin/index.js import notes ${projectName} ${samplesDir}/notes.json`);

console.log('\n【步骤4】查看项目状态');
run(`node bin/index.js review status ${projectName}`);

console.log('\n【步骤5】运行自动复核');
run(`node bin/index.js review auto ${projectName}`);

console.log('\n【步骤6】查看异常记录');
run(`node bin/index.js review anomalies ${projectName}`);

console.log('\n【步骤7】查看异常说明 - EQ001 等价答案误判');
run(`node bin/index.js review explain EQ001`);

console.log('\n【步骤8】查看待复核记录');
run(`node bin/index.js review pending ${projectName}`);

console.log('\n【步骤9】手动修正一道错题 - 把李四第1题改判为正确');
run(`node bin/index.js correct mistake ${projectName} --question 1 --student S002 --judgment correct --reason "答案表述不同但实质正确，已通过等价答案匹配验证"`);

console.log('\n【步骤10】更新第2题的等价答案');
run(`node bin/index.js correct question ${projectName} 2 --equivalent-answer "2≤z≤10"`);

console.log('\n【步骤11】更新讲评稿元数据');
run(`node bin/index.js correct meta ${projectName} --title "线性规划单元测试讲评稿" --exam-name "线性规划单元测试" --class-name "高三(1)班" --reviewer "李老师" --overall-analysis "本次考试整体情况较好，大部分学生掌握了线性规划的基本解法，但在等价答案表述、区间开闭、几何意义理解等方面仍存在问题。错误主要集中在第4题实际应用和第5题含参数问题。" --suggestions "1. 加强等价答案的识别训练；2. 重点强调区间开闭的判断；3. 增加含参数线性规划的练习。"`);

console.log('\n【步骤12】更新讲评分段 - 线性目标函数最值');
run(`node bin/index.js correct section ${projectName} --knowledge-point "线性目标函数最值" --title "一、线性目标函数最值问题" --summary "本知识点考查线性目标函数在可行域内的最值求解，是线性规划的基础内容。学生主要问题在于顶点坐标计算不仔细。" --common-mistakes "顶点坐标计算错误" "代入目标函数时计算失误" "未验证所有顶点" --teaching-points "强调画图的重要性" "要求代入所有顶点比较" "培养检查验证的习惯" --screenshot-note "此处插入讲义截图1：可行域顶点标注图"`);

console.log('\n【步骤13】更新讲评分段 - 非线性目标函数最值');
run(`node bin/index.js correct section ${projectName} --knowledge-point "非线性目标函数最值" --title "二、非线性目标函数最值问题" --summary "本知识点考查距离平方型目标函数的几何意义，学生容易出错的是区间开闭问题。" --common-mistakes "区间开闭判断错误" "几何意义理解不清" "边界点未验证" --teaching-points "强化几何意义的讲解" "强调边界是否可取的判断" "多举正反例对比"`);

console.log('\n【步骤14】再次更新截图备注，演示历史记录');
run(`node bin/index.js correct section ${projectName} --knowledge-point "线性目标函数最值" --screenshot-note "此处插入讲义截图1（更新版）：可行域顶点标注图，已用红色标记易错点"`);

console.log('\n【步骤15】标记复核完成');
run(`node bin/index.js correct done ${projectName}`);

console.log('\n【步骤16】查看历史记录 - 最近10条');
run(`node bin/index.js history list ${projectName} --latest 10`);

console.log('\n【步骤17】查看讲义截图变更历史');
run(`node bin/index.js history screenshot ${projectName}`);

console.log('\n【步骤18】查看手动改判历史');
run(`node bin/index.js history correction ${projectName}`);

console.log('\n【步骤19】版本对比');
run(`node bin/index.js history compare ${projectName}`);

console.log('\n【步骤20】导出前检查');
run(`node bin/index.js export check ${projectName}`);

console.log('\n【步骤21】导出讲评稿（强制导出，因为还有未复核记录）');
run(`node bin/index.js export script ${projectName} --force`);

console.log('\n【步骤22】导出错题明细 - 第1题');
run(`node bin/index.js export mistakes ${projectName} --question 1`);

console.log('\n【步骤23】最终查看项目状态');
run(`node bin/index.js review status ${projectName}`);

console.log('\n' + '='.repeat(60));
console.log('  演示完成！请查看 data/exports 目录下的导出文件');
console.log('='.repeat(60));
