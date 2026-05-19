export class DataMasker {
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return '***';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  static maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 8) return '***';
    return idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4);
  }

  static maskName(name: string): string {
    if (!name || name.length <= 1) return '*';
    if (name.length === 2) return name.charAt(0) + '*';
    return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
  }

  static maskField(value: string, fieldType: 'phone' | 'idCard' | 'name' | 'default'): string {
    switch (fieldType) {
      case 'phone':
        return this.maskPhone(value);
      case 'idCard':
        return this.maskIdCard(value);
      case 'name':
        return this.maskName(value);
      default:
        return '***';
    }
  }

  static maskObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
  ): Partial<T> {
    const masked = { ...obj } as Partial<T>;
    
    for (const field of sensitiveFields) {
      if (masked[field] !== undefined) {
        const value = String(masked[field]);
        let fieldType: 'phone' | 'idCard' | 'name' | 'default' = 'default';
        
        const fieldStr = String(field).toLowerCase();
        if (fieldStr.includes('phone') || fieldStr.includes('电话') || fieldStr.includes('手机')) {
          fieldType = 'phone';
        } else if (fieldStr.includes('idcard') || fieldStr.includes('身份证') || fieldStr.includes('id_card')) {
          fieldType = 'idCard';
        } else if (fieldStr.includes('name') || fieldStr.includes('姓名')) {
          fieldType = 'name';
        }
        
        (masked as any)[field] = this.maskField(value, fieldType);
      }
    }
    
    return masked;
  }

  static forLog<T>(obj: T): string {
    try {
      const str = JSON.stringify(obj);
      const masked = str
        .replace(/\d{11}/g, (match) => this.maskPhone(match))
        .replace(/\d{17}[\dXx]/g, (match) => this.maskIdCard(match));
      return masked;
    } catch {
      return String(obj);
    }
  }
}
