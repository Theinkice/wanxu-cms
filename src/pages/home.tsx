/**
 * 首页：按 sorher.com 首页截图一比一复刻（轮廓 + 比例），内容为仿真植物演示且全部后台可编辑
 * 版块：Hero（全宽剧中 overlay）→ 特色商品（3x2 金角框卡片）→ 服务项目（4 列错落 + 了解更多）
 *       → 品牌一览（深绿带文字 wordmark）→ 门店资讯（左文右图）
 * 数据源：banners（Hero 图） / site_settings（品牌名/Logo/按钮） / home_sections（各区块）
 *         / categories（特色商品卡片） / page_contents（页脚联系）
 */

import type { FC } from 'hono/jsx';
import type { Banner, Category, HomeSection, HomeSectionItem, Lang } from '../types';

interface HomePageProps {
  lang: Lang;
  banners: Banner[];
  categories: Category[];
  homeSections: HomeSection[];
  settings: Record<string, string>;
}

/** 站内相对路径补语言前缀，绝对 URL 原样；空链接原样返回 */
function resolveLink(lang: Lang, link: string): string {
  if (!link) return '';
  if (/^https?:\/\//i.test(link)) return link;
  if (/^\/(en|zh)(\/|$)/.test(link)) return link;
  return `/${lang}${link.startsWith('/') ? link : `/${link}`}`;
}

/** 解析 home_sections.items JSON 字符串 */
function parseItems(json: string): HomeSectionItem[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is HomeSectionItem => Boolean(x) && typeof x === 'object');
  } catch {
    return [];
  }
}

