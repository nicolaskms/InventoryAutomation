import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ComparePage from "./pages/comparepage";
import BlankReportPage from "./pages/BlankReportPage";
import FormularioDigitacaoPage from "./pages/FormularioDigitacaoPage";

function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-6 overflow-y-auto">
        <Routes>
          <Route path="/" element={<ComparePage />} />
          <Route path="/blank-report" element={<BlankReportPage />} />
          <Route path="/formulario-digitacao" element={<FormularioDigitacaoPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;