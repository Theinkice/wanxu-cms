/**
 * 前台 SSR 路由：/:lang 下的双语页面 + sitemap.xml + robots.txt
 * 所有页面经 SeoHelper(buildSeo) 生成 canonical/hreflang
 * 导航与站点信息统一由 getLayoutData 从数据库读取（后台可编辑）
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppVariables, Bindings, Category, Lang, NavItem, PageContent } from '../types';
import { langMiddleware } from '../middleware/lang';
import { buildSeo } from '../lib/seo';
import { parsePage } from '../lib/http';
import {
  ArticleRepo,
  BannerRepo,
  CategoryRepo,
  HomeSectionRepo,
  NavRepo,
  PageContentRepo,
  PagesRepo,
  ProductRepo,
  SettingsRepo,
} from '../lib/repo';
import { t } from '../i18n/ui';
import { Layout } from '../pages/layout';
import { HomePage } from '../pages/home';
import { ProductDetailPage, ProductsPage, parseImages } from '../pages/products';
import { ArticleDetailPage, ArticleListPage } from '../pages/articles';
import { AboutPage, ContactPage, CustomPage, PartnersPage } from '../pages/pages';

type C = Context<{ Bindings: Bindings; Variables: AppVariables }>;

export const frontend = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

frontend.use('*', langMiddleware);

/** 布局公共数据：联系信息 + 导航 + 分类（产品下拉） + 站点设置 */
interface LayoutData {
  contactInfo: PageContent | null;
  navItems: NavItem[];
  categories: Category[];
  settings: Record<string, string>;
}

async function getLayoutData(db: D1Database): Promise<LayoutData> {
  const [contactInfo, navItems, categories, settings] = await Promise.all([
    PageContentRepo.get(db, 'contact_info'),
    NavRepo.listPublic(db),
    CategoryRepo.list(db),
    SettingsRepo.getAll(db),
  ]);
  return { contactInfo, navItems, categories, settings };
}

/** 取默认 SEO 标题/描述（按语言从 settings 读取，未设置则回退 i18n） */
function defaultSeo(lang: Lang, settings: Record<string, string>) {
  return {
    title:
      (lang === 'zh' ? settings.seo_default_title_zh : settings.seo_default_title_en) ||
      `${t(lang, 'site_name')} | ${t(lang, 'site_tagline')}`,
    description:
      (lang === 'zh' ? settings.seo_default_description_zh : settings.seo_default_description_en) ||
      t(lang, 'footer_intro'),
  };
}

/** 前台 404（布局内双语提示） */
async function renderNotFound(c: C): Promise<Response> {
  const lang = c.get('lang') ?? 'en';
  const layout = await getLayoutData(c.env.DB);
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'notfound_title')} | ${seoDefaults.title}`,
    description: seoDefaults.description,
    path: `/${lang}/`,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={c.req.path} {...layout}>
      <section class="page-head">
        <div class="container" style="text-align:center;padding:60px 20px;">
          <p class="eyebrow center">404</p>
          <h1>{t(lang, 'notfound_title')}</h1>
          <p class="page-desc">{t(lang, 'notfound_desc')}</p>
          <a class="btn btn-primary" href={`/${lang}/`} style="margin-top:20px;">
            {t(lang, 'back_home')}
          </a>
        </div>
      </section>
    </Layout>,
    404,
  );
}

// ---------------------------------------------------------------- 首页

/** 导出供入口直接注册 /en/ 与 /zh/（hono 子应用 get('/') 仅匹配无尾斜杠路径） */
export async function homeHandler(c: C): Promise<Response> {
  const lang = c.get('lang');
  const db = c.env.DB;
  const [banners, layout, homeSections] = await Promise.all([
    BannerRepo.list(db),
    getLayoutData(db),
    HomeSectionRepo.listPublic(db),
  ]);
  const seoDefaults = defaultSeo(lang, layout.settings);
  const footerText = lang === 'zh' ? layout.settings.footer_text_zh : layout.settings.footer_text_en;
  const seo = buildSeo(c.env.SITE_URL, {
    title: seoDefaults.title,
    description: footerText || seoDefaults.description,
    path: `/${lang}/`,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={`/${lang}/`} preloadImage={banners[0]?.image} {...layout}>
      <HomePage
        lang={lang}
        banners={banners}
        categories={layout.categories}
        homeSections={homeSections}
        settings={layout.settings}
      />
    </Layout>,
  );
}

// 注：挂载于 /en、/zh 后，get('/') 实际匹配 '/en'、'/zh'；带尾斜杠的 '/en/' 在入口显式注册
frontend.get('/', homeHandler);
frontend.get('', homeHandler);

// ------------------------------------------------------------ 产品列表

frontend.get('/products', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const { page } = parsePage({ page: c.req.query('page') }, 12);
  const catRaw = Number.parseInt(c.req.query('category') ?? '', 10);
  const activeCategory = Number.isFinite(catRaw) && catRaw > 0 ? catRaw : null;

  const [categories, layout, data] = await Promise.all([
    CategoryRepo.list(db),
    getLayoutData(db),
    ProductRepo.listPublic(db, activeCategory, page, 12),
  ]);

  const currentPath = `/${lang}/products${activeCategory ? `?category=${activeCategory}` : ''}`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'products_page_title')} | ${seoDefaults.title}`,
    description: t(lang, 'products_page_desc') || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <ProductsPage lang={lang} categories={categories} activeCategory={activeCategory} data={data} />
    </Layout>,
  );
});

// ------------------------------------------------------------ 产品详情

