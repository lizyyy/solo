export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  env: process.env.NODE_ENV || 'development',

  validate() {
    const errors: string[] = [];
    if (isNaN(this.port)) {
      errors.push('PORT 必须是有效的数字');
    }
    return errors;
  },

  getMissingConfigMessage() {
    const errors = this.validate();
    if (errors.length === 0) return null;
    return `配置检查失败:\n${errors.map(e => '- ' + e).join('\n')}`;
  }
};
