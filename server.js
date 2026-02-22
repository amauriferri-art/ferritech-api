const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI; 
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🟢 Banco de Dados conectado!'))
  .catch(err => console.log('🔴 Erro ao conectar ao banco:', err));

// ================= MODELOS DE DADOS =================
const Produto = mongoose.model('Produto', {
    name: String, price: Number, stock: Number, media: [String],
    category: String, featuredOrder: Number, description: String, weight: Number
});

const Usuario = mongoose.model('Usuario', {
    nome: String, email: { type: String, unique: true }, senha: String, dataCriacao: { type: Date, default: Date.now }
});

const Pedido = mongoose.model('Pedido', {
    usuarioId: String, nomeCliente: String, itens: Array, 
    metodoEntrega: String, valorFrete: Number, total: Number,
    endereco: Object, // NOVO: Guarda o endereço do cliente
    pagamentoId: String, // NOVO: Guarda o ID do Mercado Pago para atualizar sozinho
    status: { type: String, default: 'Pendente' }, 
    dataPedido: { type: Date, default: Date.now }
});
// ====================================================

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI' });

app.post('/api/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        const existe = await Usuario.findOne({ email });
        if (existe) return res.status(400).json({ success: false, message: "E-mail já cadastrado!" });
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const novoUsuario = new Usuario({ nome, email, senha: senhaHash });
        await novoUsuario.save();
        res.json({ success: true, userId: novoUsuario._id, nome: novoUsuario.nome, email: novoUsuario.email });
    } catch (e) { res.status(500).json({ success: false, message: "Erro ao criar conta." }); }
});

app.post('/api/login-cliente', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await Usuario.findOne({ email });
        if (!usuario) return res.status(400).json({ success: false, message: "Usuário não encontrado." });
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ success: false, message: "Senha incorreta." });
        res.json({ success: true, userId: usuario._id, nome: usuario.nome, email: usuario.email });
    } catch (e) { res.status(500).json({ success: false, message: "Erro no login." }); }
});

// --- ROTA DE PAGAMENTO ---
app.post('/api/process_payment', async (req, res) => {
    const { paymentData, items, shippingPrice, shippingName, userId, userName, endereco } = req.body;
    
    try {
        const payment = new Payment(client);
        paymentData.description = `Pedido FerriTech - ${userName}`;
        
        // Configura o Webhook automático para essa URL
        paymentData.notification_url = "https://ferritech-api.onrender.com/api/webhook";

        const response = await payment.create({ body: paymentData });

        const isPix = paymentData.payment_method_id === 'pix';
        const qrCode = isPix && response.point_of_interaction ? response.point_of_interaction.transaction_data.qr_code : null;
        const qrCodeBase64 = isPix && response.point_of_interaction ? response.point_of_interaction.transaction_data.qr_code_base64 : null;

        const subtotal = items.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
        const totalGeral = subtotal + shippingPrice;
        
        const statusPedido = response.status === 'approved' ? 'Pago' : 'Pendente';
        
        const novoPedido = new Pedido({
            usuarioId: userId, nomeCliente: userName, itens: items,
            metodoEntrega: shippingName, valorFrete: shippingPrice, total: totalGeral,
            endereco: endereco,
            pagamentoId: response.id.toString(), // Salva o ID do MP
            status: statusPedido
        });
        await novoPedido.save();

        res.json({ success: true, status: response.status, isPix: isPix, qrCode: qrCode, qrCodeBase64: qrCodeBase64 });
    } catch (error) { 
        res.status(500).json({ success: false, message: "Erro ao processar pagamento." }); 
    }
});

