def validar_quantidade(quantidade: str) -> bool:
    """
    Valida se a quantidade está no formato correto (exemplo: '800kg', '1200kg').
    """
    return quantidade.endswith("kg") and quantidade[:-2].isdigit()