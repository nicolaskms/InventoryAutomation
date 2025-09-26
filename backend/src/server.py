# backend/src/server.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from io import BytesIO
import os
from blank import gerar_em_branco
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
import re
from typing import List, Tuple, Optional, Any, Dict
import logging

# IMPORTA suas funções já existentes do módulo compare.py
from compare import carregar_planilha, comparar, _extrai_local

# # Importa a função gerar_em_branco caso exista em blank.py (opcional)
# try:
#     from blank import gerar_em_branco  # type: ignore
# except Exception:
#     gerar_em_branco = None  # pode não existir; /blank ficará disponível só se presente

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="InventoryAutomation API")

# cria DATA_DIR para arquivos temporários (compatível com outras versões)
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

# Libera o front (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rx_loc = re.compile(r"^([A-Za-z]+)?(\d+)?([A-Za-z]+)?$")


def _sort_key_gaveta(s: str) -> Tuple[str, int, str]:
    s = str(s).strip()
    m = _rx_loc.match(s) or None
    if not m:
        return (s.lower(), 0, "")
    g1, g2, g3 = m.groups()
    letra = (g1 or "").lower()
    numero = int(g2) if g2 and g2.isdigit() else 0
    sufx = (g3 or "").lower()
    return (letra, numero, sufx)


def _auto_fit_and_center(xlsx_bytes: BytesIO, sheet_name: Optional[str] = None) -> BytesIO:
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


def _df_to_xlsx_bytes(df: pd.DataFrame, sheet_name: str = "Relatorio") -> BytesIO:
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name)
    buf.seek(0)
    return buf


async def _first_uploadfile_from_request(request: Request) -> Optional[UploadFile]:
    """
    Utility: pega o primeiro UploadFile presente no multipart/form-data
    independente do nome do campo (flexibilidade para o frontend).
    Usa uma checagem flexível (não depende estritamente do tipo).
    """
    form = await request.form()
    for k, v in form.items():
        # v pode ser UploadFile (Starlette) ou outro objeto com .filename
        if hasattr(v, "filename") and getattr(v, "filename"):
            logger.debug("Found upload field '%s' filename='%s'", k, getattr(v, "filename"))
            return v  # tipo é UploadFile/Starlette UploadFile
    return None


@app.post("/compare")
async def compare_endpoint(
    planilha_oficial: UploadFile = File(...),
    planilha_divergente: UploadFile = File(...),
):
    try:
        oficial_bytes = BytesIO(await planilha_oficial.read())
        divergente_bytes = BytesIO(await planilha_divergente.read())

        df_oficial = carregar_planilha(oficial_bytes)
        df_div = carregar_planilha(divergente_bytes)

        df_out: pd.DataFrame = comparar(df_oficial, df_div)

        buf = _df_to_xlsx_bytes(df_out, sheet_name="Relatorio")
        buf = _auto_fit_and_center(buf, sheet_name="Relatorio")

        filename = "relatorio_auditoria_comparacao.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        logger.exception("Error in /compare")
        raise HTTPException(status_code=400, detail=f"Erro ao processar: {e}")


@app.post("/blind-template")
async def blind_template(
    request: Request,
    planilha_oficial: UploadFile = File(None),
):
    """
    Recebe uma planilha WMS (aceita campo 'planilha_oficial' ou qualquer arquivo multipart)
    e devolve um XLSX 'às cegas' com apenas a coluna 'gaveta' preenchida.
    """
    try:
        # Primeiro tenta o UploadFile explicitamente nomeado
        planilha = planilha_oficial if (planilha_oficial and getattr(planilha_oficial, "filename", None)) else None

        # Se não veio via parâmetro, tenta pegar o primeiro arquivo do form (fallback)
        if not planilha:
            planilha = await _first_uploadfile_from_request(request)

        if not planilha or not getattr(planilha, "filename", None):
            logger.warning("No file found in request for /blind-template. Form keys: %s", list((await request.form()).keys()))
            raise HTTPException(status_code=400, detail="Arquivo inválido")

        logger.info("Received file for blind-template: %s", getattr(planilha, "filename"))

        oficial_bytes = BytesIO(await planilha.read())
        df_wms = carregar_planilha(oficial_bytes)

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

        gavetas_ordenadas = sorted(gavetas, key=_sort_key_gaveta)

        cols = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]
        df_out = pd.DataFrame({"gaveta": gavetas_ordenadas})
        for c in cols[1:]:
            df_out[c] = ""

        buf = _df_to_xlsx_bytes(df_out, sheet_name="Relatorio_As_Cegas")
        buf = _auto_fit_and_center(buf, sheet_name="Relatorio_As_Cegas")

        filename = "relatorio_as_cegas.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        # repropaga HTTPException sem alteração
        raise
    except Exception as e:
        logger.exception("Error in /blind-template")
        raise HTTPException(status_code=400, detail=f"Erro ao gerar relatório às cegas: {e}")


@app.post("/blank")
async def blank_endpoint(request: Request):
    try:
        wms = await _first_uploadfile_from_request(request)  # Recebe o arquivo WMS
        if not wms or not getattr(wms, "filename", None):
            raise HTTPException(status_code=400, detail="Arquivo inválido")

        # Salva o arquivo WMS temporariamente
        wms_path = os.path.join(DATA_DIR, "wms_upload.xlsx")
        with open(wms_path, "wb") as f:
            f.write(await wms.read())

        # Carrega o arquivo e gera a planilha em branco
        df_blank = gerar_em_branco(wms_path)

        # Converte o DataFrame para bytes
        buf = _df_to_xlsx_bytes(df_blank, sheet_name="relatorio")
        buf = _auto_fit_and_center(buf, sheet_name="relatorio")

        filename = "relatorio_em_branco.xlsx"
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        logger.exception("Error in /blank")
        raise HTTPException(status_code=400, detail=f"Erro ao processar planilha: {e}")
    
