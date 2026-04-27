export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/detail/detail',
    'pages/compare/compare',
    'pages/favorites/favorites',
    'pages/profile/profile',
    'pages/budget-calculator/budget-calculator'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#10b981',
    navigationBarTitleText: '25平米全屋定制',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#9ca3af',
    selectedColor: '#10b981',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/favorites/favorites',
        text: '收藏'
      },
      {
        pagePath: 'pages/profile/profile',
        text: '我的'
      }
    ]
  }
})
