import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { Header } from '../components/common/Header';

export const MainLayout: React.FC = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
};
