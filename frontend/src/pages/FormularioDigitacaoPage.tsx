import React, { useState } from "react";
import { postFormDraft, postFormExport, downloadBlob, FormDraftResponse } from "../lib/api";
import AutoCompleteCell from "../components/AutoCompleteCell";
import DropZone from "../components/DropZone";

type Row = Record<string, string>;

/**
 * Extrai letras (ruas) a partir da primeira letra das posições/gavetas.
 * Para cada letra gera também variantes PAR e IMPAR (ex.: A, APAR, AIMPAR).
 */
function montarOpcoesRuas(rows: Row[]): string[] {
  const letras = new Set<string>();
  rows.forEach(linha => {
    const pos = (linha["gaveta"] || linha["Posicao"] || "").trim();
    if (!pos) return;
    const first = pos[0].toUpperCase();
    if (/[A-Z]/.test(first)) {
      letras.add(first);
    }
  });
  const ordenadas = Array.from(letras).sort();
  const opcoes: string[] = ["Todas"];
  for (const letra of ordenadas) {
    opcoes.push(letra);          // todas daquela letra
    opcoes.push(letra + "PAR");  // apenas pares
    opcoes.push(letra + "IMPAR");// apenas ímpares
  }
  return opcoes;
}

/**
 * Tenta extrair (letra, numero) de uma posição.
 * Ex: B12A -> { letra: 'B', numero: 12 }
 * Se não encontrar número, retorna undefined para numero.
 */
function parsePosicao(posicaoRaw: string): { letra: string; numero?: number } | null {
  const pos = (posicaoRaw || "").trim().toUpperCase();
  if (!pos) return null;
  const m = /^([A-Z])(\d+)/.exec(pos);
  if (m) {
    return { letra: m[1], numero: parseInt(m[2], 10) };
  }
  // Ainda capturamos somente a letra inicial caso não tenha número
  if (/^[A-Z]/.test(pos)) {
    return { letra: pos[0] };
  }
  return null;
}

function filtrarPorOpcao(rows: Row[], opcao: string): Row[] {
  if (opcao === "Todas") return rows;

  // Letra pura (ex.: A, B, C)
  if (/^[A-Z]$/.test(opcao)) {
    return rows.filter(l => {
      const p = parsePosicao(l["gaveta"] || l["Posicao"] || "");
      return p && p.letra === opcao;
    });
  }

  // Padrões APAR / AIMPAR, etc.
  const m = /^([A-Z])(PAR|IMPAR)$/.exec(opcao);
  if (m) {
    const letraFiltro = m[1];
    const tipo = m[2]; // PAR ou IMPAR
    return rows.filter(l => {
      const p = parsePosicao(l["gaveta"] || l["Posicao"] || "");
      if (!p || p.letra !== letraFiltro || p.numero === undefined) return false;
      if (tipo === "PAR") return p.numero % 2 === 0;
      return p.numero % 2 === 1;
    });
  }

  // Fallback (caso algo inesperado)
  return rows;
}

export default function FormularioDigitacaoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [orderedGavetas, setOrderedGavetas] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Filtro por rua/opção
  const [opcoesRua, setOpcoesRua] = useState<string[]>([]);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<string>("Todas");
  const [rowsFiltrados, setRowsFiltrados] = useState<Row[]>([]);

  // Mapa código -> produtos
  const [codProdMap, setCodProdMap] = useState<Record<string, string[]>>({});

  async function handleGenerate() {
    if (!file) return;
    setLoading(true);
    try {
      const data: FormDraftResponse = await postFormDraft(file);
      setColumns(data.columns);
      setRows(data.base_rows);
      setSuggestions(data.suggestions);
      setOrderedGavetas(data.ordered_gavetas);
      setDraftLoaded(true);
      setCodProdMap(data.cod_prod_map || {});

      const opcoes = montarOpcoesRuas(data.base_rows);
      setOpcoesRua(opcoes);
      setOpcaoSelecionada("Todas");
      setRowsFiltrados(data.base_rows);
    } catch (e) {
      alert("Falha ao gerar draft");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Atualiza célula (usando rowsFiltrados -> encontra índice real em rows).
   * Mantém lógica de autofill do produto baseado no código.
   */
  function updateCell(rowIndexFiltrado: number, col: string, value: string) {
    setRows(prevAll => {
      const linhaFiltrada = rowsFiltrados[rowIndexFiltrado];
      // Critério para achar a linha original:
      const idxReal = prevAll.findIndex(linha =>
        linha["gaveta"] === linhaFiltrada["gaveta"] &&
        linha["Posicao"] === linhaFiltrada["Posicao"]
      );
      if (idxReal === -1) return prevAll;

      const clone = [...prevAll];
      const updated = { ...clone[idxReal], [col]: value };

      if (col === "cod") {
        const codeKey = value.trim();
        const prods = codProdMap[codeKey];
        if (prods && prods.length === 1) {
          updated["produto"] = prods[0];
        } else if (prods && prods.length > 1) {
          if (!updated["produto"] || !prods.includes(updated["produto"])) {
            updated["produto"] = prods[0];
          }
        } else {
          if (updated["produto"]) updated["produto"] = "";
        }
      }

      clone[idxReal] = updated;
      setRowsFiltrados(filtrarPorOpcao(clone, opcaoSelecionada));
      return clone;
    });
  }

  function addEmptyRow() {
    const obj: Row = {};
    columns.forEach(c => { obj[c] = ""; });
    const newRows = [...rows, obj];
    setRows(newRows);
    setRowsFiltrados(filtrarPorOpcao(newRows, opcaoSelecionada));
  }

  async function handleExport() {
    try {
      const blob = await postFormExport({
        columns,
        rows: rowsFiltrados,
        suggestions
      });
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
      downloadBlob(blob, `formulario_digitacao_${ts}.xlsx`);
    } catch (e) {
      alert("Falha ao exportar");
      console.error(e);
    }
  }

  function handleOpcaoRuaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const opc = e.target.value;
    setOpcaoSelecionada(opc);
    setRowsFiltrados(filtrarPorOpcao(rows, opc));
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
          <div className="flex gap-2 flex-wrap">
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
            <div className="flex items-center gap-2">
              <label className="text-sm">Filtro:</label>
              <select
                value={opcaoSelecionada}
                onChange={handleOpcaoRuaChange}
                className="border rounded px-2 py-1 text-sm"
              >
                {opcoesRua.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
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
                {rowsFiltrados.map((row, rIdx) => (
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
            Linhas exibidas: {rowsFiltrados.length} / Total base: {rows.length}
          </p>
        </div>
      )}
    </div>
  );
}