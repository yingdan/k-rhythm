import { AppBar, Toolbar, Typography, Button, Box, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 'bold' }}
          onClick={() => navigate('/')}
        >
          K-Rhythm
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {user && (
            <>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2">{user.username}</Typography>
              <Button variant="outlined" size="small" onClick={handleLogout}>
                退出
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
