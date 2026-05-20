import { Typography } from '@mui/material';
import { LoginForm } from '../components/auth/LoginForm';

export const Login: React.FC = () => {
  return (
    <>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>
        KTrainer
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" mb={4}>
        K线模拟训练系统
      </Typography>
      <LoginForm />
    </>
  );
};
