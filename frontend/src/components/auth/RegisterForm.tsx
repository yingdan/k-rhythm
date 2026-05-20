import { useState } from 'react';
import { Paper, TextField, Button, Typography, Box, Alert } from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { consumePendingTrainingReturnTo, migrateGuestTrainingSnapshot } from '../../utils/trainingPersistence';

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      const { access_token, user } = response.data;
      login(access_token, user);
      migrateGuestTrainingSnapshot(user.id);
      navigate(consumePendingTrainingReturnTo() || '/');
    } catch (err: any) {
      // 如果后端未启动，使用模拟注册
      if (err.code === 'ERR_NETWORK' || err.response?.status === 404) {
        const user = { id: form.username || '1', username: form.username, email: form.email };
        login('mock-token', user);
        migrateGuestTrainingSnapshot(user.id);
        navigate(consumePendingTrainingReturnTo() || '/');
      } else {
        setError(err.response?.data?.message || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom align="center">
        注册
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
          label="邮箱"
          type="email"
          fullWidth
          margin="normal"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
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
        <TextField
          label="确认密码"
          type="password"
          fullWidth
          margin="normal"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </Button>
      </form>
      <Box mt={2} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          已有账号？<Link to="/login">立即登录</Link>
        </Typography>
      </Box>
    </Paper>
  );
};
