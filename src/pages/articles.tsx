/**
 * 文章页：新闻列表（分页）与文章详情
 */

import type { FC } from 'hono/jsx';
import type { Article, Lang, Page } from '../types';
import { t } from '../i18n/ui';

function pick(lang: Lang, obj: Record<string, string>, base: string): string {
  return lang === 'zh' ? obj[`${base}_zh`] ?? '' : obj[`${base}_en`] ?? '';
}

/** ISO 时间 → YYYY-MM-DD */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// -------------------------------------------------------- 文章列表页

interface ArticleListPageProps {
  lang: Lang;
  data: Page<Article>;
}

export const ArticleListPage: FC<ArticleListPageProps> = ({ lang, data }) => {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (p: number): string => `/${lang}/news?page=${p}`;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{t(lang, 'news_page_title')}</span>
          </nav>
          <h1>{t(lang, 'news_page_title')}</h1>
          <p class="page-desc">{t(lang, 'news_page_desc')}</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          {data.items.length === 0 ? (
            <p class="empty-tip">{t(lang, 'no_articles')}</p>
          ) : (
            <div class="article-list">
              {data.items.map((a) => (
                <a class="article-item" href={`/${lang}/news/${a.id}`}>
                  <div class="article-thumb">
                    {a.cover_image ? (
                      <img
                        src={a.cover_image}
                        alt={pick(lang, a as unknown as Record<string, string>, 'title')}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div class="article-body">
                    <h3>{pick(lang, a as unknown as Record<string, string>, 'title')}</h3>
                    <p class="article-date">
                      {t(lang, 'published_on')} {fmtDate(a.published_at)}
                    </p>
                    <p class="article-summary">
                      {pick(lang, a as unknown as Record<string, string>, 'summary')}
                    </p>
                    <span class="read-more">{t(lang, 'read_more')} &rarr;</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav class="pagination" aria-label="Pagination">
              {data.page > 1 ? (
                <a class="page-btn" href={link(data.page - 1)}>
                  {t(lang, 'prev_page')}
                </a>
              ) : null}
              {pages.map((p) => (
                <a class={p === data.page ? 'page-btn current' : 'page-btn'} href={link(p)}>
                  {p}
                </a>
              ))}
              {data.page < totalPages ? (
                <a class="page-btn" href={link(data.page + 1)}>
                  {t(lang, 'next_page')}
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
};

// -------------------------------------------------------- 文章详情页

interface ArticleDetailPageProps {
  lang: Lang;
  article: Article;
}

export const ArticleDetailPage: FC<ArticleDetailPageProps> = ({ lang, article }) => {
  const title = pick(lang, article as unknown as Record<string, string>, 'title');
  const content = pick(lang, article as unknown as Record<string, string>, 'content');

  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <a href={`/${lang}/news`}>{t(lang, 'news_page_title')}</a>
            <span>/</span>
            <span>{title}</span>
          </nav>
        </div>
      </section>

      <section class="section">
        <div class="container article-detail">
          <h1 class="article-title">{title}</h1>
          <p class="article-date center">
            {t(lang, 'published_on')} {fmtDate(article.published_at)}
          </p>
          {article.cover_image ? (
            <div class="article-cover">
              <img src={article.cover_image} alt={title} />
            </div>
          ) : null}
          <div class="rich-text article-content" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </section>
    </>
  );
};
