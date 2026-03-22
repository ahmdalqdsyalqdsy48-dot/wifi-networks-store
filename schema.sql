-- ========================================================
-- 1️⃣ جدول المستخدمين والوكلاء (Users & Agents)
-- ========================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'agent', 
    network_name VARCHAR(150),
    profit_percentage DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 2️⃣ جدول المحافظ المالية (Wallets)
-- ========================================================
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    risk_threshold DECIMAL(15,2) DEFAULT 2000.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 3️⃣ جدول السجل المالي والأسود (Transactions)
-- ========================================================
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, 
    amount DECIMAL(15,2) NOT NULL,
    previous_balance DECIMAL(15,2) NOT NULL,
    new_balance DECIMAL(15,2) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 4️⃣ جدول الاشتراكات والروبوت الآلي (Subscriptions)
-- ========================================================
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    agent_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL,
    system_profit_percentage DECIMAL(5,2) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 5️⃣ (جديد) جدول الإعدادات العامة للمتجر (Settings)
-- ========================================================
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- إدخال الإعدادات الافتراضية
INSERT INTO settings (setting_key, setting_value) VALUES 
('site_name', 'متجر شبكات الواي فاي'),
('maintenance_mode', 'false'),
('sms_gateway_api', 'https://api.sms-provider.com/send');

-- ========================================================
-- 6️⃣ (جديد) جدول الإعلانات والبنرات (Ads & Banners)
-- ========================================================
CREATE TABLE ads (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150),
    image_url TEXT NOT NULL,
    target_link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 7️⃣ (جديد) جدول سجل رسائل الـ SMS
-- ========================================================
CREATE TABLE sms_logs (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
