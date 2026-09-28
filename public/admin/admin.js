/**
 * 晚叙 CMS 管理后台前端 v2（完整重构版）
 * 架构：原生 ES Module + Hash 路由，无构建依赖
 * 模块：仪表盘 / 轮播 / 首页内容 / 分类 / 标签 / 产品 / 页面 / 文章 / 文件管理 / 询盘 / 导航 / 设置 / 管理员
 */

// ============================================================ 全局状态
const RICH_EDITORS = [];
const state = {
  admin: null,
  listParams: {},
  devOriginal: {},
  siteInfo: {},
};

// ============================================================ 工具函数
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN');
}

function fmtDateTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN');
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : '';
}

function debounce(fn, ms = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function toast(msg, ok = true) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${ok ? 'ok' : 'err'}`;
  el.innerHTML = `<i class="ph ${ok ? 'ph-check-circle' : 'ph-warning-circle'}"></i><span>${esc(msg)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function pagerHtml(total, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return '';
  let html = `<div class="pager"><span class="pager-info">共 ${total} 条</span>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      html += `<button class="${i === page ? 'current' : ''}" data-pg="${i}">${i}</button>`;
    } else if (i === page - 2 || i === page + 2) {
      html += '<span class="pager-dots">…</span>';
    }
  }
  return html + '</div>';
}

/** 统一 API 调用：plain object body 自动 JSON 序列化；401 自动跳登录 */
async function api(path, opts = {}) {
  const o = { ...opts };
  if (o.body && typeof o.body === 'object' && !(o.body instanceof FormData) && !(o.body instanceof Blob)) {
    o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    o.body = JSON.stringify(o.body);
  }
  const res = await fetch(path, o);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应 */ }
  if (res.status === 401 && !path.endsWith('/login')) {
    state.admin = null;
    location.hash = '#login';
    const err = new Error('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  return { status: res.status, body: json };
}

function formValues(form) {
  const data = {};
  form.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') data[el.name] = el.checked ? '1' : '0';
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else data[el.name] = el.value;
  });
  return data;
}

/** 展示后端返回的字段级错误 {errors: {field: msg}} */
function showFieldErrors(form, errors) {
  if (!form) return;
  form.querySelectorAll('.field-err').forEach((el) => el.remove());
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  if (!errors || typeof errors !== 'object') return;
  let first = null;
  for (const [key, msg] of Object.entries(errors)) {
    if (key === '_form') { toast(msg, false); continue; }
    const input = form.querySelector(`[name="${CSS.escape(key)}"]`);
    if (!input) continue;
    input.classList.add('invalid');
    const err = document.createElement('p');
    err.className = 'field-err';
    err.textContent = msg;
    const anchor = input.closest('.upload-field') || input;
    anchor.parentElement.appendChild(err);
    if (!first) first = input;
  }
  if (first) first.focus();
}

function confirmDialog(msg, danger = true) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-mask">
        <div class="modal">
          <h3 class="modal-title">请确认</h3>
          <p class="modal-msg">${esc(msg)}</p>
          <div class="modal-actions">
            <button class="btn" data-act="no">取消</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">确定</button>
          </div>
        </div>
      </div>`;
    $('[data-act="yes"]', root).onclick = () => { root.innerHTML = ''; resolve(true); };
    $('[data-act="no"]', root).onclick = () => { root.innerHTML = ''; resolve(false); };
    $('.modal-mask', root).onclick = (e) => {
      if (e.target.classList.contains('modal-mask')) { root.innerHTML = ''; resolve(false); }
    };
  });
}

// ============================================================ 模块与权限
const MODULES = [
  { key: 'dashboard', name: '仪表盘', minRole: 'editor', icon: 'ph-gauge', desc: '站点数据概览与快捷入口' },
  { key: 'banners', name: '轮播图', minRole: 'admin', icon: 'ph-images', desc: '首页顶部轮播大图' },
  { key: 'home-content', name: '首页内容', minRole: 'admin', icon: 'ph-layout', desc: '首页区块与页面文案' },
  { key: 'categories', name: '产品分类', minRole: 'admin', icon: 'ph-squares-four', desc: '产品所属分类管理' },
  { key: 'tags', name: '标签管理', minRole: 'admin', icon: 'ph-tag', desc: '产品/文章/页面标签' },
  { key: 'products', name: '产品', minRole: 'admin', icon: 'ph-package', desc: '双语产品资料与图集' },
  { key: 'pages', name: '页面管理', minRole: 'admin', icon: 'ph-file-text', desc: '自定义单页内容' },
  { key: 'articles', name: '文章', minRole: 'editor', icon: 'ph-article', desc: '新闻与博客文章' },
  { key: 'media', name: '文件管理', minRole: 'admin', icon: 'ph-folder-open', desc: '全站图片与文件库' },
  { key: 'inquiries', name: '询盘', minRole: 'editor', icon: 'ph-envelope', desc: '客户询盘消息' },
  { key: 'navigation', name: '导航管理', minRole: 'super_admin', icon: 'ph-list', desc: '站点顶部导航菜单' },
  { key: 'settings', name: '站点设置', minRole: 'super_admin', icon: 'ph-gear', desc: '品牌、联系、SEO、邮件等' },
  { key: 'admins', name: '管理员与权限', minRole: 'super_admin', icon: 'ph-users', desc: '后台账号与角色' },
];

const ROLE_LEVEL = { super_admin: 0, admin: 1, editor: 2 };
const ROLE_NAMES = { super_admin: '超级管理员', admin: '管理员', editor: '编辑' };
const ROLE_DESCS = {
  super_admin: '全部模块：含导航管理、站点设置、管理员与权限。',
  admin: '内容管理：轮播、首页内容、分类、标签、产品、页面、文章、文件、询盘。',
  editor: '仅文章与询盘：可撰写文章、处理询盘消息。',
};

/** 路由别名：这些子路由归属某个模块的权限 */
const MODULE_ALIASES = {
  'home-sections': 'home-content',
  'page-contents': 'home-content',
};

function canAccess(moduleKey) {
  const key = MODULE_ALIASES[moduleKey] || moduleKey;
  const m = MODULES.find((x) => x.key === key);
  if (!m || !state.admin) return false;
  return ROLE_LEVEL[state.admin.role] <= ROLE_LEVEL[m.minRole];
}

function moduleOf(key) {
  return MODULES.find((m) => m.key === (MODULE_ALIASES[key] || key));
}

// ============================================================ 登录
async function checkLogin() {
  try {
    const r = await api('/api/admin/me');
    if (r.status === 200 && r.body?.code === 0) {
      state.admin = r.body.data;
      return true;
    }
  } catch (e) {
    if (!e.unauthorized) console.warn(e);
  }
  return false;
}

