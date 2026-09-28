/**
 * 前台固定 UI 文案字典（中英双语）
 * 内容文案一律读数据库 *_zh/*_en 字段；此处只放导航、按钮、表单标签等固定文案
 * 禁止在 JSX 中写死文案（共享知识第 7 条）
 */

import type { Lang } from '../types';

const dict: Record<string, { en: string; zh: string }> = {
  site_name: { en: 'Wanxu CMS', zh: '晚叙 CMS' },
  site_logo_text: { en: 'WANXU', zh: '晚叙' },
  site_tagline: {
    en: 'Corporate website and content management for global trade',
    zh: '外贸企业官网与内容管理，一站搞定',
  },

  nav_home: { en: 'Home', zh: '首页' },
  nav_products: { en: 'Products', zh: '产品' },
  nav_partners: { en: 'Partners', zh: '合作伙伴' },
  nav_about: { en: 'About Me', zh: '关于我' },
  nav_news: { en: 'News', zh: '新闻资讯' },
  nav_contact: { en: 'Contact', zh: '联系我们' },

  search_btn: { en: 'Search', zh: '搜索' },
  search_placeholder: { en: 'Search products, articles, pages…', zh: '搜索产品、文章、页面…' },
  search_modal_title: { en: 'Site Search', zh: '全站搜索' },
  search_loading: { en: 'Searching…', zh: '正在搜索…' },
  search_no_results: { en: 'No results found.', zh: '没有找到相关结果。' },
  search_results_products: { en: 'Products', zh: '产品' },
  search_results_articles: { en: 'Articles', zh: '文章' },
  search_results_pages: { en: 'Pages', zh: '页面' },
  search_close: { en: 'Close', zh: '关闭' },

  hero_cta: { en: 'Featured Products', zh: '精选产品' },

  story_title: { en: 'Our Story', zh: '品牌故事' },
  learn_more: { en: 'Learn More', zh: '了解更多' },
  store_inquiry_btn: { en: 'Send Inquiry', zh: '立即询盘' },
  store_email_btn: { en: 'Email Us', zh: '邮件联系' },

  featured_products: { en: 'Featured Products', zh: '特色产品' },
  view_all_products: { en: 'View All Products', zh: '查看全部产品' },

  home_about_title: { en: 'About Us', zh: '关于我们' },
  home_about_btn: { en: 'About Us', zh: '了解我们' },

  footer_intro: {
    en: 'A content management system built for export businesses — website, products, inquiries and content, all editable from one dashboard.',
    zh: '为外贸企业而生的内容管理系统——官网、产品、询盘与内容，一个后台全部可编辑。',
  },
  footer_links: { en: 'Quick Links', zh: '快捷导航' },
  footer_contact: { en: 'Contact Us', zh: '联系方式' },
  footer_developer: { en: 'Developer', zh: '开发者信息' },
  footer_rights: { en: 'All rights reserved.', zh: '版权所有。' },
  dev_tel_label: { en: 'TEL', zh: '电话' },
  dev_mail_label: { en: 'MAIL', zh: '邮箱' },
  dev_wechat_label: { en: 'WECHAT', zh: '微信号' },
  contact_address_label: { en: 'Address', zh: '地址' },
  contact_phone_label: { en: 'Phone', zh: '电话' },
  contact_email_label: { en: 'Email', zh: '邮箱' },
  contact_wechat_label: { en: 'WeChat', zh: '微信' },
  contact_whatsapp_label: { en: 'WhatsApp', zh: 'WhatsApp' },
  contact_overseas_phone_label: { en: 'Overseas Phone', zh: '海外电话' },
  contact_custom_label: { en: 'Other', zh: '其他' },
  contact_hours_label: { en: 'Working Hours', zh: '工作时间' },

  breadcrumb_home: { en: 'Home', zh: '首页' },
  all_categories: { en: 'All Products', zh: '全部产品' },

  products_page_title: { en: 'Products', zh: '产品中心' },
  products_page_desc: {
    en: 'Browse our full range of artificial trees, flowers, green walls and potted plants.',
    zh: '浏览仿真树、仿真花、植物墙与仿真盆栽全线产品。',
  },
  no_products: { en: 'No products found in this category yet.', zh: '该分类下暂无产品。' },

  sizes: { en: 'Sizes', zh: '尺寸' },
  colors: { en: 'Colors', zh: '颜色' },
  send_inquiry: { en: 'Send Inquiry', zh: '站内询盘' },
  send_email_inquiry: { en: 'Email Inquiry', zh: '邮件询盘' },
  product_description: { en: 'Description', zh: '详细描述' },
  product_params: { en: 'Specifications', zh: '产品参数' },
  product_not_found: { en: 'Product not found.', zh: '产品不存在或已下架。' },
  spec_packaging: { en: 'Packaging', zh: '包装' },
  spec_material: { en: 'Material', zh: '材质' },
  selected_specs: { en: 'Selected', zh: '已选' },
  zoom_image: { en: 'Zoom', zh: '放大' },
  zoom_close: { en: 'Close (Esc)', zh: '关闭 (Esc)' },
  zoom_prev: { en: 'Previous image', zh: '上一张' },
  zoom_next: { en: 'Next image', zh: '下一张' },

  partners_logos_title: { en: 'Trusted by Partners Worldwide', zh: '合作伙伴与客户' },
  icp_label: { en: 'ICP License', zh: 'ICP 备案' },

  partners_page_title: { en: 'Partners', zh: '合作伙伴' },
  partners_page_desc: {
    en: 'We collaborate with wholesalers, contractors and retail brands worldwide.',
    zh: '我们与全球批发商、工程商与零售品牌长期合作，共创价值。',
  },

  news_page_title: { en: 'News & Insights', zh: '新闻资讯' },
  news_page_desc: {
    en: 'Industry trends, product knowledge and company updates.',
    zh: '行业趋势、产品知识与企业动态。',
  },
  read_more: { en: 'Read More', zh: '阅读全文' },
  published_on: { en: 'Published on', zh: '发布于' },
  no_articles: { en: 'No articles published yet.', zh: '暂无已发布的文章。' },
  article_not_found: { en: 'Article not found.', zh: '文章不存在或未发布。' },

  about_page_title: { en: 'About Us', zh: '关于我们' },
  about_page_desc: {
    en: 'Learn about our factory, capacity and quality commitment.',
    zh: '了解我们的工厂、产能与品质承诺。',
  },

  contact_page_title: { en: 'Contact Us', zh: '联系我们' },
  contact_page_desc: {
    en: 'Send us an inquiry and our sales team will reply within 24 hours.',
    zh: '提交询盘，我们的销售团队将在 24 小时内回复。',
  },
  contact_info_title: { en: 'Get in Touch', zh: '联系方式' },

  form_name: { en: 'Name', zh: '姓名' },
  form_email: { en: 'Email', zh: '邮箱' },
  form_company: { en: 'Company', zh: '公司名' },
  form_country: { en: 'Country', zh: '国家' },
  form_message: { en: 'Message', zh: '留言内容' },
  form_submit: { en: 'Submit Inquiry', zh: '提交询盘' },
  form_required_mark: { en: '*', zh: '*' },
  form_optional: { en: 'optional', zh: '选填' },
  inquiry_product_label: { en: 'Inquiry about', zh: '咨询产品' },

  success_title: { en: 'Thank You!', zh: '提交成功！' },
  success_message: {
    en: 'Your inquiry has been received. Our sales team will get back to you within 24 hours.',
    zh: '您的询盘已收到，销售团队将在 24 小时内与您联系。',
  },

  err_required: { en: 'This field is required.', zh: '该字段为必填项。' },
  err_email: { en: 'Please enter a valid email address.', zh: '请输入正确的邮箱地址。' },
  err_generic: {
    en: 'Submission failed. Please try again later.',
    zh: '提交失败，请稍后重试。',
  },

  prev_page: { en: 'Previous', zh: '上一页' },
  next_page: { en: 'Next', zh: '下一页' },
  page_separator: { en: '/', zh: '/' },

  notfound_title: { en: 'Page Not Found', zh: '页面未找到' },
  notfound_desc: {
    en: 'The page you are looking for does not exist or has been moved.',
    zh: '您访问的页面不存在或已被移动。',
  },
  back_home: { en: 'Back to Home', zh: '返回首页' },

  server_error_title: { en: 'Something Went Wrong', zh: '服务器开小差了' },
  server_error_desc: {
    en: 'An unexpected error occurred. Please try again later.',
    zh: '发生了意外错误，请稍后重试。',
  },
};

/**
 * 取固定文案；key 不存在时返回 key 本身便于排查
 */
export function t(lang: Lang, key: string): string {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}