frontend.get('/products/:id', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return renderNotFound(c);

  const product = await ProductRepo.findPublicById(db, id);
  if (!product) return renderNotFound(c);

  const [category, layout] = await Promise.all([
    CategoryRepo.findById(db, product.category_id),
    getLayoutData(db),
  ]);

  const name = lang === 'zh' ? product.name_zh : product.name_en;
  const summary = lang === 'zh' ? product.summary_zh : product.summary_en;
  const catName = category ? (lang === 'zh' ? category.name_zh : category.name_en) : '';
  const currentPath = `/${lang}/products/${product.id}`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${name} | ${catName ? `${catName} | ` : ''}${seoDefaults.title}`,
    description: summary || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <ProductDetailPage
        lang={lang}
        product={product}
        images={parseImages(product.images)}
        category={category}
        settings={layout.settings}
      />
    </Layout>,
  );
});

// ------------------------------------------------------------ 文章列表

frontend.get('/news', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const { page } = parsePage({ page: c.req.query('page') }, 10);
  const [layout, data] = await Promise.all([
    getLayoutData(db),
    ArticleRepo.listPublic(db, page, 10),
  ]);
  const currentPath = `/${lang}/news`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'news_page_title')} | ${seoDefaults.title}`,
    description: t(lang, 'news_page_desc') || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <ArticleListPage lang={lang} data={data} />
    </Layout>,
  );
});

// ------------------------------------------------------------ 文章详情

frontend.get('/news/:id', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const id = Number.parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return renderNotFound(c);

  const article = await ArticleRepo.findPublicById(db, id);
  if (!article) return renderNotFound(c);

  const layout = await getLayoutData(db);
  const title = lang === 'zh' ? article.title_zh : article.title_en;
  const summary = lang === 'zh' ? article.summary_zh : article.summary_en;
  const currentPath = `/${lang}/news/${article.id}`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${title} | ${seoDefaults.title}`,
    description: summary || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <ArticleDetailPage lang={lang} article={article} />
    </Layout>,
  );
});

// -------------------------------------------------------------- 合作伙伴

frontend.get('/partners', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const [page, layout] = await Promise.all([
    PagesRepo.findPublicBySlug(db, 'partners'),
    getLayoutData(db),
  ]);
  if (!page) return renderNotFound(c);
  const currentPath = `/${lang}/partners`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'partners_page_title')} | ${seoDefaults.title}`,
    description: t(lang, 'partners_page_desc') || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <PartnersPage lang={lang} page={page} settings={layout.settings} />
    </Layout>,
  );
});

// -------------------------------------------------------------- 关于我

frontend.get('/about', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const [page, layout] = await Promise.all([
    PagesRepo.findPublicBySlug(db, 'about'),
    getLayoutData(db),
  ]);
  if (!page) return renderNotFound(c);
  const currentPath = `/${lang}/about`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'about_page_title')} | ${seoDefaults.title}`,
    description: t(lang, 'about_page_desc') || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <AboutPage lang={lang} page={page} />
    </Layout>,
  );
});

// ---------------------------------------------------------- 联系/询盘

frontend.get('/contact', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const layout = await getLayoutData(db);
  const productRef = (c.req.query('product') ?? '').slice(0, 200);
  const specs = (c.req.query('specs') ?? '').slice(0, 300);
  const currentPath = `/${lang}/contact`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${t(lang, 'contact_page_title')} | ${seoDefaults.title}`,
    description: t(lang, 'contact_page_desc') || seoDefaults.description,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <ContactPage lang={lang} settings={layout.settings} productRef={productRef} specs={specs} />
    </Layout>,
  );
});

// --------------------------------------- 自定义页面（页面管理，动态 slug）
// 注意：必须注册在所有具名路由之后，避免吞掉 /products /news 等

frontend.get('/:slug', async (c) => {
  const lang = c.get('lang');
  const db = c.env.DB;
  const slug = c.req.param('slug');
  const page = await PagesRepo.findPublicBySlug(db, slug);
  if (!page) return renderNotFound(c);

  const layout = await getLayoutData(db);
  const title = lang === 'zh' ? page.title_zh : page.title_en;
  const currentPath = `/${lang}/${page.slug}`;
  const seoDefaults = defaultSeo(lang, layout.settings);
  const pageDesc =
    (lang === 'zh' ? page.seo_description_zh : page.seo_description_en) || title || seoDefaults.description;
  const seo = buildSeo(c.env.SITE_URL, {
    title: `${title} | ${seoDefaults.title}`,
    description: pageDesc,
    path: currentPath,
  });
  return c.html(
    <Layout lang={lang} seo={seo} currentPath={currentPath} {...layout}>
      <CustomPage lang={lang} page={page} />
    </Layout>,
  );
});

// ------------------------------------------------- sitemap.xml / robots

export async function sitemapHandler(c: C): Promise<Response> {
  const db = c.env.DB;
  const base = c.env.SITE_URL.replace(/\/+$/, '');
  const urls: string[] = [];
  const push = (p: string): void => {
    urls.push(`${base}/en${p}`, `${base}/zh${p}`);
  };
  push('/');
  push('/products');
  push('/news');
  push('/partners');
  push('/about');
  push('/contact');

  const [products, articles, pages] = await Promise.all([
    db.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id ASC').all<{ id: number }>(),
    db.prepare("SELECT id FROM articles WHERE status = 'published' ORDER BY id ASC").all<{ id: number }>(),
    db.prepare('SELECT slug FROM pages WHERE is_active = 1 ORDER BY id ASC').all<{ slug: string }>(),
  ]);
  for (const r of products.results ?? []) push(`/products/${r.id}`);
  for (const r of articles.results ?? []) push(`/news/${r.id}`);
  for (const r of pages.results ?? []) push(`/${r.slug}`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export function robotsHandler(c: C): Response {
  const base = c.env.SITE_URL.replace(/\/+$/, '');
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
}