function renderLogin() {
  const remembered = localStorage.getItem('wanxu_last_user') || '';
  const dev = state.siteInfo || {};
  const app = $('#app');
  app.innerHTML = `
    <div class="login-page">
      <div class="login-decoration"><div class="login-blob"></div><div class="login-blob blob-2"></div></div>
      <div class="login-card" id="login-card">
        <div class="login-left">
          <div class="login-brand-large">
            <div class="login-logo-mark"><i class="ph ph-plant"></i></div>
            <div class="login-logo">${esc(dev.site_name_zh || dev.site_name || '晚叙 CMS')}</div>
            <div class="login-sub">${esc(dev.site_slogan_zh || '外贸企业官网与内容管理系统')}</div>
          </div>
          <ul class="login-features">
            <li><i class="ph ph-check-circle"></i> 双语产品 / 文章 / 页面管理</li>
            <li><i class="ph ph-check-circle"></i> 询盘接收与邮件通知</li>
            <li><i class="ph ph-check-circle"></i> 文件管理全站调用</li>
            <li><i class="ph ph-check-circle"></i> SEO、导航与站点设置</li>
          </ul>
          <div class="login-dev">
            <div class="dev-title">技术支持</div>
            <div class="dev-row"><span>开发者</span><span>${esc(dev.dev_name || '晚叙科技')}</span></div>
            ${dev.dev_url ? `<a href="${esc(dev.dev_url)}" target="_blank" rel="noopener" class="dev-support-link"><i class="ph ph-arrow-square-out"></i> 获取技术支持</a>` : ''}
            ${dev.dev_wechat_qr ? `<div class="dev-qr"><img src="${esc(dev.dev_wechat_qr)}" alt="微信技术支持" /><span>微信技术支持</span></div>` : ''}
          </div>
        </div>
        <div class="login-right">
          <div class="login-form-header">
            <h1 class="login-form-title">欢迎回来</h1>
            <p class="login-form-sub">请登录以管理您的站点内容</p>
          </div>
          <div class="login-error" id="login-error"></div>
          <form id="login-form" novalidate>
            <div class="login-form-row">
              <div class="login-field">
                <label><i class="ph ph-user"></i> 用户名</label>
                <input type="text" name="username" value="${esc(remembered)}" autocomplete="username" required autofocus />
              </div>
              <div class="login-field">
                <label><i class="ph ph-lock-key"></i> 密码</label>
                <div class="login-password-wrap">
                  <input type="password" name="password" autocomplete="current-password" required />
                  <button type="button" class="toggle-pwd" id="toggle-pwd" title="显示/隐藏密码"><i class="ph ph-eye"></i></button>
                </div>
                <p class="caps-hint" id="caps-hint"><i class="ph ph-warning"></i> 大写锁定已开启</p>
              </div>
              <button type="submit" class="btn btn-primary login-submit" id="login-btn">
                <span>登 录</span> <i class="ph ph-arrow-right"></i>
              </button>
            </div>
            <div class="login-form-foot">
              <a href="#forgot-password" id="link-forgot"><i class="ph ph-key"></i> 忘记密码？</a>
            </div>
          </form>
        </div>
      </div>
    </div>`;

  const pwdInput = $('input[name="password"]');
  $('#toggle-pwd').onclick = () => {
    const show = pwdInput.type === 'password';
    pwdInput.type = show ? 'text' : 'password';
    $('#toggle-pwd').innerHTML = `<i class="ph ${show ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
    pwdInput.focus();
  };
  pwdInput.addEventListener('keyup', (e) => {
    const on = e.getModifierState && e.getModifierState('CapsLock');
    $('#caps-hint').classList.toggle('show', !!on);
  });

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = formValues(e.target);
    const btn = $('#login-btn');
    const errBox = $('#login-error');
    errBox.classList.remove('show');
    if (!data.username || !data.password) {
      errBox.textContent = '请输入用户名和密码';
      errBox.classList.add('show');
      return;
    }
    btn.classList.add('loading');
    btn.innerHTML = '<span>登录中</span> <i class="ph ph-circle-notch"></i>';
    try {
      const r = await api('/api/admin/login', { method: 'POST', body: data });
      if (r.status === 200 && r.body?.code === 0) {
        localStorage.setItem('wanxu_last_user', data.username);
        state.admin = r.body.data;
        location.hash = '#dashboard';
        scheduleRoute();
        return;
      }
      errBox.textContent = r.body?.message || '登录失败，请重试';
      errBox.classList.add('show');
      const card = $('#login-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    } catch {
      errBox.textContent = '网络错误，请稍后重试';
      errBox.classList.add('show');
    } finally {
      btn.classList.remove('loading');
      btn.innerHTML = '<span>登 录</span> <i class="ph ph-arrow-right"></i>';
    }
  };
}

// ============================================================ 找回密码 / 重置密码
const FORGOT_STEPS = `
  <ol class="auth-steps">
    <li><b>1</b> 填写注册时使用的用户名与邮箱</li>
    <li><b>2</b> 查收邮件中的重置链接（30 分钟内有效）</li>
    <li><b>3</b> 设置新密码并返回登录</li>
  </ol>`;

const RESET_STEPS = `
  <ol class="auth-steps">
    <li><b>1</b> 设置不少于 8 位的新密码</li>
    <li><b>2</b> 两次输入需完全一致</li>
    <li><b>3</b> 提交后旧密码立即失效</li>
  </ol>`;

/** 认证页左侧品牌栏（与登录页视觉保持一致） */
function authLeftHtml(stepsHtml) {
  const dev = state.siteInfo || {};
  return `
    <div class="login-left">
      <div class="login-brand-large">
        <div class="login-logo-mark"><i class="ph ph-plant"></i></div>
        <div class="login-logo">${esc(dev.site_name_zh || dev.site_name || '晚叙 CMS')}</div>
        <div class="login-sub">${esc(dev.site_slogan_zh || '外贸企业官网与内容管理系统')}</div>
      </div>
      ${stepsHtml || `
      <ul class="login-features">
        <li><i class="ph ph-check-circle"></i> 双语产品 / 文章 / 页面管理</li>
        <li><i class="ph ph-check-circle"></i> 询盘接收与邮件通知</li>
        <li><i class="ph ph-check-circle"></i> 文件管理全站调用</li>
        <li><i class="ph ph-check-circle"></i> SEO、导航与站点设置</li>
      </ul>`}
      <div class="login-dev">
        <div class="dev-title">技术支持</div>
        <div class="dev-row"><span>开发者</span><span>${esc(dev.dev_name || '晚叙科技')}</span></div>
        ${dev.dev_url ? `<a href="${esc(dev.dev_url)}" target="_blank" rel="noopener" class="dev-support-link"><i class="ph ph-arrow-square-out"></i> 获取技术支持</a>` : ''}
        ${dev.dev_wechat_qr ? `<div class="dev-qr"><img src="${esc(dev.dev_wechat_qr)}" alt="微信技术支持" /><span>微信技术支持</span></div>` : ''}
      </div>
    </div>`;
}

/** 渲染认证页外壳（左品牌 + 右内容） */
function renderAuthPage(rightHtml, stepsHtml) {
  $('#app').innerHTML = `
    <div class="login-page">
      <div class="login-decoration"><div class="login-blob"></div><div class="login-blob blob-2"></div></div>
      <div class="login-card auth-card" id="login-card">
        ${authLeftHtml(stepsHtml)}
        <div class="login-right">${rightHtml}</div>
      </div>
    </div>`;
}

/** 成功/异常态的右侧内容 */
function authSuccessHtml(icon, title, descHtml, actionHtml) {
  return `
    <div class="auth-success">
      <div class="auth-success-icon"><i class="ph ${icon}"></i></div>
      <h2>${esc(title)}</h2>
      <p>${descHtml}</p>
      ${actionHtml || ''}
    </div>`;
}

/** 绑定密码框的显示/隐藏与大写锁定提示 */
function bindPasswordFields(root, form) {
  $$('.toggle-pwd', root).forEach((btn) => {
    btn.onclick = () => {
      const input = form.querySelector(`[name="${CSS.escape(btn.dataset.toggle || '')}"]`);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = `<i class="ph ${show ? 'ph-eye-slash' : 'ph-eye'}"></i>`;
      input.focus();
    };
  });
  $$('input[type="password"]', form).forEach((input) => {
    const hint = input.closest('.login-field')?.querySelector('.caps-hint');
    if (!hint) return;
    input.addEventListener('keyup', (e) => {
      hint.classList.toggle('show', !!(e.getModifierState && e.getModifierState('CapsLock')));
    });
  });
}

/** 找回密码：用户名 + 邮箱 → 请求发送重置链接 */
function renderForgotPassword() {
  const remembered = localStorage.getItem('wanxu_last_user') || '';
  renderAuthPage(`
    <div class="login-form-header">
      <h1 class="login-form-title">找回密码</h1>
      <p class="login-form-sub">验证用户名与绑定邮箱后，重置链接将发送至该邮箱</p>
    </div>
    <div class="login-error" id="login-error"></div>
    <form id="forgot-form" novalidate>
      <div class="login-field">
        <label><i class="ph ph-user"></i> 用户名</label>
        <input type="text" name="username" value="${esc(remembered)}" autocomplete="username" required autofocus />
      </div>
      <div class="login-field">
        <label><i class="ph ph-envelope"></i> 绑定邮箱</label>
        <input type="email" name="email" autocomplete="email" placeholder="name@example.com" required />
      </div>
      <button type="submit" class="btn btn-primary login-submit" id="forgot-btn">
        <span>发送重置链接</span> <i class="ph ph-paper-plane-tilt"></i>
      </button>
      <div class="login-form-foot">
        <a href="#login"><i class="ph ph-arrow-left"></i> 返回登录</a>
      </div>
    </form>`, FORGOT_STEPS);

  const form = $('#forgot-form');
  const btn = $('#forgot-btn');
  const errBox = $('#login-error');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errBox.classList.remove('show');
    showFieldErrors(form, null);
    const data = formValues(form);
    if (!data.username || !data.email) {
      errBox.textContent = '请输入用户名与绑定邮箱';
      errBox.classList.add('show');
      return;
    }
    btn.classList.add('loading');
    btn.innerHTML = '<span>发送中</span> <i class="ph ph-circle-notch"></i>';
    try {
      const r = await api('/api/admin/forgot-password', { method: 'POST', body: data });
      if (r.status === 200 && r.body?.code === 0) {
        renderAuthPage(
          authSuccessHtml(
            'ph-paper-plane-tilt',
            '重置链接已发送',
            `如果用户名与邮箱匹配，我们已向 <strong>${esc(data.email)}</strong> 发送了包含重置链接的邮件。<br />链接 30 分钟内有效，请及时查收（也请留意垃圾邮件箱）。`,
            '<a href="#login" class="btn btn-primary auth-action"><i class="ph ph-arrow-left"></i> 返回登录</a>',
          ),
          FORGOT_STEPS,
        );
        return;
      }
      if (r.body?.data?.errors) showFieldErrors(form, r.body.data.errors);
      errBox.textContent = r.body?.message || '发送失败，请稍后重试';
      errBox.classList.add('show');
    } catch {
      errBox.textContent = '网络错误，请稍后重试';
      errBox.classList.add('show');
    } finally {
      if ($('#forgot-form')) {
        btn.classList.remove('loading');
        btn.innerHTML = '<span>发送重置链接</span> <i class="ph ph-paper-plane-tilt"></i>';
      }
    }
  };
}

/** 重置密码：使用邮件中的令牌设置新密码 */
function renderResetPassword(token) {
  if (!token) {
    renderAuthPage(
      authSuccessHtml(
        'ph-warning-circle',
        '重置链接无效',
        '链接缺少必要的令牌参数，可能是复制不完整。请返回登录页重新发起找回密码。',
        '<a href="#forgot-password" class="btn btn-primary auth-action"><i class="ph ph-key"></i> 重新找回密码</a>',
      ),
      RESET_STEPS,
    );
    return;
  }

  renderAuthPage(`
    <div class="login-form-header">
      <h1 class="login-form-title">设置新密码</h1>
      <p class="login-form-sub">请设置 8 位以上的新密码，提交后旧密码立即失效</p>
    </div>
    <div class="login-error" id="login-error"></div>
    <form id="reset-form" novalidate>
      <input type="hidden" name="token" value="${esc(token)}" />
      <div class="login-field">
        <label><i class="ph ph-lock-key"></i> 新密码</label>
        <div class="login-password-wrap">
          <input type="password" name="new_password" autocomplete="new-password" minlength="8" placeholder="至少 8 位" required autofocus />
          <button type="button" class="toggle-pwd" data-toggle="new_password" title="显示/隐藏密码"><i class="ph ph-eye"></i></button>
        </div>
        <p class="caps-hint"><i class="ph ph-warning"></i> 大写锁定已开启</p>
      </div>
      <div class="login-field">
        <label><i class="ph ph-lock-key"></i> 确认新密码</label>
        <div class="login-password-wrap">
          <input type="password" name="confirm_password" autocomplete="new-password" minlength="8" placeholder="再次输入新密码" required />
          <button type="button" class="toggle-pwd" data-toggle="confirm_password" title="显示/隐藏密码"><i class="ph ph-eye"></i></button>
        </div>
      </div>
      <button type="submit" class="btn btn-primary login-submit" id="reset-btn">
        <span>确认重置</span> <i class="ph ph-check"></i>
      </button>
      <div class="login-form-foot">
        <a href="#login"><i class="ph ph-arrow-left"></i> 返回登录</a>
      </div>
    </form>`, RESET_STEPS);

  const form = $('#reset-form');
  const btn = $('#reset-btn');
  const errBox = $('#login-error');
  bindPasswordFields($('#app'), form);

  form.onsubmit = async (e) => {
    e.preventDefault();
    errBox.classList.remove('show');
    showFieldErrors(form, null);
    const data = formValues(form);
    if (!data.new_password || !data.confirm_password) {
      errBox.textContent = '请完整填写两次新密码';
      errBox.classList.add('show');
      return;
    }
    if (data.new_password.length < 8) {
      errBox.textContent = '新密码至少 8 位';
      errBox.classList.add('show');
      return;
    }
    if (data.new_password !== data.confirm_password) {
      errBox.textContent = '两次输入的新密码不一致';
      errBox.classList.add('show');
      return;
    }
    btn.classList.add('loading');
    btn.innerHTML = '<span>提交中</span> <i class="ph ph-circle-notch"></i>';
    try {
      const r = await api('/api/admin/reset-password', { method: 'POST', body: data });
      if (r.status === 200 && r.body?.code === 0) {
        renderAuthPage(
          authSuccessHtml(
            'ph-check-circle',
            '密码已重置',
            '新密码已生效，请使用新密码登录管理后台。',
            '<a href="#login" class="btn btn-primary auth-action"><i class="ph ph-sign-in"></i> 前往登录</a>',
          ),
          RESET_STEPS,
        );
        return;
      }
      if (r.body?.data?.errors) showFieldErrors(form, r.body.data.errors);
      errBox.textContent = r.body?.message || '重置失败，请稍后重试';
      errBox.classList.add('show');
    } catch {
      errBox.textContent = '网络错误，请稍后重试';
      errBox.classList.add('show');
    } finally {
      if ($('#reset-form')) {
        btn.classList.remove('loading');
        btn.innerHTML = '<span>确认重置</span> <i class="ph ph-check"></i>';
      }
    }
  };
}

async function doLogout() {
  await api('/api/admin/logout', { method: 'POST' });
  state.admin = null;
  location.hash = '#login';
  route();
}

// ============================================================ 后台外壳
function renderShell() {
  const app = $('#app');
  const dev = state.siteInfo || {};
  app.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-mark"><i class="ph ph-plant"></i></div>
          <div class="sidebar-logo-text">晚叙 <span>CMS</span></div>
        </div>
        <div class="sidebar-scroll"><nav class="sidebar-nav" id="sidebar-nav"></nav></div>
        ${dev.dev_name ? `
        <div class="sidebar-dev">
          <div class="dev-title">技术支持</div>
          <div class="dev-row"><span>开发者</span><span>${esc(dev.dev_name)}</span></div>
          ${dev.dev_url ? `<a href="${esc(dev.dev_url)}" target="_blank" rel="noopener" class="dev-support-link"><i class="ph ph-arrow-square-out"></i> 获取技术支持</a>` : ''}
          ${dev.dev_wechat_qr ? `<div class="dev-qr"><img src="${esc(dev.dev_wechat_qr)}" alt="微信技术支持" /><span>微信技术支持</span></div>` : ''}
        </div>` : ''}
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar"><i class="ph ph-user"></i></div>
            <div class="user-meta">
              <div class="user-name">${esc(state.admin?.username || '')}</div>
              <div class="user-role">${ROLE_NAMES[state.admin?.role] || ''}</div>
            </div>
          </div>
          <div class="sidebar-actions">
            <button class="sidebar-action" id="btn-pwd"><i class="ph ph-lock-key"></i> 改密</button>
            <button class="sidebar-action" id="btn-logout"><i class="ph ph-sign-out"></i> 退出</button>
          </div>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div class="topbar-left" id="topbar-left"><h1><i class="ph ph-gauge"></i> 仪表盘</h1></div>
          <div class="topbar-right">
            <a href="/" target="_blank" class="topbar-link"><i class="ph ph-globe"></i> <span>访问前台</span></a>
            <div class="topbar-user"><i class="ph ph-user-circle"></i> <span>${esc(state.admin?.username || '')}</span></div>
          </div>
        </header>
        <div class="content" id="content"></div>
      </main>
    </div>`;

  const nav = $('#sidebar-nav');
  nav.innerHTML = MODULES
    .filter((m) => ROLE_LEVEL[state.admin.role] <= ROLE_LEVEL[m.minRole])
    .map((m) => `<a href="#${m.key}" data-module="${m.key}"><i class="ph ${m.icon}"></i><span>${esc(m.name)}</span></a>`)
    .join('');
  nav.querySelectorAll('a').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); location.hash = a.getAttribute('href'); };
  });
  $('#btn-logout').onclick = doLogout;
  $('#btn-pwd').onclick = showChangePassword;
}

function renderModuleTitle(key) {
  const m = moduleOf(key);
  if (!m) return;
  $('#topbar-left').innerHTML = `
    <h1><i class="ph ${m.icon}"></i> ${esc(m.name)}
      ${m.desc ? `<small class="topbar-desc">${esc(m.desc)}</small>` : ''}
    </h1>`;
}

function setActiveNav(key) {
  const k = MODULE_ALIASES[key] || key;
  $$('.sidebar-nav a').forEach((a) => a.classList.toggle('active', a.dataset.module === k));
}

