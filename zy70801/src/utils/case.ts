const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

export const convertKeysToCamelCase = <T = any>(obj: any): T => {
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysToCamelCase(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result: any, key) => {
      const camelKey = toCamelCase(key);
      result[camelKey] = convertKeysToCamelCase(obj[key]);
      return result;
    }, {}) as T;
  }

  return obj;
};
