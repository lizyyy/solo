class MatrixGenerator {
  generate(endpoints, roles) {
    const roleNames = roles.map(r => r.name);
    
    const rows = endpoints.map(endpoint => {
      const row = {
        method: endpoint.method,
        path: endpoint.path,
        operationId: endpoint.operationId,
        summary: endpoint.summary,
        authRequired: endpoint.auth.required,
        authDescription: endpoint.auth.description,
        source: endpoint.source,
        roles: {}
      };
      
      for (const roleName of roleNames) {
        row.roles[roleName] = endpoint.roles.includes(roleName);
      }
      
      return row;
    });
    
    const stats = this._calculateStats(rows, roleNames);
    
    return {
      headers: ['method', 'path', ...roleNames],
      rows,
      roleNames,
      stats
    };
  }

  _calculateStats(rows, roleNames) {
    const roleStats = {};
    
    for (const roleName of roleNames) {
      roleStats[roleName] = {
        total: rows.filter(r => r.roles[roleName]).length,
        percentage: 0
      };
    }
    
    if (rows.length > 0) {
      for (const roleName of roleNames) {
        roleStats[roleName].percentage = 
          (roleStats[roleName].total / rows.length * 100).toFixed(1);
      }
    }
    
    const endpointsWithAuth = rows.filter(r => r.authRequired).length;
    const endpointsWithoutAuth = rows.filter(r => !r.authRequired).length;
    
    return {
      totalEndpoints: rows.length,
      endpointsWithAuth,
      endpointsWithoutAuth,
      authCoverage: rows.length > 0 ? 
        (endpointsWithAuth / rows.length * 100).toFixed(1) : 0,
      roleStats
    };
  }
}

module.exports = {
  MatrixGenerator
};
