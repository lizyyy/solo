const TestData = {
    normal: {
        name: '正常场景',
        description: '模拟日常运营状态，车辆流量适中，闸口配置合理',
        config: {
            peakArrivalRate: 2,
            offPeakArrivalRate: 1,
            maxQueueSize: 100,
            peakStrategy: 'fixed',
            offPeakStrategy: 'fixed',
            peakGates: 5,
            offPeakGates: 2,
            processingTime: 2
        },
        expectedResults: {
            overflowCount: 0,
            averageWaitTime: 5,
            status: 'pass'
        }
    },

    overflow: {
        name: '队列溢出场景',
        description: '模拟高峰时段车辆激增导致队列溢出，用于测试溢出处理能力',
        config: {
            peakArrivalRate: 4,
            offPeakArrivalRate: 2,
            maxQueueSize: 20,
            peakStrategy: 'fixed',
            offPeakStrategy: 'fixed',
            peakGates: 3,
            offPeakGates: 1,
            processingTime: 2
        },
        expectedResults: {
            overflowCount: '>0',
            averageWaitTime: 15,
            status: 'fail'
        }
    },

    strategy_change: {
        name: '策略调整场景',
        description: '模拟需要策略切换的情况，用于验证策略切换的正确性',
        config: {
            peakArrivalRate: 3,
            offPeakArrivalRate: 1,
            maxQueueSize: 50,
            peakStrategy: 'elastic',
            offPeakStrategy: 'elastic',
            peakGates: 3,
            offPeakGates: 2,
            processingTime: 2
        },
        expectedResults: {
            strategyChangeCount: '>0',
            overflowCount: 0,
            status: 'pass'
        }
    },

    getConfig: function(scenario) {
        if (this[scenario]) {
            return this[scenario].config;
        }
        return null;
    },

    getAllScenarios: function() {
        return {
            normal: this.normal,
            overflow: this.overflow,
            strategy_change: this.strategy_change
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestData };
}
