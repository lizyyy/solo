class MissingDetector {
  detect(endpoints, roles) {
    const missing = [];
    
    for (const endpoint of endpoints) {
      if (!endpoint.auth.required) {
        missing.push({
          type: 'no_auth_required',
          endpoint: {
            method: endpoint.method,
            path: endpoint.path
          },
          message: '接口未配置鉴权要求',
          source: endpoint.source
        });
      }
      
      if (endpoint.auth.required && endpoint.roles.length === 0) {
        missing.push({
          type: 'no_roles_defined',
          endpoint: {
            method: endpoint.method,
            path: endpoint.path
          },
          message: '接口需要鉴权但未配置角色',
          source: endpoint.source
        });
      }
      
      if (endpoint.auth.required && !endpoint.auth.description) {
        missing.push({
          type: 'no_auth_description',
          endpoint: {
            method: endpoint.method,
            path: endpoint.path
          },
          message: '接口缺少鉴权说明',
          source: endpoint.source
        });
      }
    }
    
    return missing;
  }
}

module.exports = {
  MissingDetector
};
