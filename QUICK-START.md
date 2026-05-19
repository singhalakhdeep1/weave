# 🚀 Quick Start Guide

## Get Up and Running in 10 Minutes

### **Prerequisites**

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker Desktop (optional for local databases)

---

## **Step 1: Clone & Install**

```bash
# Clone the repository
git clone https://github.com/Alakhdeepsingh/realtime-collaborative-workspace.git
cd realtime-collaborative-workspace

# Install all dependencies (root + frontend + backend)
npm run install:all
```

---

## **Step 2: Setup Environment Variables**

### **Frontend (.env)**

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
```

### **Backend (.env)**

```bash
cd ../backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/collaborative_workspace

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 (Optional - for file uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Email (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

---

## **Step 3: Start Databases**

### **Option A: Using Docker (Recommended)**

```bash
# Start PostgreSQL & Redis
npm run docker:up

# Check logs
npm run docker:logs

# When done, stop services
npm run docker:down
```

### **Option B: Manual Setup**

**PostgreSQL:**

```bash
# Install PostgreSQL
# Create database
createdb collaborative_workspace
```

**Redis:**

```bash
# Install Redis
redis-server
```

---

## **Step 4: Database Setup**

```bash
# Run migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

---

## **Step 5: Start Development Servers**

```bash
# Start both frontend & backend
npm run dev

# Or start individually:
npm run dev:frontend  # Frontend on http://localhost:5173
npm run dev:backend   # Backend on http://localhost:5000
```

---

## **Step 6: Open in Browser**

Visit [http://localhost:5173](http://localhost:5173)

**Test Accounts (if seeded):**

- Email: `demo@example.com`
- Password: `password123`

---

## 🎯 What You Should See

1. **Landing Page** with login/signup options
2. **Dashboard** with workspace list
3. **Document Editor** with real-time collaboration
4. **Presence Indicators** showing online users
5. **Comments Panel** for discussions

---

## 🧪 Running Tests

```bash
# All tests
npm run test

# Frontend tests only
npm run test:frontend

# Backend tests only
npm run test:backend

# E2E tests (Cypress)
npm run test:e2e
```

---

## 📚 Next Steps

1. **Read the Documentation:** Check `/docs` folder
   - [HLD](./docs/HLD.md) - High-level architecture
   - [LLD](./docs/LLD.md) - Low-level design
   - [ROADMAP](./docs/ROADMAP.md) - Implementation plan

2. **Explore the Code:**
   - Frontend: `/frontend/src`
   - Backend: `/backend/src`

3. **Follow the Roadmap:** Start with Week 1 tasks

---

## 🐛 Troubleshooting

### **Port Already in Use**

```bash
# Check what's using port 5173 (frontend)
lsof -i :5173
kill -9 <PID>

# Check what's using port 5000 (backend)
lsof -i :5000
kill -9 <PID>
```

### **Database Connection Failed**

```bash
# Check if PostgreSQL is running
docker ps

# Restart containers
npm run docker:down
npm run docker:up
```

### **Module Not Found**

```bash
# Reinstall dependencies
rm -rf node_modules frontend/node_modules backend/node_modules
npm run install:all
```

---

## 📦 Useful Commands

```bash
# Code formatting
npm run format

# Linting
npm run lint

# Type checking
npm run type-check

# Build for production
npm run build

# View database
npm run db:studio

# Docker logs
npm run docker:logs
```

---

## 🎉 You're Ready!

Start building amazing features! Check the [ROADMAP](./docs/ROADMAP.md) for the implementation plan.

**Need Help?**

- Review documentation in `/docs`
- Check issues on GitHub
- Reach out: alakhdeepsingh773@gmail.com

---

**Happy Coding! 🚀**