function showChangePassword() {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal">
        <h3 class="modal-title">修改密码</h3>
        <form id="pwd-form">
          <div class="form-row"><label>当前密码</label><input type="password" name="old_password" required autocomplete="current-password" /></div>
          <div class="form-row"><label>新密码（至少 8 位）</label><input type="password" name="new_password" required minlength="8" autocomplete="new-password" /></div>
          <div class="form-row"><label>确认新密码</label><input type="password" name="confirm_password" required minlength="8" autocomplete="new-password" /></div>
          <div class="modal-actions">
            <button type="button" class="btn" data-act="close">取消</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>`;
  $('[data-act="close"]', root).onclick = () => { root.innerHTML = ''; };
  $('#pwd-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = formValues(e.target);
    if (data.new_password !== data.confirm_password) { toast('两次输入的新密码不一致', false); return; }
    const r = await api('/api/admin/change-password', { method: 'POST', body: data });
    if (r.body?.code === 0) { toast('密码已修改'); root.innerHTML = ''; }
    else {
      showFieldErrors(e.target, r.body?.data?.errors);
      if (!r.body?.data?.errors) toast(r.body?.message || '修改失败', false);
    }
  };
}

// ============================================================ 富文本编辑器（HTML / Markdown）
function sanitizeHtml(html) {
  if (!html) return '';
  let out = String(html);
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  out = out.replace(/javascript:/gi, '');
  out = out.replace(/on\w+\s*=/gi, '');
  return out;
}

function mdToHtml(md) {
  if (window.marked) {
    try { return sanitizeHtml(window.marked.parse(md)); } catch { /* 降级 */ }
  }
  return null;
}

function htmlToMd(html) {
  if (window.TurndownService) {
    try {
      const td = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      return td.turndown(html || '');
    } catch { /* 降级 */ }
  }
  return null;
}

function richEditorHtml(name, label, value) {
  const md = htmlToMd(value) || '';
  return `
    <div class="form-row full" data-editor="${esc(name)}">
      <label>${esc(label)}</label>
      <div class="rich-toolbar">
        <button type="button" class="rich-tab active" data-mode="html">HTML</button>
        <button type="button" class="rich-tab" data-mode="md">Markdown</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-sm" data-insert-img><i class="ph ph-image"></i> 插入图片</button>
        <button type="button" class="btn btn-sm" data-preview><i class="ph ph-eye"></i> 实时预览</button>
      </div>
      <input type="hidden" name="${esc(name)}" value="${esc(value || '')}" data-html />
      <textarea class="rich-input" data-mode="html" rows="8" spellcheck="false">${esc(value || '')}</textarea>
      <textarea class="rich-input" data-mode="md" rows="8" style="display:none" spellcheck="false">${esc(md)}</textarea>
      <div class="rich-preview" style="display:none"></div>
    </div>`;
}

function bindRichEditors(root) {
  root.querySelectorAll('[data-editor]').forEach((box) => {
    const hidden = box.querySelector('[data-html]');
    const htmlTa = box.querySelector('textarea[data-mode="html"]');
    const mdTa = box.querySelector('textarea[data-mode="md"]');
    const preview = box.querySelector('.rich-preview');
    const tabs = box.querySelectorAll('.rich-tab');
    let currentMode = 'html';

    const sync = () => {
      if (currentMode === 'html') {
        hidden.value = sanitizeHtml(htmlTa.value);
        mdTa.value = htmlToMd(hidden.value) || '';
      } else {
        const html = mdToHtml(mdTa.value) || '';
        hidden.value = html;
        htmlTa.value = html;
      }
    };

    tabs.forEach((t) => {
      t.onclick = () => {
        tabs.forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        currentMode = t.dataset.mode;
        htmlTa.style.display = currentMode === 'html' ? '' : 'none';
        mdTa.style.display = currentMode === 'md' ? '' : 'none';
        preview.style.display = 'none';
        if (currentMode === 'md') sync();
      };
    });

    htmlTa.oninput = sync;
    mdTa.oninput = sync;

    box.querySelector('[data-preview]').onclick = () => {
      sync();
      preview.innerHTML = hidden.value || '<p class="form-hint">暂无内容</p>';
      preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
    };

    box.querySelector('[data-insert-img]').onclick = async () => {
      const url = await filePickerModal({ accept: 'image/*', multiple: false });
      if (!url) return;
      if (currentMode === 'html') htmlTa.value += `<img src="${url}" alt="" />`;
      else mdTa.value += `![图片](${url})`;
      sync();
      toast('图片已插入');
    };

    RICH_EDITORS.push({ sync });
  });
}

function finalizeRichEditors() {
  RICH_EDITORS.forEach((e) => e.sync?.());
}

// ============================================================ 文件管理（全站通用）
const UPLOAD_ACCEPT_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'image/bmp'];
const UPLOAD_MAX = 20 * 1024 * 1024;

function fileIconClass(mime) {
  if (!mime) return 'ph-file';
  if (mime.startsWith('image/')) return 'ph-image';
  if (mime.startsWith('video/')) return 'ph-film-strip';
  if (mime.startsWith('audio/')) return 'ph-music-note';
  if (mime.includes('pdf')) return 'ph-file-pdf';
  if (mime.includes('word') || mime.includes('document')) return 'ph-file-doc';
  if (mime.includes('excel') || mime.includes('sheet') || mime.includes('csv')) return 'ph-file-xls';
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'ph-file-ppt';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return 'ph-file-zip';
  if (mime.includes('text') || mime.includes('markdown') || mime.includes('json')) return 'ph-file-text';
  return 'ph-file';
}

function isImageUrl(url) {
  return /\.(jpe?g|png|webp|gif|svg|avif|bmp)(\?|$)/i.test(url || '');
}

/** 通用文件选择弹窗：{accept:'image/*'|'*', multiple} → url | urls | '' | [] */
async function filePickerModal({ accept = '*', multiple = false } = {}) {
  const root = $('#modal-root');
  let page = 1;
  let q = '';
  let type = accept === 'image/*' ? 'image' : 'all';
  let selectedUrls = [];

  const typeTabs = accept === 'image/*'
    ? [{ key: 'image', label: '图片' }]
    : [
        { key: 'all', label: '全部' },
        { key: 'image', label: '图片' },
        { key: 'document', label: '文档' },
        { key: 'archive', label: '压缩包' },
        { key: 'media', label: '音视频' },
        { key: 'other', label: '其他' },
      ];

  const renderGallery = async () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: '40', q, type });
    const r = await api(`/api/admin/media?${qs}`);
    const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 40 };
    const grid = $('#file-gallery', root);
    grid.innerHTML = d.items.length === 0
      ? '<p class="form-hint" style="grid-column:1/-1;padding:24px 0;text-align:center">没有符合条件的文件，可直接本地上传。</p>'
      : d.items.map((m) => {
          const isImg = String(m.mime_type || '').startsWith('image/');
          const selected = selectedUrls.includes(m.url);
          return `
            <div class="file-thumb ${selected ? 'selected' : ''}" data-url="${esc(m.url)}" title="${esc(m.filename || '')}">
              ${isImg
                ? `<img src="${esc(m.url)}" alt="" loading="lazy" />`
                : `<div class="file-thumb-icon"><i class="ph ${fileIconClass(m.mime_type)} file-thumb-icon-svg"></i></div>`}
              <div class="file-thumb-meta">${esc(truncate(m.filename, 16))}<br/>${fmtSize(m.size)}</div>
            </div>`;
        }).join('');
    grid.querySelectorAll('.file-thumb').forEach((thumb) => {
      thumb.onclick = () => {
        const url = thumb.dataset.url;
        if (multiple) {
          selectedUrls = selectedUrls.includes(url)
            ? selectedUrls.filter((u) => u !== url)
            : [...selectedUrls, url];
        } else {
          selectedUrls = [url];
        }
        grid.querySelectorAll('.file-thumb').forEach((t) =>
          t.classList.toggle('selected', selectedUrls.includes(t.dataset.url)));
      };
    });
    const pager = $('#file-pager', root);
    pager.innerHTML = pagerHtml(d.total, d.page, d.pageSize);
    pager.querySelectorAll('[data-pg]').forEach((btn) => {
      btn.onclick = () => { page = Number(btn.dataset.pg); renderGallery(); };
    });
  };

  return new Promise((resolve) => {
    root.innerHTML = `
      <div class="modal-mask">
        <div class="modal wide">
          <h3 class="modal-title"><i class="ph ph-folder-open"></i> 从文件库选择</h3>
          <div class="modal-body">
            <div class="file-picker-actions">
              <button type="button" class="btn btn-sm btn-primary" id="file-upload"><i class="ph ph-upload-simple"></i> 本地上传</button>
              <input type="search" id="file-search" placeholder="搜索文件名…" value="${esc(q)}" />
              <div class="file-type-tabs" id="file-type-tabs"></div>
            </div>
            <div class="file-gallery" id="file-gallery"></div>
            <div id="file-pager"></div>
          </div>
          <div class="modal-actions">
            <button class="btn" data-act="close">取消</button>
            <button class="btn btn-primary" data-act="ok">确认选择</button>
          </div>
        </div>
      </div>`;

    $('#file-type-tabs', root).innerHTML = typeTabs.map((t) =>
      `<button class="file-type-tab ${type === t.key ? 'active' : ''}" data-t="${esc(t.key)}">${esc(t.label)}</button>`).join('');
    $('#file-type-tabs', root).querySelectorAll('[data-t]').forEach((btn) => {
      btn.onclick = () => { type = btn.dataset.t; page = 1; renderGallery(); };
    });

    $('#file-search', root).oninput = debounce((e) => { q = e.target.value.trim(); page = 1; renderGallery(); });

    $('#file-upload', root).onclick = async () => {
      const files = await pickLocalFiles({ accept, multiple: true });
      if (!files.length) return;
      const btn = $('#file-upload', root);
      btn.disabled = true;
      btn.textContent = '上传中…';
      for (const file of files) {
        if (file.size > UPLOAD_MAX) { toast(`${file.name} 超过 20MB，已跳过`, false); continue; }
        const fd = new FormData();
        fd.append('file', file);
        const r = await api('/api/admin/upload', { method: 'POST', body: fd });
        if (r.body?.code === 0) {
          if (multiple) selectedUrls.push(r.body.data.url);
          else selectedUrls = [r.body.data.url];
        } else {
          toast(`${file.name}：${r.body?.message || '上传失败'}`, false);
        }
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-upload-simple"></i> 本地上传';
      page = 1;
      await renderGallery();
      toast('上传完成，请点击「确认选择」');
    };

    renderGallery();
    const done = (val) => { root.innerHTML = ''; resolve(val); };
    $('[data-act="close"]', root).onclick = () => done(multiple ? [] : '');
    $('[data-act="ok"]', root).onclick = () => done(multiple ? selectedUrls : selectedUrls[0] || '');
    $('.modal-mask', root).onclick = (e) => {
      if (e.target.classList.contains('modal-mask')) done(multiple ? [] : '');
    };
  });
}

/** 图片上传字段 */
function uploadFieldHtml(name, label, value, required, hint = '') {
  return `
    <div class="form-row">
      <label>${esc(label)}${required ? ' <em>*</em>' : ''}</label>
      <div class="upload-field" data-name="${esc(name)}" data-accept="image/*">
        <input type="hidden" name="${esc(name)}" value="${esc(value || '')}" />
        <div class="upload-preview">
          ${value ? `<img src="${esc(value)}" alt="" />` : '<span class="upload-empty">未选择</span>'}
        </div>
        <div class="upload-actions">
          <button type="button" class="btn btn-sm" data-upload-btn><i class="ph ph-image"></i> 选择图片</button>
          <button type="button" class="btn btn-sm btn-ghost" data-upload-clear ${value ? '' : 'hidden'}>清除</button>
        </div>
      </div>
      ${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}
    </div>`;
}

/** 任意文件上传字段 */
function uploadFileFieldHtml(name, label, value, required, hint = '') {
  return `
    <div class="form-row">
      <label>${esc(label)}${required ? ' <em>*</em>' : ''}</label>
      <div class="upload-field" data-name="${esc(name)}" data-accept="*">
        <input type="hidden" name="${esc(name)}" value="${esc(value || '')}" />
        <div class="upload-preview">
          ${value
            ? (isImageUrl(value)
                ? `<img src="${esc(value)}" alt="" />`
                : `<div class="file-preview"><i class="ph ph-file"></i><span class="file-url">${esc(truncate(value.split('/').pop(), 18))}</span></div>`)
            : '<span class="upload-empty">未选择</span>'}
        </div>
        <div class="upload-actions">
          <button type="button" class="btn btn-sm" data-upload-btn><i class="ph ph-file"></i> 选择文件</button>
          <button type="button" class="btn btn-sm btn-ghost" data-upload-clear ${value ? '' : 'hidden'}>清除</button>
        </div>
      </div>
      ${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}
    </div>`;
}

function bindUploadFields(root) {
  root.querySelectorAll('.upload-field').forEach((f) => {
    const hidden = f.querySelector('input[type="hidden"]');
    const btn = f.querySelector('[data-upload-btn]');
    if (!hidden || !btn) return; // 条目内嵌图片字段由 bindHomeItemImages 单独绑定
    const clearBtn = f.querySelector('[data-upload-clear]');
    const preview = f.querySelector('.upload-preview');
    const accept = f.dataset.accept || 'image/*';

    const renderPreview = () => {
      if (!hidden.value) {
        preview.innerHTML = '<span class="upload-empty">未选择</span>';
      } else if (isImageUrl(hidden.value)) {
        preview.innerHTML = `<img src="${esc(hidden.value)}" alt="" />`;
      } else {
        preview.innerHTML = `<div class="file-preview"><i class="ph ph-file"></i><span class="file-url">${esc(truncate(hidden.value.split('/').pop(), 18))}</span></div>`;
      }
      if (clearBtn) clearBtn.hidden = !hidden.value;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    };

    btn.onclick = async () => {
      const url = await filePickerModal({ accept, multiple: false });
      if (!url) return;
      hidden.value = url;
      renderPreview();
      toast('已选择');
    };
    if (clearBtn) clearBtn.onclick = () => { hidden.value = ''; renderPreview(); };
  });
}

function pickLocalFiles({ accept = 'image/*', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept === '*' ? '' : accept;
    input.multiple = multiple;
    input.onchange = () => {
      const raw = Array.from(input.files || []);
      let files = raw;
      if (accept === 'image/*') {
        files = raw.filter((f) => UPLOAD_ACCEPT_IMAGE.includes(f.type));
        if (files.length < raw.length) toast('已过滤不支持的图片格式', false);
      }
      resolve(files);
    };
    input.click();
  });
}

// ============================================================ 开发者验证
async function ensureDevChallenge() {
  if (getCookie('wanxu_dev_ok')) return '';
  const r = await api('/api/admin/dev-challenge');
  const question = r.body?.data?.question || '大叔日记博客地址？';
  const answer = await devChallengeModal(question);
  if (!answer) return null;
  const r2 = await api('/api/admin/dev-challenge', { method: 'POST', body: { answer } });
  if (r2.body?.code !== 0) { toast(r2.body?.message || '验证失败', false); return null; }
  return answer;
}

function devChallengeModal(question) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-mask">
        <div class="modal">
          <h3 class="modal-title"><i class="ph ph-shield-check"></i> 开发者验证</h3>
          <p class="modal-msg">修改开发者信息前，请回答验证问题：</p>
          <form id="dev-form">
            <div class="form-row">
              <label>${esc(question)}</label>
              <input type="text" name="answer" placeholder="请输入答案" required autofocus autocomplete="off" />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" data-act="close">取消</button>
              <button type="submit" class="btn btn-primary">验证</button>
            </div>
          </form>
        </div>
      </div>`;
    $('[data-act="close"]', root).onclick = () => { root.innerHTML = ''; resolve(''); };
    $('#dev-form').onsubmit = (e) => {
      e.preventDefault();
      const val = String(new FormData(e.target).get('answer') || '').trim();
      root.innerHTML = '';
      resolve(val);
    };
    $('.modal-mask', root).onclick = (e) => {
      if (e.target.classList.contains('modal-mask')) { root.innerHTML = ''; resolve(''); }
    };
  });
}

// ============================================================ 列表/表单页面骨架
function buildListPage({ newText, onNew, filterHtml = '', tableHead, rowsHtml, pager = '' }) {
  $('#content').innerHTML = `
    <div class="card">
      <div class="toolbar">
        ${newText ? `<button class="btn btn-primary" id="btn-new"><i class="ph ph-plus"></i> ${esc(newText)}</button>` : ''}
        <span class="spacer"></span>
        ${filterHtml}
      </div>
      <table class="data-table">
        <thead><tr>${tableHead}</tr></thead>
        <tbody>${rowsHtml || '<tr class="empty-row"><td colspan="99"><i class="ph ph-tray"></i>暂无数据</td></tr>'}</tbody>
      </table>
      ${pager}
    </div>`;
  if (newText && onNew) $('#btn-new').onclick = onNew;
}

function buildFormPage({ backTo, fields, onSave, onDelete, saveText = '保存' }) {
  $('#content').innerHTML = `
    <div class="card">
      <form class="form-grid" id="edit-form" novalidate>${fields}</form>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-back"><i class="ph ph-arrow-left"></i> 返回</button>
        ${onDelete ? '<button type="button" class="btn btn-danger" id="btn-delete"><i class="ph ph-trash"></i> 删除</button>' : ''}
        <span class="spacer" style="flex:1"></span>
        <button type="submit" class="btn btn-primary" id="btn-save" form="edit-form"><i class="ph ph-check"></i> ${esc(saveText)}</button>
      </div>
    </div>`;
  $('#btn-back').onclick = () => { location.hash = backTo; };
  if (onDelete) {
    $('#btn-delete').onclick = async () => {
      if (await confirmDialog('确定删除吗？此操作不可恢复。')) onDelete();
    };
  }
  const form = $('#edit-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    finalizeRichEditors();
    const btn = $('#btn-save');
    btn.disabled = true;
    try {
      await onSave(formValues(form), form);
    } finally {
      btn.disabled = false;
    }
  };
  bindRichEditors($('#content'));
  bindUploadFields($('#content'));
  return form;
}

/** 保存失败统一处理：字段错误优先，其次 message */
function handleSaveError(r, form) {
  const errors = r.body?.data?.errors;
  if (errors && Object.keys(errors).length) {
    showFieldErrors(form, errors);
    if (!errors._form) toast('请检查标红的字段', false);
  } else {
    toast(r.body?.message || '保存失败', false);
  }
}

