import io
import re
import unicodedata
from typing import List, Dict, Optional, Tuple
import pandas as pd

# Colunas internas necessárias para gerar o template
_REQUIRED = ["GAVETA_RAW", "MATERIAL", "DESCRICAO"]

# Palavras chave para identificação da linha de cabeçalho
_HEADER_KEYWORDS = {
    "gaveta": 5,
    "material": 5,
    "descr": 4,
    "descrição": 4,
    "descricao": 4,
    "qtd.gaveta": 3,
    "qtd_gaveta": 3,
    "qtd": 2,
    "quant": 2,
    "lote": 2,
    "local": 2,
    "almoxarifado": 2
}

_token_pattern = re.compile(r'(\d+|[A-Za-z]+|[^A-Za-z0-9])')


# ------------------ Normalização ------------------ #
def _strip_bom(s: str) -> str:
    return s.replace("\ufeff", "") if isinstance(s, str) else s

def _normalize_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = _strip_bom(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"\s+", " ", s)
    return s.strip()

def _normalize_for_match(s: str) -> str:
    return _normalize_text(s).lower()


# ------------------ Detecção de cabeçalho ------------------ #
def _score_header_row(values: List[str]) -> int:
    score = 0
    seen_keywords = set()
    for raw in values:
        n = _normalize_for_match(raw)
        if not n:
            continue
        for kw, weight in _HEADER_KEYWORDS.items():
            if kw in n:
                # Evita somar várias vezes exatamente a mesma string/kw
                key = (kw, n)
                if key not in seen_keywords:
                    score += weight
                    seen_keywords.add(key)
    return score

def _find_header_row(df_raw: pd.DataFrame, max_scan: int = 25) -> int:
    """
    Procura a linha que provavelmente contém os nomes de coluna.
    Retorna índice da linha. Se não achar, levanta erro explicativo.
    """
    best_idx = -1
    best_score = 0

    # Converter tudo pra string (sem alterar df original)
    rows = min(max_scan, len(df_raw))
    for i in range(rows):
        values = ["" if pd.isna(v) else str(v) for v in df_raw.iloc[i].tolist()]
        non_empty = [v for v in values if _normalize_for_match(v)]
        if not non_empty:
            continue
        score = _score_header_row(values)
        # Critério: requer pelo menos duas das colunas fundamentais juntas
        fundamentals_present = 0
        test_line = " ".join(v.lower() for v in non_empty)
        for kw in ["gaveta", "material", "descr", "descrição", "descricao"]:
            if kw in test_line:
                fundamentals_present += 1
        if fundamentals_present >= 2 and score > best_score:
            best_score = score
            best_idx = i

    if best_idx == -1:
        # Mostra as primeiras linhas para debug
        sample_lines = []
        for i in range(min(8, len(df_raw))):
            row_vals = ["" if pd.isna(v) else str(v) for v in df_raw.iloc[i].tolist()]
            sample_lines.append(f"{i}: {row_vals}")
        raise ValueError(
            "Não foi possível detectar a linha de cabeçalho. Amostra inicial:\n" +
            "\n".join(sample_lines)
        )

    # print(f"[DEBUG] Linha de cabeçalho detectada: {best_idx} (score={best_score})")
    return best_idx


# ------------------ Leitura bruta ------------------ #
def _read_raw(file_bytes: bytes) -> pd.DataFrame:
    # Tenta Excel sem header
    try:
        return pd.read_excel(io.BytesIO(file_bytes), header=None, dtype=str)
    except Exception:
        pass

    # Tenta CSV com separadores comuns
    for sep in [";", ",", "\t", "|"]:
        try:
            return pd.read_csv(io.BytesIO(file_bytes), header=None, sep=sep, dtype=str, engine="python")
        except Exception:
            continue

    raise ValueError("Arquivo não pôde ser lido como Excel ou CSV com separadores padrão.")


# ------------------ Renomeação heurística ------------------ #
def _heuristic_rename_columns(header_values: List[str]) -> List[str]:
    """
    Recebe a linha de cabeçalho original e retorna a lista de nomes
    normalizados/renomeados para uso interno.
    """
    renamed = []
    for raw in header_values:
        n_raw = "" if raw is None else str(raw)
        n = _normalize_for_match(n_raw)

        target = None
        if "gaveta" in n:
            target = "GAVETA_RAW"
        elif "material" in n:
            target = "MATERIAL"
        elif "descr" in n:
            target = "DESCRICAO"
        elif "qtd.gav" in n or ("qtd" in n and "gav" in n) or ("quant" in n and "gav" in n):
            target = "QTD_GAVETA"
        elif "lote" in n:
            target = "LOTE"
        elif n == "local" or " local" == n or n.startswith("local "):
            target = "LOCAL"
        elif "almox" in n:
            target = "ALMOXARIFADO"

        if target is None:
            # Mantém uma versão "limpa" do original para não perder completamente a coluna
            target = _normalize_text(n_raw).replace(" ", "_").upper()
            if not target:
                target = "COL_VAZIA"

        renamed.append(target)

    # Resolver duplicatas adicionando sufixo _DUPn
    counts: Dict[str, int] = {}
    final: List[str] = []
    for name in renamed:
        if name not in counts:
            counts[name] = 0
            final.append(name)
        else:
            counts[name] += 1
            final.append(f"{name}_DUP{counts[name]}")
    return final


