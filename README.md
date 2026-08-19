# Reading Insights Dashboard

PREV ERRO      │      ├── Excel atualizado      │      ↓  importar_postgres.py      │      ↓  PostgreSQL      │      ├───────────────┐      ↓               ↓  análise         mensagens      ↓               ↓  ranking          WhatsApp      │      ↓  dashboard

eu tenho uma planilha de controle de leituras, para saber os leituristas que colocaram alguma leitura com consumo superior ao mes passado, e assim verificar com ele se esta correto ou nao, com isso, com essa planilha eu consigo criar uma script que puxe os dados dela e faça meio que um resumo com dados e top leituristas com mais consumos agravantes, com grafico de retorno, e que possa controlar a data?, eu atualizo em hora e hora

P: A análise deve ler direto da planilha Excel ou do banco PostgreSQL (já vi que você tem as tabelas controle_leituras/controle_retornos no CENEGED)? R: Direto do Excel (mais simples, sem depender do banco)

P: Que tipo de resultado você quer receber agora? R: Dashboard interativo (abre no navegador, atualiza quando eu rodar de novo)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/75c94d52-34f2-4410-b3fc-5de690c7db2f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