// ============================================================ 仪表盘
async function viewDashboard() {
  renderModuleTitle('dashboard');
  const [prods, arts, inqs, pages] = await Promise.all([
    canAccess('products') ? api('/api/admin/products?page=1&pageSize=1') : Promise.resolve({ status: 200, body: { code: 0, data: { total: 0 } } }),
    api('/api/admin/articles?page=1&pageSize=1'),
    api('/api/admin/inquiries?page=1&pageSize=6'),
    canAccess('pages') ? api('/api/admin/pages?page=1&pageSize=1') : Promise.resolve({ status: 200, body: { code: 0, data: { total: 0 } } }),
  ]);
  const inq = inqs.body?.data || {};
  const recent = (inq.items || []).slice(0, 6);
  $('#content').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon green"><i class="ph ph-package"></i></div><div><div class="num">${prods.body?.data?.total ?? 0}</div><div class="label">产品</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="ph ph-article"></i></div><div><div class="num">${arts.body?.data?.total ?? 0}</div><div class="label">文章</div></div></div>
      <div class="stat-card"><div class="stat-icon orange"><i class="ph ph-envelope"></i></div><div><div class="num">${inq.unread ?? 0}</div><div class="label">未读询盘</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><i class="ph ph-file-text"></i></div><div><div class="num">${pages.body?.data?.total ?? 0}</div><div class="label">页面</div></div></div>
    </div>
    <div class="dash-cols">
      <div class="card">
        <h3 class="form-section-title"><i class="ph ph-lightning"></i> 快捷操作</h3>
        <div class="quick-links">
          ${canAccess('products') ? '<a href="#products/new" class="btn"><i class="ph ph-package"></i> 发布产品</a>' : ''}
          ${canAccess('articles') ? '<a href="#articles/new" class="btn"><i class="ph ph-article"></i> 撰写文章</a>' : ''}
          ${canAccess('banners') ? '<a href="#banners" class="btn"><i class="ph ph-images"></i> 轮播图</a>' : ''}
          ${canAccess('home-content') ? '<a href="#home-content" class="btn"><i class="ph ph-layout"></i> 首页内容</a>' : ''}
          ${canAccess('media') ? '<a href="#media" class="btn"><i class="ph ph-folder-open"></i> 文件管理</a>' : ''}
          ${canAccess('settings') ? '<a href="#settings" class="btn"><i class="ph ph-gear"></i> 站点设置</a>' : ''}
        </div>
      </div>
      <div class="card">
        <h3 class="form-section-title"><i class="ph ph-envelope-open"></i> 最新询盘</h3>
        ${recent.length === 0 ? '<p class="form-hint">暂无询盘。</p>' : `
          <ul class="recent-list">
            ${recent.map((i) => `
              <li class="recent-item ${i.is_read ? '' : 'unread'}">
                <div class="recent-main">
                  <strong>${esc(i.name)}</strong>
                  <span class="recent-msg">${esc(truncate(i.message, 46))}</span>
                </div>
                <span class="recent-time">${fmtDate(i.created_at)}</span>
              </li>`).join('')}
          </ul>
          <div style="margin-top:14px"><a href="#inquiries" class="link-btn">查看全部询盘 →</a></div>`}
      </div>
    </div>`;
}

// ============================================================ 产品分类
async function viewCategories() {
  renderModuleTitle('categories');
  const r = await api('/api/admin/categories');
  const rows = (r.body?.data || []).map((c) => `
    <tr>
      <td>${c.sort_order}</td>
      <td><strong>${esc(c.name_zh)}</strong><br/><small class="cell-sub">${esc(c.name_en)}</small></td>
      <td><small class="cell-sub">${esc(c.subtitle_zh || '-')}</small></td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${c.id}">编辑</button>
        <button class="link-btn danger" data-del="${c.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建分类', onNew: () => { location.hash = '#categories/new'; },
    tableHead: '<th style="width:70px">排序</th><th>名称</th><th>副标题</th><th style="width:130px">操作</th>',
    rowsHtml: rows,
  });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#categories/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该分类？'))) return;
      const r2 = await api(`/api/admin/categories/${btn.dataset.del}`, { method: 'DELETE' });
      if (r2.body?.code === 0) { toast('已删除'); viewCategories(); }
      else toast(r2.body?.message || '删除失败', false);
    };
  });
}

