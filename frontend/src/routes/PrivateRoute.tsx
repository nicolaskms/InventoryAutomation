import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface PrivateRouteProps {
  children: JSX.Element;
}

/**
 * Uso:
 * <Route path="/digitacao" element={<PrivateRoute><Digitacao/></PrivateRoute>} />
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;