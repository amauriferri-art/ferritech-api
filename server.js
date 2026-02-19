const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM O BANCO DE DADOS FIXO
const MONGODB_URI = process.env.MONGODB_URI; // Vai puxar a senha segura do Render

mongoose.connect(MONGODB_URI)
  .then(() => console.log('🟢 Banco de Dados MongoDB conectado com sucesso!'))
  .catch(err => console.log('🔴 Erro ao conectar ao banco:', err));

// 2. CRIANDO O "MOLDE" DO PRODUTO (Schema)
const ProdutoSchema = new mongoose.Schema({
    name: String,
    price: Number,
    stock: Number,
    media: [String] // Lista de URLs das fotos/vídeos
});

// Criando o modelo baseado no molde acima
const Produto = mongoose.model('Produto', ProdutoSchema);

// --- ROTAS DA API ---

// Buscar todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const produtosDoBanco = await Produto.find();
        
        // Adaptamos o formato para o frontend entender perfeitamente
        const produtosFormatados = produtosDoBanco.map(p => ({
            id: p._id, // O MongoDB usa _id ao invés de id
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

// Cadastrar novo produto
app.post('/api/produtos', async (req, res) => {
    try {
        const novoProduto = new Produto(req.body);
        await novoProduto.save(); // Salva permanentemente no banco
        res.status(201).json({ mensagem: "Máquina salva no banco com sucesso!", produto: novoProduto });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar no banco de dados." });
    }
});

// Apagar produto
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await Produto.findByIdAndDelete(req.params.id); // Apaga permanentemente
        res.json({ mensagem: "Produto removido da base de dados!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao apagar do banco de dados." });
    }
});

// Ligando o servidor
const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🚀 Servidor da FerriTech rodando na porta ${PORTA}`));
