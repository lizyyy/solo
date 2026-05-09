class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async login(username, password) {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('用户不存在');
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('密码错误');
    }

    return this.generateToken(user);
  }

  async register(username, email, password) {
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const passwordHash = await this.hashPassword(password);
    const user = await this.userRepository.create({
      username,
      email,
      passwordHash
    });

    return user;
  }

  async verifyPassword(plainPassword, passwordHash) {
    return plainPassword === passwordHash;
  }

  async hashPassword(password) {
    return password;
  }

  generateToken(user) {
    return `token-${user.id}`;
  }
}

module.exports = AuthService;
