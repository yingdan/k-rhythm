import { useState } from 'react';
import { Paper, TextField, Button, Typography, Box, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';
import { consumePendingTrainingReturnTo, migrateGuestTrainingSnapshot } from '../../utils/trainingPersistence';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(form);
      const { access_token, user } = response.data;
      login(access_token, user);
      migrateGuestTrainingSnapshot(user.id);
      navigate(consumePendingTrainingReturnTo() || '/');
    } catch (err: any) {
      // 如果后端未启动，使用模拟登录
      if (err.code === 'ERR_NETWORK' || err.response?.status === 404) {
        const user = { id: form.username || '1', username: form.username, email: `${form.username}@test.com` };
        login('mock-token', user);
        migrateGuestTrainingSnapshot(user.id);
        navigate(consumePendingTrainingReturnTo() || '/');
      } else {
        setError(err.response?.data?.message || '登录失败，请检查用户名和密码');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom align="center">
        登录
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <TextField
          label="用户名"
          fullWidth
          margin="normal"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <TextField
          label="密码"
          type="password"
          fullWidth
          margin="normal"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
      <Box mt={2} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          还没有账号？<a href="/register">立即注册</a>
        </Typography>
      </Box>
    </Paper>
  );
};
