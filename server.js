const express = require('express');
const cors = require('cors');

const app = express();

// Configurações básicas
app.use(cors());
app.use(express.json());

// Banco de Dados em memória (Agora aceitando múltiplas mídias)
let produtos = [
    {
        id: 1,
        name: "PC Gamer FerriTech Pro - i7 12700, RTX 4060",
        price: 5899.90,
        media: ["https://via.placeholder.com/300x300/1a1a1a/00eaff?text=PC+GAMER+FERRITECH"],
        stock: 2
    }
];

// ROTA GET: Buscar todos os produtos
app.get('/api/produtos', (req, res) => res.json(produtos));

// ROTA POST: Adicionar novo produto
app.post('/api/produtos', (req, res) => {
    const novoProduto = req.body;
    // Cria um ID único baseado no maior ID existente
    novoProduto.id = produtos.length > 0 ? Math.max(...produtos.map(p => p.id)) + 1 : 1;
    produtos.push(novoProduto);
    res.status(201).json({ mensagem: "Sucesso!", produto: novoProduto });
});

// ROTA DELETE: Apagar um produto pelo ID (NOVIDADE)
app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    produtos = produtos.filter(p => p.id !== id);
    res.json({ mensagem: "Produto removido com sucesso!" });
});

// Porta dinâmica para o Render
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🚀 Servidor rodando na porta ${PORTA}`));
