import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Training } from './pages/Training';
import { Review } from './pages/Review';
import { Leaderboard } from './pages/Leaderboard';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* 认证路由 */}
        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
          />
        </Route>

        {/* 主应用路由 - 免登录页面 */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/training/:symbolCode" element={<Training />} />
        </Route>

        {/* 需要登录的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/review/:sessionId" element={<Review />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Route>
        </Route>

        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