/** 解析 home_sections.config JSON 字符串 */
function parseConfig(json: string): Record<string, unknown> {
  try {
    const obj = JSON.parse(json || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function configStr(cfg: Record<string, unknown>, key: string): string {
  const v = cfg[key];
  return typeof v === 'string' ? v.trim() : '';
}

function configArr(cfg: Record<string, unknown>, key: string): unknown[] {
  const v = cfg[key];
  return Array.isArray(v) ? v : [];
}

/** 区块眉标 + 标题 + 金线（特色商品居中标题，sorher 同款） */
const SectionHead: FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <div class="section-head">
    {eyebrow ? <p class="eyebrow center" data-anim="fadeInUp">◆ {eyebrow} ◆</p> : null}
    {title ? <h2 class="section-title center" data-anim="fadeInUp">{title}</h2> : null}
    <div class="grow-line" data-anim="growRight"></div>
  </div>
);

/** Hero 剧中白色线条 Logo（呼应 sorher 手绘花叶线条） */
const HeroMark: FC = () => (
  <svg class="hero-mark" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
    <path d="M18 46 C18 28 32 16 48 14 C46 32 36 44 20 47" stroke-linecap="round" />
    <path d="M20 46 C30 38 40 28 47 16" stroke-linecap="round" />
    <circle cx="48" cy="13" r="2.6" />
    <path d="M14 50 C24 46 34 40 44 30" stroke-linecap="round" stroke-dasharray="1 4" />
  </svg>
);

export const HomePage: FC<HomePageProps> = ({ lang, banners, categories, homeSections, settings }) => {
  const byKey = (key: string): HomeSection | undefined => homeSections.find((s) => s.key === key);
  const secEyebrow = (s?: HomeSection): string => (s ? (lang === 'zh' ? s.eyebrow_zh : s.eyebrow_en) : '');
  const secTitle = (s?: HomeSection): string => (s ? (lang === 'zh' ? s.title_zh : s.title_en) : '');

  const heroSection = byKey('hero');
  const catSection = byKey('categories');
  const services = byKey('services');
  const brands = byKey('brands');
  const store = byKey('store');

  const heroConfig = heroSection ? parseConfig(heroSection.config) : {};
  const serviceItems = services ? parseItems(services.items) : [];
  const brandItems = brands ? parseItems(brands.items) : [];

  // ---------------------------------------------------------------- Hero（全宽图 + 剧中 overlay）
  // 后台「站点设置 → 首页首屏」优先级最高；「首页编辑 → Hero 区块」作为回退。
  const slides = banners.length > 0 ? banners : [{ image: '', link: '' } as Banner];
  const heroLink = settings.hero_cta_link || configStr(heroConfig, 'cta_link') || slides[0]?.link || '';
  const brandEn = settings.hero_brand_en || heroSection?.title_en || '';
  const brandZh =
    lang === 'zh'
      ? (settings.hero_brand_zh || heroSection?.title_zh || settings.site_name_zh || settings.site_name || '')
      : (settings.site_slogan_en || settings.hero_brand_en || heroSection?.title_en || '');
  const heroCta =
    (lang === 'zh'
      ? (settings.hero_cta_zh || heroSection?.content_zh)
      : (settings.hero_cta_en || heroSection?.content_en)) || '';

  const hero =
    heroSection && heroSection.is_active ? (
      <section class="hero-sorher" id="hero-carousel">
      <div class="hero-slides">
        {slides.map((b, i) => (
          <div class={`hero-slide${i === 0 ? ' active' : ''}`}>
            <img
              src={b.image}
              alt=""
              width="1600"
              height="900"
              {...(i === 0 ? { fetchpriority: 'high' } : { loading: 'lazy' })}
            />
          </div>
        ))}
      </div>
      <div class="hero-overlay">
        {(lang === 'zh' ? settings.logo_image_zh : '') || settings.logo_image ? (
          <img class="hero-panel-logo" src={(lang === 'zh' ? settings.logo_image_zh : '') || settings.logo_image} alt={brandEn} />
        ) : (
          <HeroMark />
        )}
        {brandEn ? <span class="hero-brand-en">{brandEn}</span> : null}
        {brandZh ? <span class="hero-brand-zh">{brandZh}</span> : null}
        {heroCta && heroLink ? (
          <a class="hero-cta" href={resolveLink(lang, heroLink)}>
            {heroCta}
          </a>
        ) : null}
      </div>
      {slides.length > 1 ? (
        <div class="hero-dots">
          {slides.map((_, i) => (
            <button class={`hero-dot${i === 0 ? ' active' : ''}`} data-carousel-dot aria-label={`Slide ${i + 1}`}></button>
          ))}
        </div>
      ) : null}
    </section>
  ) : null;

  // ------------------------------------------------------------ 特色商品（3x2 金角框分类卡片）
  const catConfig = catSection ? parseConfig(catSection.config) : {};
  const selectedCatIds = configArr(catConfig, 'category_ids')
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  const displayCategories =
    selectedCatIds.length > 0
      ? selectedCatIds.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => Boolean(c))
      : categories;

  const categoriesSection =
    catSection && catSection.is_active ? (
      <section class="section categories-section">
        <div class="container">
          <SectionHead eyebrow={secEyebrow(catSection)} title={secTitle(catSection)} />
          <div class="category-cards">
            {displayCategories.map((c, i) => (
              <a
                class="category-card"
                data-anim="fadeInUp"
                style={`transition-delay:${(i % 3) * 0.1}s`}
                href={`/${lang}/products?category=${c.id}`}
              >
                <div class="category-card-frame">
                  <div class="category-card-img">
                    <img src={c.cover_image} alt={lang === 'zh' ? c.name_zh : c.name_en} loading="lazy" />
                  </div>
                </div>
                <div class="category-card-body">
                  <h3>{lang === 'zh' ? c.name_zh : c.name_en}</h3>
                  <p>{lang === 'zh' ? (c.subtitle_zh || c.name_zh) : (c.subtitle_en || c.name_en)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    ) : null;

  // ------------------------------------------------------------ 服务项目（4 列错落 + 了解更多）
  const svcConfig = services ? parseConfig(services.config) : {};
  const svcBtnText = lang === 'zh' ? configStr(svcConfig, 'button_text_zh') : configStr(svcConfig, 'button_text_en');
  const svcBtnLink = configStr(svcConfig, 'button_link');

  const servicesSection =
    services && services.is_active && serviceItems.length > 0 ? (
      <section class="section services-section">
        <div class="container">
          <div class="services-head" data-anim="fadeInUp">
            <h2 class="section-title">{secTitle(services)}</h2>
            {secEyebrow(services) ? <span class="services-head-zh">{secEyebrow(services)}</span> : null}
          </div>
          <div class="service-grid">
            {serviceItems.map((item, i) => {
              const href = resolveLink(lang, item.url);
              const Card = href ? 'a' : 'div';
              return (
                <Card
                  class={`service-card${href ? '' : ' service-card-static'}`}
                  data-anim="fadeInUp"
                  style={`transition-delay:${i * 0.08}s`}
                  {...(href ? { href } : {})}
                >
                  {item.image ? (
                    <div class="service-card-img">
                      <img src={item.image} alt={lang === 'zh' ? item.title_zh : item.title_en} loading="lazy" />
                    </div>
                  ) : null}
                  <div class="service-card-body">
                    <h3>{lang === 'zh' ? item.title_zh : item.title_en}</h3>
                    <p>{lang === 'zh' ? item.subtitle_zh : item.subtitle_en}</p>
                  </div>
                </Card>
              );
            })}
            {svcBtnText && svcBtnLink ? (
              <a
                class="service-more"
                data-anim="fadeInUp"
                style={`transition-delay:${serviceItems.length * 0.08}s`}
                href={resolveLink(lang, svcBtnLink)}
              >
                <span>{svcBtnText}</span>
                <span class="arr">&#8594;</span>
              </a>
            ) : null}
          </div>
        </div>
      </section>
    ) : null;

  // ------------------------------------------------------------ 品牌一览（深绿带 · 艺术字排版）
  const brandConfig = brands ? parseConfig(brands.config) : {};
  const brandWatermark = configStr(brandConfig, 'watermark');

  const brandsSection =
    brands && brands.is_active && brandItems.length > 0 ? (
      <section class="brands-section">
        <div class="container brands-stage">
          <header class="brands-head" data-anim="fadeInUp">
            <span class="brands-eyebrow">{secEyebrow(brands)}</span>
            <h2 class="brands-art-title">{secTitle(brands)}</h2>
            <div class="brands-line" aria-hidden="true"></div>
            {(lang === 'zh' ? brands.content_zh : brands.content_en) ? (
              <div class="brands-desc" dangerouslySetInnerHTML={{ __html: lang === 'zh' ? brands.content_zh : brands.content_en }} />
            ) : null}
          </header>
          <div class="brands-canvas">
            {brandWatermark ? (
              <span class="brands-watermark" aria-hidden="true">
                {brandWatermark}
              </span>
            ) : null}
            <div class="brands-flow">
              {brandItems.map((item, i) => (
                <span
                  class={`brand-art ba${(i % 6) + 1}`}
                  data-anim="fadeInUp"
                  style={`transition-delay:${i * 0.07}s`}
                >
                  {lang === 'zh' ? (item.title_zh || item.title_en) : (item.title_en || item.title_zh)}
                </span>
              ))}
            </div>
            <span class="brands-ornament" aria-hidden="true">&#10035;</span>
          </div>
        </div>
      </section>
    ) : null;

  // ------------------------------------------------------------ 门店资讯（左文右图 + 金框）
  const storeConfig = store ? parseConfig(store.config) : {};
  const storeBtnText = lang === 'zh' ? configStr(storeConfig, 'button_text_zh') : configStr(storeConfig, 'button_text_en');
  const storeBtnLink = configStr(storeConfig, 'button_link');

  const storeSection =
    store && store.is_active ? (
      <section class="section store-section">
        <div class="container store-grid">
          <div class="store-info" data-anim="fadeInUp">
            <h2 class="section-title">{secTitle(store)}</h2>
            <div class="store-line" aria-hidden="true"></div>
            <div
              class="rich-text store-body"
              dangerouslySetInnerHTML={{ __html: lang === 'zh' ? store.content_zh : store.content_en }}
            />
            {storeBtnText && storeBtnLink ? (
              <div class="store-actions">
                <a class="btn btn-gold" href={resolveLink(lang, storeBtnLink)}>
                  {storeBtnText}
                </a>
              </div>
            ) : null}
          </div>
          {store.image ? (
            <div class="store-image" data-anim="fadeInUp">
              <img src={store.image} alt={secTitle(store)} loading="lazy" />
            </div>
          ) : null}
        </div>
      </section>
    ) : null;

  return (
    <>
      {hero}
      {categoriesSection}
      {servicesSection}
      {brandsSection}
      {storeSection}
    </>
  );
};
