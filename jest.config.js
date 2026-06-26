module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    modulePathIgnorePatterns: ['<rootDir>/dist/'],
    collectCoverage: true,
    collectCoverageFrom: [
        'libs/**/*.js',
        '!libs/**/*.test.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true
};
