import os
import argparse
from compare import carregar_planilha, comparar

def main():
    # Verificar o diretório atual para garantir que o script está na pasta src/
    print(f"Diretório atual: {os.getcwd()}")

    # Caminhos absolutos para as planilhas em "C:/Users/55119/Documents/data"
    planilha_oficial = "C:/Users/55119/Documents/data/planilha_oficial.xlsx"
    planilha_divergente = "C:/Users/55119/Documents/data/planilha_divergente.xlsx"

    # Verificar se as planilhas existem antes de carregar
    if not os.path.isfile(planilha_oficial):
        print(f"Erro: A planilha oficial não foi encontrada em: {planilha_oficial}")
        return
    if not os.path.isfile(planilha_divergente):
        print(f"Erro: A planilha divergente não foi encontrada em: {planilha_divergente}")
        return
    
    # Carregar as planilhas usando os caminhos fornecidos
    planilha_oficial = carregar_planilha(planilha_oficial)
    planilha_divergente = carregar_planilha(planilha_divergente)

    # Comparar as planilhas
    resultado = comparar(planilha_oficial, planilha_divergente)

    # Salvar o resultado da comparação
    resultado.to_excel("C:/Users/55119/Documents/data/relatorio_auditoria_comparacao.xlsx", index=False)
    print("Relatório gerado com sucesso: C:/Users/55119/Documents/data/relatorio_auditoria_comparacao.xlsx")

if __name__ == "__main__":
    main()