import pandas as pd

def carregar_planilha(path: str) -> pd.DataFrame:
    """
    Função para carregar uma planilha Excel em um DataFrame do Pandas.
    """
    return pd.read_excel(path)

def comparar(planilha_oficial: pd.DataFrame, auditor_input: pd.DataFrame) -> pd.DataFrame:
    """
    Função para comparar os dados entre a planilha oficial e os dados do auditor.
    Se houver discrepâncias entre as quantidades, será marcado como 'Divergente'.
    """
    # Realizar o merge entre os DataFrames com base na coluna 'Produto'
    df_comparacao = planilha_oficial.merge(auditor_input, on="produto", suffixes=("_oficial", "_auditor"))

    # Adicionar uma coluna de status para identificar discrepâncias
    df_comparacao["Status"] = df_comparacao.apply(
        lambda row: "OK" if row["quantidade_oficial"] == row["quantidade_auditor"] else "Divergente", axis=1
    )
    return df_comparacao