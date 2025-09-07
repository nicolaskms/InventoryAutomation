import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ComparePage from "./pages/comparepage";
import HistoryPage from "./pages/HistoryPage";
import BlindTemplatePage from "./pages/BlindTemplatePage";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<HistoryPage to="/comparar" replace />} />
            <Route path="/comparar" element={<ComparePage />} />
            <Route path="/relatorio-as-cegas" element={<BlindTemplatePage />} />
            {/* fallback para evitar tela branca */}
            <Route path="*" element={<div>Página não encontrada.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}