async function editCategory(id) {
  renderModuleTitle('categories');
  let data = {};
  if (id !== 'new') {
    // 后端无 GET /categories/:id 单条接口，从列表中查找
    const listR = await api('/api/admin/categories');
    const found = (listR.body?.data || []).find((c) => Number(c.id) === Number(id));
    if (!found) { toast('分类不存在', false); location.hash = '#categories'; return; }
    data = found;
  }
  buildFormPage({
    backTo: '#categories',
    onDelete: id !== 'new' ? async () => {
      const r = await api(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (r.body?.code === 0) { toast('已删除'); location.hash = '#categories'; }
      else toast(r.body?.message || '删除失败', false);
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-squares-four"></i> ${id === 'new' ? '新建分类' : '编辑分类'}</div>
      <div class="form-row"><label>中文名称 <em>*</em></label><input type="text" name="name_zh" value="${esc(data.name_zh || '')}" required /></div>
      <div class="form-row"><label>英文名称 <em>*</em></label><input type="text" name="name_en" value="${esc(data.name_en || '')}" required /></div>
      <div class="form-row"><label>中文副标题</label><input type="text" name="subtitle_zh" value="${esc(data.subtitle_zh || '')}" /></div>
      <div class="form-row"><label>英文副标题</label><input type="text" name="subtitle_en" value="${esc(data.subtitle_en || '')}" /></div>
      ${uploadFieldHtml('cover_image', '封面图', data.cover_image || '', false)}
      <div class="form-row"><label>排序（越小越靠前）</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
    `,
    onSave: async (vals, form) => {
      const body = { ...vals, sort_order: Number(vals.sort_order) || 0 };
      const r = id === 'new'
        ? await api('/api/admin/categories', { method: 'POST', body })
        : await api(`/api/admin/categories/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#categories'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 产品
async function viewProducts() {
  renderModuleTitle('products');
  const p = state.listParams.products || { page: 1, q: '', category_id: '', status: '' };
  state.listParams.products = p;
  const cats = await api('/api/admin/categories');
  const catOptions = (cats.body?.data || []).map((c) =>
    `<option value="${c.id}" ${String(p.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name_zh)}</option>`).join('');
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '20' });
  if (p.q) qs.set('q', p.q);
  if (p.category_id) qs.set('category_id', p.category_id);
  if (p.status) qs.set('status', p.status);
  const r = await api(`/api/admin/products?${qs}`);
  const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 20 };
  const rows = d.items.map((item) => `
    <tr>
      <td class="thumb-cell">${item.images?.[0] ? `<img src="${esc(item.images[0])}" alt="" />` : '<span class="cell-sub">-</span>'}</td>
      <td><strong>${esc(item.name_zh)}</strong><br/><small class="cell-sub">${esc(item.name_en)}</small></td>
      <td>${item.is_active ? '<span class="badge badge-green">上架</span>' : '<span class="badge badge-gray">下架</span>'}</td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${item.id}">编辑</button>
        <button class="link-btn" data-toggle="${item.id}" data-active="${item.is_active}">${item.is_active ? '下架' : '上架'}</button>
        <button class="link-btn danger" data-del="${item.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建产品', onNew: () => { location.hash = '#products/new'; },
    filterHtml: `
      <select id="status-filter">
        <option value="">全部状态</option>
        <option value="active" ${p.status === 'active' ? 'selected' : ''}>已上架</option>
        <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>已下架</option>
      </select>
      <select id="cat-filter"><option value="">全部分类</option>${catOptions}</select>
      <input type="search" id="q-filter" placeholder="搜索产品名…" value="${esc(p.q || '')}" />`,
    tableHead: '<th style="width:88px">图片</th><th>名称</th><th style="width:90px">状态</th><th style="width:170px">操作</th>',
    rowsHtml: rows,
    pager: pagerHtml(d.total, d.page, d.pageSize),
  });
  $('#status-filter').onchange = (e) => { p.status = e.target.value; p.page = 1; viewProducts(); };
  $('#cat-filter').onchange = (e) => { p.category_id = e.target.value; p.page = 1; viewProducts(); };
  $('#q-filter').oninput = debounce((e) => { p.q = e.target.value.trim(); p.page = 1; viewProducts(); });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#products/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.onclick = async () => {
      const next = btn.dataset.active === '1' ? 0 : 1;
      await api(`/api/admin/products/${btn.dataset.toggle}/status`, { method: 'PATCH', body: { is_active: next } });
      toast(next ? '已上架' : '已下架');
      viewProducts();
    };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该产品？'))) return;
      const r2 = await api(`/api/admin/products/${btn.dataset.del}`, { method: 'DELETE' });
      if (r2.body?.code === 0) { toast('已删除'); viewProducts(); }
      else toast(r2.body?.message || '删除失败', false);
    };
  });
  $('#content').querySelectorAll('[data-pg]').forEach((btn) => {
    btn.onclick = () => { p.page = Number(btn.dataset.pg); viewProducts(); };
  });
}

function seoFieldsHtml(data) {
  return `
    <div class="form-section-title"><i class="ph ph-magnifying-glass"></i> SEO 设置 <span class="title-hint">不填则使用站点默认</span></div>
    <div class="form-row"><label>SEO 标题（中）</label><input type="text" name="seo_title_zh" value="${esc(data.seo_title_zh || '')}" /></div>
    <div class="form-row"><label>SEO 标题（英）</label><input type="text" name="seo_title_en" value="${esc(data.seo_title_en || '')}" /></div>
    <div class="form-row"><label>SEO 描述（中）</label><textarea name="seo_description_zh" rows="2">${esc(data.seo_description_zh || '')}</textarea></div>
    <div class="form-row"><label>SEO 描述（英）</label><textarea name="seo_description_en" rows="2">${esc(data.seo_description_en || '')}</textarea></div>
  `;
}

function tagChecksHtml(tags, selectedIds) {
  if (!tags.length) return '<p class="form-hint">暂无标签，可先在「标签管理」中创建。</p>';
  return `<div class="checkbox-grid">${tags.map((t) => {
    const checked = (selectedIds || []).includes(t.id) ? 'checked' : '';
    return `<label class="inline-check"><input type="checkbox" name="tag_ids" value="${t.id}" ${checked} /> ${esc(t.name_zh)}</label>`;
  }).join('')}</div>`;
}

function collectTagIds(form) {
  return $$('input[name="tag_ids"]:checked', form).map((cb) => Number(cb.value)).filter((n) => n > 0);
}

async function editProduct(id) {
  renderModuleTitle('products');
  let data = { images: [], params_zh: [], params_en: [] };
  if (id !== 'new') {
    const r = await api(`/api/admin/products/${id}`);
    if (r.body?.code !== 0) { toast(r.body?.message || '产品不存在', false); location.hash = '#products'; return; }
    data = { ...data, ...(r.body.data || {}) };
  }
  const [catsR, tagsR] = await Promise.all([api('/api/admin/categories'), api('/api/admin/tags')]);
  const cats = catsR.body?.data || [];
  const tags = tagsR.body?.data || [];
  const catOptions = cats.map((c) =>
    `<option value="${c.id}" ${data.category_id == c.id ? 'selected' : ''}>${esc(c.name_zh)}</option>`).join('');

  const imgChips = (data.images || []).map((url) => galleryChipHtml(url)).join('');
  const paramRows = (data.params_zh || []).map((p, i) => {
    const en = (data.params_en || [])[i] || {};
    return paramRowHtml(p, en);
  }).join('');

  const form = buildFormPage({
    backTo: '#products',
    onDelete: id !== 'new' ? async () => {
      const r = await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (r.body?.code === 0) { toast('已删除'); location.hash = '#products'; }
      else toast(r.body?.message || '删除失败', false);
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-package"></i> ${id === 'new' ? '新建产品' : '编辑产品'}</div>
      <div class="form-row"><label>所属分类 <em>*</em></label><select name="category_id" required><option value="">请选择分类</option>${catOptions}</select></div>
      <div class="form-row"><label>排序（越小越靠前）</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
      <div class="form-row"><label>中文名称 <em>*</em></label><input type="text" name="name_zh" value="${esc(data.name_zh || '')}" required /></div>
      <div class="form-row"><label>英文名称 <em>*</em></label><input type="text" name="name_en" value="${esc(data.name_en || '')}" required /></div>
      <div class="form-row"><label>中文摘要</label><textarea name="summary_zh" rows="2">${esc(data.summary_zh || '')}</textarea></div>
      <div class="form-row"><label>英文摘要</label><textarea name="summary_en" rows="2">${esc(data.summary_en || '')}</textarea></div>
      ${richEditorHtml('description_zh', '中文详情', data.description_zh || '')}
      ${richEditorHtml('description_en', '英文详情', data.description_en || '')}
      <div class="form-row full"><label>产品图集（第一张为主图）</label>
        <div class="gallery-manager" id="img-list">${imgChips}</div>
        <button type="button" class="btn btn-sm gallery-add-btn" id="add-img"><i class="ph ph-plus"></i> 添加图片（可多选）</button>
      </div>
      <div class="form-row"><label>规格（中）</label><input type="text" name="sizes" value="${esc(data.sizes || '')}" placeholder="如：30/50/80cm" /></div>
      <div class="form-row"><label>规格（英）</label><input type="text" name="sizes_en" value="${esc(data.sizes_en || '')}" placeholder="e.g. 30/50/80cm" /></div>
      <div class="form-row"><label>颜色（中）</label><input type="text" name="colors" value="${esc(data.colors || '')}" /></div>
      <div class="form-row"><label>颜色（英）</label><input type="text" name="colors_en" value="${esc(data.colors_en || '')}" /></div>
      <div class="form-row full"><label>产品参数（中英文）</label>
        <div class="params-list" id="params-list">${paramRows}</div>
        <button type="button" class="btn btn-sm" id="add-param"><i class="ph ph-plus"></i> 添加参数</button>
      </div>
      <div class="form-row full"><label>标签</label>${tagChecksHtml(tags, data.tag_ids)}</div>
      ${seoFieldsHtml(data)}
      <div class="form-row checkbox-row"><label class="inline-check"><input type="checkbox" name="is_active" ${data.is_active !== 0 ? 'checked' : ''} /> 上架（前台可见）</label></div>
    `,
    onSave: async (vals, formEl) => {
      const imgs = $$('#img-list .img-chip').map((chip) => chip.dataset.url).filter(Boolean);
      const params_zh = [];
      const params_en = [];
      $$('#params-list .param-row').forEach((row) => {
        const kzh = row.querySelector('[data-pk-zh]').value.trim();
        const vzh = row.querySelector('[data-pv-zh]').value.trim();
        const ken = row.querySelector('[data-pk-en]').value.trim();
        const ven = row.querySelector('[data-pv-en]').value.trim();
        if (kzh || vzh) params_zh.push({ key: kzh, value: vzh });
        if (ken || ven) params_en.push({ key: ken, value: ven });
      });
      const body = {
        ...vals,
        category_id: Number(vals.category_id),
        is_active: vals.is_active === '1' ? 1 : 0,
        sort_order: Number(vals.sort_order) || 0,
        main_image: imgs[0] || '',
        images: imgs,
        params_zh,
        params_en,
        tag_ids: collectTagIds(formEl),
      };
      const r = id === 'new'
        ? await api('/api/admin/products', { method: 'POST', body })
        : await api(`/api/admin/products/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#products'; }
      else handleSaveError(r, formEl);
    },
  });

  // 图集管理
  $('#add-img').onclick = async () => {
    const urls = await filePickerModal({ accept: 'image/*', multiple: true });
    if (!urls || !urls.length) return;
    for (const url of urls) {
      $('#img-list').insertAdjacentHTML('beforeend', galleryChipHtml(url));
    }
  };
  $('#img-list').addEventListener('click', (e) => {
    const chip = e.target.closest('.img-chip');
    if (!chip) return;
    if (e.target.closest('[data-img-del]')) chip.remove();
    else if (e.target.closest('[data-img-left]')) {
      const prev = chip.previousElementSibling;
      if (prev) $('#img-list').insertBefore(chip, prev);
    }
  });

  // 参数管理
  $('#add-param').onclick = () => {
    $('#params-list').insertAdjacentHTML('beforeend', paramRowHtml({}, {}));
  };
  $('#params-list').addEventListener('click', (e) => {
    if (e.target.closest('[data-pdel]')) e.target.closest('.param-row').remove();
  });
  return form;
}

function galleryChipHtml(url) {
  return `
    <div class="img-chip" data-url="${esc(url)}">
      <img src="${esc(url)}" alt="" />
      <button type="button" class="link-btn" data-img-left title="前移（更靠前）"><i class="ph ph-caret-left"></i></button>
      <button type="button" class="link-btn danger" data-img-del title="移除"><i class="ph ph-x"></i></button>
    </div>`;
}

function paramRowHtml(zh, en) {
  return `
    <div class="param-row bilingual">
      <input placeholder="参数名（中）" value="${esc(zh.key || '')}" data-pk-zh />
      <input placeholder="参数值（中）" value="${esc(zh.value || '')}" data-pv-zh />
      <input placeholder="参数名（英）" value="${esc(en.key || '')}" data-pk-en />
      <input placeholder="参数值（英）" value="${esc(en.value || '')}" data-pv-en />
      <button type="button" class="link-btn danger" data-pdel><i class="ph ph-x"></i></button>
    </div>`;
}

// ============================================================ 文章
async function viewArticles() {
  renderModuleTitle('articles');
  const p = state.listParams.articles || { page: 1, q: '', status: '' };
  state.listParams.articles = p;
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '20' });
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const r = await api(`/api/admin/articles?${qs}`);
  const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 20 };
  const rows = d.items.map((a) => `
    <tr>
      <td><strong>${esc(a.title_zh)}</strong><br/><small class="cell-sub">${esc(a.title_en)}</small></td>
      <td>${a.status === 'published' ? '<span class="badge badge-green">已发布</span>' : '<span class="badge badge-orange">草稿</span>'}</td>
      <td>${fmtDate(a.published_at || a.updated_at)}</td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${a.id}">编辑</button>
        <button class="link-btn danger" data-del="${a.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建文章', onNew: () => { location.hash = '#articles/new'; },
    filterHtml: `
      <select id="status-filter">
        <option value="">全部状态</option>
        <option value="published" ${p.status === 'published' ? 'selected' : ''}>已发布</option>
        <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>草稿</option>
      </select>
      <input type="search" id="q-filter" placeholder="搜索标题…" value="${esc(p.q || '')}" />`,
    tableHead: '<th>标题</th><th style="width:90px">状态</th><th style="width:110px">发布时间</th><th style="width:130px">操作</th>',
    rowsHtml: rows,
    pager: pagerHtml(d.total, d.page, d.pageSize),
  });
  $('#status-filter').onchange = (e) => { p.status = e.target.value; p.page = 1; viewArticles(); };
  $('#q-filter').oninput = debounce((e) => { p.q = e.target.value.trim(); p.page = 1; viewArticles(); });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#articles/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该文章？'))) return;
      await api(`/api/admin/articles/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewArticles();
    };
  });
  $('#content').querySelectorAll('[data-pg]').forEach((btn) => {
    btn.onclick = () => { p.page = Number(btn.dataset.pg); viewArticles(); };
  });
}

async function editArticle(id) {
  renderModuleTitle('articles');
  let data = {};
  if (id !== 'new') {
    const r = await api(`/api/admin/articles/${id}`);
    if (r.body?.code !== 0) { toast(r.body?.message || '文章不存在', false); location.hash = '#articles'; return; }
    data = r.body.data || {};
  }
  const tagsR = await api('/api/admin/tags');
  const tags = tagsR.body?.data || [];
  buildFormPage({
    backTo: '#articles',
    onDelete: id !== 'new' ? async () => {
      await api(`/api/admin/articles/${id}`, { method: 'DELETE' });
      toast('已删除');
      location.hash = '#articles';
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-article"></i> ${id === 'new' ? '新建文章' : '编辑文章'}</div>
      <div class="form-row"><label>中文标题 <em>*</em></label><input type="text" name="title_zh" value="${esc(data.title_zh || '')}" required /></div>
      <div class="form-row"><label>英文标题 <em>*</em></label><input type="text" name="title_en" value="${esc(data.title_en || '')}" required /></div>
      <div class="form-row"><label>中文摘要</label><textarea name="summary_zh" rows="2">${esc(data.summary_zh || '')}</textarea></div>
      <div class="form-row"><label>英文摘要</label><textarea name="summary_en" rows="2">${esc(data.summary_en || '')}</textarea></div>
      ${uploadFieldHtml('cover_image', '封面图', data.cover_image || '', false)}
      <div class="form-row"><label>发布状态</label>
        <select name="status">
          <option value="draft" ${data.status !== 'published' ? 'selected' : ''}>草稿</option>
          <option value="published" ${data.status === 'published' ? 'selected' : ''}>发布</option>
        </select>
      </div>
      ${richEditorHtml('content_zh', '中文内容', data.content_zh || '')}
      ${richEditorHtml('content_en', '英文内容', data.content_en || '')}
      <div class="form-row full"><label>标签</label>${tagChecksHtml(tags, data.tag_ids)}</div>
      ${seoFieldsHtml(data)}
    `,
    onSave: async (vals, form) => {
      const body = { ...vals, tag_ids: collectTagIds(form) };
      const r = id === 'new'
        ? await api('/api/admin/articles', { method: 'POST', body })
        : await api(`/api/admin/articles/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#articles'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 页面管理
async function viewPages() {
  renderModuleTitle('pages');
  const p = state.listParams.pages || { page: 1, q: '' };
  state.listParams.pages = p;
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '20' });
  if (p.q) qs.set('q', p.q);
  const r = await api(`/api/admin/pages?${qs}`);
  const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 20 };
  const rows = d.items.map((pg) => `
    <tr>
      <td><code class="slug-code">/${esc(pg.slug)}</code></td>
      <td><strong>${esc(pg.title_zh)}</strong><br/><small class="cell-sub">${esc(pg.title_en)}</small></td>
      <td>${pg.is_active ? '<span class="badge badge-green">启用</span>' : '<span class="badge badge-gray">禁用</span>'}</td>
      <td class="table-actions">
        <a class="link-btn" href="/zh/${esc(pg.slug)}" target="_blank" rel="noopener">预览</a>
        <button class="link-btn" data-edit="${pg.id}">编辑</button>
        <button class="link-btn danger" data-del="${pg.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建页面', onNew: () => { location.hash = '#pages/new'; },
    filterHtml: `<input type="search" id="q-filter" placeholder="搜索标题 / URL…" value="${esc(p.q || '')}" />`,
    tableHead: '<th style="width:140px">URL 标识</th><th>标题</th><th style="width:80px">状态</th><th style="width:180px">操作</th>',
    rowsHtml: rows,
    pager: pagerHtml(d.total, d.page, d.pageSize),
  });
  $('#q-filter').oninput = debounce((e) => { p.q = e.target.value.trim(); p.page = 1; viewPages(); });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#pages/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该页面？'))) return;
      await api(`/api/admin/pages/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewPages();
    };
  });
  $('#content').querySelectorAll('[data-pg]').forEach((btn) => {
    btn.onclick = () => { p.page = Number(btn.dataset.pg); viewPages(); };
  });
}

async function editPage(id) {
  renderModuleTitle('pages');
  let data = {};
  if (id !== 'new') {
    const r = await api(`/api/admin/pages/${id}`);
    if (r.body?.code !== 0) { toast(r.body?.message || '页面不存在', false); location.hash = '#pages'; return; }
    data = r.body.data || {};
  }
  const tagsR = await api('/api/admin/tags');
  const tags = tagsR.body?.data || [];
  buildFormPage({
    backTo: '#pages',
    onDelete: id !== 'new' ? async () => {
      await api(`/api/admin/pages/${id}`, { method: 'DELETE' });
      toast('已删除');
      location.hash = '#pages';
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-file-text"></i> ${id === 'new' ? '新建页面' : '编辑页面'}</div>
      <div class="form-row"><label>URL 标识 <em>*</em></label><input type="text" name="slug" value="${esc(data.slug || '')}" required placeholder="如 about-us" /><p class="form-hint">小写字母、数字与中划线；访问路径为 /zh/标识 与 /en/标识</p></div>
      <div class="form-row"><label>排序</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
      <div class="form-row"><label>中文标题 <em>*</em></label><input type="text" name="title_zh" value="${esc(data.title_zh || '')}" required /></div>
      <div class="form-row"><label>英文标题 <em>*</em></label><input type="text" name="title_en" value="${esc(data.title_en || '')}" required /></div>
      ${uploadFieldHtml('cover_image', '封面图', data.cover_image || '', false)}
      <div class="form-row checkbox-row"><label class="inline-check"><input type="checkbox" name="is_active" ${data.is_active !== 0 ? 'checked' : ''} /> 启用（前台可访问）</label></div>
      ${richEditorHtml('content_zh', '中文内容', data.content_zh || '')}
      ${richEditorHtml('content_en', '英文内容', data.content_en || '')}
      <div class="form-row full"><label>标签</label>${tagChecksHtml(tags, data.tag_ids)}</div>
      ${seoFieldsHtml(data)}
    `,
    onSave: async (vals, form) => {
      const body = {
        ...vals,
        is_active: vals.is_active === '1' ? 1 : 0,
        sort_order: Number(vals.sort_order) || 0,
        tag_ids: collectTagIds(form),
      };
      const r = id === 'new'
        ? await api('/api/admin/pages', { method: 'POST', body })
        : await api(`/api/admin/pages/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#pages'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 轮播图
async function viewBanners() {
  renderModuleTitle('banners');
  const r = await api('/api/admin/banners');
  const rows = (r.body?.data || []).map((b) => `
    <tr>
      <td class="thumb-cell">${b.image ? `<img src="${esc(b.image)}" alt="" />` : '-'}</td>
      <td><strong>${esc(b.title_zh || '-')}</strong><br/><small class="cell-sub">${esc(b.title_en || '')}</small></td>
      <td><small class="cell-sub">${esc(b.link || '-')}</small></td>
      <td>${b.sort_order}</td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${b.id}">编辑</button>
        <button class="link-btn danger" data-del="${b.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建轮播', onNew: () => { location.hash = '#banners/new'; },
    tableHead: '<th style="width:88px">图片</th><th>标题</th><th>链接</th><th style="width:60px">排序</th><th style="width:130px">操作</th>',
    rowsHtml: rows,
  });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#banners/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该轮播？'))) return;
      await api(`/api/admin/banners/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewBanners();
    };
  });
}

async function editBanner(id) {
  renderModuleTitle('banners');
  let data = {};
  if (id !== 'new') {
    // 后端无 GET /banners/:id 单条接口，从列表中查找
    const listR = await api('/api/admin/banners');
    const found = (listR.body?.data || []).find((b) => Number(b.id) === Number(id));
    if (!found) { toast('轮播不存在', false); location.hash = '#banners'; return; }
    data = found;
  }
  buildFormPage({
    backTo: '#banners',
    onDelete: id !== 'new' ? async () => {
      await api(`/api/admin/banners/${id}`, { method: 'DELETE' });
      toast('已删除');
      location.hash = '#banners';
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-images"></i> ${id === 'new' ? '新建轮播' : '编辑轮播'}</div>
      ${uploadFieldHtml('image', '轮播图片', data.image || '', true, '建议宽图（如 1920×800），不超过 20MB')}
      <div class="form-row"><label>链接（点击跳转）</label><input type="text" name="link" value="${esc(data.link || '')}" placeholder="如 /products 或完整网址" /></div>
      <div class="form-row"><label>中文标题</label><input type="text" name="title_zh" value="${esc(data.title_zh || '')}" /></div>
      <div class="form-row"><label>英文标题</label><input type="text" name="title_en" value="${esc(data.title_en || '')}" /></div>
      <div class="form-row"><label>中文副标题</label><input type="text" name="subtitle_zh" value="${esc(data.subtitle_zh || '')}" /></div>
      <div class="form-row"><label>英文副标题</label><input type="text" name="subtitle_en" value="${esc(data.subtitle_en || '')}" /></div>
      <div class="form-row"><label>排序（越小越靠前）</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
    `,
    onSave: async (vals, form) => {
      const body = { ...vals, sort_order: Number(vals.sort_order) || 0 };
      const r = id === 'new'
        ? await api('/api/admin/banners', { method: 'POST', body })
        : await api(`/api/admin/banners/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#banners'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 标签
async function viewTags() {
  renderModuleTitle('tags');
  const r = await api('/api/admin/tags');
  const rows = (r.body?.data || []).map((t) => `
    <tr>
      <td><strong>${esc(t.name_zh)}</strong><br/><small class="cell-sub">${esc(t.name_en)}</small></td>
      <td><code class="slug-code">${esc(t.slug)}</code></td>
      <td>${t.sort_order ?? 0}</td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${t.id}">编辑</button>
        <button class="link-btn danger" data-del="${t.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    newText: '新建标签', onNew: () => { location.hash = '#tags/new'; },
    tableHead: '<th>名称</th><th style="width:160px">Slug</th><th style="width:70px">排序</th><th style="width:130px">操作</th>',
    rowsHtml: rows,
  });
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#tags/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该标签？'))) return;
      await api(`/api/admin/tags/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewTags();
    };
  });
}

async function editTag(id) {
  renderModuleTitle('tags');
  let data = {};
  if (id !== 'new') {
    // 后端无 GET /tags/:id 单条接口，从列表中查找
    const listR = await api('/api/admin/tags');
    const found = (listR.body?.data || []).find((t) => Number(t.id) === Number(id));
    if (!found) { toast('标签不存在', false); location.hash = '#tags'; return; }
    data = found;
  }
  buildFormPage({
    backTo: '#tags',
    onDelete: id !== 'new' ? async () => {
      await api(`/api/admin/tags/${id}`, { method: 'DELETE' });
      toast('已删除');
      location.hash = '#tags';
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-tag"></i> ${id === 'new' ? '新建标签' : '编辑标签'}</div>
      <div class="form-row"><label>中文名称 <em>*</em></label><input type="text" name="name_zh" value="${esc(data.name_zh || '')}" required /></div>
      <div class="form-row"><label>英文名称 <em>*</em></label><input type="text" name="name_en" value="${esc(data.name_en || '')}" required /></div>
      <div class="form-row"><label>Slug <em>*</em></label><input type="text" name="slug" value="${esc(data.slug || '')}" required placeholder="小写字母/数字/中划线" /></div>
      <div class="form-row"><label>排序</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
    `,
    onSave: async (vals, form) => {
      const body = { ...vals, sort_order: Number(vals.sort_order) || 0 };
      const r = id === 'new'
        ? await api('/api/admin/tags', { method: 'POST', body })
        : await api(`/api/admin/tags/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#tags'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 询盘
async function viewInquiries() {
  renderModuleTitle('inquiries');
  const p = state.listParams.inquiries || { page: 1, read: '' };
  state.listParams.inquiries = p;
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '20' });
  if (p.read !== '') qs.set('read', p.read);
  const r = await api(`/api/admin/inquiries?${qs}`);
  const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 20, unread: 0 };
  const rows = d.items.map((i) => `
    <tr class="${i.is_read ? '' : 'unread'}">
      <td><strong>${esc(i.name)}</strong><br/><small class="cell-sub">${esc(i.email)}</small></td>
      <td>${esc(i.company || '-')}</td>
      <td><small>${esc(truncate(i.message, 42))}</small></td>
      <td><small class="cell-sub">${fmtDateTime(i.created_at)}</small></td>
      <td class="table-actions">
        <button class="link-btn" data-view="${i.id}">查看</button>
        <button class="link-btn" data-read="${i.id}" data-readnow="${i.is_read}">${i.is_read ? '标未读' : '标已读'}</button>
        <button class="link-btn danger" data-del="${i.id}">删除</button>
      </td>
    </tr>`).join('');
  buildListPage({
    filterHtml: `
      <div class="file-type-tabs">
        <button class="file-type-tab ${p.read === '' ? 'active' : ''}" data-read-filter="">全部</button>
        <button class="file-type-tab ${p.read === '0' ? 'active' : ''}" data-read-filter="0">未读 ${d.unread ? `(${d.unread})` : ''}</button>
        <button class="file-type-tab ${p.read === '1' ? 'active' : ''}" data-read-filter="1">已读</button>
      </div>`,
    tableHead: '<th>联系人</th><th style="width:130px">公司</th><th>留言</th><th style="width:150px">时间</th><th style="width:180px">操作</th>',
    rowsHtml: rows,
    pager: pagerHtml(d.total, d.page, d.pageSize),
  });
  $('#content').querySelectorAll('[data-read-filter]').forEach((btn) => {
    btn.onclick = () => { p.read = btn.dataset.readFilter; p.page = 1; viewInquiries(); };
  });
  $('#content').querySelectorAll('[data-view]').forEach((btn) => {
    btn.onclick = async () => {
      const r2 = await api(`/api/admin/inquiries/${btn.dataset.view}`);
      const i = r2.body?.data;
      if (!i) return;
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-mask">
          <div class="modal">
            <h3 class="modal-title"><i class="ph ph-envelope-open"></i> 询盘详情</h3>
            <dl class="detail-list">
              <dt>姓名</dt><dd>${esc(i.name)}</dd>
              <dt>邮箱</dt><dd><a href="mailto:${esc(i.email)}">${esc(i.email)}</a></dd>
              <dt>公司</dt><dd>${esc(i.company || '-')}</dd>
              <dt>国家</dt><dd>${esc(i.country || '-')}</dd>
              <dt>意向产品</dt><dd>${esc(i.product_ref || '-')}</dd>
              <dt>留言</dt><dd style="white-space:pre-wrap">${esc(i.message)}</dd>
              <dt>时间</dt><dd>${fmtDateTime(i.created_at)}</dd>
            </dl>
            <div class="modal-actions"><button class="btn btn-primary" data-act="close">关闭</button></div>
          </div>
        </div>`;
      $('[data-act="close"]', root).onclick = () => { root.innerHTML = ''; };
      if (!i.is_read) {
        await api(`/api/admin/inquiries/${i.id}/read`, { method: 'PATCH', body: { is_read: 1 } });
        viewInquiries();
      }
    };
  });
  $('#content').querySelectorAll('[data-read]').forEach((btn) => {
    btn.onclick = async () => {
      const next = btn.dataset.readnow === '1' ? 0 : 1;
      await api(`/api/admin/inquiries/${btn.dataset.read}/read`, { method: 'PATCH', body: { is_read: next } });
      viewInquiries();
    };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该询盘？'))) return;
      await api(`/api/admin/inquiries/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewInquiries();
    };
  });
  $('#content').querySelectorAll('[data-pg]').forEach((btn) => {
    btn.onclick = () => { p.page = Number(btn.dataset.pg); viewInquiries(); };
  });
}

// ============================================================ 文件管理
async function viewMedia() {
  renderModuleTitle('media');
  const p = state.listParams.media || { page: 1, q: '', type: 'all' };
  state.listParams.media = p;
  const qs = new URLSearchParams({ page: String(p.page), pageSize: '40', q: p.q || '', type: p.type || 'all' });
  const r = await api(`/api/admin/media?${qs}`);
  const d = r.body?.data || { items: [], total: 0, page: 1, pageSize: 40 };
  const typeTabs = [
    { key: 'all', label: '全部' },
    { key: 'image', label: '图片' },
    { key: 'document', label: '文档' },
    { key: 'archive', label: '压缩包' },
    { key: 'media', label: '音视频' },
    { key: 'other', label: '其他' },
  ];
  const items = d.items.map((m) => {
    const isImg = String(m.mime_type || '').startsWith('image/');
    return `
      <div class="file-item" title="${esc(m.filename || '')}">
        ${isImg
          ? `<img src="${esc(m.url)}" alt="" loading="lazy" />`
          : `<div class="file-item-icon"><i class="ph ${fileIconClass(m.mime_type)} file-item-icon-svg"></i></div>`}
        <div class="file-item-meta">${esc(truncate(m.filename, 18))}<br/>${fmtSize(m.size)}</div>
        <div class="file-item-actions">
          <button class="link-btn" data-copy="${esc(m.url)}" title="复制链接"><i class="ph ph-link"></i></button>
          <button class="link-btn danger" data-del="${m.id}" title="删除"><i class="ph ph-trash"></i></button>
        </div>
      </div>`;
  }).join('');
  $('#content').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <button class="btn btn-primary" id="upload-btn"><i class="ph ph-upload-simple"></i> 上传文件</button>
        <div class="file-type-tabs">${typeTabs.map((t) =>
          `<button class="file-type-tab ${p.type === t.key ? 'active' : ''}" data-t="${t.key}">${t.label}</button>`).join('')}</div>
        <span class="spacer"></span>
        <input type="search" id="media-q" placeholder="搜索文件名…" value="${esc(p.q || '')}" />
      </div>
      <div class="media-dropzone" id="dropzone">
        <div class="file-grid">${items || '<p class="form-hint" style="grid-column:1/-1;text-align:center;padding:30px 0">文件库为空，点击上传或拖拽文件到此处。</p>'}</div>
      </div>
      <p class="form-hint" style="margin-top:10px"><i class="ph ph-info"></i> 支持图片、文档、压缩包、音视频等，单文件不超过 20MB；可拖拽批量上传。</p>
      ${pagerHtml(d.total, d.page, d.pageSize)}
    </div>`;
  $('#upload-btn').onclick = async () => {
    const files = await pickLocalFiles({ accept: '*', multiple: true });
    await uploadFiles(files);
  };
  $('#content').querySelectorAll('[data-t]').forEach((btn) => {
    btn.onclick = () => { p.type = btn.dataset.t; p.page = 1; viewMedia(); };
  });
  $('#media-q').oninput = debounce((e) => { p.q = e.target.value.trim(); p.page = 1; viewMedia(); });
  const dz = $('#dropzone');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('dragover'); };
  dz.ondragleave = () => dz.classList.remove('dragover');
  dz.ondrop = async (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    await uploadFiles(Array.from(e.dataTransfer?.files || []));
  };
  $('#content').querySelectorAll('[data-copy]').forEach((btn) => {
    btn.onclick = async () => {
      const url = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(location.origin + url);
        toast('链接已复制');
      } catch {
        toast(url, true);
      }
    };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该文件？引用它的地方将无法显示。'))) return;
      const r2 = await api(`/api/admin/media/${btn.dataset.del}`, { method: 'DELETE' });
      if (r2.body?.code === 0) { toast('已删除'); viewMedia(); }
      else toast(r2.body?.message || '删除失败', false);
    };
  });
  $('#content').querySelectorAll('[data-pg]').forEach((btn) => {
    btn.onclick = () => { p.page = Number(btn.dataset.pg); viewMedia(); };
  });
}

async function uploadFiles(files) {
  if (!files || !files.length) return;
  let okCount = 0;
  for (const file of files) {
    if (file.size > UPLOAD_MAX) { toast(`${file.name} 超过 20MB，已跳过`, false); continue; }
    const fd = new FormData();
    fd.append('file', file);
    const r = await api('/api/admin/upload', { method: 'POST', body: fd });
    if (r.body?.code === 0) okCount++;
    else toast(`${file.name}：${r.body?.message || '上传失败'}`, false);
  }
  if (okCount) toast(`已上传 ${okCount} 个文件`);
  state.listParams.media = { ...(state.listParams.media || {}), page: 1 };
  viewMedia();
}

// ============================================================ 首页内容
const HOME_SECTION_LABELS = {
  hero: '首屏 Hero',
  categories: '特色商品',
  services: '服务项目',
  brands: '品牌一览',
  store: '厂家资讯',
};
const PAGE_CONTENT_LABELS = {
  home_story: '品牌故事（首页）',
  home_about: '工厂实力（首页）',
  contact_info: '联系信息（联系页/页脚）',
};

async function viewHomeContent() {
  renderModuleTitle('home-content');
  const [sectionsR, contentsR] = await Promise.all([
    api('/api/admin/home-sections'),
    api('/api/admin/page-contents'),
  ]);
  const sections = sectionsR.body?.data || [];
  const contents = contentsR.body?.data || [];
  $('#content').innerHTML = `
    <div class="card">
      <h3 class="form-section-title"><i class="ph ph-layout"></i> 首页区块</h3>
      <p class="form-hint" style="margin-bottom:16px">控制首页各展示区块的标题、条目、配图与启停，排序越小越靠前。</p>
      <div class="home-card-grid">
        ${sections.map((s) => `
          <div class="home-card ${s.is_active ? '' : 'off'}">
            <div class="home-card-head">
              <span class="home-card-name">${esc(HOME_SECTION_LABELS[s.key] || s.key)}</span>
              ${s.is_active ? '<span class="badge badge-green">启用</span>' : '<span class="badge badge-gray">停用</span>'}
            </div>
            <div class="home-card-title">${esc(s.title_zh || '-')}<br/><small class="cell-sub">${esc(s.title_en || '')}</small></div>
            <div class="home-card-foot">
              <span class="cell-sub">排序 ${s.sort_order} · ${(s.items || []).length} 个条目</span>
              <button class="btn btn-sm" data-edit-section="${esc(s.key)}">编辑</button>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3 class="form-section-title"><i class="ph ph-text-align-left"></i> 页面文案</h3>
      <p class="form-hint" style="margin-bottom:16px">首页品牌故事、工厂实力与联系页的富文案内容。</p>
      <div class="home-card-grid">
        ${Object.entries(PAGE_CONTENT_LABELS).map(([key, label]) => {
          const pc = contents.find((c) => c.key === key) || {};
          return `
            <div class="home-card">
              <div class="home-card-head"><span class="home-card-name">${esc(label)}</span></div>
              <div class="home-card-title"><small class="cell-sub">${esc(truncate((pc.content_zh || '').replace(/<[^>]+>/g, ''), 60) || '尚未填写')}</small></div>
              <div class="home-card-foot">
                <span class="cell-sub">${pc.updated_at ? `更新于 ${fmtDate(pc.updated_at)}` : ''}</span>
                <button class="btn btn-sm" data-edit-pc="${esc(key)}">编辑</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
  $('#content').querySelectorAll('[data-edit-section]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#home-content/section/${btn.dataset.editSection}`; };
  });
  $('#content').querySelectorAll('[data-edit-pc]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#home-content/content/${btn.dataset.editPc}`; };
  });
}

/** 首页区块条目编辑器（item 字段：title/subtitle/url/image） */
function homeItemHtml(it, idx) {
  return `
    <div class="home-item" data-ii="${idx}">
      <div class="home-item-head">
        <i class="ph ph-dots-six-vertical"></i> 条目 ${idx + 1}
        <span class="spacer" style="flex:1"></span>
        <button type="button" class="link-btn danger" data-del-item>删除条目</button>
      </div>
      <div class="home-item-grid">
        <label>标题（中）<input data-it="title_zh" value="${esc(it.title_zh || '')}" /></label>
        <label>标题（英）<input data-it="title_en" value="${esc(it.title_en || '')}" /></label>
        <label>副标题（中）<input data-it="subtitle_zh" value="${esc(it.subtitle_zh || '')}" /></label>
        <label>副标题（英）<input data-it="subtitle_en" value="${esc(it.subtitle_en || '')}" /></label>
        <label class="full">链接（如 /products 或完整网址）<input data-it="url" value="${esc(it.url || '')}" /></label>
      </div>
      <div class="home-item-upload">
        <div class="upload-field item-image-field" data-accept="image/*">
          <input type="hidden" data-it="image" value="${esc(it.image || '')}" />
          <div class="upload-preview">${it.image ? `<img src="${esc(it.image)}" alt="" />` : '<span class="upload-empty">未选择</span>'}</div>
          <div class="upload-actions">
            <button type="button" class="btn btn-sm" data-item-img>选择图片</button>
            <button type="button" class="btn btn-sm btn-ghost" data-item-img-clear ${it.image ? '' : 'hidden'}>清除</button>
          </div>
        </div>
      </div>
    </div>`;
}

function bindHomeItemImages(root) {
  root.querySelectorAll('.item-image-field').forEach((f) => {
    const hidden = f.querySelector('input[type="hidden"]');
    const preview = f.querySelector('.upload-preview');
    const clearBtn = f.querySelector('[data-item-img-clear]');
    const render = () => {
      preview.innerHTML = hidden.value ? `<img src="${esc(hidden.value)}" alt="" />` : '<span class="upload-empty">未选择</span>';
      if (clearBtn) clearBtn.hidden = !hidden.value;
    };
    f.querySelector('[data-item-img]').onclick = async () => {
      const url = await filePickerModal({ accept: 'image/*', multiple: false });
      if (!url) return;
      hidden.value = url;
      render();
    };
    if (clearBtn) clearBtn.onclick = () => { hidden.value = ''; render(); };
  });
}

async function editHomeSection(key) {
  renderModuleTitle('home-content');
  const r = await api('/api/admin/home-sections');
  const s = (r.body?.data || []).find((x) => x.key === key);
  if (!s) { toast('区块不存在', false); location.hash = '#home-content'; return; }

  const cfg = s.config || {};
  const knownKeys = ['button_text_zh', 'button_text_en', 'button_link'];
  const extraCfg = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (!knownKeys.includes(k)) extraCfg[k] = v;
  }

  const itemsHtml = (s.items || []).map((it, i) => homeItemHtml(it, i)).join('');
  $('#content').innerHTML = `
    <div class="card">
      <form class="form-grid" id="edit-form" novalidate>
        <div class="form-section-title"><i class="ph ph-layout"></i> 编辑区块：${esc(HOME_SECTION_LABELS[key] || key)}</div>
        <div class="form-row"><label>中文标题</label><input type="text" name="title_zh" value="${esc(s.title_zh || '')}" /></div>
        <div class="form-row"><label>英文标题</label><input type="text" name="title_en" value="${esc(s.title_en || '')}" /></div>
        <div class="form-row"><label>眉标（中）<span class="label-tip">标题上方小字</span></label><input type="text" name="eyebrow_zh" value="${esc(s.eyebrow_zh || '')}" /></div>
        <div class="form-row"><label>眉标（英）</label><input type="text" name="eyebrow_en" value="${esc(s.eyebrow_en || '')}" /></div>
        <div class="form-row"><label>排序（越小越靠前）</label><input type="number" name="sort_order" value="${esc(s.sort_order ?? 0)}" /></div>
        <div class="form-row checkbox-row" style="align-self:end"><label class="inline-check"><input type="checkbox" name="is_active" ${s.is_active ? 'checked' : ''} /> 在首页显示该区块</label></div>
        ${uploadFieldHtml('image', '区块配图（部分区块使用）', s.image || '', false)}
        <div class="form-row"><label>按钮文字（中）</label><input type="text" name="cfg_button_text_zh" value="${esc(cfg.button_text_zh || '')}" /></div>
        <div class="form-row"><label>按钮文字（英）</label><input type="text" name="cfg_button_text_en" value="${esc(cfg.button_text_en || '')}" /></div>
        <div class="form-row"><label>按钮链接</label><input type="text" name="cfg_button_link" value="${esc(cfg.button_link || '')}" placeholder="如 /contact" /></div>
        <div class="form-row"><label>扩展配置（JSON）</label><textarea class="code-input" name="cfg_extra" rows="2" spellcheck="false" placeholder='{"watermark":"WANXU"}'>${esc(Object.keys(extraCfg).length ? JSON.stringify(extraCfg, null, 2) : '')}</textarea><p class="form-hint">高级选项，留空即可；须为合法 JSON 对象</p></div>
        <div class="form-row full"><label>区块条目（服务/品牌等卡片）</label>
          <div class="items-list" id="items-list">${itemsHtml}</div>
          <button type="button" class="btn btn-sm" id="add-item" style="margin-top:10px"><i class="ph ph-plus"></i> 添加条目</button>
        </div>
        ${richEditorHtml('content_zh', '区块正文（中，部分区块使用）', s.content_zh || '')}
        ${richEditorHtml('content_en', '区块正文（英）', s.content_en || '')}
      </form>
      <div class="form-actions">
        <button type="button" class="btn" id="btn-back"><i class="ph ph-arrow-left"></i> 返回</button>
        <span style="flex:1"></span>
        <button type="submit" class="btn btn-primary" form="edit-form"><i class="ph ph-check"></i> 保存区块</button>
      </div>
    </div>`;

  $('#btn-back').onclick = () => { location.hash = '#home-content'; };
  bindRichEditors($('#content'));
  bindUploadFields($('#content'));
  bindHomeItemImages($('#content'));

  $('#add-item').onclick = () => {
    const idx = $('#items-list').children.length;
    $('#items-list').insertAdjacentHTML('beforeend', homeItemHtml({}, idx));
    const added = $('#items-list').lastElementChild;
    bindHomeItemImages(added);
    renumberHomeItems();
  };
  $('#items-list').addEventListener('click', (e) => {
    if (e.target.closest('[data-del-item]')) {
      e.target.closest('.home-item').remove();
      renumberHomeItems();
    }
  });

  $('#edit-form').onsubmit = async (e) => {
    e.preventDefault();
    finalizeRichEditors();
    const vals = formValues(e.target);
    // 校验扩展配置 JSON
    let extra = {};
    const extraRaw = (vals.cfg_extra || '').trim();
    if (extraRaw) {
      try {
        const parsed = JSON.parse(extraRaw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad');
        extra = parsed;
      } catch {
        toast('扩展配置不是合法的 JSON 对象', false);
        return;
      }
    }
    const config = { ...extra };
    if (vals.cfg_button_text_zh) config.button_text_zh = vals.cfg_button_text_zh;
    if (vals.cfg_button_text_en) config.button_text_en = vals.cfg_button_text_en;
    if (vals.cfg_button_link) config.button_link = vals.cfg_button_link;

    const items = $$('#items-list .home-item').map((el) => ({
      title_zh: el.querySelector('[data-it="title_zh"]').value.trim(),
      title_en: el.querySelector('[data-it="title_en"]').value.trim(),
      subtitle_zh: el.querySelector('[data-it="subtitle_zh"]').value.trim(),
      subtitle_en: el.querySelector('[data-it="subtitle_en"]').value.trim(),
      url: el.querySelector('[data-it="url"]').value.trim(),
      image: el.querySelector('[data-it="image"]').value,
    }));

    const body = {
      title_zh: vals.title_zh,
      title_en: vals.title_en,
      eyebrow_zh: vals.eyebrow_zh,
      eyebrow_en: vals.eyebrow_en,
      content_zh: vals.content_zh,
      content_en: vals.content_en,
      image: vals.image,
      sort_order: Number(vals.sort_order) || 0,
      is_active: vals.is_active === '1' ? 1 : 0,
      items,
      config,
    };
    const r2 = await api(`/api/admin/home-sections/${key}`, { method: 'PUT', body });
    if (r2.body?.code === 0) { toast('区块已保存'); location.hash = '#home-content'; }
    else handleSaveError(r2, e.target);
  };
}

function renumberHomeItems() {
  $$('#items-list .home-item').forEach((el, i) => {
    const head = el.querySelector('.home-item-head');
    if (head) head.innerHTML = `<i class="ph ph-dots-six-vertical"></i> 条目 ${i + 1}<span class="spacer" style="flex:1"></span><button type="button" class="link-btn danger" data-del-item>删除条目</button>`;
  });
}

async function editPageContent(key) {
  renderModuleTitle('home-content');
  const r = await api('/api/admin/page-contents');
  const pc = (r.body?.data || []).find((c) => c.key === key) || {};
  buildFormPage({
    backTo: '#home-content',
    saveText: '保存文案',
    fields: `
      <div class="form-section-title"><i class="ph ph-text-align-left"></i> 编辑文案：${esc(PAGE_CONTENT_LABELS[key] || key)}</div>
      ${uploadFieldHtml('image', '配图', pc.image || '', false)}
      <div class="form-row"></div>
      ${richEditorHtml('content_zh', '中文内容', pc.content_zh || '')}
      ${richEditorHtml('content_en', '英文内容', pc.content_en || '')}
    `,
    onSave: async (vals, form) => {
      const body = { content_zh: vals.content_zh, content_en: vals.content_en, image: vals.image };
      const r2 = await api(`/api/admin/page-contents/${key}`, { method: 'PUT', body });
      if (r2.body?.code === 0) { toast('文案已保存'); location.hash = '#home-content'; }
      else handleSaveError(r2, form);
    },
  });
}

// ============================================================ 导航管理
async function viewNav() {
  renderModuleTitle('navigation');
  const r = await api('/api/admin/nav');
  const list = r.body?.data || [];
  const byParent = (pid) => list.filter((n) => (n.parent_id || 0) === pid).sort((a, b) => a.sort_order - b.sort_order);

  const rowHtml = (n, siblings, depth) => `
    <li class="nav-row ${n.is_active ? '' : 'off'}">
      <span class="nav-label">${esc(n.label_zh)} <small class="cell-sub">/ ${esc(n.label_en)}</small></span>
      <span class="nav-url">${esc(n.url)}</span>
      ${n.is_active ? '' : '<span class="badge badge-gray">停用</span>'}
      <span class="table-actions" style="margin-left:auto">
        <button class="link-btn" data-move="${n.id}" data-dir="up" data-group="${siblings.map((x) => x.id).join(',')}" ${siblings[0]?.id === n.id ? 'disabled' : ''} title="上移"><i class="ph ph-caret-up"></i></button>
        <button class="link-btn" data-move="${n.id}" data-dir="down" data-group="${siblings.map((x) => x.id).join(',')}" ${siblings[siblings.length - 1]?.id === n.id ? 'disabled' : ''} title="下移"><i class="ph ph-caret-down"></i></button>
        <button class="link-btn" data-edit="${n.id}">编辑</button>
        ${depth === 0 ? `<button class="link-btn" data-add-child="${n.id}">加子项</button>` : ''}
        <button class="link-btn danger" data-del="${n.id}">删除</button>
      </span>
    </li>`;

  const buildTree = (pid, depth) => {
    const children = byParent(pid);
    if (!children.length) return '';
    return `<ul>${children.map((c) => rowHtml(c, children, depth) + buildTree(c.id, depth + 1)).join('')}</ul>`;
  };

  const top = byParent(0);
  $('#content').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <button class="btn btn-primary" id="btn-new"><i class="ph ph-plus"></i> 新建导航</button>
        <span class="spacer"></span>
        <span class="form-hint">链接支持站内路径（/开头）与完整 http(s) 地址</span>
      </div>
      <ul class="nav-tree">${top.map((n) => rowHtml(n, top, 0) + buildTree(n.id, 1)).join('') || '<p class="form-hint">暂无导航项。</p>'}</ul>
    </div>`;

  $('#btn-new').onclick = () => { location.hash = '#navigation/new'; };
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#navigation/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-add-child]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#navigation/new?parent=${btn.dataset.addChild}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该导航项？其子项也会被移除。'))) return;
      await api(`/api/admin/nav/${btn.dataset.del}`, { method: 'DELETE' });
      toast('已删除');
      viewNav();
    };
  });
  $('#content').querySelectorAll('[data-move]').forEach((btn) => {
    btn.onclick = async () => {
      const ids = btn.dataset.group.split(',').map(Number);
      const idx = ids.indexOf(Number(btn.dataset.move));
      const swapWith = btn.dataset.dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= ids.length) return;
      [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
      await api('/api/admin/nav/reorder', { method: 'PUT', body: { ids } });
      viewNav();
    };
  });
}

async function editNav(id) {
  renderModuleTitle('navigation');
  const listR = await api('/api/admin/nav');
  const all = listR.body?.data || [];
  let data = {};
  if (id !== 'new') {
    // 后端无 GET /nav/:id 单条接口，直接从列表中查找
    const found = all.find((n) => Number(n.id) === Number(id));
    if (!found) { toast('导航项不存在', false); location.hash = '#navigation'; return; }
    data = found;
  }
  const presetParent = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('parent')) || 0;
  const parentId = id === 'new' ? presetParent : (data.parent_id || 0);
  const parentOptions = [{ id: 0, label_zh: '（顶级导航）' }, ...all.filter((n) => !n.parent_id && n.id !== Number(id))]
    .map((n) => `<option value="${n.id}" ${Number(parentId) === Number(n.id) ? 'selected' : ''}>${esc(n.label_zh)}</option>`).join('');

  buildFormPage({
    backTo: '#navigation',
    onDelete: id !== 'new' ? async () => {
      await api(`/api/admin/nav/${id}`, { method: 'DELETE' });
      toast('已删除');
      location.hash = '#navigation';
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-list"></i> ${id === 'new' ? '新建导航' : '编辑导航'}</div>
      <div class="form-row"><label>父级</label><select name="parent_id">${parentOptions}</select></div>
      <div class="form-row"><label>排序</label><input type="number" name="sort_order" value="${esc(data.sort_order ?? 0)}" /></div>
      <div class="form-row"><label>中文标签 <em>*</em></label><input type="text" name="label_zh" value="${esc(data.label_zh || '')}" required /></div>
      <div class="form-row"><label>英文标签 <em>*</em></label><input type="text" name="label_en" value="${esc(data.label_en || '')}" required /></div>
      <div class="form-row full"><label>链接地址 <em>*</em></label><input type="text" name="url" value="${esc(data.url || '')}" required placeholder="/products 或 https://…" /></div>
      <div class="form-row checkbox-row"><label class="inline-check"><input type="checkbox" name="is_active" ${data.is_active !== 0 ? 'checked' : ''} /> 启用</label></div>
    `,
    onSave: async (vals, form) => {
      const body = {
        ...vals,
        parent_id: Number(vals.parent_id) || 0,
        sort_order: Number(vals.sort_order) || 0,
        is_active: vals.is_active === '1' ? 1 : 0,
      };
      const r = id === 'new'
        ? await api('/api/admin/nav', { method: 'POST', body })
        : await api(`/api/admin/nav/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#navigation'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 站点设置
async function viewSettings() {
  renderModuleTitle('settings');
  const r = await api('/api/admin/settings');
  const s = r.body?.data || {};
  state.devOriginal = {
    dev_name: s.dev_name || '',
    dev_url: s.dev_url || '',
    dev_tel: s.dev_tel || '',
    dev_mail: s.dev_mail || '',
    dev_wechat: s.dev_wechat || '',
    dev_wechat_qr: s.dev_wechat_qr || '',
  };

  const row = (key, label, type = 'text', placeholder = '', hint = '') =>
    `<div class="form-row"><label>${esc(label)}</label><input type="${type}" name="${esc(key)}" value="${esc(s[key] || '')}" placeholder="${esc(placeholder)}" />${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}</div>`;
  const check = (key, label, hint = '') =>
    `<div class="form-row"><label class="inline-check"><input type="checkbox" name="${esc(key)}" ${s[key] === '1' ? 'checked' : ''} /> ${esc(label)}</label>${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}</div>`;
  const area = (key, label, rows = 3, hint = '') =>
    `<div class="form-row full"><label>${esc(label)}</label><textarea name="${esc(key)}" rows="${rows}">${esc(s[key] || '')}</textarea>${hint ? `<p class="form-hint">${esc(hint)}</p>` : ''}</div>`;
  const color = (key, label) => `
    <div class="form-row"><label>${esc(label)}</label>
      <div class="color-row">
        <input type="color" data-color-picker="${esc(key)}" value="${esc(s[key] || '#2c3e35')}" />
        <input type="text" name="${esc(key)}" value="${esc(s[key] || '')}" placeholder="#2c3e35" />
      </div>
    </div>`;
  const sectionTitle = (icon, text, hint = '') =>
    `<div class="form-section-title"><i class="ph ${icon}"></i> ${esc(text)}</div>${hint ? `<p class="form-section-hint">${esc(hint)}</p>` : ''}`;

  let partnersLogosText = '';
  try {
    const arr = JSON.parse(s.partners_logos || '[]');
    if (Array.isArray(arr)) partnersLogosText = arr.join('\n');
  } catch { partnersLogosText = s.partners_logos || ''; }

  $('#content').innerHTML = `
    <form class="settings-grid" id="settings-form" novalidate>
      ${sectionTitle('ph-storefront', '品牌基础')}
      ${row('site_name', '站点名称（英文/默认）')}
      ${row('site_name_zh', '站点名称（中文）', 'text', '留空时中文站回退使用上方名称')}
      ${row('favicon', 'Favicon 地址', 'text', '/favicon.svg')}
      ${row('site_slogan_zh', '品牌口号（中）')}
      ${row('site_slogan_en', '品牌口号（英）')}
      ${uploadFieldHtml('logo_image', '站点 Logo（英文/默认）', s.logo_image || '', false)}
      ${uploadFieldHtml('logo_image_zh', '站点 Logo（中文）', s.logo_image_zh || '', false, '留空时中文站回退使用上方 Logo')}
      <div class="form-row"></div>
      ${color('primary_color', '主色')}
      ${color('accent_color', '强调色')}
      ${area('footer_text_zh', '页脚简介（中）', 2)}
      ${area('footer_text_en', '页脚简介（英）', 2)}

      ${sectionTitle('ph-image', '首页首屏（Hero）')}
      ${row('hero_brand_zh', '首屏品牌名（中）')}
      ${row('hero_brand_en', '首屏品牌名（英）')}
      ${row('hero_cta_zh', '首屏按钮文字（中）')}
      ${row('hero_cta_en', '首屏按钮文字（英）')}
      ${row('hero_cta_link', '首屏按钮链接', 'text', '/products')}

      ${sectionTitle('ph-address-book', '联系信息', '将展示在联系页与页脚。')}
      ${row('contact_email', '联系邮箱')}
      ${row('contact_phone', '国内电话')}
      ${row('contact_overseas_phone', '海外电话')}
      ${row('contact_whatsapp', 'WhatsApp（国际格式号码）')}
      ${row('contact_wechat', '微信号')}
      ${row('contact_working_hours_zh', '工作时间（中）')}
      ${row('contact_working_hours_en', '工作时间（英）')}
      <div class="form-row"></div>
      ${row('contact_address_zh', '地址（中）')}
      ${row('contact_address_en', '地址（英）')}
      ${row('contact_custom_1_label_zh', '自定义联系1 名称（中）', 'text', '如：QQ')}
      ${row('contact_custom_1_label_en', '自定义联系1 名称（英）')}
      ${row('contact_custom_1_value', '自定义联系1 内容')}
      <div class="form-row"></div>
      ${row('contact_custom_2_label_zh', '自定义联系2 名称（中）')}
      ${row('contact_custom_2_label_en', '自定义联系2 名称（英）')}
      ${row('contact_custom_2_value', '自定义联系2 内容')}
      <div class="form-row"></div>

      ${sectionTitle('ph-share-network', '社交账号', '填写完整 http(s) 地址，留空则不显示。')}
      ${row('social_facebook', 'Facebook', 'text', 'https://')}
      ${row('social_instagram', 'Instagram', 'text', 'https://')}
      ${row('social_linkedin', 'LinkedIn', 'text', 'https://')}
      ${row('social_twitter', 'Twitter / X', 'text', 'https://')}
      ${row('social_youtube', 'YouTube', 'text', 'https://')}

      ${sectionTitle('ph-magnifying-glass', 'SEO 默认值')}
      ${row('seo_default_title_zh', '默认标题（中）')}
      ${row('seo_default_title_en', '默认标题（英）')}
      ${area('seo_default_description_zh', '默认描述（中）', 2)}
      ${area('seo_default_description_en', '默认描述（英）', 2)}

      ${sectionTitle('ph-users-three', '合作伙伴 Logo 墙', '每行一个图片地址，将展示在合作伙伴页面。')}
      <div class="form-row full"><label>Logo 地址列表</label><textarea name="partners_logos_text" rows="4" placeholder="/media/uploads/2026/09/logo-1.png">${esc(partnersLogosText)}</textarea><p class="form-hint">可先到「文件管理」上传 Logo，再复制地址粘贴到此处，每行一个</p></div>

      ${sectionTitle('ph-file-text', '备案信息')}
      ${row('icp_number', '备案号', 'text', '如：粤ICP备12345678号')}
      ${check('icp_enabled', '在页脚显示备案号')}

      ${sectionTitle('ph-envelope-simple', '询盘邮件通知（SMTP）', '配置后，新询盘将发送邮件通知到指定邮箱。')}
      ${check('smtp_enabled', '启用 SMTP 发信')}
      ${check('smtp_notify_enabled', '新询盘时发送邮件通知')}
      ${row('inquiry_recipient', '询盘通知接收邮箱')}
      <div class="form-row"></div>
      ${row('smtp_host', 'SMTP 主机', 'text', '如：smtp.exmail.qq.com')}
      ${row('smtp_port', 'SMTP 端口', 'number', '465')}
      ${row('smtp_user', 'SMTP 用户名')}
      ${row('smtp_pass', 'SMTP 密码', 'password', '', '留空则不修改')}
      ${row('smtp_from', '发件人地址')}
      ${row('smtp_from_name', '发件人名称')}

      ${sectionTitle('ph-code', '第三方代码', '将注入全站 <head>，可用于统计/验证代码。')}
      ${area('head_code', '全局 <head> 代码', 3)}

      ${sectionTitle('ph-identification-card', '开发者信息', '修改本组任意字段需要回答开发者验证问题。')}
      ${row('dev_name', '开发者名称')}
      ${row('dev_url', '开发者博客/网站')}
      ${row('dev_tel', '开发者电话')}
      ${row('dev_mail', '开发者邮箱')}
      ${row('dev_wechat', '开发者微信')}
      ${uploadFieldHtml('dev_wechat_qr', '开发者微信二维码', s.dev_wechat_qr || '', false)}

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="settings-save"><i class="ph ph-check"></i> 保存设置</button>
      </div>
    </form>`;

  bindUploadFields($('#content'));
  // 颜色选择器联动
  $$('#settings-form [data-color-picker]').forEach((picker) => {
    const text = $(`#settings-form input[name="${picker.dataset.colorPicker}"]`);
    picker.oninput = () => { text.value = picker.value; };
    text.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value; };
  });

  $('#settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = formValues(form);
    if (!data.smtp_pass) delete data.smtp_pass;
    // 合作伙伴 Logo：每行一个 → JSON 数组
    const logoLines = String(data.partners_logos_text || '')
      .split('\n').map((x) => x.trim()).filter(Boolean);
    delete data.partners_logos_text;
    data.partners_logos = JSON.stringify(logoLines);

    // 开发者信息变更检测
    const devKeys = Object.keys(state.devOriginal);
    const devChanged = devKeys.some((k) => (data[k] || '') !== (state.devOriginal[k] || ''));
    if (devChanged) {
      const answer = await ensureDevChallenge();
      if (answer === null) return;
      if (answer) data.answer = answer;
    }

    const btn = $('#settings-save');
    btn.disabled = true;
    const r2 = await api('/api/admin/settings', { method: 'PUT', body: data });
    btn.disabled = false;
    if (r2.body?.code === 0) {
      toast('设置已保存');
      state.devOriginal = {
        dev_name: data.dev_name || '',
        dev_url: data.dev_url || '',
        dev_tel: data.dev_tel || '',
        dev_mail: data.dev_mail || '',
        dev_wechat: data.dev_wechat || '',
        dev_wechat_qr: data.dev_wechat_qr || '',
      };
      const siteR = await api('/api/site');
      state.siteInfo = siteR.body?.data || state.siteInfo;
    } else {
      handleSaveError(r2, form);
    }
  };
}

// ============================================================ 管理员与权限
async function viewAdmins() {
  renderModuleTitle('admins');
  const r = await api('/api/admin/admins');
  const rows = (r.body?.data || []).map((a) => `
    <tr>
      <td><strong>${esc(a.username)}</strong>${a.username === state.admin?.username ? ' <span class="badge badge-blue">当前账号</span>' : ''}</td>
      <td><small class="cell-sub">${esc(a.email || '-')}</small></td>
      <td>${ROLE_NAMES[a.role] || a.role}</td>
      <td><small class="cell-sub">${fmtDate(a.created_at)}</small></td>
      <td class="table-actions">
        <button class="link-btn" data-edit="${a.id}">编辑</button>
        <button class="link-btn danger" data-del="${a.id}">删除</button>
      </td>
    </tr>`).join('');
  $('#content').innerHTML = `
    <div class="role-info-card">
      <div class="role-info-title"><i class="ph ph-shield-check"></i> 角色权限说明</div>
      <div class="role-info-grid">
        ${Object.entries(ROLE_NAMES).map(([role, name]) => `
          <div class="role-info-item">
            <div class="role-info-name">${esc(name)}</div>
            <div class="role-info-desc">${esc(ROLE_DESCS[role])}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="toolbar">
        <button class="btn btn-primary" id="btn-new"><i class="ph ph-plus"></i> 新建管理员</button>
      </div>
      <table class="data-table">
        <thead><tr><th>用户名</th><th style="min-width:180px">邮箱</th><th style="width:130px">角色</th><th style="width:130px">创建时间</th><th style="width:130px">操作</th></tr></thead>
        <tbody>${rows || '<tr class="empty-row"><td colspan="99"><i class="ph ph-tray"></i>暂无数据</td></tr>'}</tbody>
      </table>
    </div>`;
  $('#btn-new').onclick = () => { location.hash = '#admins/new'; };
  $('#content').querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#admins/edit/${btn.dataset.edit}`; };
  });
  $('#content').querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!(await confirmDialog('确定删除该管理员？'))) return;
      const r2 = await api(`/api/admin/admins/${btn.dataset.del}`, { method: 'DELETE' });
      if (r2.body?.code === 0) { toast('已删除'); viewAdmins(); }
      else toast(r2.body?.message || '删除失败', false);
    };
  });
}

