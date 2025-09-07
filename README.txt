# InventoryAutomation

Este projeto realiza a comparação entre duas planilhas de inventário: uma oficial e outra fornecida pelo auditor. O sistema compara os valores dos produtos e gera um relatório destacando as discrepâncias.

## Estrutura do Projeto

- `data/`: Contém as planilhas de entrada.
- `src/`: Contém o código Python para realizar a comparação.
- `requirements.txt`: Dependências do projeto.

--------------------------------------------
pip install -r requirements.txt
--------------------------------------------

## Para rodar o backend:
- cd C:\Users\55119\Documents\InventoryAutomation\backend\src
- python -m uvicorn server:app --reload --port 8000

## Para rodar o frontend:
- cd C:\Users\55119\Documents\InventoryAutomation\frontend\src
- npm run dev
- abra http://localhost:5173/