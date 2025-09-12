import React, { useState } from "react";
import Card from "../components/Card";
import DropZone from "../components/DropZone";
import { postBlindTemplate, downloadBlob } from "../lib/api";

export default function BlankReportPage() {
  const [wmsFile, setWmsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = Boolean(wmsFile && !loading);

  async function handleGenerate() {
    if (!wmsFile) return;
    try {
      setLoading(true);
      // Chama a API /blind-template
      const blob = await postBlindTemplate(wmsFile);

      if (confirm("Relatório em branco gerado. Deseja baixar agora?")) {
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        downloadBlob(blob, `relatorio_as_cegas-${ts}.xlsx`);
      }
    } catch (err: any) {
      alert(`Falha ao gerar/baixar: ${err?.message || err}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Função para limpar o arquivo
  const handleClear = () => {
    setWmsFile(null);  // Limpa o arquivo
  };

  return (
    <div className="space-y-6">
      <Card title="Relatório às Cegas (a partir do WMS)">
        <div className="max-w-xl">
          <DropZone
            label="Planilha oficial (WMS)"
            file={wmsFile}        // Aqui, passando o estado `wmsFile` para o DropZone
            onFile={setWmsFile}    // E aqui, definindo `setWmsFile` como função para atualizar o estado
          />
        </div>

        <div className="mt-6">
          <button
            disabled={!canSubmit}
            onClick={handleGenerate}
            className={[
              "px-4 py-2 rounded-xl",
              canSubmit
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-200 text-zinc-500 cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Gerando..." : "Gerar Relatório em Branco"}
          </button>
          {!wmsFile && (
            <span className="ml-3 text-sm text-zinc-500">
              Envie a planilha WMS para habilitar.
            </span>
          )}
        </div>

        {/* Botão de limpar */}
        {wmsFile && (
          <button
            className="mt-4 px-4 py-2 rounded-xl text-white bg-red-600 hover:bg-red-700"
            onClick={handleClear}
          >
            Limpar Arquivo
          </button>
        )}
      </Card>
    </div>
  );
}