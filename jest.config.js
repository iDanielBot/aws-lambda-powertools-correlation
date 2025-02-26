module.exports = {
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.ts?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  coveragePathIgnorePatterns: ['__tests__', 'node_modules'],
  modulePathIgnorePatterns: ['__tests__', 'node_modules'],
  transformIgnorePatterns: ['node_modules'],
  testEnvironment: 'node',
  silent: true,
  verbose: true
}
