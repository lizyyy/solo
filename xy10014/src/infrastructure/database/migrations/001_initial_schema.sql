CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    avatar_url          VARCHAR(500),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id        UUID NOT NULL,
    aggregate_type      VARCHAR(50) NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    event_version       INTEGER NOT NULL,
    sequence_number     BIGSERIAL NOT NULL,
    payload             JSONB NOT NULL,
    metadata            JSONB NOT NULL,
    command_id          UUID NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (aggregate_id, event_version),
    UNIQUE (command_id),
    UNIQUE (sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_metadata_operator ON events((metadata->>'operatorId'));

CREATE TABLE IF NOT EXISTS idempotency_records (
    command_id          UUID PRIMARY KEY,
    aggregate_id        UUID NOT NULL,
    event_id            UUID NOT NULL,
    result              JSONB,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id        UUID NOT NULL,
    aggregate_type      VARCHAR(50) NOT NULL,
    version             INTEGER NOT NULL,
    state               JSONB NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (aggregate_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate ON snapshots(aggregate_id);

CREATE TABLE IF NOT EXISTS bills (
    id                  UUID PRIMARY KEY,
    group_id            UUID NOT NULL REFERENCES groups(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    total_amount        DECIMAL(18,4) NOT NULL,
    currency            VARCHAR(10) NOT NULL DEFAULT 'CNY',
    bill_date           DATE NOT NULL,
    category            VARCHAR(50),
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version             INTEGER NOT NULL DEFAULT 1,
    is_deleted          BOOLEAN DEFAULT FALSE,
    last_event_id       UUID NOT NULL,
    last_sequence       BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bills_group ON bills(group_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_category ON bills(category);

CREATE TABLE IF NOT EXISTS bill_participants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id             UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    user_name           VARCHAR(100) NOT NULL,
    share_amount        DECIMAL(18,4) NOT NULL,
    paid_amount         DECIMAL(18,4) NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (bill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_participants_bill ON bill_participants(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_participants_user ON bill_participants(user_id);

CREATE TABLE IF NOT EXISTS user_balances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name           VARCHAR(100) NOT NULL,
    balance             DECIMAL(18,4) NOT NULL DEFAULT 0,
    last_event_id       UUID NOT NULL,
    last_sequence       BIGINT NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_group ON user_balances(group_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_user ON user_balances(user_id);

CREATE TABLE IF NOT EXISTS projection_checkpoints (
    id                  VARCHAR(100) PRIMARY KEY,
    last_sequence       BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO projection_checkpoints (id, last_sequence) VALUES
    ('bill_projection', 0),
    ('balance_projection', 0)
ON CONFLICT (id) DO NOTHING;
