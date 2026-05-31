export function checkAuthorization(auth) {
    if (!auth) {
        return {
            status: 'fail',
            label: '未录入',
            reason: '授权信息缺失，没有录入授权方的名称、有效期和授权范围。上次设计师就卡在这里——色卡那版没人留底，授权过期了才发现。',
            nextStep: '请补充授权文件，填写授权方名称、开始日期、截止日期和授权范围后重新导入。如果授权已过期，联系品牌方续签。'
        };
    }

    if (!auth.holder || !auth.endDate || !auth.startDate) {
        return {
            status: 'fail',
            label: '信息不全',
            reason: `授权信息不完整：${!auth.holder ? '缺少授权方名称；' : ''}${!auth.startDate ? '缺少开始日期；' : ''}${!auth.endDate ? '缺少截止日期；' : ''}。无法判断授权是否有效。`,
            nextStep: '请补全授权方名称和起止日期。如果原始授权文件丢失，联系品牌方补发。'
        };
    }

    const now = new Date();
    const start = new Date(auth.startDate);
    const end = new Date(auth.endDate);
    const daysUntilExpiry = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (now < start) {
        return {
            status: 'warn',
            label: '尚未生效',
            reason: `授权方"${auth.holder}"的授权从 ${auth.startDate} 才开始生效，当前日期早于授权起始日。授权范围：${auth.scope || '未填写'}。`,
            nextStep: `等授权生效后（${auth.startDate}）再进行导出。如果需要提前使用，联系"${auth.holder}"确认是否允许。`
        };
    }

    if (daysUntilExpiry < 0) {
        return {
            status: 'fail',
            label: '已过期',
            reason: `授权方"${auth.holder}"的授权已于 ${auth.endDate} 过期，超出有效期 ${Math.abs(daysUntilExpiry)} 天。授权范围：${auth.scope || '未填写'}。上次就是授权过期卡住了整个流程。`,
            nextStep: `联系"${auth.holder}"续签授权。续签前不得导出投放物料。拿到新授权后，重新导入并填写新的截止日期。`
        };
    }

    if (daysUntilExpiry <= 7) {
        return {
            status: 'warn',
            label: '即将过期',
            reason: `授权方"${auth.holder}"的授权将在 ${daysUntilExpiry} 天后（${auth.endDate}）过期。授权范围：${auth.scope || '未填写'}。现在还能用，但导出后如果投放周期超过有效期就有风险。`,
            nextStep: `尽快联系"${auth.holder}"续签。如果本次导出用于短期投放且在有效期内，可以继续，但建议在交付说明里注明授权到期日。`
        };
    }

    if (daysUntilExpiry <= 30) {
        return {
            status: 'pass',
            label: '有效（临近到期）',
            reason: `授权方"${auth.holder}"的授权有效，还剩 ${daysUntilExpiry} 天（截止 ${auth.endDate}）。授权范围：${auth.scope || '未填写'}。当前可以使用，但距离到期不足一个月。`,
            nextStep: `建议在本次导出的交付说明中标注授权到期日，提醒下一班人员关注续签进度。`
        };
    }

    return {
        status: 'pass',
        label: '有效',
        reason: `授权方"${auth.holder}"的授权有效，截止 ${auth.endDate}（剩余 ${daysUntilExpiry} 天）。授权范围：${auth.scope || '未填写'}。`,
        nextStep: '授权状态正常，可以继续导出。'
    };
}
