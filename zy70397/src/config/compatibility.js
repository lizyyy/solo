const compatibilityConfig = {
  versions: {
    minimumSupported: '1.0.0',
    current: '2.0.0',
    deprecated: ['1.0.0', '1.1.0', '1.2.0'],
    deprecationWarning: '该版本即将下线，请尽快升级到最新版本'
  },
  
  fieldMappings: [
    {
      oldField: 'user_name',
      newField: 'username',
      description: '用户名字段重命名',
      deprecatedSince: '1.0.0'
    },
    {
      oldField: 'mobile_phone',
      newField: 'phone',
      description: '手机号字段重命名',
      deprecatedSince: '1.0.0'
    },
    {
      oldField: 'user_age',
      newField: 'age',
      description: '年龄字段重命名',
      deprecatedSince: '1.0.0'
    },
    {
      oldField: 'home_address',
      newField: 'address',
      description: '地址字段重命名',
      deprecatedSince: '1.0.0'
    }
  ],
  
  deprecatedFields: [
    {
      field: 'legacy_id',
      warning: '该字段即将下线，请迁移到新字段',
      willBeRemoved: '2.1.0',
      suggestion: '请使用新的身份验证机制'
    },
    {
      field: 'old_token',
      warning: '旧token格式即将停止支持',
      willBeRemoved: '2.0.0',
      suggestion: '请升级到新的JWT token格式'
    }
  ],
  
  newFieldsWithDefaults: [
    {
      field: 'deviceType',
      defaultValue: 'unknown',
      description: '设备类型',
      introducedIn: '1.2.0'
    },
    {
      field: 'appSource',
      defaultValue: 'official',
      description: '应用来源渠道',
      introducedIn: '1.2.0'
    },
    {
      field: 'isWebview',
      defaultValue: false,
      description: '是否在Webview中打开',
      introducedIn: '1.2.0'
    }
  ],
  
  grayFields: [
    {
      field: 'newFeatureEnabled',
      minimumVersion: '1.5.0',
      description: '新功能开关字段，仅1.5.0以上版本可用'
    },
    {
      field: 'premiumSubscription',
      minimumVersion: '1.8.0',
      description: '高级订阅字段，仅1.8.0以上版本可用'
    }
  ],
  
  idempotentEndpoints: [
    '/api/user/profile',
    '/api/order/create'
  ]
};

module.exports = compatibilityConfig;
