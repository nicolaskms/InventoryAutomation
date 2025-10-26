import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ComparePage from "./pages/comparepage";
import BlankReportPage from "./pages/BlankReportPage";
import FormularioDigitacaoPage from "./pages/FormularioDigitacaoPage";
import Login from "./components/Login";
import PrivateRoute from "./routes/PrivateRoute";
import { useAuth } from "./auth/AuthContext";

function App() {
  const { isAuthenticated } = useAuth();

  // Se não estiver autenticado, exibir somente a tela de login (sem Sidebar)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  // Usuário autenticado: layout com Sidebar e rotas protegidas
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-6 overflow-y-auto">
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <ComparePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/blank-report"
            element={
              <PrivateRoute>
                <BlankReportPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/formulario-digitacao"
            element={
              <PrivateRoute>
                <FormularioDigitacaoPage />
              </PrivateRoute>
            }
          />
          {/* Caso queira rota de logout ou outras rotas autenticadas, adicione aqui */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;