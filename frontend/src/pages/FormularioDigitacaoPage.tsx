import React, { useState } from "react";
import { postFormDraft, postFormExport, downloadBlob } from "../lib/api";
import AutoCompleteCell from "../components/AutoCompleteCell";

type Row = Record<string, string>;

export default function FormularioDigitacaoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [orderedGavetas, setOrderedGavetas] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

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
    } catch (e) {
      alert("Falha ao gerar draft");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(rowIndex: number, col: string, value: string) {
    setRows(r => {
      const clone = [...r];
      clone[rowIndex] = { ...clone[rowIndex], [col]: value };
      return clone;
    });
  }

  function addEmptyRow() {
    const obj: Row = {};
    columns.forEach(c => {
      if (c === "gaveta") obj[c] = ""; else obj[c] = "";
    });
    setRows(r => [...r, obj]);
  }

  async function handleExport() {
    try {
      const blob = await postFormExport({
        columns,
        rows,
        suggestions
      });
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
      downloadBlob(blob, `formulario_digitacao_${ts}.xlsx`);
    } catch (e) {
      alert("Falha ao exportar");
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Formulário de Digitação</h1>

      <div className="border p-4 rounded space-y-4">
        <div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
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
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map(c => (
                    <th key={c} className="px-2 py-2 border text-left">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
                    {columns.map(col => {
                      const isAuto = ["gaveta","cod","produto","lote"].includes(col);
                      return (
                        <td key={col} className="border px-2 py-1 align-top">
                          {isAuto ? (
                            <AutoCompleteCell
                              value={row[col] || ""}
                              suggestions={suggestions[col] || []}
                              onChange={(v) => updateCell(rIdx, col, v)}
                              placeholder={col}
                            />
                          ) : (
                            <input
                              value={row[col] || ""}
                              onChange={(e) => updateCell(rIdx, col, e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder={col}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">
            Total de linhas: {rows.length} | Gavetas detectadas: {orderedGavetas.length}
          </p>
        </div>
      )}
    </div>
  );
}