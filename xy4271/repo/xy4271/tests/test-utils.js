class TestAssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TestAssertionError';
    }
}

export const assert = {
    equal: (actual, expected, message = '') => {
        if (actual !== expected) {
            throw new TestAssertionError(
                `${message} 预期: ${expected}, 实际: ${actual}`
            );
        }
    },
    
    deepEqual: (actual, expected, message = '') => {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new TestAssertionError(
                `${message} 预期: ${expectedStr}, 实际: ${actualStr}`
            );
        }
    },
    
    notEqual: (actual, expected, message = '') => {
        if (actual === expected) {
            throw new TestAssertionError(
                `${message} 预期值不应该等于: ${expected}`
            );
        }
    },
    
    isTrue: (value, message = '') => {
        if (!value) {
            throw new TestAssertionError(
                `${message} 预期为 true, 实际为 ${value}`
            );
        }
    },
    
    isFalse: (value, message = '') => {
        if (value) {
            throw new TestAssertionError(
                `${message} 预期为 false, 实际为 ${value}`
            );
        }
    },
    
    isNull: (value, message = '') => {
        if (value !== null) {
            throw new TestAssertionError(
                `${message} 预期为 null, 实际为 ${value}`
            );
        }
    },
    
    notNull: (value, message = '') => {
        if (value === null) {
            throw new TestAssertionError(
                `${message} 预期不为 null`
            );
        }
    },
    
    throws: (fn, message = '') => {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new TestAssertionError(
                `${message} 预期函数会抛出异常`
            );
        }
    },
    
    doesNotThrow: (fn, message = '') => {
        try {
            fn();
        } catch (e) {
            throw new TestAssertionError(
                `${message} 预期函数不会抛出异常, 但抛出了: ${e.message}`
            );
        }
    },
    
    arrayContains: (array, item, message = '') => {
        if (!array.includes(item)) {
            throw new TestAssertionError(
                `${message} 预期数组包含 ${item}`
            );
        }
    },
    
    arrayNotContains: (array, item, message = '') => {
        if (array.includes(item)) {
            throw new TestAssertionError(
                `${message} 预期数组不包含 ${item}`
            );
        }
    }
};

export class TestRunner {
    constructor() {
        this.tests = [];
        this.currentSuite = null;
    }

    describe(suiteName, fn) {
        this.currentSuite = suiteName;
        fn();
        this.currentSuite = null;
    }

    it(testName, fn) {
        this.tests.push({
            suite: this.currentSuite || '默认测试套件',
            name: testName,
            fn
        });
    }

    async run() {
        const results = {
            total: 0,
            passed: 0,
            failed: 0,
            suites: {}
        };

        let currentSuite = null;
        let suiteResults = { passed: 0, failed: 0, tests: [] };

        for (const test of this.tests) {
            if (currentSuite !== test.suite) {
                if (currentSuite !== null) {
                    results.suites[currentSuite] = suiteResults;
                }
                currentSuite = test.suite;
                suiteResults = { passed: 0, failed: 0, tests: [] };
            }

            results.total++;
            const testResult = {
                name: test.name,
                passed: false,
                error: null,
                duration: 0
            };

            const startTime = Date.now();
            try {
                await test.fn();
                testResult.passed = true;
                results.passed++;
                suiteResults.passed++;
            } catch (error) {
                testResult.error = error.message;
                results.failed++;
                suiteResults.failed++;
            }
            testResult.duration = Date.now() - startTime;

            suiteResults.tests.push(testResult);
        }

        if (currentSuite !== null) {
            results.suites[currentSuite] = suiteResults;
        }

        return results;
    }

    printResults(results) {
        console.log('\n========================================');
        console.log('测试结果汇总');
        console.log('========================================\n');

        for (const [suiteName, suiteResult] of Object.entries(results.suites)) {
            console.log(`📁 ${suiteName}`);
            console.log(`   通过: ${suiteResult.passed} | 失败: ${suiteResult.failed}\n`);

            for (const test of suiteResult.tests) {
                const icon = test.passed ? '✅' : '❌';
                const status = test.passed ? '通过' : '失败';
                console.log(`   ${icon} [${status}] ${test.name} (${test.duration}ms)`);
                
                if (!test.passed && test.error) {
                    console.log(`      错误: ${test.error}`);
                }
            }
            console.log('');
        }

        console.log('========================================');
        console.log(`总计: ${results.total} 个测试`);
        console.log(`通过: ${results.passed}`);
        console.log(`失败: ${results.failed}`);
        
        if (results.failed === 0) {
            console.log('\n🎉 所有测试通过!');
        } else {
            console.log('\n⚠️  有测试失败, 请检查代码');
        }
        console.log('========================================\n');

        return results.failed === 0;
    }
}

export const runner = new TestRunner();
export const describe = runner.describe.bind(runner);
export const it = runner.it.bind(runner);
