/**
 * 前台页面骨架：<html> + SEO head + 顶部导航 + 页脚 + 语言切换
 * hono/jsx 默认转义一切插值；仅管理员录入的富文本字段用 dangerouslySetInnerHTML
 *
 * 导航数据来自 nav_items 表（后台"导航管理"可增删改排序，支持二级下拉）；
 * 产品中心的下拉二级分类自动读取 categories 表；
 * 站点信息 / Logo / 配色 / 备案 / 页脚文案 来自 site_settings 表（后台"站点设置"可编辑）；
 * 开发者信息仅展示于管理后台登录页与后台，不在前台展示。
 */

import { html } from 'hono/html';
import type { FC } from 'hono/jsx';
import type { Category, Lang, NavItem, PageContent } from '../types';
import { alternatePaths, type SeoMeta } from '../lib/seo';
import { t } from '../i18n/ui';
import { Copyable } from '../components/copyable';

interface LayoutProps {
  lang: Lang;
  seo: SeoMeta;
  /** 当前路径（含语言前缀，可含查询串），用于导航高亮与语言切换 */
  currentPath: string;
  contactInfo: PageContent | null;
  /** 数据库导航（nav_items，仅启用项，含二级） */
  navItems: NavItem[];
  /** 产品分类（产品中心下拉二级分类） */
  categories: Category[];
  /** 站点设置键值（site_settings） */
  settings: Record<string, string>;
  /** 首屏关键图（首页第一张轮播图），head 中 preload 提前发起请求 */
  preloadImage?: string;
  children?: unknown;
}

/** 站内链接补语言前缀；完整外链原样返回 */
function resolveNavUrl(lang: Lang, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/(en|zh)(\/|$)/.test(url)) return url;
  if (url === '/' || url === '') return `/${lang}/`;
  return `/${lang}${url.startsWith('/') ? url : `/${url}`}`;
}

const LOGO_SVG = (
  <svg class="logo-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
    <rect x="2" y="2" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" />
    <path fill="currentColor" d="M8 23c0-6 3-11 9-13-1 4-3 6-6 7 4-1 7-3 9-7 1 6-2 13-9 13h-3z" />
  </svg>
);

