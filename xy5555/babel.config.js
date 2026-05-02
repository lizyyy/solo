module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    ['babel-preset-taro', {
      framework: 'react',
      ts: true,
      compiler: {
        type: 'webpack5'
      }
    }]
  ]
}
