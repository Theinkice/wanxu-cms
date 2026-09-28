/**
 * 产品页：分类列表 + 产品网格（分页）与产品详情
 */

import type { FC } from 'hono/jsx';
import type { Category, Lang, Page, Product } from '../types';
import { t } from '../i18n/ui';

function pick(lang: Lang, obj: Record<string, string>, base: string): string {
  return lang === 'zh' ? obj[`${base}_zh`] ?? '' : obj[`${base}_en`] ?? '';
}

/** 解析 products.images JSON 字段 */
export function parseImages(json: string): string[] {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 解析外贸参数 JSON 字段 → [{key, value}] */
export function parseParams(json: string): { key: string; value: string }[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is Record<string, string> => Boolean(x) && typeof x === 'object')
      .map((x) => ({ key: String(x.key ?? ''), value: String(x.value ?? '') }))
      .filter((x) => x.key.length > 0);
  } catch {
    return [];
  }
}

/** 逗号分隔规格 → 数组 */
function splitSpecs(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** 将中英文逗号分隔规格按索引合并，用于前台双语展示 */
function splitBilingualSpecs(zh: string, en: string): { zh: string; en: string }[] {
  const z = splitSpecs(zh);
  const e = splitSpecs(en);
  const len = Math.max(z.length, e.length);
  const out: { zh: string; en: string }[] = [];
  for (let i = 0; i < len; i++) {
    if (z[i] || e[i]) out.push({ zh: z[i] || '', en: e[i] || '' });
  }
  return out;
}

// ------------------------------------------------------------- 分页器

interface PaginationProps {
  lang: Lang;
  page: number;
  pageSize: number;
  total: number;
  /** 生成页码链接 */
  baseUrl: string;
}

const Pagination: FC<PaginationProps> = ({ lang, page, pageSize, total, baseUrl }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const sep = baseUrl.includes('?') ? '&' : '?';
  const link = (p: number): string => `${baseUrl}${sep}page=${p}`;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <nav class="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a class="page-btn" href={link(page - 1)}>
          {t(lang, 'prev_page')}
        </a>
      ) : null}
      {pages.map((p) => (
        <a class={p === page ? 'page-btn current' : 'page-btn'} href={link(p)}>
          {p}
        </a>
      ))}
      {page < totalPages ? (
        <a class="page-btn" href={link(page + 1)}>
          {t(lang, 'next_page')}
        </a>
      ) : null}
    </nav>
  );
};

// -------------------------------------------------------- 产品列表页

interface ProductsPageProps {
  lang: Lang;
  categories: Category[];
  activeCategory: number | null;
  data: Page<Product>;
}

export const ProductsPage: FC<ProductsPageProps> = ({ lang, categories, activeCategory, data }) => {
  const currentCategory = activeCategory
    ? categories.find((c) => c.id === activeCategory) ?? null
    : null;
  const pageTitle = currentCategory ? pick(lang, currentCategory as unknown as Record<string, string>, 'name') : t(lang, 'products_page_title');
  const baseUrl = activeCategory ? `/${lang}/products?category=${activeCategory}` : `/${lang}/products`;

  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{pageTitle}</span>
          </nav>
          <h1>{pageTitle}</h1>
          <p class="page-desc">{t(lang, 'products_page_desc')}</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="category-tabs">
            <a class={activeCategory === null ? 'tab active' : 'tab'} href={`/${lang}/products`}>
              {t(lang, 'all_categories')}
            </a>
            {categories.map((c) => (
              <a
                class={activeCategory === c.id ? 'tab active' : 'tab'}
                href={`/${lang}/products?category=${c.id}`}
              >
                {pick(lang, c as unknown as Record<string, string>, 'name')}
              </a>
            ))}
          </div>

          {data.items.length === 0 ? (
            <p class="empty-tip">{t(lang, 'no_products')}</p>
          ) : (
            <div class="product-grid">
              {data.items.map((p) => (
                <a class="product-card" href={`/${lang}/products/${p.id}`}>
                  <div class="product-card-img">
                    <img
                      src={p.main_image}
                      alt={pick(lang, p as unknown as Record<string, string>, 'name')}
                      loading="lazy"
                    />
                  </div>
                  <div class="product-card-body">
                    <h3>{pick(lang, p as unknown as Record<string, string>, 'name')}</h3>
                    <p>{pick(lang, p as unknown as Record<string, string>, 'summary')}</p>
                  </div>
                </a>
              ))}
            </div>
          )}

          <Pagination lang={lang} page={data.page} pageSize={data.pageSize} total={data.total} baseUrl={baseUrl} />
        </div>
      </section>
    </>
  );
};

