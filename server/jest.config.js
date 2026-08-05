module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testRegex: '.*\\.spec\\.ts$',
};
