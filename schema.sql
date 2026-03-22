-- ========================================================
-- 1️⃣ جدول المستخدمين والوكلاء (Users & Agents)
-- ========================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'agent', -- الأدوار: owner, admin, agent, user
    network_name VARCHAR(150),
    profit_percentage DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active', -- active, frozen, suspended
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
-- 3️⃣ جدول السجل المالي والأسود (Transactions - Immutable Ledger)
-- ========================================================
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- deposit, withdrawal, auto_deduction, manual_adjustment
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
    status VARCHAR(20) DEFAULT 'active', -- active, paused, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
