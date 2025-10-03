import React, { useState } from "react";
import { postFormDraft, postFormExport, downloadBlob } from "../lib/api";
import AutoCompleteCell from "../components/AutoCompleteCell";
import DropZone from "../components/DropZone";

type Row = Record<string, string>;

function extrairRuas(rows: Row[]): string[] {
  const ruasSet = new Set<string>();
  rows.forEach((linha) => {
    const posicao = linha["gaveta"] || linha["Posicao"];
    if (posicao && posicao.length >= 1) {
      const rua = posicao.trim()[0].toUpperCase();
      ruasSet.add(rua);
    }
  });
  return Array.from(ruasSet).sort();
}

function filtrarPorRua(rows: Row[], rua: string): Row[] {
  if (rua === "Todas") return rows;
  return rows.filter((linha) => {
    const posicao = linha["gaveta"] || linha["Posicao"];
    if (!posicao) return false;
    return posicao.trim().toUpperCase().startsWith(rua.toUpperCase());
  });
}

export default function FormularioDigitacaoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [orderedGavetas, setOrderedGavetas] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Novos estados para filtro de rua
  const [ruas, setRuas] = useState<string[]>([]);
  const [ruaSelecionada, setRuaSelecionada] = useState<string>("Todas");
  const [rowsFiltrados, setRowsFiltrados] = useState<Row[]>([]);

  async function handleGenerate() {
    if (!file) return;
    setLoading(true);
    try {
      const data = await postFormDraft(file);
      setColumns(data.columns);
      setRows(data.base_rows);
      setSuggestions(data.suggestions);
      setOrderedGavetas(data.ordered_gavetas);
      setDraftLoaded(true);
      // Extrai ruas da planilha
      const extraidas = extrairRuas(data.base_rows);
      setRuas(["Todas", ...extraidas]);
      setRuaSelecionada("Todas");
      setRowsFiltrados(data.base_rows);
    } catch (e) {
      alert("Falha ao gerar draft");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(rowIndexFiltrado: number, col: string, value: string) {
  setRows(r => {
    const linhaFiltrada = rowsFiltrados[rowIndexFiltrado];
    const idxReal = r.findIndex(linha =>
      linha["gaveta"] === linhaFiltrada["gaveta"] &&
      linha["Posicao"] === linhaFiltrada["Posicao"]
    );
    if (idxReal === -1) return r;

    const clone = [...r];
    clone[idxReal] = { ...clone[idxReal], [col]: value };
    setRowsFiltrados(filtrarPorRua(clone, ruaSelecionada));
    return clone;
  });
  }

  function addEmptyRow() {
    const obj: Row = {};
    columns.forEach(c => {
      obj[c] = "";
    });
    const newRows = [...rows, obj];
    setRows(newRows);
    setRowsFiltrados(filtrarPorRua(newRows, ruaSelecionada));
  }

  // ALTERAÇÃO: Exporta apenas as linhas filtradas!
  async function handleExport() {
    try {
      const blob = await postFormExport({
        columns,
        rows: rowsFiltrados, // << só exporta as linhas mostradas/filtros!
        suggestions
      });
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
      downloadBlob(blob, `formulario_digitacao_${ts}.xlsx`);
    } catch (e) {
      alert("Falha ao exportar");
      console.error(e);
    }
  }

  function handleRuaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const rua = e.target.value;
    setRuaSelecionada(rua);
    setRowsFiltrados(filtrarPorRua(rows, rua));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Formulário de Digitação</h1>

      <div className="border p-4 rounded space-y-4">
        <DropZone
          label="Arraste ou solte uma planilha para gerar o formulário:"
          accept=".xlsx,.xls"
          file={file}
          onFile={setFile}
        />
        <button
          disabled={!file || loading}
            onClick={handleGenerate}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? "Processando..." : "Gerar Formulário"}
        </button>
      </div>

      {draftLoaded && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={addEmptyRow}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              + Linha
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Exportar XLSX
            </button>
          </div>
          <div>
            <label className="mr-2">Escolha a rua:</label>
            <select value={ruaSelecionada} onChange={handleRuaChange} className="border rounded px-2 py-1">
              {ruas.map((rua) => (
                <option key={rua} value={rua}>{rua}</option>
              ))}
            </select>
          </div>
          <div>
            {/* Renderização dos dados filtrados */}
            <table className="min-w-full border">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col} className="border px-2 py-1">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsFiltrados.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map(col => (
                      <td key={col} className="border px-2 py-1">
                        <AutoCompleteCell
                          value={row[col] ?? ""}
                          suggestions={suggestions[col] ?? []}
                          onChange={v => updateCell(rowIndex, col, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}