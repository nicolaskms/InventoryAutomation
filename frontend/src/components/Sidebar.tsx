import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div className="w-64 bg-yellow-400 p-6">
      <h1 className="text-lg font-bold mb-6">Inventory Automation</h1>
      <nav className="flex flex-col gap-3">
        <Link to="/" className="hover:font-semibold">Comparar Planilhas</Link>
        <Link to="/blank-report" className="hover:font-semibold">Relatório as Cegas</Link>
        <Link to="/history" className="hover:font-semibold">Histórico</Link>
      </nav>
    </div>
  );
}