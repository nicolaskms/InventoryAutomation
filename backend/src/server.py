# backend/src/server.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from io import BytesIO
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment
import re
from typing import List, Tuple


# IMPORTA suas funções já existentes
# Ajuste o caminho do import conforme sua estrutura
from compare import carregar_planilha, comparar

app = FastAPI(title="InventoryAutomation API")

# --- helper de ordenação igual ao que combinamos (rua/letra -> número -> sufixo letra) ---
_rx_loc = re.compile(r"^([A-Za-z]+)?(\d+)?([A-Za-z]+)?$")

# Libera o front (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _sort_key_gaveta(s: str) -> Tuple[str, int, str]:
    """
    Converte 'G61b' -> ('g', 61, 'b')
    Converte 'a2a'  -> ('a', 2,  'a')
    Variações sem alguma parte caem no fallback.
    """
    s = str(s).strip()
    m = _rx_loc.match(s) or None
    if not m:
        return (s.lower(), 0, "")
    g1, g2, g3 = m.groups()
    letra = (g1 or "").lower()
    numero = int(g2) if g2 and g2.isdigit() else 0
    sufx  = (g3 or "").lower()
    return (letra, numero, sufx)

def _auto_fit_and_center(xlsx_bytes: BytesIO, sheet_name: str = None) -> BytesIO:
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

@app.post("/blind-template")
async def blind_template(planilha_oficial: UploadFile = File(...)):
    """
    Recebe WMS (UploadFile), extrai/normaliza posições (gaveta) e
    devolve XLSX 'às cegas' com só a primeira coluna preenchida.
    Cabeçalhos: ['gaveta','cod','produto','lote','quantidade','observacao'].
    """
    try:
        # lê arquivo em memória e normaliza com sua função
        oficial_bytes = BytesIO(await planilha_oficial.read())
        df_wms = carregar_planilha(oficial_bytes)

        # extrai gaveta (já vem em df_wms["gaveta"], mas reforçamos limpeza)
        if "gaveta" not in df_wms.columns:
            df_wms["gaveta"] = ""

        gavetas: List[str] = (
            df_wms["gaveta"]
            .astype(str)
            .map(lambda x: _extrai_local(x).strip())
            .replace("", pd.NA)
            .dropna()
            .unique()
            .tolist()
        )

        # ordena conforme regra (rua/letra -> número -> sufx)
        gavetas_ordenadas = sorted(gavetas, key=_sort_key_gaveta)

        # monta df 'às cegas': só a 1ª coluna preenchida
        cols = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]
        df_out = pd.DataFrame({"gaveta": gavetas_ordenadas})
        for c in cols[1:]:
            df_out[c] = ""  # colunas vazias

        # gera xlsx em memória
        buf = BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df_out.to_excel(writer, index=False, sheet_name="Relatorio_As_Cegas")

        buf = _auto_fit_and_center(buf, sheet_name="Relatorio_As_Cegas")

        filename = "relatorio_as_cegas.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao gerar relatório às cegas: {e}")

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