// استدعاء المكتبات الأساسية
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// إنشاء تطبيق الخادم
const app = express();

// إعدادات الحماية واستقبال البيانات
app.use(cors());
app.use(express.json()); // لكي يفهم الخادم البيانات القادمة بصيغة JSON

// إعداد الاتصال بقاعدة البيانات (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // ضروري للاستضافات السحابية
});

// 🟢 مسار الفحص (للتأكد أن المحرك يعمل)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: "مرحباً يا هندسة! 🚀 الخادم يعمل بكفاءة، وقاعدة البيانات جاهزة لاستقبال الأوامر.",
        timestamp: new Date()
    });
});

// تشغيل المحرك على المنفذ المخصص
const PORT = process.env.PORT || 5000;
// =================================================================
// 🚪 1. نافذة (API): تسجيل وكيل جديد وإضافة محفظة فارغة له آلياً
// =================================================================
app.post('/api/agents', async (req, res) => {
    const { full_name, phone, password, network_name, profit_percentage } = req.body;

    try {
        // 1. نبدأ معاملة مالية آمنة (Transaction)
        await pool.query('BEGIN');

        // 2. إدخال الوكيل في جدول المستخدمين
        const insertUserQuery = `
            INSERT INTO users (full_name, phone, password_hash, role, network_name, profit_percentage) 
            VALUES ($1, $2, $3, 'agent', $4, $5) RETURNING id;
        `;
        const userResult = await pool.query(insertUserQuery, [full_name, phone, password, network_name, profit_percentage]);
        const newUserId = userResult.rows[0].id;

        // 3. إنشاء محفظة مالية (صفرية) لهذا الوكيل فوراً
        const insertWalletQuery = `INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00);`;
        await pool.query(insertWalletQuery, [newUserId]);

        // 4. تأكيد وحفظ العمليتين معاً في قاعدة البيانات
        await pool.query('COMMIT');

        res.status(201).json({ success: true, message: "✅ تم تسجيل الوكيل وإنشاء محفظته بنجاح!" });
    } catch (error) {
        // في حال حدوث أي خطأ، نلغي كل شيء كي لا تتشوه البيانات
        await pool.query('ROLLBACK');
        console.error("خطأ في تسجيل الوكيل:", error);
        res.status(500).json({ success: false, message: "❌ حدث خطأ في الخادم أثناء التسجيل." });
    }
});

// =================================================================
// 🚪 2. نافذة (API): جلب قائمة جميع الوكلاء وأرصدتهم لعرضها في الجدول
// =================================================================
app.get('/api/agents', async (req, res) => {
    try {
        const getAgentsQuery = `
            SELECT u.id, u.full_name, u.phone, u.network_name, u.status, w.balance 
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
            WHERE u.role = 'agent'
            ORDER BY u.created_at DESC;
        `;
        const result = await pool.query(getAgentsQuery);
        res.status(200).json({ success: true, agents: result.rows });
    } catch (error) {
        console.error("خطأ في جلب الوكلاء:", error);
        res.status(500).json({ success: false, message: "❌ حدث خطأ أثناء جلب البيانات." });
    }
});

// =================================================================
// 🚪 3. نافذة (API): شحن محفظة وكيل (إيداع مالي وتسجيل في السجل الأسود)
// =================================================================
app.post('/api/finance/topup', async (req, res) => {
    const { agent_id, amount, description } = req.body;

    try {
        await pool.query('BEGIN');

        // 1. جلب الرصيد الحالي للمحفظة
        const getWalletQuery = `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE;`;
        const walletResult = await pool.query(getWalletQuery, [agent_id]);
        
        if (walletResult.rows.length === 0) throw new Error("المحفظة غير موجودة!");
        const previousBalance = parseFloat(walletResult.rows[0].balance);
        const newBalance = previousBalance + parseFloat(amount);

        // 2. تحديث الرصيد الجديد في المحفظة
        const updateWalletQuery = `UPDATE wallets SET balance = $1 WHERE user_id = $2;`;
        await pool.query(updateWalletQuery, [newBalance, agent_id]);

        // 3. توثيق الحركة في (السجل الأسود / سجل المعاملات)
        const insertLogQuery = `
            INSERT INTO transactions (user_id, type, amount, previous_balance, new_balance, description)
            VALUES ($1, 'deposit', $2, $3, $4, $5);
        `;
        await pool.query(insertLogQuery, [agent_id, amount, previousBalance, newBalance, description]);

        await pool.query('COMMIT');
        res.status(200).json({ success: true, message: "✅ تم إيداع المبلغ في المحفظة وتوثيق الحركة بنجاح!" });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("خطأ في شحن المحفظة:", error);
        res.status(500).json({ success: false, message: "❌ فشلت عملية الإيداع." });
    }
});
            
app.listen(PORT, () => {
    console.log(`🚀 النظام يعمل بنجاح على المنفذ: ${PORT}`);
});

