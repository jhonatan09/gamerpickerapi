# 🕸️ Gamer Picker API - Backend

Este é o backend da aplicação **Game Picker**, responsável por fazer scraping das especificações mínimas de sistema de jogos (como RAM, processador, armazenamento) a partir de uma URL externa da página de detalhes de cada jogo.

> 🔗 Frontend do projeto: [https://github.com/jhonatan09/game-picker](https://github.com/jhonatan09/game-picker)

---

## ⚙️ Tecnologias Utilizadas

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [Puppeteer](https://pptr.dev/) para scraping em páginas HTML
- [CORS](https://www.npmjs.com/package/cors)

---

## 🚀 Como rodar o projeto localmente

### ✅ Pré-requisitos

- Node.js v18+ instalado
- NPM ou Yarn

### 🧪 Instalação e execução

1. **Clone o repositório**

```bash
git clone https://github.com/jhonatan09/gamerpickerapi.git
cd gamerpickerapi
```

2. **Instale as dependências**

```bash
npm install
```

3. **Execute o servidor**

```bash
npm start
```

> O servidor será iniciado em: [http://localhost:3000](http://localhost:3000)

---

## 🧠 Como funciona

- Endpoint principal:  
  `GET /specs?url={URL}`  
  Onde `url` deve ser a URL da página de detalhes do jogo no site [freetogame.com](https://www.freetogame.com/).

- O servidor utiliza **Puppeteer** para abrir a página em background, ler os elementos HTML que contêm as especificações mínimas de sistema e retornar esses dados em formato JSON.

### 🧾 Exemplo de requisição

```http
GET http://localhost:3000/specs?url=https://www.freetogame.com/game/overwatch-2
```

### 🔁 Exemplo de resposta

```json
{
  "os": "Windows 10",
  "memory": "8 GB RAM",
  "processor": "Intel Core i5",
  "graphics": "NVIDIA GeForce GTX 600",
  "storage": "50 GB available space"
}
```

---

## 🛠️ Scripts disponíveis

```bash
npm start     # Inicia o servidor em modo de produção
```

---

## ❗ Observações

- O backend está configurado com CORS liberado para qualquer origem (`origin: "*"`) — ideal apenas para ambiente de testes.
- O Puppeteer pode demorar alguns segundos para carregar páginas com muitos elementos.
- O servidor retorna erro `400` se nenhuma URL for informada.

---

## 📬 Contato

**Jhonatan Cardoso Moreira**  
[LinkedIn](https://www.linkedin.com/in/jhonatan-cardoso-moreira/)  
[GitHub](https://github.com/jhonatan09)
