module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/cli.js',
        '!src/server.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 10000,
    verbose: true
};
