import React, { useState, useMemo, useCallback, useRef } from "react";

interface PreviewRow { [key: string]: any }

const Autocomplete: React.FC<{ gavetas: string[] }> = ({ gavetas }) => {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    if (!value) return [];
    const v = value.toLowerCase();
    return gavetas.filter(g => g.toLowerCase().startsWith(v)).slice(0, 20);
  }, [value, gavetas]);

  const hasMatches = matches.length > 0 && open;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setActiveIndex(-1);
    setOpen(true);
  };

  const selectValue = useCallback((val: string) => {
    setValue(val);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasMatches) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (i + 1 >= matches.length ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < matches.length) {
        e.preventDefault();
        selectValue(matches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeId = activeIndex >= 0 ? `opt-gav-${activeIndex}` : undefined;

  return (
    <div className="w-full max-w-md">
      <label htmlFor="autocomplete-gaveta" className="text-sm font-semibold">
        Autocomplete de Gaveta
      </label>
      {/* Padrão combobox simplificado: role="combobox" no input + lista separada com role="listbox" */}
      <input
        id="autocomplete-gaveta"
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Timeout para permitir clique nas opções
          requestAnimationFrame(() => {
            if (!e.currentTarget.contains(document.activeElement)) {
              setOpen(false);
            }
          });
        }}
        placeholder="Digite prefixo (ex: m004)"
        className="w-full border rounded px-2 py-1 mt-1"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={hasMatches}
        aria-controls="lista-sugestoes-gaveta"
        aria-activedescendant={activeId}
      />
      {hasMatches && (
        <div
          id="lista-sugestoes-gaveta"
          ref={listRef}
          role="listbox"
          className="border rounded bg-white shadow max-h-56 overflow-auto mt-1 text-sm"
        >
          {matches.map((m, i) => {
            const isActive = i === activeIndex;
            return (
              <div
                key={m}
                id={`opt-gav-${i}`}
                role="option"
                aria-selected={isActive}
                className={`px-2 py-1 cursor-pointer ${
                  isActive ? "bg-blue-600 text-white" : "hover:bg-blue-100"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectValue(m);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {m}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const PlanilhaDigitacao: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gavetas, setGavetas] = useState<string[]>([]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setColumns([]);
      setPreview([]);
      setTotal(0);
      setErro(null);
      setGavetas([]);
    }
  }

  async function preprocess() {
  if (!file) return;
  setLoading(true);
  setErro(null);

  const fd = new FormData();
  fd.append("file", file);

  try {
    // Se o backend está em outra porta (8000), considere usar URL completa:
    const API = "http://127.0.0.1:8000";
    const res = await fetch(`${API}/planilha-digitacao/preprocess`, { method: "POST", body: fd });

    const raw = await res.text(); // lê como texto
    if (!raw) {
      throw new Error(`Resposta vazia (status ${res.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Resposta não é JSON válido. Início: ${raw.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(data.detail || `Erro HTTP ${res.status}`);
    }

    if (!Array.isArray(data.preview) || !Array.isArray(data.columns)) {
      throw new Error("Formato inesperado do backend (faltam 'preview' ou 'columns').");
    }

    setColumns(data.columns);
    setPreview(data.preview);
    setTotal(data.totalRows);

    const gavetaCol = data.columns.find(
      (c: string) => c.toLowerCase() === "gaveta"
    );

    if (gavetaCol) {
      setGavetas(
        Array.from(
          new Set(
            data.preview
              .map((r: any) => r[gavetaCol])
              .filter((v: any) => v !== undefined && v !== null && v !== "")
          )
        )
      );
    }
  } catch (e: any) {
    setErro(e.message || "Falha ao processar");
  } finally {
    setLoading(false);
  }
}

  async function exportar() {
    if (!file) return;
    setLoading(true);
    setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/planilha-digitacao/export", {
        method: "POST",
        body: fd
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "planilha_digitacao.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Planilha de Digitação</h1>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="upload-wms" className="block text-sm font-semibold mb-1">
            Upload Planilha WMS
          </label>
            <input
              id="upload-wms"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFile}
              aria-describedby="hint-upload"
            />
            <p id="hint-upload" className="text-xs text-gray-500 mt-1">
              Colunas esperadas: ALMOXARIFADO, LOCAL, GAVETA..., MATERIAL, DESCRIÇÃO, LOTE, QTD.GAVETA
            </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={preprocess}
            disabled={!file || loading}
            className="bg-blue-600 text-white px-4 py-1 rounded disabled:opacity-50"
          >
            Pré-visualizar
          </button>
          <button
            type="button"
            onClick={exportar}
            disabled={!preview.length || loading}
            className="bg-green-600 text-white px-4 py-1 rounded disabled:opacity-50"
          >
            Gerar XLSX
          </button>
        </div>

        {erro && (
          <div role="alert" className="text-red-600 text-sm" aria-live="assertive">
            {erro}
          </div>
        )}

        {total > 0 && (
          <div className="text-sm text-gray-700">
            Linhas totais: {total}
          </div>
        )}
      </div>

      <Autocomplete gavetas={gavetas} />

      {preview.length > 0 && (
        <div
          className="border rounded max-h-[460px] overflow-auto"
          role="region"
          aria-label="Pré-visualização da planilha"
        >
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                {columns.map(c => (
                  <th
                    key={c}
                    scope="col"
                    className="px-2 py-1 font-semibold border-b text-left"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  {columns.map(c => (
                    <td key={c} className="px-2 py-1 border-b">
                      {row[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500" aria-live="polite">Processando...</div>}
    </div>
  );
};