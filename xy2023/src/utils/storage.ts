import CryptoJS from 'crypto-js';

const STORAGE_KEYS = {
  USER_PROFILE: 'menstrual_care_user_profile',
  CYCLE_RECORDS: 'menstrual_care_cycle_records',
  DIARY_ENTRIES: 'menstrual_care_diary_entries',
  DIARY_SETTINGS: 'menstrual_care_diary_settings',
  CHECK_INS: 'menstrual_care_check_ins',
  PAIN_RECORDS: 'menstrual_care_pain_records',
  POSTS: 'menstrual_care_posts',
  COMMENTS: 'menstrual_care_comments',
  CONSTITUTION_ANSWERS: 'menstrual_care_constitution_answers',
};

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  clear: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
};

export const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString();
};

export const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

export const encryptContent = (content: string, password: string): string => {
  return CryptoJS.AES.encrypt(content, password).toString();
};

export const decryptContent = (encryptedContent: string, password: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
};

export { STORAGE_KEYS };
