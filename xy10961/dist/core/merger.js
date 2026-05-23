"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeData = mergeData;
const default_1 = require("../config/default");
const chalk_1 = __importDefault(require("chalk"));
function mergeData(visitRecords, channelRecords, badRecords, originalVisitCount, originalChannelCount) {
    console.log(chalk_1.default.blue('\n🔄 正在合并数据...'));
    const phoneMap = new Map();
    visitRecords.forEach(record => {
        if (!phoneMap.has(record.归一化电话)) {
            phoneMap.set(record.归一化电话, { visits: [], channels: [] });
        }
        phoneMap.get(record.归一化电话).visits.push(record);
    });
    channelRecords.forEach(record => {
        if (!phoneMap.has(record.归一化电话)) {
            phoneMap.set(record.归一化电话, { visits: [], channels: [] });
        }
        phoneMap.get(record.归一化电话).channels.push(record);
    });
    console.log(chalk_1.default.green(`  ✅ 发现 ${phoneMap.size} 个唯一客户`));
    const mergedRecords = [];
    const customPriority = default_1.defaultConfig.渠道优先级;
    phoneMap.forEach(({ visits, channels }, phone) => {
        const allRecords = [...visits, ...channels];
        const allChannels = [
            ...new Set([
                ...visits.map(v => v.渠道名称).filter(Boolean),
                ...channels.map(c => c.渠道名称).filter(Boolean)
            ])
        ];
        const allAdvisors = [
            ...new Set([
                ...visits.map(v => v.置业顾问).filter(Boolean),
                ...channels.map(c => c.置业顾问).filter(Boolean)
            ])
        ];
        let finalChannel = allChannels[0] || '未知渠道';
        let maxPriority = Infinity;
        allChannels.forEach(channel => {
            const idx = customPriority.indexOf(channel);
            if (idx !== -1 && idx < maxPriority) {
                maxPriority = idx;
                finalChannel = channel;
            }
        });
        const allStatuses = [
            ...new Set([
                ...visits.map(v => v.认领状态).filter(Boolean),
                ...channels.map(c => c.认领状态).filter(Boolean)
            ])
        ];
        let finalStatus = allStatuses[0] || '未认领';
        let maxStatusPriority = Infinity;
        allStatuses.forEach(status => {
            const idx = default_1.defaultConfig.认领状态优先级.findIndex(s => status.includes(s) || s.includes(status));
            if (idx !== -1 && idx < maxStatusPriority) {
                maxStatusPriority = idx;
                finalStatus = status;
            }
        });
        const allNames = [
            ...new Set([
                ...visits.map(v => v.客户姓名).filter(Boolean),
                ...channels.map(c => c.客户姓名).filter(Boolean)
            ])
        ];
        const visitDates = visits.map(v => v.来访日期).filter(Boolean);
        visitDates.sort();
        const isDuplicate = allChannels.length > 1 || allAdvisors.length > 1;
        const mergedRecord = {
            归一化电话: phone,
            客户姓名: allNames[0] || '未知客户',
            最终渠道: finalChannel,
            最终置业顾问: allAdvisors[0] || '未分配',
            最终认领状态: finalStatus,
            首次来访日期: visitDates[0],
            来访次数: visits.length,
            涉及渠道数量: allChannels.length,
            涉及顾问数量: allAdvisors.length,
            是否重复认领: isDuplicate,
            重复认领渠道: isDuplicate ? allChannels : [],
            重复认领顾问: isDuplicate ? allAdvisors : [],
            原始来访记录行号: visits.map(v => v.原始行号),
            原始渠道记录行号: channels.map(c => c.原始行号),
            所有来访记录: visits,
            所有渠道记录: channels
        };
        mergedRecords.push(mergedRecord);
    });
    const duplicateCount = mergedRecords.filter(r => r.是否重复认领).length;
    console.log(chalk_1.default.yellow(`  ⚠️  发现 ${duplicateCount} 个重复认领客户`));
    const advisorSummary = generateAdvisorSummary(mergedRecords);
    const channelSummary = generateChannelSummary(mergedRecords);
    return {
        合并记录: mergedRecords,
        顾问汇总: advisorSummary,
        渠道汇总: channelSummary,
        坏记录: badRecords,
        统计: {
            原始来访记录数: originalVisitCount,
            原始渠道记录数: originalChannelCount,
            有效来访记录数: visitRecords.length,
            有效渠道记录数: channelRecords.length,
            合并后客户数: mergedRecords.length,
            重复认领客户数: duplicateCount,
            坏记录数: badRecords.length
        }
    };
}
function generateAdvisorSummary(mergedRecords) {
    const advisorMap = new Map();
    mergedRecords.forEach(record => {
        const advisors = [...new Set([
                ...record.所有来访记录.map(v => v.置业顾问).filter(Boolean),
                ...record.所有渠道记录.map(c => c.置业顾问).filter(Boolean)
            ])];
        const channels = [...new Set([
                ...record.所有来访记录.map(v => v.渠道名称).filter(Boolean),
                ...record.所有渠道记录.map(c => c.渠道名称).filter(Boolean)
            ])];
        advisors.forEach(advisor => {
            if (!advisorMap.has(advisor)) {
                advisorMap.set(advisor, {
                    clients: new Set(),
                    duplicateClients: new Set(),
                    channels: new Set()
                });
            }
            const data = advisorMap.get(advisor);
            data.clients.add(record.归一化电话);
            if (record.是否重复认领) {
                data.duplicateClients.add(record.归一化电话);
            }
            channels.forEach(ch => data.channels.add(ch));
        });
    });
    const summary = [];
    advisorMap.forEach((data, advisor) => {
        summary.push({
            置业顾问: advisor,
            认领客户数: data.clients.size,
            重复认领数: data.duplicateClients.size,
            涉及渠道: Array.from(data.channels)
        });
    });
    return summary.sort((a, b) => b.认领客户数 - a.认领客户数);
}
function generateChannelSummary(mergedRecords) {
    const channelMap = new Map();
    mergedRecords.forEach(record => {
        const channels = [...new Set([
                ...record.所有来访记录.map(v => v.渠道名称).filter(Boolean),
                ...record.所有渠道记录.map(c => c.渠道名称).filter(Boolean)
            ])];
        const advisors = [...new Set([
                ...record.所有来访记录.map(v => v.置业顾问).filter(Boolean),
                ...record.所有渠道记录.map(c => c.置业顾问).filter(Boolean)
            ])];
        channels.forEach(channel => {
            if (!channelMap.has(channel)) {
                channelMap.set(channel, {
                    clients: new Set(),
                    duplicateClients: new Set(),
                    advisors: new Set()
                });
            }
            const data = channelMap.get(channel);
            data.clients.add(record.归一化电话);
            if (record.是否重复认领) {
                data.duplicateClients.add(record.归一化电话);
            }
            advisors.forEach(adv => data.advisors.add(adv));
        });
    });
    const summary = [];
    channelMap.forEach((data, channel) => {
        summary.push({
            渠道名称: channel,
            认领客户数: data.clients.size,
            重复认领数: data.duplicateClients.size,
            涉及顾问: Array.from(data.advisors)
        });
    });
    return summary.sort((a, b) => b.认领客户数 - a.认领客户数);
}