const SOCIALS = [
  {
    key: 'social_facebook',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: 'social_instagram',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 2.2.3 3 .7.9.4 1.6 1 2.2 1.7.6.7 1.1 1.5 1.4 2.4.3.9.5 1.9.5 3s-.2 2.1-.5 3c-.3.9-.8 1.7-1.4 2.4-.6.7-1.3 1.3-2.2 1.7-.8.4-1.8.6-3 .7-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-2.2-.3-3-.7-.9-.4-1.6-1-2.2-1.7-.6-.7-1.1-1.5-1.4-2.4-.3-.9-.5-1.9-.5-3s.2-2.1.5-3c.3-.9.8-1.7 1.4-2.4C5.4 4.9 6.1 4.3 7 3.9c.8-.4 1.8-.6 3-.7 1.3-.1 1.7-.1 4.9-.1M12 0C8.7 0 8.3 0 7 .1 5.7.2 4.6.4 3.5 1c-1.1.5-2 1.2-2.8 2.1C0 4 0 5 0 6.3c0 1.3.2 2.5.2 3.2.3 1.3.8 2.4 1.6 3.3.8.9 1.7 1.6 2.8 2.1 1.1.5 2.2.7 3.5.8 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.4-.3 3.5-.8 1.1-.5 2-1.2 2.8-2.1.8-.9 1.3-2 1.6-3.3.2-.7.2-1.9.2-3.2 0-1.3-.2-2.5-.2-3.2-.3-1.3-.8-2.4-1.6-3.3C21.1 2.2 20.2 1.5 19.1 1c-1.1-.5-2.2-.7-3.5-.8C14.3 0 13.9 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.5-11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
      </svg>
    ),
  },
  {
    key: 'social_linkedin',
    label: 'LinkedIn',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: 'social_twitter',
    label: 'X / Twitter',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: 'social_youtube',
    label: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s6.75 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

export const Layout: FC<LayoutProps> = ({ lang, seo, currentPath, contactInfo, navItems, categories, settings, preloadImage, children }) => {
  const otherLang: Lang = lang === 'en' ? 'zh' : 'en';
  const switchUrl = alternatePaths(currentPath)[otherLang];
  const homeHref = `/${lang}/`;

  // 站点名称 / Logo 支持中文版本：中文站优先用 *_zh，未设置时回退通用值
  const siteName = (lang === 'zh' ? settings.site_name_zh : '') || settings.site_name || t(lang, 'site_name');
  const logoText = siteName;
  const logoImage = (lang === 'zh' ? settings.logo_image_zh : '') || settings.logo_image || '';
  const favicon = settings.favicon || '/favicon.svg';
  const footerText = (lang === 'zh' ? settings.footer_text_zh : settings.footer_text_en) || t(lang, 'footer_intro');
  const headCode = settings.head_code || '';

  // 动态配色（后台"站点设置"可改，缺省回退主题默认值）
  const primaryColor = settings.primary_color || '#2c3e35';
  const accentColor = settings.accent_color || '#b8955a';

  // 备案号（可开关）
  const icpEnabled = settings.icp_enabled === '1';
  const icpNumber = settings.icp_number || '';

  // 导航高亮：去掉语言前缀后与当前路径比较
  const pathNoLang = currentPath.replace(/^\/(en|zh)/, '') || '/';
  const isActive = (url: string): boolean => {
    const target = url.replace(/^\/(en|zh)/, '') || '/';
    if (target === '/') return pathNoLang === '/';
    return pathNoLang === target || pathNoLang.startsWith(`${target}/`);
  };

  const year = new Date().getUTCFullYear();

  const topItems = navItems.filter((n) => n.parent_id === 0);
  const childrenOf = (parentId: number): NavItem[] => navItems.filter((n) => n.parent_id === parentId);

  /** 渲染一级导航项（含下拉） */
  const renderNavItem = (item: NavItem): unknown => {
    const children = childrenOf(item.id);
    const isProducts = item.url === '/products';
    const catItems = isProducts ? categories : [];
    const hasDropdown = children.length > 0 || catItems.length > 0;
    const label = lang === 'zh' ? item.label_zh : item.label_en;

    if (!hasDropdown) {
      return (
        <li>
          <a
            href={resolveNavUrl(lang, item.url)}
            class={isActive(item.url) ? 'active' : ''}
            {...(/^https?:\/\//.test(item.url) ? { target: '_blank', rel: 'noopener' } : {})}
          >
            {label}
          </a>
        </li>
      );
    }

    return (
      <li class="has-dropdown">
        <a href={resolveNavUrl(lang, item.url)} class={isActive(item.url) ? 'active' : ''}>
          {label}
        </a>
        <ul class="nav-dropdown">
          {isProducts ? (
            <li>
              <a href={resolveNavUrl(lang, '/products')}>{t(lang, 'all_categories')}</a>
            </li>
          ) : null}
          {catItems.map((c) => (
            <li>
              <a href={`/${lang}/products?category=${c.id}`}>
                {lang === 'zh' ? c.name_zh : c.name_en}
              </a>
            </li>
          ))}
          {children.map((sub) => (
            <li>
              <a
                href={resolveNavUrl(lang, sub.url)}
                {...(/^https?:\/\//.test(sub.url) ? { target: '_blank', rel: 'noopener' } : {})}
              >
                {lang === 'zh' ? sub.label_zh : sub.label_en}
              </a>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <>
      {html`<!DOCTYPE html>`}
      <html lang={lang === 'zh' ? 'zh-CN' : 'en'}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          {preloadImage ? <link rel="preload" as="image" href={preloadImage} fetchpriority="high" /> : null}
          <link rel="canonical" href={seo.canonical} />
          <link rel="alternate" hreflang="en" href={seo.alternates.en} />
          <link rel="alternate" hreflang="zh" href={seo.alternates.zh} />
          <link rel="alternate" hreflang="x-default" href={seo.alternates.en} />
          <link rel="icon" href={favicon} type={favicon.endsWith('.png') ? 'image/png' : 'image/svg+xml'} />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Serif+SC:wght@400;500;600&family=Noto+Sans+SC:wght@300;400;500&display=swap"
          />
          <style>{`:root{--c-ink:${primaryColor};--c-forest:${primaryColor};--c-gold:${accentColor};}`}</style>
          {headCode ? ({ toString: () => headCode, isEscaped: true } as unknown) : null}
          <link rel="stylesheet" href="/css/site.css" />
        </head>
        <body>
          <div id="page-loader">
            <div class="loader-ring"></div>
          </div>
          <header class="site-header" id="site-header">
            <div class="container header-inner">
              <a class="logo" href={homeHref}>
                {logoImage ? (
                  <img class="logo-img" src={logoImage} alt={siteName} />
                ) : (
                  <>
                    {LOGO_SVG}
                    <span class="logo-text">{logoText}</span>
                  </>
                )}
              </a>
              <nav class="main-nav" id="main-nav">
                <ul>{topItems.map(renderNavItem)}</ul>
              </nav>
              <div class="header-actions">
                <button
                  class="search-toggle"
                  id="search-toggle"
                  aria-label={t(lang, 'search_btn')}
                  title={t(lang, 'search_btn')}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
                <a class="lang-switch" href={switchUrl} hreflang={otherLang}>
                  {otherLang === 'zh' ? '中文' : 'EN'}
                </a>
                <button class="nav-toggle" id="nav-toggle" aria-label="Menu" aria-expanded="false">
                  <span></span>
                  <span></span>
                  <span></span>
                </button>
              </div>
            </div>
          </header>

          <div
            class="search-modal"
            id="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t(lang, 'search_modal_title')}
            data-loading={t(lang, 'search_loading')}
            data-no-results={t(lang, 'search_no_results')}
            data-group-products={t(lang, 'search_results_products')}
            data-group-articles={t(lang, 'search_results_articles')}
            data-group-pages={t(lang, 'search_results_pages')}
            hidden
          >
            <div class="search-modal-overlay" id="search-modal-overlay"></div>
            <div class="search-modal-inner">
              <div class="search-modal-header">
                <div class="search-input-wrap">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="search"
                    id="search-input"
                    placeholder={t(lang, 'search_placeholder')}
                    autocomplete="off"
                    aria-label={t(lang, 'search_placeholder')}
                  />
                </div>
                <button class="search-modal-close" id="search-modal-close" type="button" aria-label={t(lang, 'search_close')}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="search-modal-body">
                <div class="search-status" id="search-status" aria-live="polite"></div>
                <div class="search-results" id="search-results"></div>
              </div>
            </div>
          </div>

          <main class="site-main">{children}</main>

          <footer class="site-footer">
            <div class="container footer-grid">
              <div class="footer-col footer-brand">
                <a class="logo logo-footer" href={homeHref}>
                  {logoImage ? (
                    <img class="logo-img logo-img-footer" src={logoImage} alt={siteName} />
                  ) : (
                    <>
                      {LOGO_SVG}
                      <span class="logo-text">{logoText}</span>
                    </>
                  )}
                </a>
                <p>{footerText}</p>
                {SOCIALS.some((s) => settings[s.key]) ? (
                  <div class="footer-social">
                    {SOCIALS.map(
                      (s) =>
                        settings[s.key] && (
                          <a
                            href={settings[s.key]}
                            target="_blank"
                            rel="noopener"
                            aria-label={s.label}
                            title={s.label}
                          >
                            {s.icon}
                          </a>
                        ),
                    )}
                  </div>
                ) : null}
              </div>
              <div class="footer-col">
                <h4>{t(lang, 'footer_links')}</h4>
                <ul class="footer-links-list">
                  {topItems.map((item) => (
                    <li>
                      <a href={resolveNavUrl(lang, item.url)}>{lang === 'zh' ? item.label_zh : item.label_en}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div class="footer-col footer-contact">
                <h4>{t(lang, 'footer_contact')}</h4>
                <div class="footer-contact-body">
                  {settings.contact_address_zh || settings.contact_address_en ? (
                    <p>
                      <strong>{t(lang, 'contact_address_label')}</strong>
                      <br />
                      <Copyable value={lang === 'zh' ? settings.contact_address_zh : settings.contact_address_en} lang={lang} />
                    </p>
                  ) : null}
                  {settings.contact_phone ? (
                    <p>
                      <strong>{t(lang, 'contact_phone_label')}</strong>
                      <br />
                      <Copyable value={settings.contact_phone} lang={lang} href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`} />
                    </p>
                  ) : null}
                  {settings.contact_email ? (
                    <p>
                      <strong>{t(lang, 'contact_email_label')}</strong>
                      <br />
                      <Copyable value={settings.contact_email} lang={lang} href={`mailto:${settings.contact_email}`} />
                    </p>
                  ) : null}
                  {settings.contact_overseas_phone ? (
                    <p>
                      <strong>{t(lang, 'contact_overseas_phone_label')}</strong>
                      <br />
                      <Copyable value={settings.contact_overseas_phone} lang={lang} href={`tel:${settings.contact_overseas_phone.replace(/\s+/g, '')}`} />
                    </p>
                  ) : null}
                  {settings.contact_wechat ? (
                    <p>
                      <strong>{t(lang, 'contact_wechat_label')}</strong>
                      <br />
                      <Copyable value={settings.contact_wechat} lang={lang} />
                    </p>
                  ) : null}
                  {settings.contact_whatsapp ? (
                    <p>
                      <strong>{t(lang, 'contact_whatsapp_label')}</strong>
                      <br />
                      <Copyable value={settings.contact_whatsapp} lang={lang} href={`https://wa.me/${settings.contact_whatsapp.replace(/\D/g, '')}`} />
                    </p>
                  ) : null}
                  {[1, 2].map((idx) => {
                    const label = lang === 'zh'
                      ? settings[`contact_custom_${idx}_label_zh`]
                      : settings[`contact_custom_${idx}_label_en`];
                    const value = settings[`contact_custom_${idx}_value`];
                    if (!label || !value) return null;
                    const v = value.trim();
                    let href: string | undefined;
                    if (/^https?:\/\//i.test(v)) href = v;
                    else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(v)) href = `mailto:${v}`;
                    return (
                      <p>
                        <strong>{label}</strong>
                        <br />
                        <Copyable value={v} lang={lang} href={href} />
                      </p>
                    );
                  })}
                  {settings.contact_working_hours_zh || settings.contact_working_hours_en ? (
                    <p>
                      <strong>{t(lang, 'contact_hours_label')}</strong>
                      <br />
                      <Copyable value={lang === 'zh' ? settings.contact_working_hours_zh : settings.contact_working_hours_en} lang={lang} />
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div class="footer-bottom">
              <div class="container footer-bottom-inner">
                <p>&copy; {year} {siteName}. {t(lang, 'footer_rights')}</p>
                {icpEnabled && icpNumber ? (
                  <p class="icp">
                    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
                      {icpNumber}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </footer>

          <script src="/js/site.js" defer></script>
        </body>
      </html>
    </>
  );
};