// -------------------------------------------------------- 产品详情页

interface ProductDetailPageProps {
  lang: Lang;
  product: Product;
  images: string[];
  category: Category | null;
  /** 站点设置（用于邮件询盘的收件邮箱等） */
  settings: Record<string, string>;
}

export const ProductDetailPage: FC<ProductDetailPageProps> = ({ lang, product, images, category, settings }) => {
  const name = pick(lang, product as unknown as Record<string, string>, 'name');
  const summary = pick(lang, product as unknown as Record<string, string>, 'summary');
  const description = pick(lang, product as unknown as Record<string, string>, 'description');
  const gallery = images.length > 0 ? images : product.main_image ? [product.main_image] : [];
  const sizesBi = splitBilingualSpecs(product.sizes, product.sizes_en);
  const colorsBi = splitBilingualSpecs(product.colors, product.colors_en);
  const paramsZh = parseParams(product.params_zh);
  const paramsEn = parseParams(product.params_en);

  // 严格按当前语言取值，当前语言缺失时回退到另一语言
  const pickLang = (zh: string, en: string) => {
    if (lang === 'zh') return zh || en;
    return en || zh;
  };

  // 尺寸 / 颜色 chip 显示双语值（如 120cm / 120cm/4ft），提交询盘时取当前语言值
  const formatBilingualChip = (zh: string, en: string) => {
    if (!zh && !en) return '';
    if (!en || zh === en) return zh;
    if (!zh) return en;
    return `${zh} / ${en}`;
  };

  const sizes = sizesBi
    .map((s) => ({
      value: pickLang(s.zh, s.en),
      display: formatBilingualChip(s.zh, s.en),
    }))
    .filter((s) => s.value);
  const colors = colorsBi
    .map((s) => ({
      value: pickLang(s.zh, s.en),
      display: formatBilingualChip(s.zh, s.en),
    }))
    .filter((s) => s.value);

  // 关键主项：从外贸参数中提取包装 / 材质（中英文键名都匹配）
  const paramValue = (list: { key: string; value: string }[], re: RegExp) =>
    list.find((p) => re.test(p.key))?.value ?? '';
  const packagingValue = pickLang(
    paramValue(paramsZh, /包装|packing|packag/i),
    paramValue(paramsEn, /包装|packing|packag/i),
  );
  const materialValue = pickLang(
    paramValue(paramsZh, /材质|material/i),
    paramValue(paramsEn, /材质|material/i),
  );

  // 当前语言参数表（严格按语言显示，缺失则回退）
  const currentParams = lang === 'zh' ? paramsZh : paramsEn;
  const inquiryUrl = `/${lang}/contact?product=${encodeURIComponent(name)}`;

  // 邮件询盘：mailto 直达联系邮箱，主题/正文预填产品信息
  const contactEmail = settings.contact_email || settings.inquiry_recipient || '';
  const mailSubject = encodeURIComponent(`Inquiry about ${name}`);
  const mailBody = encodeURIComponent(`Hello,\n\nI'd like to inquire about the product "${name}".\n\nPlease send me more details, pricing and MOQ. Thank you.\n`);
  const mailtoUrl = contactEmail ? `mailto:${contactEmail}?subject=${mailSubject}&body=${mailBody}` : '';
  const productRef = name;

  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <a href={`/${lang}/products`}>{t(lang, 'products_page_title')}</a>
            {category ? (
              <>
                <span>/</span>
                <a href={`/${lang}/products?category=${category.id}`}>
                  {pick(lang, category as unknown as Record<string, string>, 'name')}
                </a>
              </>
            ) : null}
            <span>/</span>
            <span>{name}</span>
          </nav>
        </div>
      </section>

      <section class="section">
        <div class="container product-detail">
          <div
            class="product-gallery"
            data-gallery
            data-lbl-close={t(lang, 'zoom_close')}
            data-lbl-prev={t(lang, 'zoom_prev')}
            data-lbl-next={t(lang, 'zoom_next')}
          >
            <div class="gallery-main">
              {gallery.length > 0 ? <img id="gallery-main-img" src={gallery[0]} alt={name} /> : null}
              {gallery.length > 0 ? (
                <button type="button" class="gallery-zoom" aria-label={t(lang, 'zoom_image')}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                  </svg>
                  {t(lang, 'zoom_image')}
                </button>
              ) : null}
            </div>
            {gallery.length > 1 ? (
              <div class="gallery-thumbs">
                {gallery.map((img, i) => (
                  <button
                    class={i === 0 ? 'thumb active' : 'thumb'}
                    data-thumb={img}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={img} alt={`${name} ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div class="product-info">
            <h1>{name}</h1>
            <p class="product-summary">{summary}</p>

            {sizes.length > 0 ? (
              <div class="spec-group">
                <span class="spec-label">{t(lang, 'sizes')}:</span>
                <div class="spec-chips">
                  {sizes.map((s) => (
                    <button type="button" class="chip" data-spec-select="size" data-value={s.value}>
                      {s.display}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {colors.length > 0 ? (
              <div class="spec-group">
                <span class="spec-label">{t(lang, 'colors')}:</span>
                <div class="spec-chips">
                  {colors.map((s) => (
                    <button type="button" class="chip" data-spec-select="color" data-value={s.value}>
                      {s.display}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {packagingValue ? (
              <div class="spec-group">
                <span class="spec-label">{t(lang, 'spec_packaging')}:</span>
                <div class="spec-chips">
                  <span class="chip chip-static">{packagingValue}</span>
                </div>
              </div>
            ) : null}

            {materialValue ? (
              <div class="spec-group">
                <span class="spec-label">{t(lang, 'spec_material')}:</span>
                <div class="spec-chips">
                  <span class="chip chip-static">{materialValue}</span>
                </div>
              </div>
            ) : null}

            <p
              class="spec-selected"
              hidden
              data-size-label={t(lang, 'sizes')}
              data-color-label={t(lang, 'colors')}
              data-selected-label={t(lang, 'selected_specs')}
            ></p>

            <div class="inquiry-actions">
              <a class="btn btn-primary btn-lg" data-inquiry-btn data-href={inquiryUrl} href={inquiryUrl}>
                {t(lang, 'send_inquiry')}
              </a>
              {mailtoUrl ? (
                <a class="btn btn-outline btn-lg" href={mailtoUrl}>
                  {t(lang, 'send_email_inquiry')}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {currentParams.length > 0 ? (
          <div class="container product-params" id="product-params">
            <h2 class="section-title">{t(lang, 'product_params')}</h2>
            <table class="params-table">
              <tbody>
                {currentParams.map((row) => (
                  <tr>
                    <th scope="row">{row.key}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {description ? (
          <div class="container product-description">
            <h2 class="section-title">{t(lang, 'product_description')}</h2>
            <div class="rich-text" dangerouslySetInnerHTML={{ __html: description }} />
          </div>
        ) : null}
      </section>
    </>
  );
};
