/* ============================================================
   wanxu-cms 前台交互：轮播、移动菜单、产品图集、询盘表单
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initLoader();
    initMobileMenu();
    initSearch();
    initCarousel();
    initGallery();
    initLightbox();
    initSpecSelect();
    initInquiryForm();
    initReveal();
    initCopyable();
  });

  /* ------------------------------------------------ 页面加载动画 */
  function initLoader() {
    var loader = document.getElementById('page-loader');
    if (!loader) return;
    function hide() {
      loader.classList.add('hidden');
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 600);
    }
    // 不等 window.load（图片不阻塞首屏），DOM 就绪后短暂展示即收起
    setTimeout(hide, 350);
  }

  /* ------------------------------------------------ 滚动触发特效 */
  function initReveal() {
    var els = document.querySelectorAll('[data-anim]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------ 移动端菜单 */
  function initMobileMenu() {
    var toggle = document.getElementById('nav-toggle');
    var header = document.getElementById('site-header');
    var nav = document.getElementById('main-nav');
    if (!toggle || !header || !nav) return;
    toggle.addEventListener('click', function () {
      // 同步两处状态：nav.open 控制展开动画，header.nav-open 控制汉堡按钮变 X
      var open = nav.classList.toggle('open');
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // 点击导航链接后收起
    nav.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'A') {
        nav.classList.remove('open');
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* --------------------------------------------------- 全站搜索弹窗 */
  function initSearch() {
    var toggle = document.getElementById('search-toggle');
    var modal = document.getElementById('search-modal');
    var overlay = document.getElementById('search-modal-overlay');
    var closeBtn = document.getElementById('search-modal-close');
    var input = document.getElementById('search-input');
    var status = document.getElementById('search-status');
    var results = document.getElementById('search-results');
    if (!toggle || !modal || !input || !results) return;

    var labels = {
      loading: modal.getAttribute('data-loading') || 'Searching…',
      noResults: modal.getAttribute('data-no-results') || 'No results found.',
      products: modal.getAttribute('data-group-products') || 'Products',
      articles: modal.getAttribute('data-group-articles') || 'Articles',
      pages: modal.getAttribute('data-group-pages') || 'Pages',
    };

    var abortController = null;
    var debounceTimer = null;

    function open() {
      modal.hidden = false;
      document.body.classList.add('search-open');
      input.value = '';
      status.textContent = '';
      results.innerHTML = '';
      setTimeout(function () { input.focus(); }, 50);
      // 打开搜索时收起移动菜单
      var nav = document.getElementById('main-nav');
      var header = document.getElementById('site-header');
      var navToggle = document.getElementById('nav-toggle');
      if (nav && header) {
        nav.classList.remove('open');
        header.classList.remove('nav-open');
      }
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }

    function close() {
      modal.hidden = true;
      document.body.classList.remove('search-open');
      if (abortController) abortController.abort();
      abortController = null;
    }

    function langFromPath() {
      var m = window.location.pathname.match(/^\/(zh|en)\b/);
      return m ? m[1] : 'en';
    }

    function render(items) {
      results.innerHTML = '';
      if (!items || !items.length) {
        status.textContent = labels.noResults;
        return;
      }
      status.textContent = '';
      var groups = { product: [], article: [], page: [] };
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (groups[it.type]) groups[it.type].push(it);
      }
      var groupMeta = [
        { key: 'product', label: labels.products },
        { key: 'article', label: labels.articles },
        { key: 'page', label: labels.pages },
      ];
      for (var g = 0; g < groupMeta.length; g++) {
        var key = groupMeta[g].key;
        var list = groups[key];
        if (!list.length) continue;
        var section = document.createElement('div');
        section.className = 'search-group';
        var h = document.createElement('h4');
        h.textContent = groupMeta[g].label;
        section.appendChild(h);
        var ul = document.createElement('ul');
        ul.className = 'search-group-list';
        for (var j = 0; j < list.length; j++) {
          var it = list[j];
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = it.url;
          a.className = 'search-result-item';
          var imgHtml = it.image ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" />' : '<span class="search-result-noimg"></span>';
          a.innerHTML = '<span class="search-result-media">' + imgHtml + '</span>' +
            '<span class="search-result-body">' +
            '<span class="search-result-title">' + esc(it.title) + '</span>' +
            '<span class="search-result-summary">' + esc(it.summary) + '</span>' +
            '</span>';
          li.appendChild(a);
          ul.appendChild(li);
        }
        section.appendChild(ul);
        results.appendChild(section);
      }
    }

    function esc(s) {
      return (s || '').replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function doSearch() {
      var q = input.value.trim();
      if (!q) {
        status.textContent = '';
        results.innerHTML = '';
        return;
      }
      if (abortController) abortController.abort();
      abortController = new AbortController();
      status.textContent = labels.loading;
      fetch('/api/search?q=' + encodeURIComponent(q) + '&lang=' + langFromPath(), {
        signal: abortController.signal,
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (json && json.code === 0 && json.data) {
            render(json.data.results);
          } else {
            render([]);
          }
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          status.textContent = labels.noResults;
        });
    }

    toggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
    input.addEventListener('input', function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 250);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (debounceTimer) clearTimeout(debounceTimer);
        doSearch();
      }
    });
    // 点击结果后关闭弹窗
    results.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a) close();
    });
  }

  /* --------------------------------------------------- 轮播 */
  function initCarousel() {
    var hero = document.getElementById('hero-carousel');
    if (!hero) return;
    var slides = hero.querySelectorAll('.hero-slide');
    if (slides.length <= 1) return;
    var dots = hero.querySelectorAll('[data-carousel-dot]');
    var prevBtn = hero.querySelector('[data-carousel-prev]');
    var nextBtn = hero.querySelector('[data-carousel-next]');
    var current = 0;
    var timer = null;

    function show(i) {
      current = (i + slides.length) % slides.length;
      for (var k = 0; k < slides.length; k++) {
        slides[k].classList.toggle('active', k === current);
      }
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('active', d === current);
      }
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(function () {
        show(current + 1);
      }, 6000);
    }

    function stopAuto() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        show(current - 1);
        startAuto();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        show(current + 1);
        startAuto();
      });
    }
    for (var i = 0; i < dots.length; i++) {
      (function (idx) {
        dots[idx].addEventListener('click', function () {
          show(idx);
          startAuto();
        });
      })(i);
    }
    hero.addEventListener('mouseenter', stopAuto);
    hero.addEventListener('mouseleave', startAuto);
    startAuto();
  }

  /* ---------------------------------------------- 产品图集 */
  function initGallery() {
    var gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    var main = document.getElementById('gallery-main-img');
    if (!main) return;
    var thumbs = gallery.querySelectorAll('[data-thumb]');
    for (var i = 0; i < thumbs.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          main.src = btn.getAttribute('data-thumb');
          for (var k = 0; k < thumbs.length; k++) {
            thumbs[k].classList.toggle('active', thumbs[k] === btn);
          }
        });
      })(thumbs[i]);
    }
  }

  /* ---------------------------------------------- 图片放大灯箱
     点击主图或"放大"按钮打开；支持 ‹ › 切换、Esc/背景点击关闭、方向键导航 */
  function initLightbox() {
    var gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    var main = document.getElementById('gallery-main-img');
    if (!main) return;

    // 收集原图列表（缩略图 data-thumb，单图退化为当前主图）
    function sources() {
      var out = [];
      var thumbs = gallery.querySelectorAll('[data-thumb]');
      if (thumbs.length) {
        for (var i = 0; i < thumbs.length; i++) out.push(thumbs[i].getAttribute('data-thumb'));
      } else {
        out.push(main.getAttribute('src'));
      }
      return out;
    }

    var lb = null, img = null, counter = null, idx = 0, imgs = [];

    function build() {
      lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.innerHTML =
        '<button type="button" class="lb-close" aria-label="' + escAttr(gallery.getAttribute('data-lbl-close') || 'Close') + '">&times;</button>' +
        '<button type="button" class="lb-nav lb-prev" aria-label="' + escAttr(gallery.getAttribute('data-lbl-prev') || 'Previous') + '">&#8249;</button>' +
        '<img class="lb-img" alt="" />' +
        '<button type="button" class="lb-nav lb-next" aria-label="' + escAttr(gallery.getAttribute('data-lbl-next') || 'Next') + '">&#8250;</button>' +
        '<div class="lb-counter"></div>';
      document.body.appendChild(lb);
      img = lb.querySelector('.lb-img');
      counter = lb.querySelector('.lb-counter');
      lb.querySelector('.lb-close').addEventListener('click', close);
      lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
      lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    }

    function escAttr(s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function show(i) {
      if (!imgs.length) return;
      idx = (i + imgs.length) % imgs.length;
      img.src = imgs[idx];
      counter.textContent = (idx + 1) + ' / ' + imgs.length;
      var multi = imgs.length > 1;
      lb.querySelector('.lb-prev').hidden = !multi;
      lb.querySelector('.lb-next').hidden = !multi;
      counter.hidden = !multi;
    }

    function open() {
      imgs = sources();
      if (!imgs.length) return;
      if (!lb) build();
      lb.classList.add('open');
      document.body.classList.add('lb-lock');
      document.addEventListener('keydown', onKey);
      var cur = main.getAttribute('src');
      var at = imgs.indexOf(cur);
      show(at >= 0 ? at : 0);
    }

    function close() {
      if (!lb) return;
      lb.classList.remove('open');
      document.body.classList.remove('lb-lock');
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (!lb || !lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    }

    // 点击主图或放大按钮都打开灯箱
    main.style.cursor = 'zoom-in';
    main.addEventListener('click', open);
    var zoomBtn = gallery.querySelector('.gallery-zoom');
    if (zoomBtn) zoomBtn.addEventListener('click', open);
  }

  /* ---------------------------------------------- 规格选择（尺寸/颜色 chip 多选）
     选中状态实时汇总到 .spec-selected，并把选择追加到询盘按钮链接（specs 参数） */
  function initSpecSelect() {
    var info = document.querySelector('.product-info');
    if (!info) return;
    var chips = info.querySelectorAll('[data-spec-select]');
    var summary = info.querySelector('.spec-selected');
    var btn = info.querySelector('[data-inquiry-btn]');
    if (chips.length === 0) return;

    function selected(group) {
      var out = [];
      var sel = info.querySelectorAll('[data-spec-select="' + group + '"].selected');
      for (var i = 0; i < sel.length; i++) out.push(sel[i].getAttribute('data-value'));
      return out;
    }

    function refresh() {
      var sizes = selected('size');
      var colors = selected('color');
      var parts = [];
      if (summary) {
        if (sizes.length) parts.push(summary.getAttribute('data-size-label') + ': ' + sizes.join(', '));
        if (colors.length) parts.push(summary.getAttribute('data-color-label') + ': ' + colors.join(', '));
        summary.hidden = parts.length === 0;
        summary.textContent = parts.length
          ? summary.getAttribute('data-selected-label') + ' — ' + parts.join('  |  ')
          : '';
      }
      if (btn) {
        var url = btn.getAttribute('data-href');
        if (parts.length) url += '&specs=' + encodeURIComponent(parts.join(' | '));
        btn.setAttribute('href', url);
      }
    }

    for (var i = 0; i < chips.length; i++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          chip.classList.toggle('selected');
          refresh();
        });
      })(chips[i]);
    }
  }

  /* ---------------------------------------------- 可复制联系方式 */
  function initCopyable() {
    var wrap = document.body;
    if (!wrap) return;

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('execCommand failed'));
        } catch (e) {
          document.body.removeChild(ta);
          reject(e);
        }
      });
    }

    function feedback(el) {
      el.classList.add('copied');
      var timer = el._copyTimer;
      if (timer) clearTimeout(timer);
      el._copyTimer = setTimeout(function () {
        el.classList.remove('copied');
      }, 1200);
    }

    wrap.addEventListener('click', function (e) {
      var el = e.target.closest('.copy-value');
      if (!el) return;
      var text = el.getAttribute('data-copy') || el.textContent || '';
      if (!text) return;
      var isLink = el.tagName === 'A';
      var href = isLink ? el.getAttribute('href') : '';

      feedback(el);
      copyText(text).catch(function () {
        // 复制失败静默处理；真实浏览器中通常成功
      });

      // 链接类联系方式（电话/邮箱/WhatsApp 等）点击后仍允许跳转
      if (isLink && href && !/^javascript:/i.test(href)) {
        return; // 不阻止默认行为，浏览器继续跳转
      }
      e.preventDefault();
    });

    // 键盘支持（Enter / Space）
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('.copy-value');
      if (!el) return;
      e.preventDefault();
      el.click();
    });
  }

  /* ---------------------------------------------- 询盘表单 */
  function initInquiryForm() {
    var form = document.getElementById('inquiry-form');
    if (!form) return;

    var errRequired = form.getAttribute('data-err-required') || 'This field is required.';
    var errEmail = form.getAttribute('data-err-email') || 'Please enter a valid email address.';
    var errGeneric = form.getAttribute('data-err-generic') || 'Submission failed.';
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function setError(field, msg) {
      var el = form.querySelector('[data-error-for="' + field + '"]');
      var input = form.querySelector('[name="' + field + '"]');
      if (el) {
        el.textContent = msg || '';
        el.classList.toggle('show', !!msg);
      }
      if (input) input.classList.toggle('invalid', !!msg);
    }

    function clearErrors() {
      var els = form.querySelectorAll('.field-error');
      for (var i = 0; i < els.length; i++) {
        els[i].textContent = '';
        els[i].classList.remove('show');
      }
      var inputs = form.querySelectorAll('.invalid');
      for (var k = 0; k < inputs.length; k++) inputs[k].classList.remove('invalid');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();

      var data = {
        name: (form.name.value || '').trim(),
        email: (form.email.value || '').trim(),
        company: (form.company.value || '').trim(),
        country: (form.country.value || '').trim(),
        message: (form.message.value || '').trim(),
        product_ref: form.product_ref ? form.product_ref.value : '',
      };

      // 前端校验
      var hasError = false;
      if (!data.name) {
        setError('name', errRequired);
        hasError = true;
      }
      if (!data.email) {
        setError('email', errRequired);
        hasError = true;
      } else if (!EMAIL_RE.test(data.email)) {
        setError('email', errEmail);
        hasError = true;
      }
      if (!data.message) {
        setError('message', errRequired);
        hasError = true;
      }
      if (hasError) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            return { status: res.status, json: json };
          });
        })
        .then(function (r) {
          if (r.status === 200 && r.json && r.json.code === 0) {
            form.hidden = true;
            var ok = document.getElementById('inquiry-success');
            if (ok) ok.hidden = false;
            return;
          }
          // 服务端 400：显示字段错误
          var errors = r.json && r.json.data && r.json.data.errors;
          if (r.status === 400 && errors) {
            var map = { name: errRequired, email: errEmail, message: errRequired };
            for (var key in errors) {
              if (Object.prototype.hasOwnProperty.call(errors, key)) {
                setError(key, map[key] || errGeneric);
              }
            }
          } else {
            setError('message', errGeneric);
          }
        })
        .catch(function () {
          setError('message', errGeneric);
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();
