import './style.css'

const API_URL = '/api'
const app = document.querySelector('#app')

function getToken() {
  return localStorage.getItem('token')
}

function getUser() {
  const user = localStorage.getItem('user')
  return user ? JSON.parse(user) : null
}

function setAuth(token, user) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  renderAuthPage()
}

async function apiRequest(path, options = {}) {
  const token = getToken()

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Ошибка запроса')
  }

  return data
}

function renderAuthPage() {
  app.innerHTML = `
    <main class="page">
      <section class="auth-card">
        <div class="brand">
          <p class="badge">Vite + Express + PostgreSQL</p>
          <h1>Личный кабинет</h1>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="login">Вход</button>
          <button class="tab" data-tab="register">Регистрация</button>
        </div>

        <form id="loginForm" class="form">
          <label>
            Email
            <input id="loginEmail" type="email" placeholder="admin@mail.ru">
            <small></small>
          </label>

          <label>
            Пароль
            <input id="loginPassword" type="password" placeholder="admin123">
            <small></small>
          </label>

          <button type="submit">Войти</button>
        </form>

        <form id="registerForm" class="form hidden">
          <label>
            Имя
            <input id="registerName" type="text" placeholder="Иван">
            <small></small>
          </label>

          <label>
            Email
            <input id="registerEmail" type="email" placeholder="user@mail.ru">
            <small></small>
          </label>

          <label>
            Пароль
            <input id="registerPassword" type="password" placeholder="Минимум 6 символов">
            <small></small>
          </label>

          <button type="submit">Создать аккаунт</button>
        </form>

        <div id="message" class="message"></div>
      </section>
    </main>
  `

  initAuthEvents()
}

function initAuthEvents() {
  const tabs = document.querySelectorAll('.tab')
  const loginForm = document.querySelector('#loginForm')
  const registerForm = document.querySelector('#registerForm')
  const message = document.querySelector('#message')

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.remove('active'))
      tab.classList.add('active')
      message.textContent = ''

      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden')
        registerForm.classList.add('hidden')
      } else {
        registerForm.classList.remove('hidden')
        loginForm.classList.add('hidden')
      }
    })
  })

  loginForm.addEventListener('submit', async event => {
    event.preventDefault()

    const email = document.querySelector('#loginEmail')
    const password = document.querySelector('#loginPassword')

    clearErrors(loginForm)

    if (!validateEmail(email) || !validatePassword(password)) return

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.value,
          password: password.value
        })
      })

      setAuth(data.token, data.user)
      renderProfilePage()
    } catch (error) {
      message.textContent = error.message
      message.className = 'message error'
    }
  })

  registerForm.addEventListener('submit', async event => {
    event.preventDefault()

    const name = document.querySelector('#registerName')
    const email = document.querySelector('#registerEmail')
    const password = document.querySelector('#registerPassword')

    clearErrors(registerForm)

    let isValid = true

    if (!name.value.trim()) {
      showError(name, 'Введите имя')
      isValid = false
    }

    if (!validateEmail(email)) isValid = false
    if (!validatePassword(password)) isValid = false

    if (!isValid) return

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          password: password.value
        })
      })

      message.textContent = 'Регистрация прошла успешно. Теперь можно войти.'
      message.className = 'message success'
      registerForm.reset()
    } catch (error) {
      message.textContent = error.message
      message.className = 'message error'
    }
  })
}

function renderProfilePage() {
  const user = getUser()

  app.innerHTML = `
    <main class="page">
      <section class="dashboard">
        <header class="dashboard-header">
          <div>
            <p class="badge">Профиль</p>
            <h1>Привет, ${user.name}</h1>
            <p>
              Вы вошли как <strong>${user.role}</strong>.
              Данные ниже загружаются через AJAX-запросы к backend.
            </p>
          </div>

          <button id="logoutBtn" class="secondary">Выйти</button>
        </header>

        <div class="actions">
          <button id="loadMediaBtn">Загрузить материалы</button>
          ${
            user.role === 'admin'
              ? '<button id="loadUsersBtn" class="admin-btn">Открыть админ-панель</button>'
              : ''
          }
        </div>

        <section class="content-grid">
          <div>
            <h2>Медиа</h2>
            <div id="mediaList" class="media-list">
              <p class="empty">Нажми «Загрузить материалы».</p>
            </div>
          </div>

          ${
            user.role === 'admin'
              ? `
                <div>
                  <h2>Админ-панель</h2>
                  <div id="usersList" class="users-list">
                    <p class="empty">Нажми «Открыть админ-панель».</p>
                  </div>
                </div>
              `
              : ''
          }
        </section>
      </section>
    </main>
  `

  document.querySelector('#logoutBtn').addEventListener('click', logout)
  document.querySelector('#loadMediaBtn').addEventListener('click', loadMedia)

  if (user.role === 'admin') {
    document.querySelector('#loadUsersBtn').addEventListener('click', loadUsers)
  }
}

async function loadMedia() {
  const mediaList = document.querySelector('#mediaList')
  mediaList.innerHTML = '<p class="empty">Загрузка...</p>'

  try {
    const media = await apiRequest('/media')

    mediaList.innerHTML = media.map(item => {
      if (item.type === 'image') {
        return `
          <article class="media-card">
            <img src="${item.url}" alt="${item.title}">
            <h3>${item.title}</h3>
          </article>
        `
      }

      return `
        <article class="media-card">
          <iframe src="${item.url}" title="${item.title}" allowfullscreen></iframe>
          <h3>${item.title}</h3>
        </article>
      `
    }).join('')
  } catch (error) {
    mediaList.innerHTML = `<p class="empty error-text">${error.message}</p>`
  }
}

async function loadUsers() {
  const usersList = document.querySelector('#usersList')
  usersList.innerHTML = '<p class="empty">Загрузка пользователей...</p>'

  try {
    const users = await apiRequest('/admin/users')

    usersList.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Имя</th>
            <th>Email</th>
            <th>Роль</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.id}</td>
              <td>${user.name}</td>
              <td>${user.email}</td>
              <td><span class="role">${user.role}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  } catch (error) {
    usersList.innerHTML = `<p class="empty error-text">${error.message}</p>`
  }
}

function validateEmail(input) {
  const value = input.value.trim()

  if (!value) {
    showError(input, 'Введите email')
    return false
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    showError(input, 'Некорректный email')
    return false
  }

  return true
}

function validatePassword(input) {
  if (!input.value.trim()) {
    showError(input, 'Введите пароль')
    return false
  }

  if (input.value.length < 6) {
    showError(input, 'Минимум 6 символов')
    return false
  }

  return true
}

function showError(input, text) {
  input.classList.add('error')
  input.closest('label').querySelector('small').textContent = text
}

function clearErrors(form) {
  form.querySelectorAll('input').forEach(input => {
    input.classList.remove('error')
  })

  form.querySelectorAll('small').forEach(small => {
    small.textContent = ''
  })
}

if (getToken() && getUser()) {
  renderProfilePage()
} else {
  renderAuthPage()
}