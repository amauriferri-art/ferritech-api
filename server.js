const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const { calcularPrecoPrazo } = require('correios-brasil');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM BANCO DE DADOS
const MONGODB_URI = process.env.MONGODB_URI; 
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🟢 Banco de Dados conectado!'))
  .catch(err => console.log('🔴 Erro ao conectar ao banco:', err));

const Produto = mongoose.model('Produto', {
    name: String, price: Number, stock: Number, media: [String],
    category: String, featuredOrder: Number, description: String, weight: Number
});

// 2. CONFIGURAÇÃO DO MERCADO PAGO
// Importante: Você vai precisar colocar o MP_ACCESS_TOKEN lá no site do Render depois!
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI' });

// 3. ROTA DE FRETE DOS CORREIOS
app.post('/api/frete', async (req, res) => {
    const { cepDestino, pesoTotal } = req.body;
    const cepOrigem = '29140878'; // SEU CEP DE ORIGEM

    try {
        let args = {
            sCepOrigem: cepOrigem,
            sCepDestino: cepDestino.replace(/\D/g, ''),
            nVlPeso: pesoTotal.toString(),
            nCdFormato: '1', // 1 = Caixa/Pacote
            nVlComprimento: '20', nVlAltura: '20', nVlLargura: '20', // Medidas padrão
            nVlDiametro: '0',
        };
        
        // 04510 = PAC | 04014 = SEDEX
        args.nCdServico = ['04510']; 
        const [pac] = await calcularPrecoPrazo(args);
        
        args.nCdServico = ['04014'];
        const [sedex] = await calcularPrecoPrazo(args);

        res.json({ success: true, pac, sedex });
    } catch (error) {
        console.log("Erro no frete:", error);
        res.status(500).json({ success: false, message: "Erro ao calcular frete nos Correios." });
    }
});

// 4. ROTA DE PAGAMENTO DO MERCADO PAGO
app.post('/api/checkout', async (req, res) => {
    const { items, shippingPrice, shippingName } = req.body;
    
    try {
        const preference = new Preference(client);
        
        // Monta os produtos para o Mercado Pago
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: Number(item.price),
            quantity: 1,
            currency_id: 'BRL'
        }));

        // Adiciona o valor do Frete como um item
        if (shippingPrice > 0) {
            mpItems.push({
                title: `Frete: ${shippingName}`,
                unit_price: Number(shippingPrice),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        const response = await preference.create({
            body: {
                items: mpItems,
                back_urls: {
                    success: "https://ferritech.tec.br",
                    failure: "https://ferritech.tec.br",
                    pending: "https://ferritech.tec.br"
                },
                auto_return: "approved",
            }
        });

        res.json({ success: true, init_point: response.init_point });
    } catch (error) {
        console.error("Erro MP:", error);
        res.status(500).json({ success: false, message: "Erro ao gerar link de pagamento." });
    }
});

// ROTAS DO PAINEL ADMIN E PRODUTOS (MANTIDAS)
app.post('/api/login', (req, res) => {
    if (req.body.username === 'amauri123' && req.body.password === 'matenco123') res.json({ success: true });
    else res.status(401).json({ success: false });
});
app.get('/api/produtos', async (req, res) => {
    try {
        const dados = await Produto.find();
        res.json(dados.map(p => ({ id: p._id, name: p.name, price: p.price, stock: p.stock, media: p.media, category: p.category, featuredOrder: p.featuredOrder, description: p.description, weight: p.weight })));
    } catch (e) { res.status(500).send(e); }
});
app.post('/api/produtos', async (req, res) => {
    try { await new Produto(req.body).save(); res.status(201).json({ ok: true }); } catch (e) { res.status(500).send(e); }
});
app.put('/api/produtos/:id', async (req, res) => {
    try { await Produto.findByIdAndUpdate(req.params.id, req.body); res.json({ ok: true }); } catch (e) { res.status(500).send(e); }
});
app.delete('/api/produtos/:id', async (req, res) => {
    try { await Produto.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).send(e); }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🚀 Servidor rodando na porta ${PORTA}`));
