import pandas as pd
from compare import carregar_planilha
from openpyxl.styles import Alignment
import re  # Adicione esta linha

# Definição das colunas de saída
COLUMNS_OUT = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]

# Função para extrair as gavetas ou posições (por exemplo, "B2A", "B2B", etc.)
def _extrai_local(ocupacao: str) -> str:
    """
    Recebe strings como '2ZG-G61b' e devolve somente 'G61b'
    (pega a parte após o último '-').
    """
    s = str(ocupacao).strip()
    if "-" in s:
        return s.split("-")[-1].strip()
    return s  # fallback

# Função para ordenar as gavetas corretamente (por exemplo, B2A, B2B, A3A)
def _sort_key_gaveta(s: str) -> tuple:
    s = str(s).strip()
    # Aqui usamos uma expressão regular para separar letra, número e sufixo
    match = re.match(r"^([A-Za-z]+)?(\d+)?([A-Za-z]+)?$", s)
    if not match:
        return (s.lower(), 0, "")
    
    g1, g2, g3 = match.groups()
    letra = (g1 or "").lower()
    numero = int(g2) if g2 and g2.isdigit() else 0
    sufixo = (g3 or "").lower()
    return (letra, numero, sufixo)

# Função principal para gerar o relatório em branco
def gerar_em_branco(wms_path: str) -> pd.DataFrame:
    df_wms = carregar_planilha(wms_path)

    # Extrai as gavetas ou posições
    if "gaveta" not in df_wms.columns:
        df_wms["gaveta"] = ""

    gavetas = (
        df_wms["gaveta"]
        .astype(str)
        .map(lambda x: _extrai_local(x).strip())
        .replace("", pd.NA)
        .dropna()
        .unique()
        .tolist()
    )

    gavetas_ordenadas = sorted(gavetas, key=_sort_key_gaveta)

    # Cria o DataFrame com as gavetas ordenadas e células vazias
    cols = ["gaveta", "cod", "produto", "lote", "quantidade", "observacao"]
    df_out = pd.DataFrame({"gaveta": gavetas_ordenadas})
    for c in cols[1:]:
        df_out[c] = ""

    return df_out