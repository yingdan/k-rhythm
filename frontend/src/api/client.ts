import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：统一错误处理
apiClient.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code !== 200 && res.code !== undefined) {
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res;
  },
  (error) => {
    // 忽略 401 错误，不跳转登录页（Training 等页面不需要登录）
    if (error.response?.status === 401) {
      return Promise.resolve({ data: null, message: '未登录，跳过' });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
