# InventoryAutomation

Este projeto realiza a comparação entre duas planilhas de inventário: uma oficial e outra fornecida pelo auditor. O sistema compara os valores dos produtos e gera um relatório destacando as discrepâncias.

## Estrutura do Projeto

- `data/`: Contém as planilhas de entrada.
- `src/`: Contém o código Python para realizar a comparação.
- `requirements.txt`: Dependências do projeto.

## Como rodar backend
- cd InventoryAutomation\backend\src
- python -m uvicorn server:app --reload --port 8000

## Como rodar frontend
- cd InventoryAutomation/frontend/src
- npm run dev