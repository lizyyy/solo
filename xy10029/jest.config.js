module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/seed.ts',
    '!src/main/index.ts',
    '!src/renderer/**/*'
  ]
}
