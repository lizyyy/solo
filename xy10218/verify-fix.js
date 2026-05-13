#!/usr/bin/env node

const CHECK_STATUS = {
    PASS: 'pass',
    WARNING: 'warning',
    FAIL: 'fail',
    PENDING: 'pending'
};

const ISSUE_TYPE = {
    DURATION_EXCEED: 'duration_exceed',
    DURATION_WARNING: 'duration_warning',
    SINGLE_DURATION_EXCEED: 'single_duration_exceed',
    DURATION_NAN: 'duration_nan',
    DURATION_NEGATIVE: 'duration_negative',
    DURATION_ZERO: 'duration_zero',
    DURATION_EMPTY: 'duration_empty',
    TITLE_EMPTY: 'title_empty',
    TITLE_WHITESPACE: 'title_whitespace',
    SENSITIVE_WORD: 'sensitive_word',
    PUBLISH_BLOCKED: 'publish_blocked',
    WITHDRAW_SUCCESS: 'withdraw_success'
};

const ISSUE_LEVEL = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

const PUBLISH_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    WITHDRAWN: 'withdrawn'
};

const LOG_TYPE = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

const MAX_SINGLE_DURATION = 30;

const TIME_SLOTS = {
    'morning': {
        name: '早间',
        display: '07:00-08:00',
        duration: 60,
        warningThreshold: 55,
        maxDuration: 60
    },
    'noon': {
        name: '午间',
        display: '12:00-12:30',
        duration: 30,
        warningThreshold: 27,
        maxDuration: 30
    },
    'evening': {
        name: '晚间',
        display: '18:00-19:00',
        duration: 60,
        warningThreshold: 55,
        maxDuration: 60
    }
};

