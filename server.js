// =================================================================
// ⚙️ استدعاء المكتبات الأساسية (شاملة الروبوت الآلي)
// =================================================================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cron = require('node-cron'); // مكتبة الروبوت والمحاسب الآلي
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

// المفتاح السري لتشفير التذاكر
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_yemen_2026';

// =================================================================
// 🛡️ ميدل وير (Middleware): حارس البوابات للتحقق من التذكرة (JWT)
// =================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "⛔ الدخول مرفوض! لم تقم بإرفاق تذكرة الأمان (Token)." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "❌ تذكرة الأمان غير صالحة أو منتهية الصلاحية." });
        req.user = user; 
        next(); 
    });
};

// =================================================================
// 🟢 0. نافذة الفحص (للتأكد أن المحرك يعمل)
// =================================================================
app.get('/api/status', (req, res) => {
    res.json({ 
        success: true, 
        message: "🚀 الخادم يعمل بكفاءة ومحمي بأعلى درجات الأمان.", 
        timestamp: new Date() 
    });
});

// =================================================================
// 🔑 1. نافذة تسجيل الدخول (Login)
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

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: "❌ كلمة المرور غير صحيحة." });
        }

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

        const getWalletQuery = `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE;`;
        const walletResult = await pool.query(getWalletQuery, [agent_id]);
        
        if (walletResult.rows.length === 0) throw new Error("المحفظة غير موجودة!");
        
        const previousBalance = parseFloat(walletResult.rows[0].balance);
        const newBalance = previousBalance + parseFloat(amount);

        const updateWalletQuery = `UPDATE wallets SET balance = $1 WHERE user_id = $2;`;
        await pool.query(updateWalletQuery, [newBalance, agent_id]);

        const insertLogQuery = `
            INSERT INTO transactions (user_id, type, amount, previous_balance, new_balance, description)
            VALUES ($1, 'deposit', $2, $3, $4, $5);
        `;
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
// 🤖 5. الروبوت الآلي (الخصم التلقائي للاشتراكات)
// =================================================================
// يعمل يومياً الساعة 12:00 منتصف الليل
cron.schedule('0 0 * * *', async () => {
    console.log("🤖 الروبوت الآلي بدأ العمل: فحص اشتراكات الوكلاء...");

    try {
        await pool.query('BEGIN');

        const expiredSubsQuery = `
            SELECT s.id as sub_id, s.agent_id, s.plan_name, w.balance, u.full_name 
            FROM subscriptions s
            JOIN wallets w ON s.agent_id = w.user_id
            JOIN users u ON s.agent_id = u.id
            WHERE s.end_date <= CURRENT_TIMESTAMP AND s.status = 'active';
        `;
        const { rows: expiredSubs } = await pool.query(expiredSubsQuery);

        for (const sub of expiredSubs) {
            const renewalCost = 5000.00; // قيمة التجديد الافتراضية

            if (sub.balance >= renewalCost) {
                // خصم وتجديد
                const newBalance = parseFloat(sub.balance) - renewalCost;
                
                await pool.query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [newBalance, sub.agent_id]);
                
                await pool.query(`
                    INSERT INTO transactions (user_id, type, amount, previous_balance, new_balance, description)
                    VALUES ($1, 'auto_deduction', $2, $3, $4, $5)
                `, [sub.agent_id, -renewalCost, sub.balance, newBalance, `تجديد آلي لاشتراك: ${sub.plan_name}`]);

                await pool.query(`
                    UPDATE subscriptions 
                    SET start_date = CURRENT_TIMESTAMP, 
                        end_date = CURRENT_TIMESTAMP + INTERVAL '1 month' 
                    WHERE id = $1
                `, [sub.sub_id]);

                console.log(`✅ تم التجديد الآلي للوكيل: ${sub.full_name}`);
            } else {
                // تجميد لعدم وجود رصيد
                await pool.query(`UPDATE users SET status = 'frozen' WHERE id = $1`, [sub.agent_id]);
                await pool.query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [sub.sub_id]);
                console.log(`⛔ تم تجميد الوكيل لعدم وجود رصيد كافٍ: ${sub.full_name}`);
            }
        }

        await pool.query('COMMIT');
        console.log("🤖 انتهت مهمة الروبوت الآلي بنجاح.");
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("❌ خطأ أثناء عمل الروبوت الآلي:", error);
    }
});

// =================================================================
// 🚀 6. تشغيل المحرك على البورت المخصص
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 النظام يعمل بنجاح ومحمي بالكامل على المنفذ: ${PORT}`);
});