def _ordenar_gavetas(gavetas: list[str]) -> list[str]:
    """
    Tenta aplicar a mesma lógica que já exista para ordenar locais/gavetas.
    Se houver função oficial (ex: _extrai_local ou similar), adapte aqui.
    Exemplo: ordenar por parte alfabética + número (M004 < M010 < M100 etc.).
    """
    import re
    def key(g: str):
        if g is None:
            return ("", 0, g)
        m = re.match(r"([A-Za-z]+)(\d+)", g)
        if m:
            return (m.group(1), int(m.group(2)), g)
        return ("", 0, g)
    return sorted(set([g for g in gavetas if g]), key=key)

@app.post("/form-draft")
async def form_draft(planilha_oficial: UploadFile = File(...)):
    """
    Recebe a planilha WMS e devolve metadados para montar o formulário de digitação:
    - columns: ordem das colunas
    - suggestions: dict de listas únicas para autocomplete
    - base_rows: linhas base em branco (por gaveta) já estruturadas
    - ordered_gavetas: lista ordenada só das gavetas
    """
    try:
        if not planilha_oficial or not planilha_oficial.filename:
            raise HTTPException(status_code=400, detail="Arquivo inválido")

        temp_path = os.path.join(DATA_DIR, "form_draft_wms.xlsx")
        with open(temp_path, "wb") as f:
            f.write(await planilha_oficial.read())

        df = carregar_planilha(temp_path)

        # Garante colunas esperadas
        expected = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]
        for col in expected:
            if col not in df.columns:
                # Cria vazia (observacao por ex.)
                df[col] = "" if col in ("observacao", "quantidade") else ""

        # Coleta valores únicos
        def uniques(col):
            return sorted([str(x) for x in df[col].dropna().unique() if str(x).strip() != ""])

        suggestions = {
            "gaveta": uniques("gaveta"),
            "cod": uniques("cod"),
            "produto": uniques("produto"),
            "lote": uniques("lote"),
        }

        ordered_gavetas = _ordenar_gavetas(suggestions["gaveta"])

        # Linhas base: uma linha por gaveta (ou pode replicar as linhas originais limpando campos)
        base_rows = []
        for g in ordered_gavetas:
            base_rows.append({
                "gaveta": g,
                "cod": "",
                "produto": "",
                "lote": "",
                "quantidade": "",
                "observacao": ""
            })

        return {
            "columns": expected,
            "ordered_gavetas": ordered_gavetas,
            "suggestions": suggestions,
            "base_rows": base_rows,
            "total_rows": len(base_rows)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar draft: {e}")

@app.post("/form-export")
async def form_export(payload: Dict[str, Any] = Body(...)):
    from io import BytesIO
    try:
        columns = payload.get("columns")
        rows = payload.get("rows")
        suggestions = payload.get("suggestions", {})
        if not columns or not rows:
            raise HTTPException(status_code=400, detail="JSON inválido (columns/rows)")

        from openpyxl import Workbook
        from openpyxl.worksheet.datavalidation import DataValidation
        from openpyxl.utils import get_column_letter
        from openpyxl.styles import Alignment

        wb = Workbook()
        ws = wb.active
        ws.title = "Formulario"

        # Cabeçalho
        for j, col in enumerate(columns, start=1):
            c = ws.cell(row=1, column=j, value=col)
            c.alignment = Alignment(horizontal="center", vertical="center")

        # Linhas
        for i, row in enumerate(rows, start=2):
            for j, col in enumerate(columns, start=1):
                ws.cell(row=i, column=j, value=row.get(col, ""))

        # Aba listas (não oculta por enquanto para depurar)
        hidden = wb.create_sheet("_listas")

        # Cada lista em UMA coluna vertical
        cols_ref = {}  # map colname -> (col_letter, size)
        current_col = 1
        for colname in ["gaveta", "cod", "produto", "lote"]:
            vals = suggestions.get(colname, [])
            if not vals:
                continue
            col_letter = get_column_letter(current_col)
            for r_idx, val in enumerate(vals, start=1):
                hidden.cell(row=r_idx, column=current_col, value=val)
            cols_ref[colname] = (col_letter, len(vals))
            current_col += 1

        # Data Validation usando intervalo direto
        max_lin = len(rows) + 100
        for j, col in enumerate(columns, start=1):
            if col in cols_ref:
                col_letter_form, length = cols_ref[col]
                if length > 0:
                    col_letter = get_column_letter(j)
                    formula_range = f"'_listas'!${col_letter_form}$1:${col_letter_form}${length}"
                    dv = DataValidation(type="list", formula1=formula_range, allow_blank=True)
                    dv.add(f"{col_letter}2:{col_letter}{max_lin}")
                    ws.add_data_validation(dv)

        # Ajuste largura
        for j in range(1, len(columns)+1):
            ws.column_dimensions[get_column_letter(j)].width = 18

        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        return StreamingResponse(
            bio,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename=\"formulario_digitacao.xlsx\"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao exportar: {e}")