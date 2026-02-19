const express = require('express');
const cors = require('cors');

const app = express();

// Configurações básicas
app.use(cors());
app.use(express.json());

// Banco de Dados inicial (em memória)
let produtos = [
    {
        id: 1,
        name: "PC Gamer FerriTech Pro - i7 12700, RTX 4060, 32GB RAM RGB",
        price: 5899.90,
        image: "https://via.placeholder.com/300x300/1a1a1a/00eaff?text=PC+GAMER+FERRITECH",
        stock: 2
    },
    {
        id: 2,
        name: "Placa de Vídeo RTX 4060 Ti 8GB Dual Fan OC",
        price: 2499.90,
        image: "https://via.placeholder.com/300x300/1a1a1a/00eaff?text=GPU+RTX+4060",
        stock: 5
    },
    {
        id: 3,
        name: "Processador AMD Ryzen 7 5700X3D (Cache 3D)",
        price: 1399.00,
        image: "https://via.placeholder.com/300x300/1a1a1a/ff8c00?text=Ryzen+7",
        stock: 8
    }
];

// ROTA GET: Envia os produtos para a loja (index.html)
app.get('/api/produtos', (req, res) => {
    res.json(produtos);
});

// ROTA POST: Recebe um novo produto do painel (dashboard.html)
app.post('/api/produtos', (req, res) => {
    const novoProduto = req.body;
    
    // Cria um ID automático
    novoProduto.id = produtos.length > 0 ? produtos[produtos.length - 1].id + 1 : 1;
    
    // Adiciona na lista
    produtos.push(novoProduto);
    
    console.log("Novo hardware cadastrado:", novoProduto.name);
    res.status(201).json({ mensagem: "Produto cadastrado com sucesso!", produto: novoProduto });
});

// Ligando o servidor na nuvem ou local
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`🚀 Servidor da FerriTech rodando na porta ${PORTA}`);
});