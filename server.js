const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM O BANCO DE DADOS
const MONGODB_URI = process.env.MONGODB_URI; 

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🟢 Banco de Dados conectado!'))
  .catch(err => console.log('🔴 Erro ao conectar ao banco:', err));

// 2. MODELO DO PRODUTO
const ProdutoSchema = new mongoose.Schema({
    name: String,
    price: Number,
    stock: Number,
    media: [String]
});
const Produto = mongoose.model('Produto', ProdutoSchema);

// --- ROTAS DA API ---

// ROTA DE LOGIN (Acesso Restrito)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Validação do seu usuário único
    if (username === 'amauri123' && password === 'matenco123') {
        res.json({ success: true, message: "Acesso autorizado!" });
    } else {
        res.status(401).json({ success: false, message: "Usuário ou senha incorretos!" });
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const produtosDoBanco = await Produto.find();
        const produtosFormatados = produtosDoBanco.map(p => ({
            id: p._id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            media: p.media
        }));
        res.json(produtosFormatados);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar os hardwares." });
    }
});

app.post('/api/produtos', async (req, res) => {
    try {
        const novoProduto = new Produto(req.body);
        await novoProduto.save();
        res.status(201).json({ mensagem: "Produto salvo!", produto: novoProduto });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar." });
    }
});

app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await Produto.findByIdAndDelete(req.params.id);
        res.json({ mensagem: "Produto removido!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao apagar." });
    }
});
