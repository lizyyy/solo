import { hashPassword, verifyPassword } from '../src/utils/password'

describe('password utilities', () => {
  it('should hash password consistently', () => {
    const password = 'test123'
    const hash1 = hashPassword(password)
    const hash2 = hashPassword(password)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
  })

  it('should verify correct password', () => {
    const password = 'mypassword'
    const hash = hashPassword(password)
    expect(verifyPassword(password, hash)).toBe(true)
  })

  it('should reject wrong password', () => {
    const password = 'correct123'
    const hash = hashPassword(password)
    expect(verifyPassword('wrong123', hash)).toBe(false)
  })

  it('should handle empty password', () => {
    const hash = hashPassword('')
    expect(verifyPassword('', hash)).toBe(true)
    expect(verifyPassword('notempty', hash)).toBe(false)
  })
})
