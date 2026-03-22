// =================================================================
// ⚙️ استدعاء المكتبات الأساسية
// =================================================================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// =================================================================
// 🚀 تهيئة الخادم وقاعدة البيانات
// =================================================================
const app = express();
app.use(cors());
app.use(express.json());

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // ضروري للاستضافات السحابية
});

// المفتاح السري لتشفير التذاكر (في الإنتاج الحقيقي نضعه في ملف .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_yemen_2026';

// =================================================================
// 🛡️ ميدل وير (Middleware): حارس البوابات للتحقق من التذكرة (JWT)
// =================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // جلب التذكرة

    if (!token) {
        return res.status(401).json({ success: false, message: "⛔ الدخول مرفوض! لم تقم بإرفاق تذكرة الأمان (Token)." });
    }

    // التحقق من صحة التذكرة
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "❌ تذكرة الأمان غير صالحة أو منتهية الصلاحية." });
        
        req.user = user; // حفظ بيانات المستخدم الموثق لتمريرها للنافذة
        next(); // السماح بالمرور
    });
};

// =================================================================
// 🟢 0. نافذة الفحص (للتأكد أن المحرك يعمل) - مفتوحة للجميع
// =================================================================
app.get('/api/status', (req, res) => {
    res.json({ 
        success: true, 
        message: "🚀 الخادم يعمل بكفاءة ومحمي بأعلى درجات الأمان.", 
        timestamp: new Date() 
    });
});

// =================================================================
// 🔑 1. نافذة تسجيل الدخول (Login) - مفتوحة للجميع لإصدار التذكرة
// =================================================================
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;

    try {
        const userQuery = `SELECT * FROM users WHERE phone = $1;`;
        const { rows } = await pool.query(userQuery, [phone]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "❌ رقم الهاتف غير مسجل لدينا." });
        }

        const user = rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "⛔ حسابك مجمد، يرجى مراجعة الإدارة." });
        }

        // مطابقة كلمة المرور المشفرة
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: "❌ كلمة المرور غير صحيحة." });
        }

        // إصدار التذكرة (JWT)
        const token = jwt.sign(
            { id: user.id, role: user.role, phone: user.phone },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            message: "✅ تم تسجيل الدخول بنجاح!",
            token: token,
            user: { id: user.id, name: user.full_name, role: user.role }
        });

    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        res.status(500).json({ success: false, message: "❌ حدث خطأ في الخادم." });
    }
});

// =================================================================
// 🚪 2. نافذة إضافة وكيل (محمية 🛡️)
// =================================================================
app.post('/api/agents', authenticateToken, async (req, res) => {
    const { full_name, phone, password, network_name, profit_percentage } = req.body;

    try {
        await pool.query('BEGIN');

        // تشفير كلمة المرور قبل حفظها في قاعدة البيانات (خطوة أمنية هامة)
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertUserQuery = `
            INSERT INTO users (full_name, phone, password_hash, role, network_name, profit_percentage) 
            VALUES ($1, $2, $3, 'agent', $4, $5) RETURNING id;
        `;
        const userResult = await pool.query(insertUserQuery, [full_name, phone, hashedPassword, network_name, profit_percentage]);
        const newUserId = userResult.rows[0].id;

        const insertWalletQuery = `INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00);`;
        await pool.query(insertWalletQuery, [newUserId]);

        await pool.query('COMMIT');
        res.status(201).json({ success: true, message: "✅ تم تسجيل الوكيل وإنشاء محفظته بنجاح!" });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("خطأ في تسجيل الوكيل:", error);
        res.status(500).json({ success: false, message: "❌ حدث خطأ أثناء التسجيل، قد يكون رقم الهاتف مستخدماً." });
    }
});

// =================================================================
// 🚪 3. نافذة جلب جميع الوكلاء (محمية 🛡️)
// =================================================================
app.get('/api/agents', authenticateToken, async (req, res) => {
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
// 🚪 4. نافذة شحن المحفظة المالية (محمية 🛡️)
// =================================================================
app.post('/api/finance/topup', authenticateToken, async (req, res) => {
    const { agent_id, amount, description } = req.body;

    try {
        await pool.query('BEGIN');

        // جلب الرصيد الحالي وتجميده للحظات حتى تنتهي العملية (FOR UPDATE)
        const getWalletQuery = `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE;`;
        const walletResult = await pool.query(getWalletQuery, [agent_id]);
        
        if (walletResult.rows.length === 0) throw new Error("المحفظة غير موجودة!");
        
        const previousBalance = parseFloat(walletResult.rows[0].balance);
        const newBalance = previousBalance + parseFloat(amount);

        // تحديث الرصيد
        const updateWalletQuery = `UPDATE wallets SET balance = $1 WHERE user_id = $2;`;
        await pool.query(updateWalletQuery, [newBalance, agent_id]);

        // التسجيل في السجل الأسود (من قام بالعملية؟ نأخذ رقمه من req.user.id الذي وفره الحارس)
        const insertLogQuery = `
            INSERT INTO transactions (user_id, type, amount, previous_balance, new_balance, description)
            VALUES ($1, 'deposit', $2, $3, $4, $5);
        `;
        // نمرر agent_id كصاحب المحفظة الذي تمت عليه الحركة
        await pool.query(insertLogQuery, [agent_id, amount, previousBalance, newBalance, description]);

        await pool.query('COMMIT');
        res.status(200).json({ success: true, message: "✅ تم إيداع المبلغ وتوثيق الحركة بنجاح!" });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("خطأ في شحن المحفظة:", error);
        res.status(500).json({ success: false, message: "❌ فشلت عملية الإيداع." });
    }
});

// =================================================================
// 🚀 تشغيل المحرك على البورت المخصص
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 النظام يعمل بنجاح ومحمي بالكامل على المنفذ: ${PORT}`);
});
