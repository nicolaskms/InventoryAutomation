import React from "react";
import { NavLink } from "react-router-dom";

const base = "block px-4 py-2 rounded-lg hover:bg-zinc-200";
const active = "bg-zinc-900 text-white hover:bg-zinc-900";

export default function Sidebar() {
  return (
    <aside className="w-64 p-4 bg-white border-r border-zinc-200 min-h-screen">
      <div className="text-lg font-bold mb-4">Inventory Automation</div>
      <nav className="space-y-2">
        <NavLink
          to="/comparar"
          className={({ isActive }) => `${base} ${isActive ? active : ""}`}
        >
          Comparar Planilhas
        </NavLink>
        <NavLink
          to="/relatorio-as-cegas"
          className={({ isActive }) => `${base} ${isActive ? active : ""}`}
        >
          Relatório às Cegas
        </NavLink>
      </nav>
    </aside>
  );
}