import pandas as pd
import re
import unicodedata

# ----------------------------
# Helpers de normalização
# ----------------------------

def _strip_accents(s: str) -> str:
    s = str(s)
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")

def _norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    """normaliza nomes de colunas para minúsculas, sem acentos e sem espaços extras."""
    df = df.copy()
    df.columns = [
        _strip_accents(c).strip().lower().replace("  ", " ")
        for c in df.columns
    ]
    return df

def _norm_qtd(s: str):
    """Extrai número tolerante (ex.: '1250kg' -> 1250.0)"""
    s = str(s).strip().lower().replace(",", ".")
    m = re.search(r'[-+]?\d*\.?\d+', s)
    if not m:
        return None
    try:
        return float(m.group())
    except:
        return None

def _extrai_local(ocupacao: str) -> str:
    """
    Recebe strings como '2ZG-G61b' e devolve somente 'G61b'
    (pega a parte após o último '-').
    """
    s = str(ocupacao).strip()
    if "-" in s:
        return s.split("-")[-1].strip()
    return s  # fallback

def _parse_gaveta(val):
    """
    Converte 'A2b' -> ('A', 2, 'b') para ordenar por rua/letra, número e sufixo.
    Se não casar, retorna fallback que mantém estável.
    """
    v = "" if val is None else str(val)
    m = re.match(r"([A-Za-z]+)(\d+)([A-Za-z]*)", v)
    if not m:
        return (v.upper(), -1, "")
    letra, numero, sufixo = m.groups()
    return (letra.upper(), int(numero), sufixo.lower())

# ----------------------------
# Carregador
# ----------------------------

def carregar_planilha(path: str) -> pd.DataFrame:
    """
    Carrega Excel em DataFrame padronizado para nosso comparador.
    Suporta:
      - Planilhas “limpas” (colunas: gaveta, cod, produto, lote, quantidade, observacao)
      - Relatório oficial (ALMOXARIFADO, LOCAL, GAVETA (YX-Desc.), MATERIAL, DESCRIÇÃO, LOTE, QTD.GAVETA)
    Retorna SEMPRE colunas: gaveta, cod, produto, lote, quantidade, observacao
    """
    raw = pd.read_excel(path, dtype=str).fillna("")

    # Heurística: linha 2 (0-based) contém os títulos do relatório oficial
    # ['ALMOXARIFADO','LOCAL','GAVETA (YX-Desc.)','MATERIAL','DESCRIÇÃO','LOTE','QTD.GAVETA']
    try:
        header_row = [str(x) for x in raw.iloc[2].tolist()]
        header_norm = [_strip_accents(x).upper() for x in header_row]
        if ("DESCRICAO" in header_norm) and ("QTD.GAVETA" in header_row or "QTD.GAVETA" in header_norm):
            df = raw.iloc[3:].copy()
            df.columns = header_row
            df = df.fillna("")
            # renomeia pro padrão
            df = df.rename(columns={
                "GAVETA (YX-Desc.)": "ocupacao_estoque",
                "MATERIAL": "cod",
                "DESCRIÇÃO": "produto",
                "DESCRICAO": "produto",
                "LOTE": "lote",
                "QTD.GAVETA": "quantidade",
            })
            # extrai gaveta/local a partir da ocupacao_estoque
            if "ocupacao_estoque" in df.columns:
                df["gaveta"] = df["ocupacao_estoque"].apply(_extrai_local)
            else:
                df["gaveta"] = ""

            base = pd.DataFrame({
                "gaveta": df.get("gaveta", ""),
                "cod": df.get("cod", ""),
                "produto": df.get("produto", ""),
                "lote": df.get("lote", ""),
                "quantidade": df.get("quantidade", ""),
                "observacao": df.get("observacao", "")
            }).fillna("")
            for c in base.columns:
                base[c] = base[c].astype(str).str.strip()
            return base
    except Exception:
        # se não bater a heurística, segue pro caminho padrão
        pass

    # Caminho padrão: já é “limpa”
    df = _norm_cols(raw.fillna(""))
    aliases = {
        "gaveta": ["gaveta", "posicao", "posicao_estoque", "ocupacao", "ocupacao_estoque"],
        "cod": ["cod", "codigo", "material", "sku"],
        "produto": ["produto", "descricao", "descrição", "nome"],
        "lote": ["lote", "batch", "lote_id"],
        "quantidade": ["quantidade", "qtd", "qtd_gaveta", "qtd.gaveta"],
        "observacao": ["observacao", "observação", "obs", "nota"]
    }

    norm = {}
    for alvo, opcoes in aliases.items():
        encontrado = ""
        for op in opcoes:
            if op in df.columns:
                encontrado = op
                break
        norm[alvo] = df.get(encontrado, "")

    base = pd.DataFrame(norm).fillna("")
    base["gaveta"] = base["gaveta"].apply(_extrai_local)
    for c in base.columns:
        base[c] = base[c].astype(str).str.strip()
    return base

