import os
import io
from openpyxl import load_workbook
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
from compare import carregar_planilha, comparar
from blank import gerar_em_branco

app = FastAPI(title="InventoryAutomation API")

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

def df_to_xlsx_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="relatorio")
    buf.seek(0)
    return buf.read()

@app.post("/compare")
async def compare_endpoint(wms: UploadFile = File(...), fisico: UploadFile = File(...)):
    if not (wms.filename and fisico.filename):
        raise HTTPException(status_code=400, detail="Arquivos inválidos")

    wms_path   = os.path.join(DATA_DIR, "wms_upload.xlsx")
    fis_path   = os.path.join(DATA_DIR, "fisico_upload.xlsx")

    with open(wms_path, "wb") as f:
        f.write(await wms.read())
    with open(fis_path, "wb") as f:
        f.write(await fisico.read())

    df_wms  = carregar_planilha(wms_path)
    df_fis  = carregar_planilha(fis_path)
    result  = comparar(df_wms, df_fis)

    bytes_xlsx = df_to_xlsx_bytes(result)
    return StreamingResponse(
        io.BytesIO(bytes_xlsx),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="relatorio_comparacao.xlsx"'}
    )
    
@app.post("/blank")
async def blank_endpoint(wms: UploadFile = File(...)):
    if not wms.filename:
        raise HTTPException(status_code=400, detail="Arquivo inválido")
    wms_path = os.path.join(DATA_DIR, "wms_upload.xlsx")
    with open(wms_path, "wb") as f:
        f.write(await wms.read())

    df_blank = gerar_em_branco(wms_path)
    bytes_xlsx = df_to_xlsx_bytes(df_blank)
    return StreamingResponse(
        io.BytesIO(bytes_xlsx),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="relatorio_em_branco.xlsx"'}
    )

def ajustar_largura_colunas(path_xlsx):
    wb = load_workbook(path_xlsx)
    ws = wb.active
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            val = "" if cell.value is None else str(cell.value)
            max_len = max(max_len, len(val))
        ws.column_dimensions[col_letter].width = max_len + 2
    wb.save(path_xlsx)

def load_data():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
    # >>> ajuste os nomes dos arquivos aqui <<<
    oficial_path  = os.path.join(base_dir, 'planilha_oficial.xlsx')      # a sua planilha oficial (relatório)
    fisico_path   = os.path.join(base_dir, 'planilha_divergente.xlsx')   # contagem física
    oficial = carregar_planilha(oficial_path)
    fisico  = carregar_planilha(fisico_path)
    return oficial, fisico

def main():
    oficial, fisico = load_data()
    resultado = comparar(oficial, fisico)

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
    os.makedirs(out_dir, exist_ok=True)
    out_xlsx = os.path.join(out_dir, 'relatorio_auditoria_comparacao.xlsx')

    with pd.ExcelWriter(out_xlsx, engine='openpyxl', mode='w') as writer:
        resultado.to_excel(writer, index=False, sheet_name='comparacao')

    ajustar_largura_colunas(out_xlsx)
    print(f"Relatório gerado: {out_xlsx}")

if __name__ == "__main__":
    main()