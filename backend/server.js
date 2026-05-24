import express from 'express'
import cors from 'cors'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'demo_db',
  user: process.env.DB_USER || 'demo_user',
  password: process.env.DB_PASSWORD || 'demo_password'
})

app.use(cors())
app.use(express.json())

async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const adminEmail = 'admin@mail.ru'
  const adminPassword = 'admin123'

  const existingAdmin = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail]
  )

  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)

    await db.query(
      `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      `,
      ['Admin', adminEmail, passwordHash, 'admin']
    )

    console.log('Admin account created: admin@mail.ru / admin123')
  }
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  )
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return res.status(401).json({ message: 'Нет токена авторизации' })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Некорректный токен' })
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Доступ только для администратора' })
  }

  next()
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    time: new Date().toISOString()
  })
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Заполните все поля' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Пароль должен быть минимум 6 символов' })
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Пользователь уже существует' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await db.query(
      `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
      `,
      [name, email, passwordHash, 'user']
    )

    res.status(201).json({
      message: 'Пользователь зарегистрирован',
      user: result.rows[0]
    })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка регистрации' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Введите email и пароль' })
    }

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Неверный email или пароль' })
    }

    const user = result.rows[0]
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' })
    }

    const token = createToken(user)

    res.json({
      message: 'Вход выполнен',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Ошибка входа' })
  }
})

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await db.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  )

  res.json(result.rows[0])
})

app.get('/api/media', authMiddleware, (req, res) => {
  res.json([
    {
      id: 1,
      type: 'image',
      title: 'Frontend dashboard',
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 2,
      type: 'image',
      title: 'DevOps workflow',
      url: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=900&q=80'
    },
    {
      id: 3,
      type: 'video',
      title: 'Что такое Docker',
      url: 'https://www.youtube.com/embed/Gjnup-PuquQ'
    },
    {
      id: 4,
      type: 'video',
      title: 'GitHub Actions overview',
      url: 'https://www.youtube.com/embed/R8_veQiYBjI'
    }
  ])
})

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const result = await db.query(`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY id ASC
  `)

  res.json(result.rows)
})

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend started on port ${PORT}`)
    })
  })
  .catch(error => {
    console.error('Database init error:', error)
    process.exit(1)
  })