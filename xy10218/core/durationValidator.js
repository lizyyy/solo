const DurationValidator = {
    validate: function(scheduleData) {
        const result = {
            status: CHECK_STATUS.PASS,
            input: {},
            output: {},
            failures: [],
            warnings: [],
            details: []
        };

        if (!scheduleData || !scheduleData.slot) {
            result.status = CHECK_STATUS.FAIL;
            result.failures.push({
                rule: 'duration-slot',
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
                duration: p.duration
            }))
        };

        let totalDuration = 0;

        programs.forEach((program, index) => {
            const programResult = {
                index: index + 1,
                title: program.title,
                duration: program.duration,
                status: CHECK_STATUS.PASS,
                issues: []
            };

            if (program.duration > MAX_SINGLE_DURATION) {
                programResult.status = CHECK_STATUS.FAIL;
                programResult.issues.push({
                    type: ISSUE_TYPE.SINGLE_DURATION_EXCEED,
                    message: `单个节目时长${program.duration}分钟超过上限${MAX_SINGLE_DURATION}分钟`,
                    rule: 'duration-single'
                });
                result.failures.push({
                    program: program.title,
                    type: ISSUE_TYPE.SINGLE_DURATION_EXCEED,
                    message: `节目「${program.title}」时长${program.duration}分钟超过上限${MAX_SINGLE_DURATION}分钟`,
                    value: program.duration,
                    limit: MAX_SINGLE_DURATION
                });
            }

            totalDuration += program.duration;
            result.details.push(programResult);
        });

        result.output = {
            totalDuration: totalDuration,
            slotMaxDuration: slot.maxDuration,
            slotWarningThreshold: slot.warningThreshold,
            percentage: ((totalDuration / slot.maxDuration) * 100).toFixed(1)
        };

        if (totalDuration > slot.maxDuration) {
            result.status = CHECK_STATUS.FAIL;
            result.failures.push({
                type: ISSUE_TYPE.DURATION_EXCEED,
                message: `总时长${totalDuration}分钟超过时段上限${slot.maxDuration}分钟`,
                value: totalDuration,
                limit: slot.maxDuration,
                exceed: totalDuration - slot.maxDuration
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
                remaining: slot.maxDuration - totalDuration
            });
        }

        return result;
    },

    formatResult: function(result) {
        const lines = [];
        lines.push(`输入: ${result.input.slotName}时段 (${result.input.slotDisplay})，${result.input.programCount}个节目`);
        lines.push(`输出: 总时长${result.output.totalDuration}分钟 / 时段上限${result.output.slotMaxDuration}分钟 (${result.output.percentage}%)`);

        if (result.failures.length > 0) {
            lines.push('失败原因:');
            result.failures.forEach(f => {
                lines.push(`  ❌ ${f.message}`);
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
