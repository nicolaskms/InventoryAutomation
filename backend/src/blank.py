import pandas as pd
from compare import carregar_planilha

COLUMNS_OUT = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]

def gerar_em_branco(path_wms: str) -> pd.DataFrame:
    wms = carregar_planilha(path_wms)
    out = wms.copy()
    if "quantidade" in out.columns:
        out["quantidade"] = ""  # zera para contagem às cegas
    if "observacao" not in out.columns:
        out["observacao"] = ""
    return out[COLUMNS_OUT]