async function editAdmin(id) {
  renderModuleTitle('admins');
  let data = {};
  if (id !== 'new') {
    // 后端无 GET /admins/:id 单条接口，从列表中查找
    const listR = await api('/api/admin/admins');
    const found = (listR.body?.data || []).find((a) => Number(a.id) === Number(id));
    if (!found) { toast('管理员不存在', false); location.hash = '#admins'; return; }
    data = found;
  }
  buildFormPage({
    backTo: '#admins',
    onDelete: id !== 'new' ? async () => {
      const r = await api(`/api/admin/admins/${id}`, { method: 'DELETE' });
      if (r.body?.code === 0) { toast('已删除'); location.hash = '#admins'; }
      else toast(r.body?.message || '删除失败', false);
    } : null,
    fields: `
      <div class="form-section-title"><i class="ph ph-user-gear"></i> ${id === 'new' ? '新建管理员' : '编辑管理员'}</div>
      <div class="form-row"><label>用户名 <em>*</em></label><input type="text" name="username" value="${esc(data.username || '')}" required autocomplete="off" /></div>
      <div class="form-row"><label>邮箱 <em>*</em></label><input type="email" name="email" value="${esc(data.email || '')}" required autocomplete="email" placeholder="name@example.com" /></div>
      <div class="form-row"><label>角色 <em>*</em></label>
        <select name="role">
          <option value="super_admin" ${data.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
          <option value="admin" ${data.role === 'admin' ? 'selected' : ''}>管理员</option>
          <option value="editor" ${!data.role || data.role === 'editor' ? 'selected' : ''}>编辑</option>
        </select>
      </div>
      <div class="form-row full"><label>密码${id === 'new' ? ' <em>*</em>（至少 8 位）' : '（留空保持不变）'}</label><input type="password" name="password" ${id === 'new' ? 'required' : ''} minlength="8" autocomplete="new-password" /></div>
      <p class="role-hint full">提示：邮箱用于密码找回；系统至少保留一位超级管理员；不能删除当前登录账号。</p>
    `,
    onSave: async (vals, form) => {
      const body = { ...vals };
      if (!body.password) delete body.password;
      const r = id === 'new'
        ? await api('/api/admin/admins', { method: 'POST', body })
        : await api(`/api/admin/admins/${id}`, { method: 'PUT', body });
      if (r.body?.code === 0) { toast('已保存'); location.hash = '#admins'; }
      else handleSaveError(r, form);
    },
  });
}