# ------------------ Ordenação natural de gavetas ------------------ #
def _tokenize_gaveta(g: str):
    if g is None:
        return []
    g = str(g).strip()
    parts = _token_pattern.findall(g)
    out = []
    for p in parts:
        if p.isdigit():
            out.append(int(p))
        else:
            out.append(p.lower())
    return out

def _natural_sort_dataframe(df: pd.DataFrame, col: str) -> pd.DataFrame:
    df["_sort_key"] = df[col].apply(_tokenize_gaveta)
    df = df.sort_values(by="_sort_key", kind="stable").drop(columns="_sort_key").reset_index(drop=True)
    return df


# ------------------ Sugestões ------------------ #
def _gerar_sugestoes(gavetas: List[str], janela: int = 3) -> List[str]:
    distinct = list(dict.fromkeys(gavetas))
    prefix_index: Dict[str, List[str]] = {}
    for g in distinct:
        lg = g.lower()
        for plen in (5, 4, 3):
            if len(lg) >= plen:
                prefix = lg[:plen]
                prefix_index.setdefault(prefix, []).append(g)

    cache: Dict[str, List[str]] = {}
    for i, g in enumerate(distinct):
        vizinhos = distinct[max(0, i - janela): i + janela + 1]
        vizinhos = [v for v in vizinhos if v != g]
        gl = g.lower()
        extra = []
        for plen in (5, 4, 3):
            if len(gl) >= plen:
                cand = prefix_index.get(gl[:plen], [])
                extra = [x for x in cand if x != g]
                if extra:
                    break
        combined = []
        seen = set()
        for c in vizinhos + extra:
            if c not in seen:
                seen.add(c)
                combined.append(c)
            if len(combined) >= 8:
                break
        cache[g] = combined
    return ["; ".join(cache[g]) for g in gavetas]


# ------------------ Função principal ------------------ #
def gerar_template_digitacao(file_bytes: bytes) -> pd.DataFrame:
    df_raw = _read_raw(file_bytes)

    header_idx = _find_header_row(df_raw)
    header_row = df_raw.iloc[header_idx].tolist()
    new_columns = _heuristic_rename_columns(header_row)

    # Slice abaixo do cabeçalho
    df = df_raw.iloc[header_idx + 1:].copy()
    df.columns = new_columns

    # Remove colunas completamente vazias (opcional)
    if "COL_VAZIA" in df.columns:
        all_empty = df["COL_VAZIA"].isna().all() or (df["COL_VAZIA"].astype(str).str.strip() == "").all()
        if all_empty:
            df = df.drop(columns=["COL_VAZIA"])

    # Limpa linhas onde todas as colunas estão vazias
    df = df[~df.apply(lambda r: all(str(x).strip() == "" or str(x).lower() == "nan" for x in r), axis=1)]

    # Ajustes finais de nomes com acento (se restar)
    if "DESCRIÇÃO" in df.columns and "DESCRICAO" not in df.columns:
        df = df.rename(columns={"DESCRIÇÃO": "DESCRICAO"})

    # Verificação obrigatória
    missing = [c for c in _REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(
            f"Colunas obrigatórias ausentes: {missing}. "
            f"Colunas detectadas: {list(df.columns)}. "
            f"Primeira linha original detectada como cabeçalho: {header_row}"
        )

    has_lote = "LOTE" in df.columns
    has_qtd = "QTD_GAVETA" in df.columns

    df = _natural_sort_dataframe(df, "GAVETA_RAW")

    out = pd.DataFrame()
    out["Gaveta"] = df["GAVETA_RAW"].astype(str)
    out["Material"] = df["MATERIAL"].astype(str)
    out["Descricao"] = df["DESCRICAO"].astype(str)
    out["Lote"] = df["LOTE"] if has_lote else ""
    out["QtdeSistema"] = df["QTD_GAVETA"] if has_qtd else ""
    out["QtdeFisica"] = ""
    out["Observacao"] = ""
    out["SugestoesGaveta"] = _gerar_sugestoes(out["Gaveta"].tolist())

    return out