const DurationValidator = {
    MIN_DURATION: 1,

    validate: function(scheduleData) {
        const result = {
            status: CHECK_STATUS.PASS,
            input: {},
            output: {},
            failures: [],
            warnings: [],
            details: [],
            hasInvalidData: false
        };

        if (!scheduleData || !scheduleData.slot) {
            result.status = CHECK_STATUS.FAIL;
            result.failures.push({
                rule: 'duration-slot',
                type: ISSUE_TYPE.PUBLISH_BLOCKED,
                message: '未选择播出时段'
            });
            return result;
        }

        const slot = TIME_SLOTS[scheduleData.slot];
        const programs = scheduleData.programs || [];

        result.input = {
            slot: scheduleData.slot,
            slotName: slot.name,
            slotDuration: slot.duration,
            slotDisplay: slot.display,
            programCount: programs.length,
            programs: programs.map(p => ({
                title: p.title,
                duration: p.duration,
                durationType: typeof p.duration
            }))
        };

        if (programs.length === 0) {
            result.status = CHECK_STATUS.FAIL;
            result.failures.push({
                rule: 'program-count',
                type: ISSUE_TYPE.PUBLISH_BLOCKED,
                message: '节目单不能为空，请至少添加一个节目'
            });
            result.output = {
                totalDuration: 0,
                slotMaxDuration: slot.maxDuration,
                slotWarningThreshold: slot.warningThreshold,
                percentage: '0.0',
                validPrograms: 0,
                invalidPrograms: 0
            };
            return result;
        }

        let totalDuration = 0;
        let validPrograms = 0;
        let invalidPrograms = 0;

        programs.forEach((program, index) => {
            const programResult = this.validateProgram(program, index);
            
            if (programResult.status === CHECK_STATUS.FAIL) {
                invalidPrograms++;
                result.hasInvalidData = true;
                if (result.status !== CHECK_STATUS.FAIL) {
                    result.status = CHECK_STATUS.FAIL;
                }
                
                programResult.issues.forEach(issue => {
                    result.failures.push({
                        program: program.title || `节目${index + 1}`,
                        programIndex: index + 1,
                        type: issue.type,
                        message: issue.message,
                        value: issue.value,
                        rule: issue.rule
                    });
                });
            } else {
                validPrograms++;
                totalDuration += program.duration;
            }

            if (programResult.issues.some(i => i.type === ISSUE_TYPE.SINGLE_DURATION_EXCEED)) {
                invalidPrograms++;
                result.hasInvalidData = true;
            }

            result.details.push(programResult);
        });

        result.output = {
            totalDuration: totalDuration,
            slotMaxDuration: slot.maxDuration,
            slotWarningThreshold: slot.warningThreshold,
            percentage: ((totalDuration / slot.maxDuration) * 100).toFixed(1),
            validPrograms: validPrograms,
            invalidPrograms: invalidPrograms
        };

        if (!result.hasInvalidData) {
            if (totalDuration > slot.maxDuration) {
                result.status = CHECK_STATUS.FAIL;
                result.failures.push({
                    type: ISSUE_TYPE.DURATION_EXCEED,
                    message: `总时长${totalDuration}分钟超过时段上限${slot.maxDuration}分钟`,
                    value: totalDuration,
                    limit: slot.maxDuration,
                    exceed: totalDuration - slot.maxDuration,
                    rule: 'duration-total'
                });
            } else if (totalDuration >= slot.warningThreshold) {
                if (result.status === CHECK_STATUS.PASS) {
                    result.status = CHECK_STATUS.WARNING;
                }
                result.warnings.push({
                    type: ISSUE_TYPE.DURATION_WARNING,
                    message: `总时长${totalDuration}分钟接近时段上限${slot.maxDuration}分钟（已使用${result.output.percentage}%）`,
                    value: totalDuration,
                    limit: slot.maxDuration,
                    remaining: slot.maxDuration - totalDuration,
                    rule: 'duration-warning'
                });
            }
        }

        return result;
    },

    validateProgram: function(program, index) {
        const result = {
            index: index + 1,
            title: program.title,
            duration: program.duration,
            status: CHECK_STATUS.PASS,
            issues: []
        };

        const displayTitle = program.title || `节目${index + 1}`;

        if (program.title === undefined || program.title === null || program.title === '') {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.TITLE_EMPTY,
                message: `节目标题不能为空`,
                rule: 'title-required',
                value: program.title
            });
        } else if (typeof program.title === 'string' && program.title.trim() === '') {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.TITLE_WHITESPACE,
                message: `节目标题不能只包含空白字符`,
                rule: 'title-required',
                value: program.title
            });
        }

        if (program.duration === undefined || program.duration === null || program.duration === '') {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_EMPTY,
                message: `节目「${displayTitle}」时长不能为空`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (typeof program.duration === 'number' && isNaN(program.duration)) {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_NAN,
                message: `节目「${displayTitle}」时长无效（NaN）`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (typeof program.duration !== 'number') {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_NAN,
                message: `节目「${displayTitle}」时长必须是数字（当前类型：${typeof program.duration}）`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (!isFinite(program.duration)) {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_NAN,
                message: `节目「${displayTitle}」时长无效（无穷大）`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (program.duration < 0) {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_NEGATIVE,
                message: `节目「${displayTitle}」时长不能为负数（${program.duration}分钟）`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (program.duration === 0) {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.DURATION_ZERO,
                message: `节目「${displayTitle}」时长不能为0分钟`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (program.duration < this.MIN_DURATION && program.duration > 0) {
            result.issues.push({
                type: ISSUE_TYPE.DURATION_WARNING,
                message: `节目「${displayTitle}」时长较短（${program.duration}分钟），请确认是否正确`,
                rule: 'duration-valid',
                value: program.duration
            });
        } else if (program.duration > MAX_SINGLE_DURATION) {
            result.status = CHECK_STATUS.FAIL;
            result.issues.push({
                type: ISSUE_TYPE.SINGLE_DURATION_EXCEED,
                message: `节目「${displayTitle}」时长${program.duration}分钟超过上限${MAX_SINGLE_DURATION}分钟`,
                rule: 'duration-single',
                value: program.duration,
                limit: MAX_SINGLE_DURATION
            });
        }

        return result;
    },

    formatResult: function(result) {
        const lines = [];
        lines.push(`输入: ${result.input.slotName}时段 (${result.input.slotDisplay})，${result.input.programCount}个节目`);
        
        if (result.output) {
            lines.push(`输出: 有效节目${result.output.validPrograms}个，无效节目${result.output.invalidPrograms}个，有效总时长${result.output.totalDuration}/${result.output.slotMaxDuration}分钟 (${result.output.percentage}%)`);
        }

        if (result.hasInvalidData) {
            lines.push('⚠️ 检测到脏数据，所有非法值已记录到问题列表');
        }

        if (result.failures.length > 0) {
            lines.push('失败原因:');
            result.failures.forEach((f, i) => {
                lines.push(`  [${i + 1}] ❌ ${f.message}`);
                if (f.value !== undefined) {
                    lines.push(`       原始值: ${JSON.stringify(f.value)}`);
                }
            });
        }

        if (result.warnings.length > 0) {
            lines.push('警告:');
            result.warnings.forEach(w => {
                lines.push(`  ⚠️ ${w.message}`);
            });
        }

        return lines.join('\n');
    }
};

console.log('========================================');
console.log('  校园广播节目单门禁修复验证');
console.log('========================================\n');

let allPassed = true;
let testCount = 0;
let passCount = 0;

function runTest(name, testFn) {
    testCount++;
    console.log(`\n[测试 ${testCount}] ${name}`);
    console.log('-'.repeat(50));
    try {
        const result = testFn();
        if (result) {
            passCount++;
            console.log('✅ 通过');
        } else {
            allPassed = false;
            console.log('❌ 失败');
        }
    } catch (e) {
        allPassed = false;
        console.log('❌ 异常:', e.message);
    }
}

console.log('\n📋 测试场景 1: 空标题');
runTest('空标题应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '', duration: 10, content: 'test' }]
    });
    const hasTitleEmpty = result.failures.some(f => f.type === ISSUE_TYPE.TITLE_EMPTY);
    console.log('  status:', result.status);
    console.log('  检测到空标题:', hasTitleEmpty);
    console.log('  failures:', result.failures.map(f => f.type));
    return result.status === CHECK_STATUS.FAIL && hasTitleEmpty;
});

console.log('\n📋 测试场景 2: 纯空白标题');
runTest('纯空白标题应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '   ', duration: 10, content: 'test' }]
    });
    const hasWhitespace = result.failures.some(f => f.type === ISSUE_TYPE.TITLE_WHITESPACE);
    console.log('  status:', result.status);
    console.log('  检测到空白标题:', hasWhitespace);
    return result.status === CHECK_STATUS.FAIL && hasWhitespace;
});

