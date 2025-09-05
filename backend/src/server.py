# backend/src/server.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment

# IMPORTA suas funções já existentes
# Ajuste o caminho do import conforme sua estrutura
from compare import carregar_planilha, comparar

app = FastAPI(title="InventoryAutomation API")

# Libera o front (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _auto_fit_and_center(xlsx_bytes: BytesIO, sheet_name: str = None) -> BytesIO:
    """Centraliza e ajusta largura de colunas do XLSX."""
    xlsx_bytes.seek(0)
    wb = load_workbook(xlsx_bytes)
    ws = wb[sheet_name] if (sheet_name and sheet_name in wb.sheetnames) else wb.active

    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = center

    for col in ws.columns:
        max_len = 0
        letter = col[0].column_letter
        for cell in col:
            val = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, len(val))
        ws.column_dimensions[letter].width = min(max(12, int(max_len * 1.2)), 60)

    out = BytesIO()
    wb.save(out)
    out.seek(0)
    return out

@app.post("/compare")
async def compare_endpoint(
    planilha_oficial: UploadFile = File(...),
    planilha_divergente: UploadFile = File(...),
):
    """
    Recebe as duas planilhas via multipart/form-data:
      - planilha_oficial: File
      - planilha_divergente: File
    Retorna um XLSX com o relatório.
    """
    try:
        # lê arquivos em memória
        oficial_bytes = BytesIO(await planilha_oficial.read())
        divergente_bytes = BytesIO(await planilha_divergente.read())

        # normaliza/transforma com SUAS funções
        df_oficial = carregar_planilha(oficial_bytes)
        df_div     = carregar_planilha(divergente_bytes)

        # compara com SUA função
        df_out: pd.DataFrame = comparar(df_oficial, df_div)

        # grava para xlsx em memória
        buf = BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df_out.to_excel(writer, index=False, sheet_name="Relatorio")

        # centraliza e ajusta colunas
        buf = _auto_fit_and_center(buf, sheet_name="Relatorio")

        filename = "relatorio_auditoria_comparacao.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar: {e}")