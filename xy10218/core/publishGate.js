const PublishGate = {
    check: function(durationResult, sensitiveResult) {
        const result = {
            status: CHECK_STATUS.PENDING,
            canPublish: false,
            input: {},
            output: {},
            checklist: [],
            failures: []
        };

        result.input = {
            durationStatus: durationResult ? durationResult.status : '未检查',
            sensitiveStatus: sensitiveResult ? sensitiveResult.status : '未检查',
            durationChecked: !!durationResult,
            sensitiveChecked: !!sensitiveResult
        };

        const durationCheck = {
            name: '时长校验',
            icon: '⏱️',
            checked: !!durationResult,
            passed: durationResult && durationResult.status !== CHECK_STATUS.FAIL,
            detail: durationResult ? 
                `${durationResult.input.slotName}时段，总时长${durationResult.output.totalDuration}/${durationResult.output.slotMaxDuration}分钟` : 
                '尚未执行时长校验'
        };

        const sensitiveCheck = {
            name: '敏感词扫描',
            icon: '🔍',
            checked: !!sensitiveResult,
            passed: sensitiveResult && sensitiveResult.status === CHECK_STATUS.PASS,
            detail: sensitiveResult ? 
                `发现${sensitiveResult.output.totalMatches}个敏感词，涉及${sensitiveResult.output.affectedPrograms}个节目` : 
                '尚未执行敏感词扫描'
        };

        result.checklist = [durationCheck, sensitiveCheck];

        if (!durationResult || !sensitiveResult) {
            result.status = CHECK_STATUS.PENDING;
            result.canPublish = false;
            result.failures.push({
                type: ISSUE_TYPE.PUBLISH_BLOCKED,
                message: '请先完成所有检查步骤'
            });
        } else if (durationResult.status === CHECK_STATUS.FAIL) {
            result.status = CHECK_STATUS.FAIL;
            result.canPublish = false;
            result.failures.push({
                type: ISSUE_TYPE.PUBLISH_BLOCKED,
                message: '时长校验未通过，无法发布'
            });
        } else if (sensitiveResult.status === CHECK_STATUS.FAIL) {
            result.status = CHECK_STATUS.FAIL;
            result.canPublish = false;
            result.failures.push({
                type: ISSUE_TYPE.PUBLISH_BLOCKED,
                message: '敏感词扫描发现问题，无法发布'
            });
        } else {
            result.status = durationResult.status === CHECK_STATUS.WARNING ? 
                CHECK_STATUS.WARNING : CHECK_STATUS.PASS;
            result.canPublish = true;
        }

        result.output = {
            allChecksPassed: result.canPublish,
            durationWarning: durationResult && durationResult.status === CHECK_STATUS.WARNING
        };

        return result;
    },

    publish: function(scheduleData) {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            status: PUBLISH_STATUS.PUBLISHED,
            message: `节目单已成功发布：${scheduleData.date} ${TIME_SLOTS[scheduleData.slot].name}时段`
        };
    },

    withdraw: function(scheduleData) {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            status: PUBLISH_STATUS.WITHDRAWN,
            message: `节目单已撤回：${scheduleData.date} ${TIME_SLOTS[scheduleData.slot].name}时段`
        };
    },

    formatResult: function(result) {
        const lines = [];
        lines.push(`输入: 时长检查=${result.input.durationStatus}，敏感词检查=${result.input.sensitiveStatus}`);
        lines.push(`输出: 发布许可=${result.canPublish ? '✅ 允许发布' : '❌ 禁止发布'}`);

        lines.push('检查清单:');
        result.checklist.forEach(item => {
            const status = item.checked ? 
                (item.passed ? '✅ 通过' : '❌ 失败') : '⏳ 待检查';
            lines.push(`  ${item.icon} ${item.name}: ${status}`);
            lines.push(`    ${item.detail}`);
        });

        if (result.failures.length > 0) {
            lines.push('失败原因:');
            result.failures.forEach(f => {
                lines.push(`  ❌ ${f.message}`);
            });
        }

        return lines.join('\n');
    }
};