# ----------------------------
# Comparador (COM MERGE OUTER, preserva todas as linhas)
# ----------------------------

def comparar(oficial: pd.DataFrame, divergente: pd.DataFrame) -> pd.DataFrame:
    """
    Compara Oficial (WMS) x Físico usando merge outer (mantém todas as linhas).
    Chaves: ['gaveta','cod','produto'] (as que existirem em ambos).
    Saída:
      - quantidade_wms, quantidade_fisico, diferenca (fisico - wms)
      - lote_wms, lote_fisico
      - observacao_wms, observacao_fisico
      - Status: 'OK' ou nomes das colunas divergentes ('quantidade','lote','observacao')
                + marcações de presença via coluna _merge (left_only/right_only/both)
      - Ordenação lógica por 'gaveta': rua/letra -> número -> sufixo
    """
    # garante colunas padrão
    for df in (oficial, divergente):
        for c in ["gaveta","cod","produto","lote","quantidade","observacao"]:
            if c not in df.columns:
                df[c] = ""
        for c in df.columns:
            df[c] = df[c].astype(str).str.strip()

    # chaves
    keys_all = ["gaveta", "cod", "produto"]
    keys = [k for k in keys_all if k in oficial.columns and k in divergente.columns]
    if not keys:
        # fallback: usa só 'cod' se nada mais existir
        keys = ["cod"]

    # renomeia colunas de valor antes do merge para forçar sufixos
    left = oficial.rename(columns={
        "quantidade": "quantidade_wms",
        "lote": "lote_wms",
        "observacao": "observacao_wms",
    })
    right = divergente.rename(columns={
        "quantidade": "quantidade_fisico",
        "lote": "lote_fisico",
        "observacao": "observacao_fisico",
    })

    # merge outer preservando todas as linhas (inclusive duplicadas por chave)
    df_out = left.merge(
        right,
        on=keys,
        how="outer",
        suffixes=("", ""),  # já renomeamos acima
        indicator=True
    )

    # helpers numéricos
    def to_num(x):
        x = str(x).strip().lower().replace(",", ".")
        m = re.search(r'[-+]?\d*\.?\d+', x)
        if not m:
            return None
        try:
            return float(m.group())
        except:
            return None

    # diferenca (fisico - wms)
    if "quantidade_wms" not in df_out: df_out["quantidade_wms"] = ""
    if "quantidade_fisico" not in df_out: df_out["quantidade_fisico"] = ""
    df_out["diferenca"] = df_out.apply(
        lambda r: (
            (lambda nf, nw: (int(nf - nw) if float(nf - nw).is_integer() else float(nf - nw)))
            (to_num(r["quantidade_fisico"]), to_num(r["quantidade_wms"]))
            if (to_num(r["quantidade_fisico"]) is not None and to_num(r["quantidade_wms"]) is not None)
            else ""
        ),
        axis=1
    )

    # Status
    def status_row(r):
        issues = []
        # divergências quando linha existe nos dois lados
        if r["_merge"] == "both":
            if to_num(r["quantidade_wms"]) != to_num(r["quantidade_fisico"]):
                issues.append("quantidade")
            lw = str(r.get("lote_wms","")).strip().lower()
            lf = str(r.get("lote_fisico","")).strip().lower()
            if lw != lf:
                issues.append("lote")
            ow = str(r.get("observacao_wms","")).strip().lower()
            of_ = str(r.get("observacao_fisico","")).strip().lower()
            if ow != of_:
                issues.append("observacao")
        elif r["_merge"] == "left_only":
            issues.append("ausente_no_fisico")
        elif r["_merge"] == "right_only":
            issues.append("ausente_no_wms")
        return "OK" if not issues else ";".join(issues)

    df_out["Status"] = df_out.apply(status_row, axis=1)

    # ordenação de colunas
    ordered = keys + [
        "quantidade_wms","quantidade_fisico","diferenca",
        "lote_wms","lote_fisico",
        "observacao_wms","observacao_fisico",
        "Status","_merge"
    ]
    for c in ordered:
        if c not in df_out.columns:
            df_out[c] = ""
    df_out = df_out[ordered]

    # >>> Ordenação lógica por 'gaveta': rua/letra -> número -> sufixo
    if "gaveta" in df_out.columns:
        df_out = df_out.sort_values(
            by=keys,  # mantém ordenação também por cod/produto após gaveta
            key=lambda col: col.map(_parse_gaveta) if col.name == "gaveta" else col
        ).reset_index(drop=True)
    else:
        df_out = df_out.sort_values(by=keys).reset_index(drop=True)

    return df_out