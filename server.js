const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { MercadoPagoConfig, Preference } = require('mercadopago');

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
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI' });

// 3. NOVA ROTA DE FRETE INTELIGENTE (Sem bloqueio dos Correios)
app.post('/api/frete', async (req, res) => {
    const { cepDestino, pesoTotal } = req.body;
    
    try {
        // Busca a região do cliente via ViaCEP (Rápido e não bloqueia)
        const response = await fetch(`https://viacep.com.br/ws/${cepDestino.replace(/\D/g, '')}/json/`);
        const dadosCep = await response.json();
        
        if (dadosCep.erro) {
            return res.status(400).json({ success: false, message: "CEP não encontrado." });
        }

        const uf = dadosCep.uf;
        const peso = parseFloat(pesoTotal) || 1.0;

        let basePac = 0;
        let prazoPac = 0;

        // Tabela de Cálculo Realista baseada na saída de Cariacica - ES
        if (uf === 'ES') {
            basePac = 15.00 + (peso * 2.50);
            prazoPac = 3;
        } else if (['SP', 'RJ', 'MG'].includes(uf)) {
            basePac = 25.00 + (peso * 4.00);
            prazoPac = 6;
        } else if (['PR', 'SC', 'RS', 'DF', 'GO', 'BA'].includes(uf)) {
            basePac = 38.00 + (peso * 6.50);
            prazoPac = 9;
        } else {
            // Regiões Norte, Nordeste e Centro-Oeste mais distantes
            basePac = 55.00 + (peso * 10.00);
            prazoPac = 14;
        }

        // Sedex é mais rápido e mais caro
        const valorSedex = basePac + 25.00 + (peso * 4.00);
        const prazoSedex = Math.max(1, prazoPac - 4); // Sempre será mais rápido que o PAC

        res.json({ 
            success: true, 
            pac: { 
                Valor: basePac.toFixed(2).replace('.', ','), 
                PrazoEntrega: prazoPac.toString() 
            }, 
            sedex: { 
                Valor: valorSedex.toFixed(2).replace('.', ','), 
                PrazoEntrega: prazoSedex.toString() 
            } 
        });

    } catch (error) {
        console.log("Erro no frete:", error);
        res.status(500).json({ success: false, message: "Erro ao calcular frete." });
    }
});

// 4. ROTA DE PAGAMENTO DO MERCADO PAGO
app.post('/api/checkout', async (req, res) => {
    const { items, shippingPrice, shippingName } = req.body;
    
    try {
        const preference = new Preference(client);
        
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: Number(item.price),
            quantity: 1,
            currency_id: 'BRL'
        }));

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

// ROTAS DO PAINEL ADMIN E PRODUTOS 
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
