const { Interpreter } = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { ErrorCodes } = require('../enums');

class InterpreterService {
  static async getAll() {
    return await Interpreter.findAll();
  }

  static async getById(id) {
    const interpreter = await Interpreter.findByPk(id);
    if (!interpreter) {
      throw new NotFoundError('Interpreter', id);
    }
    return interpreter;
  }

  static async getActive() {
    return await Interpreter.findAll({ where: { status: 'active' } });
  }

  static async getByLanguage(language) {
    const all = await this.getActive();
    return all.filter(i => i.languages.includes(language));
  }

  static async create(data) {
    if (!data.id) {
      throw new ValidationError('Interpreter id is required', { field: 'id' });
    }
    if (!data.name) {
      throw new ValidationError('Interpreter name is required', { field: 'name' });
    }
    if (!data.languages || !Array.isArray(data.languages) || data.languages.length === 0) {
      throw new ValidationError('Interpreter languages are required and must be an array', { field: 'languages' });
    }

    const existing = await Interpreter.findByPk(data.id);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Interpreter with this id already exists',
        { id: data.id }
      );
    }

    return await Interpreter.create(data);
  }

  static async update(id, data) {
    const interpreter = await this.getById(id);
    return await interpreter.update(data);
  }

  static async delete(id) {
    const interpreter = await this.getById(id);
    await interpreter.destroy();
    return { success: true };
  }

  static async checkLanguageAbility(interpreterId, language) {
    const interpreter = await this.getById(interpreterId);
    if (!interpreter.languages.includes(language)) {
      throw new ConflictError(
        ErrorCodes.LANGUAGE_MISMATCH,
        `Interpreter does not support language: ${language}`,
        { interpreterId, language, supportedLanguages: interpreter.languages }
      );
    }
    return true;
  }
}

module.exports = InterpreterService;
