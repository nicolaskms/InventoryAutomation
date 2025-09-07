import React, { useState } from "react";
import Card from "../components/Card";
import DropZone from "../components/DropZone";
import { postBlindTemplate, downloadBlob } from "../lib/api";

export default function BlindTemplatePage() {
  const [wmsFile, setWmsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(wmsFile && !loading);

  async function handleGenerate() {
    if (!wmsFile) return;
    try {
      setLoading(true);
      const blob = await postBlindTemplate(wmsFile);
      if (confirm("Relatório às cegas gerado. Baixar agora?")) {
        const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
        downloadBlob(blob, `relatorio_as_cegas-${ts}.xlsx`);
      }
    } catch (e) {
      alert("Falha ao gerar/baixar. Verifique o backend.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Relatório às Cegas (a partir do WMS)">
        <div className="max-w-xl">
          <DropZone label="Planilha oficial (WMS)" onFile={setWmsFile} />
        </div>
        <div className="mt-6">
          <button
            disabled={!canSubmit}
            onClick={handleGenerate}
            className={[
              "px-4 py-2 rounded-xl",
              canSubmit ? "bg-zinc-900 text-white hover:bg-zinc-800"
                        : "bg-zinc-200 text-zinc-500 cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Gerando..." : "Gerar Relatório às Cegas"}
          </button>
          {!wmsFile && (
            <span className="ml-3 text-sm text-zinc-500">
              Envie a planilha WMS para habilitar.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}