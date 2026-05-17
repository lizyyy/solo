class RoleExtractor {
  extractRoles(endpoints, predefinedRoles = []) {
    const roleSet = new Set(predefinedRoles);
    
    for (const endpoint of endpoints) {
      if (endpoint.roles && Array.isArray(endpoint.roles)) {
        endpoint.roles.forEach(role => roleSet.add(role));
      }
      
      if (endpoint.auth?.description) {
        const extractedRoles = this._extractRolesFromText(endpoint.auth.description);
        extractedRoles.forEach(role => roleSet.add(role));
      }
      
      if (endpoint.description) {
        const extractedRoles = this._extractRolesFromText(endpoint.description);
        extractedRoles.forEach(role => roleSet.add(role));
      }
    }
    
    const roles = Array.from(roleSet).sort();
    
    return roles.map(role => ({
      name: role,
      endpointsCount: endpoints.filter(e => 
        e.roles && e.roles.includes(role)
      ).length
    }));
  }

  _extractRolesFromText(text) {
    const roles = [];
    
    const patterns = [
      /(?:需要|需要角色|requires|role)[：:]\s*([^\n,，；;]+)/gi,
      /(?:角色|权限)[：:]\s*([^\n,，；;]+)/gi,
      /\b(admin|user|guest|manager|editor|viewer|owner|member)\b/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const roleStr = match[1] || match[0];
        const parts = roleStr.split(/[,，、/\\]/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed && trimmed.length < 50) {
            roles.push(trimmed);
          }
        }
      }
    }
    
    return [...new Set(roles)];
  }
}

module.exports = {
  RoleExtractor
};
