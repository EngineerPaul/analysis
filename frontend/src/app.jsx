import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnalysesProvider } from './context/AnalysesContext';
import { AuthProvider } from './context/AuthContext';
import GraphPage from './pages/GraphPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';

const ROOT = import.meta.env.VITE_ROOT_PATH || '/extra/analyses';

/**
 * Root application with routing.
 */
export default function App() {
  return (
    <AuthProvider>
      <AnalysesProvider>
        <BrowserRouter basename={ROOT}>
          <Routes>
            <Route path="/registration" element={<RegistrationPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AnalysesProvider>
    </AuthProvider>
  );
}
