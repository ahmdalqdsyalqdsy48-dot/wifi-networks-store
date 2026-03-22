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
app.listen(PORT, () => {
    console.log(`🚀 النظام يعمل بنجاح على المنفذ: ${PORT}`);
});