console.log('\n📋 测试场景 3: NaN时长');
runTest('NaN时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: NaN, content: 'test' }]
    });
    const hasNaN = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_NAN);
    console.log('  status:', result.status);
    console.log('  检测到NaN:', hasNaN);
    console.log('  failures:', result.failures.map(f => f.type));
    return result.status === CHECK_STATUS.FAIL && hasNaN;
});

console.log('\n📋 测试场景 4: 负数时长');
runTest('负数时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: -5, content: 'test' }]
    });
    const hasNegative = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_NEGATIVE);
    console.log('  status:', result.status);
    console.log('  检测到负数:', hasNegative);
    return result.status === CHECK_STATUS.FAIL && hasNegative;
});

console.log('\n📋 测试场景 5: 0时长');
runTest('0时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: 0, content: 'test' }]
    });
    const hasZero = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_ZERO);
    console.log('  status:', result.status);
    console.log('  检测到0时长:', hasZero);
    return result.status === CHECK_STATUS.FAIL && hasZero;
});

console.log('\n📋 测试场景 6: 空时长');
runTest('空时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: '', content: 'test' }]
    });
    const hasEmpty = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_EMPTY);
    console.log('  status:', result.status);
    console.log('  检测到空时长:', hasEmpty);
    return result.status === CHECK_STATUS.FAIL && hasEmpty;
});

console.log('\n📋 测试场景 7: 字符串类型时长');
runTest('字符串类型时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: '10', content: 'test' }]
    });
    const hasWrongType = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_NAN);
    console.log('  status:', result.status);
    console.log('  检测到类型错误:', hasWrongType);
    return result.status === CHECK_STATUS.FAIL && hasWrongType;
});

console.log('\n📋 测试场景 8: 无穷大时长');
runTest('无穷大时长应该被检测', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [{ id: 'p1', title: '测试', duration: Infinity, content: 'test' }]
    });
    const hasNaN = result.failures.some(f => f.type === ISSUE_TYPE.DURATION_NAN);
    console.log('  status:', result.status);
    console.log('  检测到无穷大:', hasNaN);
    return result.status === CHECK_STATUS.FAIL && hasNaN;
});

console.log('\n📋 测试场景 9: 脏数据样例（综合测试）');
runTest('脏数据样例应该检测出多个问题', () => {
    const result = DurationValidator.validate({
        date: '2026-05-14',
        slot: 'morning',
        programs: [
            { id: 'p1', title: '', duration: 10, content: '空标题' },
            { id: 'p2', title: '   ', duration: 15, content: '空白标题' },
            { id: 'p3', title: '非法时长', duration: -5, content: '负数' },
            { id: 'p4', title: '零时长', duration: 0, content: '0' },
            { id: 'p5', title: '正常', duration: 20, content: '正常' }
        ]
    });
    console.log('  status:', result.status);
    console.log('  hasInvalidData:', result.hasInvalidData);
    console.log('  有效节目:', result.output.validPrograms);
    console.log('  无效节目:', result.output.invalidPrograms);
    console.log('  failures数:', result.failures.length);
    console.log('  问题类型:', result.failures.map(f => f.type));
    return result.status === CHECK_STATUS.FAIL && 
           result.hasInvalidData && 
           result.failures.length >= 4 &&
           result.output.invalidPrograms >= 4;
});

console.log('\n📋 测试场景 10: 正常数据应该通过');
runTest('正常数据应该通过', () => {
    const result = DurationValidator.validate({
        slot: 'morning',
        programs: [
            { id: 'p1', title: '新闻', duration: 15, content: 'test' },
            { id: 'p2', title: '音乐', duration: 20, content: 'test' }
        ]
    });
    console.log('  status:', result.status);
    console.log('  有效节目:', result.output.validPrograms);
    console.log('  无效节目:', result.output.invalidPrograms);
    return result.status === CHECK_STATUS.PASS && 
           result.output.invalidPrograms === 0 &&
           result.failures.length === 0;
});

console.log('\n\n========================================');
console.log('  验证结果汇总');
console.log('========================================');
console.log(`总测试数: ${testCount}`);
console.log(`通过数: ${passCount}`);
console.log(`失败数: ${testCount - passCount}`);

if (allPassed) {
    console.log('\n🎉 所有测试通过！修复已生效。');
    process.exit(0);
} else {
    console.log('\n❌ 部分测试失败，请检查修复。');
    process.exit(1);
}
