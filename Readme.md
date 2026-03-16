# Mini Wallet Service

A simple wallet API where users can store money, add it, spend it — and nothing ever goes wrong with the balance.

---

## What does it do?

Four things only:

- **Create a wallet** for a user (balance starts at 0)
- **Add money** (credit)
- **Spend money** (debit)
- **Check balance** + last 10 transactions

---

## What problems does it solve?

### 1. Two requests hit at the same time
If two "spend ₹100" requests arrive simultaneously and the balance is ₹100 — only one should win. The other should fail. We handle this with a database row lock (`SELECT FOR UPDATE`) so requests queue up instead of overlapping.

### 2. Same request sent twice
Mobile apps retry on network failure. Payment gateways retry on timeout. Without protection, the same payment runs twice. We prevent this with a `referenceId` — if you've seen it before, return the old result and don't touch the balance again.

### 3. Balance update and transaction record getting out of sync
If the balance updates but the transaction record fails to save (or vice versa), the data is broken. We wrap both in a single database transaction so either both save, or neither does.

---

## Why PostgreSQL?

Because this is a money system and we need:
- **Row-level locks** — lock one user's row, not the whole database
- **NUMERIC type** — exact decimal math (0.1 + 0.2 = 0.30, not 0.30000000000004)
- **CHECK constraints** — `balance >= 0` enforced at DB level, not just in code
- **UNIQUE constraints** — `(referenceId, type)` so duplicate transactions are impossible even at the DB level

MongoDB needs replica sets for proper transactions. SQLite locks the whole file. PostgreSQL does exactly what we need, out of the box.

---

## Quick Start

```bash
# Install
npm install

# Setup env
cp .env.example .env
# fill in your PostgreSQL credentials

# Create DB (schema auto-creates on first run)
createdb mini_wallet

# Start
npm start        # production
npm run dev      # with auto-reload
```

---

## API

| Method | URL | What it does |
|--------|-----|--------------|
| POST | `/wallets` | Create wallet for a user |
| GET | `/wallets/:userId` | Get balance + last 10 transactions |
| POST | `/wallets/:userId/credit` | Add money |
| POST | `/wallets/:userId/debit` | Spend money |

**Credit example:**
```json
POST /wallets/user_123/credit
{ "amount": 500, "referenceId": "order_abc" }
```

**Debit example:**
```json
POST /wallets/user_123/debit
{ "amount": 200, "referenceId": "payment_xyz" }
```

If balance is too low, the request fails with `422` — and the failed attempt is still recorded so there's always a full audit trail.

---

## Run Tests

```bash
createdb mini_wallet_test
npm test
```

Tests cover: creating wallets, adding/spending money, duplicate requests, insufficient balance, and 5 concurrent debits hitting the same wallet at once.

---

## What I'd improve for production

Right now locking happens at the database level which works perfectly. Under very high load the bottleneck would be too many requests waiting for DB connections. The fix would be a Redis lock per `userId` to reject excess requests before they even reach the database.