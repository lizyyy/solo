const IssueManager = {
    issues: [],
    issueIdCounter: 0,

    addDurationIssues: function(durationResult, sourceData) {
        const issues = [];

        durationResult.failures.forEach(failure => {
            const issue = this.createIssue({
                level: ISSUE_LEVEL.ERROR,
                type: failure.type,
                title: failure.message,
                detail: JSON.stringify({
                    value: failure.value,
                    limit: failure.limit,
                    exceed: failure.exceed,
                    program: failure.program
                }, null, 2),
                source: 'duration-validator',
                sourceData: sourceData
            });
            issues.push(issue);
        });

        durationResult.warnings.forEach(warning => {
            const issue = this.createIssue({
                level: ISSUE_LEVEL.WARNING,
                type: warning.type,
                title: warning.message,
                detail: JSON.stringify({
                    value: warning.value,
                    limit: warning.limit,
                    remaining: warning.remaining
                }, null, 2),
                source: 'duration-validator',
                sourceData: sourceData
            });
            issues.push(issue);
        });

        return issues;
    },

    addSensitiveIssues: function(sensitiveResult, sourceData) {
        const issues = [];

        sensitiveResult.failures.forEach(failure => {
            const issue = this.createIssue({
                level: ISSUE_LEVEL.ERROR,
                type: failure.type,
                title: failure.message,
                detail: JSON.stringify({
                    word: failure.word,
                    position: failure.position,
                    context: failure.context,
                    program: failure.program
                }, null, 2),
                source: 'sensitive-scanner',
                sourceData: sourceData
            });
            issues.push(issue);
        });

        return issues;
    },

    addPublishIssue: function(publishResult, sourceData) {
        const issues = [];

        publishResult.failures.forEach(failure => {
            const issue = this.createIssue({
                level: ISSUE_LEVEL.ERROR,
                type: failure.type,
                title: failure.message,
                detail: JSON.stringify({
                    durationStatus: publishResult.input.durationStatus,
                    sensitiveStatus: publishResult.input.sensitiveStatus
                }, null, 2),
                source: 'publish-gate',
                sourceData: sourceData
            });
            issues.push(issue);
        });

        return issues;
    },

    addWithdrawInfo: function(withdrawResult, sourceData) {
        const issue = this.createIssue({
            level: ISSUE_LEVEL.INFO,
            type: ISSUE_TYPE.WITHDRAW_SUCCESS,
            title: withdrawResult.message,
            detail: JSON.stringify({
                timestamp: withdrawResult.timestamp,
                status: withdrawResult.status
            }, null, 2),
            source: 'publish-gate-withdraw',
            sourceData: sourceData
        });
        return [issue];
    },

    createIssue: function(params) {
        this.issueIdCounter++;
        const issue = {
            id: this.issueIdCounter,
            level: params.level,
            type: params.type,
            title: params.title,
            detail: params.detail,
            source: params.source,
            sourceData: params.sourceData,
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };
        this.issues.unshift(issue);
        return issue;
    },

    getAll: function() {
        return this.issues;
    },

    clear: function() {
        this.issues = [];
        this.issueIdCounter = 0;
    },

    getByType: function(type) {
        return this.issues.filter(i => i.type === type);
    },

    getByLevel: function(level) {
        return this.issues.filter(i => i.level === level);
    },

    formatIssue: function(issue) {
        const levelText = {
            [ISSUE_LEVEL.ERROR]: '错误',
            [ISSUE_LEVEL.WARNING]: '警告',
            [ISSUE_LEVEL.INFO]: '信息'
        };
        const sourceText = {
            'duration-validator': '时长校验',
            'sensitive-scanner': '敏感词扫描',
            'publish-gate': '发布门禁',
            'publish-gate-withdraw': '撤回操作'
        };

        return {
            levelText: levelText[issue.level],
            sourceText: sourceText[issue.source] || issue.source,
            timeText: new Date(issue.timestamp).toLocaleString('zh-CN')
        };
    }
};
