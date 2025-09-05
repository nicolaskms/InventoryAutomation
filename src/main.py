import os
import pandas as pd
from compare import carregar_planilha, comparar
from openpyxl import load_workbook

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