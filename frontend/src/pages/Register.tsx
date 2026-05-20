import { Typography } from '@mui/material';
import { RegisterForm } from '../components/auth/RegisterForm';

export const Register: React.FC = () => {
  return (
    <>
      <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>
        KTrainer
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" mb={4}>
        K线模拟训练系统
      </Typography>
      <RegisterForm />
    </>
  );
};
