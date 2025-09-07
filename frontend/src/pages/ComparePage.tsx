import React, { useState } from "react";
import Card from "../components/Card";
import DropZone from "../components/DropZone";
import { postCompare, downloadBlob } from "../lib/api";

export default function ComparePage() {
  const [wmsFile, setWmsFile] = useState<File | null>(null);
  const [fisicoFile, setFisicoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(wmsFile && fisicoFile && !loading);

  async function handleGenerate() {
    if (!wmsFile || !fisicoFile) return;
    try {
      setLoading(true);
      const blob = await postCompare(wmsFile, fisicoFile);

      const ok = window.confirm("Relatório gerado com sucesso. Deseja baixar agora?");
      if (!ok) return;

      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
      downloadBlob(blob, `relatorio_auditoria_comparacao-${ts}.xlsx`);
    } catch (e) {
      alert("Falha ao gerar/baixar o relatório. Verifique o backend e tente novamente.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Comparar Planilhas (WMS x Físico)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DropZone label="Planilha oficial (WMS)" onFile={setWmsFile} />
          <DropZone label="Planilha divergente (Físico)" onFile={setFisicoFile} />
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
            {loading ? "Gerando..." : "Gerar Relatório de Comparação"}
          </button>
          {!wmsFile || !fisicoFile ? (
            <span className="ml-3 text-sm text-zinc-500">
              Envie as duas planilhas para habilitar.
            </span>
          ) : null}
        </div>
      </Card>
    </div>
  );
}