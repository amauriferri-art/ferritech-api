const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados usando a variável do Render
const MONGODB_URI = process.env.MONGODB_URI; 

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🟢 Banco de Dados conectado com sucesso!'))
  .catch(err => console.log('🔴 Erro ao conectar ao banco:', err));

// Modelo do Produto ATUALIZADO com Descrição
const Produto = mongoose.model('Produto', {
    name: String,
    price: Number,
    stock: Number,
    media: [String],
    category: String,       
    featuredOrder: Number,
    description: String     // NOVO: Campo de descrição
});

// Rota de Login Único
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'amauri123' && password === 'matenco123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Usuário ou senha incorretos!" });
    }
});

// Buscar Anúncios (Agora traz a descrição também)
app.get('/api/produtos', async (req, res) => {
    try {
        const dados = await Produto.find();
        res.json(dados.map(p => ({ 
            id: p._id, 
            name: p.name, 
            price: p.price, 
            stock: p.stock, 
            media: p.media,
            category: p.category,          
            featuredOrder: p.featuredOrder,
            description: p.description // NOVO
        })));
    } catch (e) { res.status(500).send(e); }
});

// Criar Anúncio
app.post('/api/produtos', async (req, res) => {
    try {
        const novo = new Produto(req.body);
        await novo.save();
        res.status(201).json({ ok: true });
    } catch (e) { res.status(500).send(e); }
});

// Editar Anúncio
app.put('/api/produtos/:id', async (req, res) => {
    try {
        await Produto.findByIdAndUpdate(req.params.id, req.body);
        res.json({ ok: true });
    } catch (e) { res.status(500).send(e); }
});

// Remover Anúncio
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await Produto.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).send(e); }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🚀 Servidor FerriTech rodando na porta ${PORTA}`));