// ============================================================ 路由分发
const LIST_VIEWS = {
  dashboard: viewDashboard,
  categories: viewCategories,
  products: viewProducts,
  articles: viewArticles,
  pages: viewPages,
  banners: viewBanners,
  tags: viewTags,
  inquiries: viewInquiries,
  media: viewMedia,
  navigation: viewNav,
  'home-content': viewHomeContent,
  settings: viewSettings,
  admins: viewAdmins,
};

const EDIT_VIEWS = {
  categories: editCategory,
  products: editProduct,
  articles: editArticle,
  pages: editPage,
  banners: editBanner,
  tags: editTag,
  navigation: editNav,
  admins: editAdmin,
};

async function route() {
  const hash = (location.hash || '').replace(/^#/, '');
  const [rawModule, action, id] = hash.split('/');
  const base = (rawModule || 'dashboard').split('?')[0];

  // 公开路由（无需登录）：找回密码 / 重置密码
  if (base === 'forgot-password') {
    renderForgotPassword();
    return;
  }
  if (base === 'reset-password') {
    const token = new URLSearchParams(hash.split('?')[1] || '').get('token') || '';
    renderResetPassword(token);
    return;
  }

  if (!state.admin) {
    const ok = await checkLogin();
    if (!ok) { renderLogin(); return; }
  }
  if (hash === 'login') {
    location.hash = '#dashboard';
    return;
  }
  if (!$('.admin-shell')) renderShell();

  if (!canAccess(base)) {
    setActiveNav('dashboard');
    $('#content').innerHTML = `
      <div class="card deny-card">
        <i class="ph ph-lock"></i>
        <h3>权限不足</h3>
        <p>当前角色（${ROLE_NAMES[state.admin?.role] || '-'}）无权访问该模块。</p>
        <a href="#dashboard" class="btn">返回仪表盘</a>
      </div>`;
    renderModuleTitle('dashboard');
    return;
  }

  setActiveNav(base);
  RICH_EDITORS.length = 0;

  try {
    if (base === 'home-content' && action === 'section' && id) await editHomeSection(id);
    else if (base === 'home-content' && action === 'content' && id) await editPageContent(id);
    else if (EDIT_VIEWS[base] && action) await EDIT_VIEWS[base](id || 'new');
    else if (LIST_VIEWS[base]) await LIST_VIEWS[base]();
    else await viewDashboard();
  } catch (e) {
    if (e.unauthorized) return;
    console.error(e);
    $('#content').innerHTML = `
      <div class="card deny-card">
        <i class="ph ph-warning-circle"></i>
        <h3>加载失败</h3>
        <p>${esc(e.message || '网络或服务异常，请稍后重试。')}</p>
        <button class="btn" onclick="location.reload()">刷新页面</button>
      </div>`;
  }
}

// ============================================================ 启动
// 路由串行化：连续触发 hashchange 时按顺序执行，避免异步视图互相覆盖（后到 hash 最终生效）
let routeChain = Promise.resolve();
function scheduleRoute() {
  routeChain = routeChain.then(() => route()).catch((e) => console.error('Route failed', e));
  return routeChain;
}

async function init() {
  try {
    const site = await api('/api/site');
    state.siteInfo = site.body?.data || {};
  } catch { /* 站点信息加载失败不阻塞 */ }
  window.addEventListener('hashchange', scheduleRoute);
  await scheduleRoute();
}

init().catch((e) => console.error('Admin init failed', e));
