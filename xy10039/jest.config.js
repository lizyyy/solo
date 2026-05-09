module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/config/**',
    '!src/scripts/**'
  ],
  testTimeout: 30000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/src/tests/jest.setup.ts']
};
