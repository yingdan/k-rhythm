// 本地存储工具函数

const STORAGE_PREFIX = 'ktrainer_';

/**
 * 获取本地存储项
 * @param key 键名
 */
export const getStorage = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
};

/**
 * 设置本地存储项
 * @param key 键名
 * @param value 值
 */
export const setStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to set storage:', error);
  }
};

/**
 * 移除本地存储项
 * @param key 键名
 */
export const removeStorage = (key: string): void => {
  localStorage.removeItem(STORAGE_PREFIX + key);
};

/**
 * 清空所有应用相关的本地存储
 */
export const clearStorage = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

/**
 * 会话存储工具
 */
export const session = {
  get: <T>(key: string): T | null => {
    try {
      const item = sessionStorage.getItem(STORAGE_PREFIX + key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to set session storage:', error);
    }
  },

  remove: (key: string): void => {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  },

  clear: (): void => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  },
};

export default {
  get: getStorage,
  set: setStorage,
  remove: removeStorage,
  clear: clearStorage,
  session,
};
