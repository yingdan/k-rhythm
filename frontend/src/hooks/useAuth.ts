import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi, LoginRequest, RegisterRequest } from '../api/auth';

export const useAuth = () => {
  const { user, token, isAuthenticated, login, logout, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (credentials: LoginRequest) => {
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(credentials);
      const { access_token, user } = response.data;
      login(access_token, user);
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || '登录失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (credentials: RegisterRequest) => {
    setLoading(true);
    setError('');

    try {
      const response = await authApi.register(credentials);
      const { access_token, user } = response.data;
      login(access_token, user);
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.message || '注册失败';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const checkAuth = async () => {
    if (!token) return false;

    try {
      const response = await authApi.getProfile();
      setUser(response.data);
      return true;
    } catch {
      logout();
      return false;
    }
  };

  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, []);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    checkAuth,
  };
};