// --- ESCUTA AUTOMÁTICA DO MERCADO PAGO (WEBHOOK) ---
app.post('/api/webhook', async (req, res) => {
    // O Mercado Pago manda requisições aqui quando o status do pagamento muda
    try {
        const action = req.body.action || req.body.type;
        if (action === 'payment.updated' || action === 'payment') {
            const paymentId = req.body.data.id;
            
            // Vai no MP consultar o status real atualizado
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            
            if (paymentInfo.status === 'approved') {
                // Atualiza o pedido sozinho no banco de dados!
                await Pedido.findOneAndUpdate({ pagamentoId: paymentId.toString() }, { status: 'Pago' });
                
                // Dispara o email avisando você que caiu o dinheiro!
                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
                    transporter.sendMail({
                        from: `"FerriTech" <${process.env.EMAIL_USER}>`, to: process.env.EMAIL_USER, subject: `💰 PAGAMENTO APROVADO!`,
                        text: `Um pedido foi pago e aprovado automaticamente.\nVerifique o painel para gerar a etiqueta de envio.`
                    }).catch(e=>{});
                }
            }
        }
        res.sendStatus(200); // MP exige que a gente responda 200 OK rápido
    } catch (err) {
        console.error("Erro no webhook:", err);
        res.sendStatus(500);
    }
});

app.post('/api/frete', async (req, res) => {
    const { cepDestino, pesoTotal } = req.body;
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDestino.replace(/\D/g, '')}/json/`);
        const dadosCep = await response.json();
        if (dadosCep.erro) return res.status(400).json({ success: false, message: "CEP não encontrado." });
        const uf = dadosCep.uf; const peso = parseFloat(pesoTotal) || 1.0; let basePac = 0, prazoPac = 0;
        if (uf === 'ES') { basePac = 15.00 + (peso * 2.50); prazoPac = 3; } 
        else if (['SP', 'RJ', 'MG'].includes(uf)) { basePac = 25.00 + (peso * 4.00); prazoPac = 6; } 
        else { basePac = 40.00 + (peso * 8.00); prazoPac = 10; }
        const valorSedex = basePac + 25.00 + (peso * 4.00);
        
        // Devolve os dados do CEP junto para a loja preencher
        res.json({ 
            success: true, 
            pac: { Valor: basePac.toFixed(2).replace('.', ','), PrazoEntrega: prazoPac.toString() }, 
            sedex: { Valor: valorSedex.toFixed(2).replace('.', ','), PrazoEntrega: Math.max(1, prazoPac - 4).toString() },
            enderecoInfo: dadosCep // Manda Rua, Bairro, etc pro frontend
        });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/meus-pedidos/:userId', async (req, res) => { try { const pedidos = await Pedido.find({ usuarioId: req.params.userId }).sort({ dataPedido: -1 }); res.json(pedidos); } catch (e) { res.status(500).send(e); } });
app.get('/api/admin/pedidos', async (req, res) => { try { const pedidos = await Pedido.find().sort({ dataPedido: -1 }); res.json(pedidos); } catch (e) { res.status(500).send(e); } });
app.put('/api/admin/pedidos/:id/status', async (req, res) => { try { await Pedido.findByIdAndUpdate(req.params.id, { status: req.body.status }); res.json({ success: true }); } catch (e) { res.status(500).send(e); } });
app.post('/api/login', (req, res) => { if (req.body.username === 'amauri123' && req.body.password === 'matenco123') res.json({ success: true }); else res.status(401).json({ success: false }); });
app.get('/api/produtos', async (req, res) => { try { const dados = await Produto.find(); res.json(dados.map(p => ({ id: p._id, name: p.name, price: p.price, stock: p.stock, media: p.media, category: p.category, featuredOrder: p.featuredOrder, description: p.description, weight: p.weight }))); } catch (e) { res.status(500).send(e); } });
app.post('/api/produtos', async (req, res) => { try { await new Produto(req.body).save(); res.status(201).json({ ok: true }); } catch (e) { res.status(500).send(e); } });
app.put('/api/produtos/:id', async (req, res) => { try { await Produto.findByIdAndUpdate(req.params.id, req.body); res.json({ ok: true }); } catch (e) { res.status(500).send(e); } });
app.delete('/api/produtos/:id', async (req, res) => { try { await Produto.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).send(e); } });

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`🚀 Servidor rodando na porta ${PORTA}`));
