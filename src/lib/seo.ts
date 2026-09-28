/**
 * SEO 工具：构造 title / description / canonical / hreflang（en、zh 互链）
 * 所有前台页面必须经 buildSeo() 生成（共享知识第 11 条）
 */

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  alternates: { en: string; zh: string };
}

export interface SeoInput {
  title: string;
  description: string;
  /** 含语言前缀的路径，如 /en/products 或 /zh/news/3 */
  path: string;
}

/**
 * 生成 SEO 元数据
 * canonical 指向当前语言版本；alternates 为 en/zh 两个绝对 URL
 */
export function buildSeo(siteUrl: string, opts: SeoInput): SeoMeta {
  const base = siteUrl.replace(/\/+$/, '');
  let path = opts.path.startsWith('/') ? opts.path : `/${opts.path}`;
  // 去掉语言前缀得到语言无关后缀
  let suffix = path.replace(/^\/(en|zh)(?=\/|$)/, '');
  if (suffix === '') suffix = '/';
  return {
    title: opts.title,
    description: opts.description,
    canonical: `${base}${path}`,
    alternates: {
      en: `${base}/en${suffix}`,
      zh: `${base}/zh${suffix}`,
    },
  };
}

/** 仅取语言切换用的相对路径对（前台语言切换链接） */
export function alternatePaths(path: string): { en: string; zh: string } {
  let p = path.startsWith('/') ? path : `/${path}`;
  let suffix = p.replace(/^\/(en|zh)(?=\/|$)/, '');
  if (suffix === '') suffix = '/';
  return { en: `/en${suffix}`, zh: `/zh${suffix}` };
}
