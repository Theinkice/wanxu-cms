/**
 * 静态内容页：关于我们 + 联系/询盘
 */

import type { FC } from 'hono/jsx';
import type { CmsPage, Lang, PageContent } from '../types';
import { t } from '../i18n/ui';
import { Copyable } from '../components/copyable';

// ---------------------------------------------------------- 关于我们页

interface AboutPageProps {
  lang: Lang;
  page: CmsPage;
}

export const AboutPage: FC<AboutPageProps> = ({ lang, page }) => {
  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{t(lang, 'about_page_title')}</span>
          </nav>
          <h1>{t(lang, 'about_page_title')}</h1>
          <p class="page-desc">{t(lang, 'about_page_desc')}</p>
        </div>
      </section>

      <section class="section">
        <div class="container about-page">
          {page.cover_image ? (
            <div class="about-hero">
              <img src={page.cover_image} alt={t(lang, 'about_page_title')} />
            </div>
          ) : null}
          <div
            class="rich-text"
            dangerouslySetInnerHTML={{ __html: lang === 'zh' ? page.content_zh : page.content_en }}
          />
          <div class="section-cta">
            <a class="btn btn-primary" href={`/${lang}/contact`}>
              {t(lang, 'nav_contact')}
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

// ---------------------------------------------------------- 自定义页面（页面管理）

interface CustomPageProps {
  lang: Lang;
  page: CmsPage;
}

export const CustomPage: FC<CustomPageProps> = ({ lang, page }) => {
  const title = lang === 'zh' ? page.title_zh : page.title_en;
  const content = lang === 'zh' ? page.content_zh : page.content_en;
  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{title}</span>
          </nav>
          <h1>{title}</h1>
        </div>
      </section>
      <section class="section">
        <div class="container about-page">
          {page.cover_image ? (
            <div class="about-hero">
              <img src={page.cover_image} alt={title} />
            </div>
          ) : null}
          <div class="rich-text" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </section>
    </>
  );
};

// ---------------------------------------------------------- 合作伙伴页

interface PartnersPageProps {
  lang: Lang;
  page: CmsPage;
  /** 站点设置（合作伙伴 logo 墙等） */
  settings: Record<string, string>;
}

function parseLogos(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

export const PartnersPage: FC<PartnersPageProps> = ({ lang, page, settings }) => {
  const logos = parseLogos(settings.partners_logos);
  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{t(lang, 'partners_page_title')}</span>
          </nav>
          <h1>{t(lang, 'partners_page_title')}</h1>
          <p class="page-desc">{t(lang, 'partners_page_desc')}</p>
        </div>
      </section>

      <section class="section">
        <div class="container about-page">
          {page.cover_image ? (
            <div class="about-hero">
              <img src={page.cover_image} alt={t(lang, 'partners_page_title')} />
            </div>
          ) : null}
          <div
            class="rich-text"
            dangerouslySetInnerHTML={{ __html: lang === 'zh' ? page.content_zh : page.content_en }}
          />

          {logos.length > 0 ? (
            <div class="partners-logos">
              <h2 class="section-title center">{t(lang, 'partners_logos_title')}</h2>
              <div class="logos-grid">
                {logos.map((l) => (
                  <div class="logo-slot">
                    <img src={l} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div class="section-cta">
            <a class="btn btn-primary" href={`/${lang}/contact`}>
              {t(lang, 'nav_contact')}
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

// -------------------------------------------------------- 联系/询盘页

interface ContactPageProps {
  lang: Lang;
  /** 全站设置中的联系信息（电话、邮箱、地址等） */
  settings: Record<string, string>;
  /** 产品详情页带入的来源产品名 */
  productRef: string;
  /** 详情页选中的规格（尺寸/颜色），随询盘一并记录 */
  specs: string;
}

export const ContactPage: FC<ContactPageProps> = ({ lang, settings, productRef, specs }) => {
  return (
    <>
      <section class="page-head">
        <div class="container">
          <nav class="breadcrumb">
            <a href={`/${lang}/`}>{t(lang, 'breadcrumb_home')}</a>
            <span>/</span>
            <span>{t(lang, 'contact_page_title')}</span>
          </nav>
          <h1>{t(lang, 'contact_page_title')}</h1>
          <p class="page-desc">{t(lang, 'contact_page_desc')}</p>
        </div>
      </section>

      <section class="section">
        <div class="container contact-grid">
          <div class="contact-info">
            <h2>{t(lang, 'contact_info_title')}</h2>
            <div class="rich-text">
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

          <div class="contact-form-card">
            <form
              id="inquiry-form"
              data-err-required={t(lang, 'err_required')}
              data-err-email={t(lang, 'err_email')}
              data-err-generic={t(lang, 'err_generic')}
              novalidate
            >
              {productRef ? (
                <div class="form-product-ref">
                  <span>
                    {t(lang, 'inquiry_product_label')}: <strong>{productRef}</strong>
                  </span>
                  {specs ? <span class="form-specs">{specs}</span> : null}
                </div>
              ) : null}
              <input type="hidden" name="product_ref" value={specs ? `${productRef}（${specs}）` : productRef} />

              <div class="form-group">
                <label for="f-name">
                  {t(lang, 'form_name')} <em>{t(lang, 'form_required_mark')}</em>
                </label>
                <input type="text" id="f-name" name="name" maxlength={100} />
                <p class="field-error" data-error-for="name"></p>
              </div>

              <div class="form-group">
                <label for="f-email">
                  {t(lang, 'form_email')} <em>{t(lang, 'form_required_mark')}</em>
                </label>
                <input type="email" id="f-email" name="email" maxlength={200} />
                <p class="field-error" data-error-for="email"></p>
              </div>

              <div class="form-group">
                <label for="f-company">
                  {t(lang, 'form_company')}{' '}
                  <span class="optional">({t(lang, 'form_optional')})</span>
                </label>
                <input type="text" id="f-company" name="company" maxlength={200} />
              </div>

              <div class="form-group">
                <label for="f-country">
                  {t(lang, 'form_country')}{' '}
                  <span class="optional">({t(lang, 'form_optional')})</span>
                </label>
                <input type="text" id="f-country" name="country" maxlength={100} />
              </div>

              <div class="form-group">
                <label for="f-message">
                  {t(lang, 'form_message')} <em>{t(lang, 'form_required_mark')}</em>
                </label>
                <textarea id="f-message" name="message" rows={6} maxlength={2000}></textarea>
                <p class="field-error" data-error-for="message"></p>
              </div>

              <button type="submit" class="btn btn-primary btn-lg btn-block">
                {t(lang, 'form_submit')}
              </button>
            </form>

            <div class="inquiry-success" id="inquiry-success" hidden>
              <div class="success-icon">&#10004;</div>
              <h3>{t(lang, 'success_title')}</h3>
              <p>{t(lang, 'success_message')}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
