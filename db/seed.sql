-- 晚叙 CMS 初始种子数据（演示内容；图片为 samples 实拍素材 public/images/samples/，正式上线请在后台上传真实图片替换）
-- 管理员: admin / Admin@12345（PBKDF2 100000 次迭代 SHA-256，哈希由脚本真实生成）

DELETE FROM inquiries;
DELETE FROM site_settings;
DELETE FROM nav_items;
DELETE FROM pages;
DELETE FROM home_sections;
DELETE FROM page_contents;
DELETE FROM banners;
DELETE FROM articles;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM sessions;
DELETE FROM admin_users;
-- 重置自增序列，保证重放 seed 后 id 从 1 开始（幂等）
DELETE FROM sqlite_sequence WHERE name IN ('admin_users', 'sessions', 'categories', 'products', 'articles', 'banners', 'page_contents', 'nav_items', 'pages', 'home_sections', 'inquiries');

INSERT INTO admin_users (username, password_hash, role, email, created_at) VALUES
('admin', 'pbkdf2$100000$97085a047b055b69d4c75b76996a1b1f$d45074d9400e71084adbc7a800298a1b964831edb78dcb9312bebfd5c2fd842e', 'super_admin', 'admin@dsriji.com', '2025-09-01T08:00:00.000Z');

-- 默认导航 8 项（一级导航）。产品中心的下拉二级分类由前台自动读取 categories 表生成。
INSERT INTO nav_items (id, parent_id, label_zh, label_en, url, sort_order, is_active) VALUES
(1, 0, '首页', 'Home', '/', 1, 1),
(2, 0, '产品中心', 'Products', '/products', 2, 1),
(3, 0, '工程案例', 'Projects', '/projects', 3, 1),
(4, 0, '关于我们', 'About', '/about', 4, 1),
(5, 0, '资质证书', 'Certificates', '/certificates', 5, 1),
(6, 0, '资讯', 'Blog', '/news', 6, 1),
(7, 0, '联系我们', 'Contact', '/contact', 7, 1),
(8, 0, '合作伙伴', 'Partners', '/partners', 8, 1);

INSERT INTO site_settings (key, value, updated_at) VALUES
('site_name', '晚叙 CMS', '2025-09-01T08:00:00.000Z'),
('site_name_zh', '晚叙 CMS', '2025-09-01T08:00:00.000Z'),
('site_slogan_zh', '外贸企业官网与内容管理，一站搞定', '2025-09-01T08:00:00.000Z'),
('site_slogan_en', 'Corporate website and content management for global trade, all in one', '2025-09-01T08:00:00.000Z'),
('logo_image', '', '2025-09-01T08:00:00.000Z'),
('logo_image_zh', '', '2025-09-01T08:00:00.000Z'),
('favicon', '/favicon.svg', '2025-09-01T08:00:00.000Z'),
('primary_color', '#164147', '2025-09-01T08:00:00.000Z'),
('accent_color', '#EDBE77', '2025-09-01T08:00:00.000Z'),
('footer_text_zh', '晚叙 CMS — 为外贸企业而生的官网内容管理系统', '2025-09-01T08:00:00.000Z'),
('footer_text_en', 'Wanxu CMS — a content management system built for export businesses', '2025-09-01T08:00:00.000Z'),
('home_sections', '["hero","categories","services","brands","store"]', '2025-09-01T08:00:00.000Z'),
-- 联系信息
('contact_email', 'sales@example.com', '2025-09-01T08:00:00.000Z'),
('contact_phone', '+86 138 0000 0000', '2025-09-01T08:00:00.000Z'),
('contact_address_zh', '广东省东莞市绿色产业园 A 栋', '2025-09-01T08:00:00.000Z'),
('contact_address_en', 'Building A, Green Industrial Park, Dongguan, Guangdong, China', '2025-09-01T08:00:00.000Z'),
('contact_wechat', 'CorinLin', '2025-09-01T08:00:00.000Z'),
('contact_whatsapp', '+86 138 0000 0000', '2025-09-01T08:00:00.000Z'),
('contact_working_hours_zh', '周一至周六 9:00 - 18:00（GMT+8）', '2025-09-01T08:00:00.000Z'),
('contact_working_hours_en', 'Monday to Saturday, 9:00 - 18:00 (GMT+8)', '2025-09-01T08:00:00.000Z'),
-- 海外联系方式（演示）
('contact_overseas_phone', '+1 (555) 123-4567', '2025-09-01T08:00:00.000Z'),
-- 自定义联系方式（演示）
('contact_custom_1_label_zh', 'Skype', '2025-09-01T08:00:00.000Z'),
('contact_custom_1_label_en', 'Skype', '2025-09-01T08:00:00.000Z'),
('contact_custom_1_value', 'live:wanxu.cms', '2025-09-01T08:00:00.000Z'),
('contact_custom_2_label_zh', 'Telegram', '2025-09-01T08:00:00.000Z'),
('contact_custom_2_label_en', 'Telegram', '2025-09-01T08:00:00.000Z'),
('contact_custom_2_value', '@wanxu_cms', '2025-09-01T08:00:00.000Z'),
-- 社交账号
('social_facebook', 'https://www.facebook.com/wanxu.cms', '2025-09-01T08:00:00.000Z'),
('social_instagram', 'https://www.instagram.com/wanxu.cms', '2025-09-01T08:00:00.000Z'),
('social_linkedin', 'https://www.linkedin.com/company/wanxu-cms', '2025-09-01T08:00:00.000Z'),
('social_twitter', 'https://x.com/wanxu_cms', '2025-09-01T08:00:00.000Z'),
('social_youtube', 'https://www.youtube.com/@wanxu_cms', '2025-09-01T08:00:00.000Z'),
-- SEO 默认
('seo_default_title_zh', '晚叙 CMS — 外贸企业官网与内容管理', '2025-09-01T08:00:00.000Z'),
('seo_default_title_en', 'Wanxu CMS — Corporate Website & Content Management', '2025-09-01T08:00:00.000Z'),
('seo_default_description_zh', '晚叙 CMS 为外贸企业提供官网搭建、产品管理、询盘跟进与内容发布的一站式解决方案。', '2025-09-01T08:00:00.000Z'),
('seo_default_description_en', 'Wanxu CMS provides export businesses with corporate websites, product management, inquiry tracking and content publishing in one place.', '2025-09-01T08:00:00.000Z'),
-- 第三方代码
('head_code', '', '2025-09-01T08:00:00.000Z'),
-- 开发者信息
('dev_name', '大叔日记', '2025-09-01T08:00:00.000Z'),
('dev_url', 'https://www.dsriji.com/', '2025-09-01T08:00:00.000Z'),
('dev_tel', '', '2025-09-01T08:00:00.000Z'),
('dev_mail', 'admin@dsriji.com', '2025-09-01T08:00:00.000Z'),
('dev_wechat', 'CorinLin', '2025-09-01T08:00:00.000Z'),
('dev_wechat_qr', '/images/wechat-qr.webp', '2025-09-01T08:00:00.000Z'),
-- 询盘 / 邮件
('inquiry_recipient', 'admin@dsriji.com', '2025-09-01T08:00:00.000Z'),
('smtp_enabled', '0', '2025-09-01T08:00:00.000Z'),
('smtp_host', '', '2025-09-01T08:00:00.000Z'),
('smtp_port', '587', '2025-09-01T08:00:00.000Z'),
('smtp_user', '', '2025-09-01T08:00:00.000Z'),
('smtp_pass', '', '2025-09-01T08:00:00.000Z'),
('smtp_from', '', '2025-09-01T08:00:00.000Z'),
('smtp_from_name', '', '2025-09-01T08:00:00.000Z'),
('smtp_notify_enabled', '1', '2025-09-01T08:00:00.000Z'),
-- 备案
('icp_number', '', '2025-09-01T08:00:00.000Z'),
('icp_enabled', '0', '2025-09-01T08:00:00.000Z'),
('partners_logos', '[]', '2025-09-01T08:00:00.000Z');

-- 默认自定义页面（工程案例 / 资质证书 / 关于我们 / 合作伙伴），后台"页面管理"可增删改
INSERT INTO pages (id, slug, title_zh, title_en, content_zh, content_en, cover_image, is_active, sort_order, created_at, updated_at) VALUES
(1, 'projects', '工程案例', 'Projects / Cases', '<p>我们为全球酒店、商业空间、展会与办公场所提供仿真植物整体方案，从方案设计、选品打样到现场安装一站式服务。</p><h3>代表案例</h3><ul><li><strong>五星酒店大堂</strong> — 12 米挑高仿真树组合造景</li><li><strong>商场中庭</strong> — 800㎡ 模块化绿植墙</li><li><strong>连锁餐厅</strong> — 仿真橄榄树 + 苔藓墙主题美陈</li><li><strong>企业总部办公区</strong> — 仿真盆栽与隔断绿化</li></ul><div class="page-gallery"><img src="/images/samples/case-1.jpg" alt="五星酒店大堂仿真树造景"/><img src="/images/samples/case-2.jpg" alt="商场中庭绿植墙"/></div>', '<p>We deliver complete artificial greenery solutions for hotels, commercial spaces, exhibitions and offices worldwide — from design and sampling to on-site installation.</p><p>Below are selected cases (replace with your real project images and descriptions here).</p><div class="page-gallery"><img src="/images/samples/case-1.jpg" alt="Hotel lobby tree landscaping"/><img src="/images/samples/case-2.jpg" alt="Mall atrium green wall"/></div>', '', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(2, 'certificates', '资质证书', 'Certificates', '<p>我们提供符合出口目的国要求的全套检测与认证文件，支撑您的清关与采购合规。</p><ul><li>植物检疫证书（Phytosanitary Certificate）</li><li>苗圃种植资质 / 出口备案</li><li>SGS 阻燃等级检测报告</li><li>抗 UV 耐候测试报告</li><li>ISO 9001 质量管理体系认证</li></ul>', '<p>We provide inspection and certification documents that meet destination-market requirements, including phytosanitary certificates, nursery qualifications, fire ratings and UV-resistance.</p><p>Upload and showcase your phytosanitary certificates, nursery qualifications and SGS reports here.</p>', '', 1, 2, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(3, 'about', '关于我们', 'About Us', '<p>我们是一家专注仿真植物研发与制造的外贸工厂，产品线覆盖仿真树、仿真花艺、微景观、悬挂植物、盆栽与绿雕六大品类，SKU 超过八百个。</p><p>工厂面积一万平方米，设有独立的打样间与检测实验室，所有出口产品均可按目的国要求提供阻燃、抗 UV 等检测报告。</p><p>十余年外贸经验让我们的团队熟悉欧美商超、批发商与工程项目不同的采购逻辑，支持 OEM、ODM 与整柜混批，交期稳定，沟通高效。</p>', '<p>We are an export-oriented factory dedicated to artificial plants, with six product lines covering trees, florals, terrariums, hanging plants, potted plants and topiary, and more than eight hundred SKUs.</p><p>Our 10,000-square-meter facility houses dedicated sampling rooms and a testing lab. Every export order can ship with flame-retardant and UV-resistance certificates as required by the destination market.</p><p>With over a decade of export experience, our team understands the distinct sourcing logic of European and American retailers, wholesalers and project contractors. OEM, ODM and mixed-container orders are all welcome, with stable lead times and responsive communication.</p>', '/images/samples/about-1.jpg', 1, 3, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(4, 'partners', '合作伙伴', 'Partners', '<p>我们与全球批发商、景观工程商与零售连锁品牌保持长期合作，提供 OEM/ODM 定制、整柜混批与项目配套服务。</p><p>欢迎渠道伙伴、设计机构与跨境电商卖家联系我们，获取专属合作政策与样品支持。</p><p><strong>合作品牌：</strong>ATELIER VERT · Flora+ · NATURA · BOTANIC LAB · EVERGREEN & CO. · OLIVE HOUSE</p>', '<p>We maintain long-term partnerships with wholesalers, landscape contractors and retail chains worldwide, offering OEM/ODM customization, mixed-container wholesale and project support.</p><p>Channel partners, design studios and cross-border e-commerce sellers are welcome to contact us for exclusive cooperation terms and sample support.</p><p><strong>Partner brands:</strong> ATELIER VERT · Flora+ · NATURA · BOTANIC LAB · EVERGREEN & CO. · OLIVE HOUSE</p>', '', 1, 4, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z');

-- 首页区块（sorher 式：特色商品 / 服务项目 / 品牌一览 / 数据统计 / 门店资讯，后台"首页内容"逐段可编辑）
INSERT INTO home_sections (id, key, title_zh, title_en, eyebrow_zh, eyebrow_en, items, content_zh, content_en, image, config, sort_order, is_active) VALUES
(1, 'hero', '晚叙 · 仿真植物美学', 'WANXU', '', '', '[]', '精选商品', 'Featured Products', '', '{"cta_link":"/products"}', 0, 1),
(2, 'categories', '特色商品', 'Featured Products', 'Feature Products', 'Feature Products', '[]', '', '', '', '{"category_ids":[]}', 1, 1),
(3, 'services', '服务项目', 'Services', 'Services', 'Services', '[{"title_zh":"家居装饰","title_en":"Home Decor","subtitle_zh":"客厅与商业空间整体美陈","subtitle_en":"Full styling for living & commercial spaces","image":"/images/samples/svc-decor.jpg","url":"/contact"},{"title_zh":"花艺设计","title_en":"Floral Design","subtitle_zh":"仿真花艺与节庆美陈方案","subtitle_en":"Faux floral & festive display schemes","image":"/images/samples/svc-floral.jpg","url":"/contact"},{"title_zh":"空间布置","title_en":"Interior Arrangement","subtitle_zh":"绿植墙与垂直绿化设计","subtitle_en":"Green walls & vertical garden design","image":"/images/samples/svc-interior.jpg","url":"/contact"},{"title_zh":"微景观定制","title_en":"Terrarium Studio","subtitle_zh":"玻璃瓶景个性定制","subtitle_en":"Custom-made glass terrariums","image":"/images/samples/svc-terrarium.jpg","url":"/contact"}]', '', '', '', '{"button_text_zh":"了解更多","button_text_en":"Learn More","button_link":"/contact"}', 2, 1),
(4, 'brands', '品牌一览', 'Our Brands', 'Brands', 'Brands', '[{"title_zh":"阿特利尔绿植","title_en":"ATELIER VERT","subtitle_zh":"","subtitle_en":"","image":"","url":""},{"title_zh":"花漾生活","title_en":"Flora+","subtitle_zh":"","subtitle_en":"","image":"","url":""},{"title_zh":"纳图拉","title_en":"NATURA","subtitle_zh":"","subtitle_en":"","image":"","url":""},{"title_zh":"植物实验室","title_en":"BOTANIC LAB","subtitle_zh":"","subtitle_en":"","image":"","url":""},{"title_zh":"常青工坊","title_en":"EVERGREEN & CO.","subtitle_zh":"","subtitle_en":"","image":"","url":""},{"title_zh":"橄榄屋","title_en":"OLIVE HOUSE","subtitle_zh":"","subtitle_en":"","image":"","url":""}]', '', '', '', '{"watermark":"WANXU"}', 3, 1),
(5, 'store', '厂家资讯', 'Our Factory', 'FACTORY DIRECT', 'FACTORY DIRECT', '[]', '<p><strong>工厂地址</strong></p><p>广东省东莞市绿色产业园 A 栋（自有厂房 8000㎡，欢迎预约参观）</p><p><strong>接待时间</strong></p><p>周一至周六 9:00 - 18:00（GMT+8）</p><p>支持 OEM / ODM 定制，样版间现场选样</p>', '<p><strong>Factory Address</strong></p><p>Building A, Green Industrial Park, Dongguan, Guangdong, China — 8,000㎡ owned facility, visits by appointment</p><p><strong>Reception Hours</strong></p><p>Monday to Saturday, 9:00 - 18:00 (GMT+8)</p><p>OEM / ODM customization welcomed, sample room open for selection</p>', '/images/samples/store.jpg', '{"button_text_zh":"立即询盘","button_text_en":"Send Inquiry","button_link":"/contact"}', 4, 1);

INSERT INTO categories (id, name_zh, name_en, subtitle_zh, subtitle_en, cover_image, sort_order, created_at, updated_at) VALUES
(1, '仿真树', 'Artificial Trees', '酒店大堂与展厅气质之选', 'Statement trees for lobbies & showrooms', '/images/samples/cat-trees.jpg', 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(2, '仿真花艺', 'Artificial Florals', '桌花、婚庆与家居装饰', 'Table, wedding & home decor', '/images/samples/cat-flowers.jpg', 2, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(3, '微景观', 'Terrariums', '玻璃瓶中的森林世界', 'Miniature forests in glass', '/images/samples/cat-terrarium.jpg', 3, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(4, '悬挂植物', 'Hanging Plants', '吊篮、苔玉与垂直绿化', 'Baskets, kokedama & vertical green', '/images/samples/cat-hanging.jpg', 4, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(5, '盆栽绿植', 'Potted Plants', '办公家具与门店陈列', 'Office & retail displays', '/images/samples/cat-pots.jpg', 5, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(6, '造型绿雕', 'Topiary', '园区造景与品牌装置', 'Landscaping & brand installations', '/images/samples/cat-topiary.jpg', 6, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z');

INSERT INTO products (category_id, name_zh, name_en, summary_zh, summary_en, description_zh, description_en, main_image, images, sizes, sizes_en, colors, colors_en, params_zh, params_en, sort_order, is_active, created_at, updated_at) VALUES
(1, '仿真幸福树', 'Artificial Happiness Tree', '枝叶舒展的幸福树，客厅与展厅的气质之选', 'A leafy happiness tree, a statement piece for lobbies and living rooms', '<p>仿真幸福树采用高仿真 PU 叶片与真木杆，叶脉纹理清晰，色泽自然。适用于酒店大堂、展厅、办公室等商业空间，无需养护，四季常青。</p><p>支持整柜混批，出口包装加固，提供尺寸定制服务。</p>', '<p>Our artificial happiness tree is crafted with high-fidelity PU leaves on a natural wood trunk. Veins and color gradients closely follow the living plant, making it ideal for hotel lobbies, showrooms and offices with zero maintenance.</p><p>Mixed-container wholesale is supported with reinforced export packaging and custom heights on request.</p>', '/images/samples/prod-tree-1.jpg', '["/images/samples/prod-tree-2.jpg","/images/samples/prod-tree-3.jpg"]', '120cm,150cm,180cm,210cm', '120cm/4ft,150cm/5ft,180cm/6ft,210cm/7ft', 'Green', 'Green', '[{"key":"材质","value":"PU 叶片 + 真木杆"},{"key":"高度","value":"150 / 180 / 210 cm"},{"key":"MOQ","value":"50 件"},{"key":"交期","value":"样品 7 天，大货 25-35 天"},{"key":"包装","value":"五层出口纸箱 + 木架加固"},{"key":"认证","value":"SGS 阻燃 / 抗 UV 报告可配"},{"key":"贸易条款","value":"FOB 深圳 / 广州，支持 CIF"},{"key":"付款方式","value":"T/T 30% 定金，余款见提单副本"}]', '[{"key":"Material","value":"PU leaves + real wood trunk"},{"key":"Height","value":"150 / 180 / 210 cm"},{"key":"MOQ","value":"50 pcs"},{"key":"Lead Time","value":"7 days for sample, 25-35 days for bulk"},{"key":"Packing","value":"5-ply export carton + wooden frame"},{"key":"Certification","value":"SGS fire-retardant / UV-resistance reports available"},{"key":"Trade Terms","value":"FOB Shenzhen / Guangzhou, CIF supported"},{"key":"Payment","value":"T/T 30% deposit, balance against B/L copy"}]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(1, '仿真榕树', 'Artificial Ficus Tree', '经典绿榕，枝叶浓密造型饱满', 'Classic ficus with dense, full-bodied foliage', '<p>经典仿真榕树，叶片采用丝印工艺层次分明，整体造型饱满，适合大堂角落与楼梯间造景。</p>', '<p>A timeless ficus with silk-screened layered leaves and a full silhouette, ideal for corner landscaping in lobbies and stairwells.</p>', '/images/samples/prod-tree-2.jpg', '["/images/samples/prod-tree-1.jpg","/images/samples/prod-tree-4.jpg"]', '120cm,150cm,180cm', '120cm/4ft,150cm/5ft,180cm/6ft', 'Green,Variegated', 'Green,Variegated', '[]', '[]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(1, '仿真橄榄树', 'Artificial Olive Tree', '地中海风情，银绿叶片配仿真果实', 'Mediterranean charm with silver-green foliage and realistic fruits', '<p>仿真橄榄树以真杆搭配高密度绢布叶片，点缀仿真橄榄果，营造南欧庭院氛围，是咖啡馆与餐厅美陈的热门选择。</p>', '<p>Built on a real trunk with dense silk leaves and lifelike olive fruits, this tree brings a southern-European courtyard mood to cafes, restaurants and retail displays.</p>', '/images/samples/prod-tree-3.jpg', '["/images/samples/prod-tree-1.jpg"]', '150cm,180cm,210cm', '150cm/5ft,180cm/6ft,210cm/7ft', 'Silver Green', 'Silver Green', '[]', '[]', 3, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(1, '仿真柏树', 'Artificial Cypress Tree', '挺拔塔形柏树，庭院列植首选', 'Upright cypress columns, perfect for courtyard rows', '<p>仿真柏树塔形挺拔，叶片细密抗 UV，户外庭院列植与入口造景的首选，支持阻燃定制。</p>', '<p>A slim, upright cypress with fine UV-resistant foliage — a favorite for outdoor courtyard rows and entrance landscaping, with fire-retardant options.</p>', '/images/samples/prod-tree-4.jpg', '["/images/samples/prod-tree-2.jpg"]', '150cm,180cm,240cm', '150cm/5ft,180cm/6ft,240cm/8ft', 'Green', 'Green', '[]', '[]', 4, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(2, '仿真紫藤盆景', 'Artificial Wisteria Bonsai', '垂坠紫藤花串，造型盆景开箱即摆', 'Cascading wisteria blooms, a display-ready bonsai', '<p>仿真紫藤盆景，垂坠花串采用渐变色绢布，配仿古盆与苔藓，适合前台、茶室与会客区陈列。</p>', '<p>A faux wisteria bonsai with cascading gradient silk blooms in an antique-style pot with moss, ready for reception desks, tea rooms and lounges.</p>', '/images/samples/prod-flower-1.jpg', '["/images/samples/prod-flower-2.jpg"]', '60cm,80cm', '60cm/2ft,80cm/2.6ft', 'Purple,White', 'Purple,White', '[{"key":"材质","value":"绢布花串 + 仿真苔藓"},{"key":"高度","value":"60 / 80 cm"},{"key":"MOQ","value":"100 件"},{"key":"交期","value":"15-25 天"},{"key":"包装","value":"单件纸箱 + 泡沫护花"},{"key":"认证","value":"抗 UV 色牢度报告"},{"key":"贸易条款","value":"FOB 深圳"},{"key":"付款方式","value":"T/T 30% 定金"}]', '[{"key":"Material","value":"Silk bloom strands + faux moss"},{"key":"Height","value":"60 / 80 cm"},{"key":"MOQ","value":"100 pcs"},{"key":"Lead Time","value":"15-25 days"},{"key":"Packing","value":"Individual carton + foam protection"},{"key":"Certification","value":"UV colorfastness report"},{"key":"Trade Terms","value":"FOB Shenzhen"},{"key":"Payment","value":"T/T 30% deposit"}]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(2, '仿真绣球花', 'Artificial Hydrangea', '花球饱满层次丰富，色彩持久不凋谢', 'Full hydrangea heads with lasting vivid color', '<p>仿真绣球花花球直径约 25cm，花瓣采用保湿手感材质，适用于酒店桌花、婚庆布置与家居装饰。</p>', '<p>Faux hydrangea heads of about 25cm with real-touch petals, widely used for hotel table arrangements, weddings and home decor.</p>', '/images/samples/prod-flower-2.jpg', '["/images/samples/prod-flower-1.jpg","/images/samples/prod-flower-3.jpg"]', '45cm,60cm', '45cm/1.5ft,60cm/2ft', 'Pink,Blue,White', 'Pink,Blue,White', '[{"key":"材质","value":"保湿手感 PU 花瓣"},{"key":"花球直径","value":"约 25 cm"},{"key":"MOQ","value":"200 枝"},{"key":"交期","value":"10-20 天"},{"key":"包装","value":"花头独立护套 + 纸箱"},{"key":"认证","value":"SGS 材质安全检测"},{"key":"贸易条款","value":"FOB / EXW"},{"key":"付款方式","value":"T/T 或信用证"}]', '[{"key":"Material","value":"Real-touch PU petals"},{"key":"Head Diameter","value":"Approx. 25 cm"},{"key":"MOQ","value":"200 stems"},{"key":"Lead Time","value":"10-20 days"},{"key":"Packing","value":"Individual head sleeves + carton"},{"key":"Certification","value":"SGS material safety test"},{"key":"Trade Terms","value":"FOB / EXW"},{"key":"Payment","value":"T/T or L/C"}]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(2, '仿真山茶花', 'Artificial Camellia', '富贵山茶，花头层叠如真', 'Luxurious camellia with layered true-to-life heads', '<p>仿真山茶花枝，花瓣采用渐变色丝印，花型雍容，是中式空间与高端橱窗陈设的佳选。</p>', '<p>Camellia sprays with gradient silk-screened petals and opulent blooms, a fine choice for oriental interiors and premium window displays.</p>', '/images/samples/prod-flower-3.jpg', '["/images/samples/prod-flower-2.jpg"]', '50cm,70cm', '50cm/1.6ft,70cm/2.3ft', 'Red,Pink,White', 'Red,Pink,White', '[]', '[]', 3, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(3, '玻璃罐蕨类微景观', 'Fern Terrarium Jar', '玻璃罐中的蕨类小森林，桌面治愈系', 'A tiny fern forest in a glass jar, a healing desk piece', '<p>玻璃罐蕨类微景观，高仿真蕨叶配仿真苔藓与石子，免打理，适合办公桌、书架与窗台陈列，支持礼盒包装。</p>', '<p>A glass-jar fern terrarium with high-fidelity fronds, faux moss and pebbles. Zero upkeep, ideal for desks, shelves and windowsills, gift-box available.</p>', '/images/samples/prod-terra-1.jpg', '["/images/samples/prod-terra-2.jpg","/images/samples/prod-terra-3.jpg"]', '15cm,20cm,25cm', '15cm/6in,20cm/8in,25cm/10in', 'Green', 'Green', '[]', '[]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(3, '玻璃瓶苔原景观', 'Moss Terrarium Bottle', '苔藓与蕨类的自然瓶景，北欧风桌摆', 'Moss and fern bottle scenery, a Nordic desk accent', '<p>玻璃瓶苔原景观，多层苔藓与蕨类组合，营造北欧自然风，适合办公室洽谈区与高端 SPA 空间。</p>', '<p>Layered moss and ferns in a glass bottle bring a Nordic calm to office lounges and premium spa interiors.</p>', '/images/samples/prod-terra-2.jpg', '["/images/samples/prod-terra-1.jpg"]', '18cm,24cm', '18cm/7in,24cm/9.5in', 'Moss Green', 'Moss Green', '[]', '[]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(3, '玻璃生态瓶', 'Botanical Glass Bottle', '整株植物封存于瓶，长久免养护', 'A whole plant sealed in glass, maintenance-free for years', '<p>玻璃生态瓶将整株仿真植物封存于玻璃瓶中，无需浇水光照，常年如新，是文创礼品渠道的热销款。</p>', '<p>A whole faux plant sealed inside a glass bottle — no water or light needed, forever fresh. A best-seller in the gift and stationery channel.</p>', '/images/samples/prod-terra-3.jpg', '["/images/samples/prod-terra-1.jpg"]', '20cm,30cm', '20cm/8in,30cm/12in', 'Green', 'Green', '[]', '[]', 3, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(4, '悬挂鸟笼花艺', 'Hanging Birdcage Planter', '鸟笼造型悬挂花艺，阳台庭院点睛之笔', 'A birdcage hanging planter, a highlight for balconies and patios', '<p>悬挂鸟笼花艺，铁艺鸟笼配仿真垂吊植物与花球，适合阳台、庭院、咖啡馆外摆与婚礼吊顶。</p>', '<p>An iron birdcage with trailing faux plants and bloom balls, perfect for balconies, patios, cafe terraces and wedding ceilings.</p>', '/images/samples/prod-hang-1.jpg', '["/images/samples/prod-hang-2.jpg"]', '30cm,40cm', '30cm/12in,40cm/16in', 'Green,Pink', 'Green,Pink', '[]', '[]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(4, '吊球苔玉植物', 'Hanging Kokedama Ball', '日式苔玉吊球，禅意空间首选', 'Japanese kokedama balls, a zen-style favorite', '<p>日式吊球苔玉，苔藓球体配垂吊蕨叶，麻绳悬挂，营造禅意空间，支持批量定制组合装。</p>', '<p>Japanese-style kokedama balls with moss spheres and trailing ferns on hemp ropes, creating a zen atmosphere. Custom sets supported in volume orders.</p>', '/images/samples/prod-hang-2.jpg', '["/images/samples/prod-hang-1.jpg"]', '15cm,20cm', '15cm/6in,20cm/8in', 'Green', 'Green', '[]', '[]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(5, '水泥盆绿植', 'Concrete Potted Plant', '清水泥盆器，工业风绿植陈列', 'Concrete planter, an industrial-style display piece', '<p>仿真绿植搭配清水泥盆器，工业极简风格，适合联合办公、展厅与零售门店陈列，支持盆器颜色定制。</p>', '<p>Faux greenery in a raw concrete pot with industrial minimal style, ideal for co-working spaces, showrooms and retail displays, custom pot colors available.</p>', '/images/samples/prod-pot-1.jpg', '["/images/samples/prod-pot-2.jpg"]', '40cm,60cm,80cm', '40cm/16in,60cm/2ft,80cm/2.6ft', 'Green', 'Green', '[]', '[]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(5, '双盆组合绿植', 'Twin Pot Plant Set', '高低双盆组合，开箱成景', 'A tall-and-low twin pot set, instant scenery out of the box', '<p>高低双盆组合装，一高一矮错落有致，成品发货开箱即成景，适合商超促销装与电商一件代发。</p>', '<p>A ready-made tall-and-low twin pot set shipped as display-ready scenery, ideal for supermarket promotions and e-commerce dropshipping.</p>', '/images/samples/prod-pot-2.jpg', '["/images/samples/prod-pot-1.jpg"]', '30cm+50cm', '30cm+50cm/12in+20in', 'Green', 'Green', '[]', '[]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(6, '双球造型绿雕', 'Double Ball Topiary', '双球造型规整饱满，入口造景常青', 'Neat double-ball topiary, evergreen entrance decor', '<p>双球造型绿雕，球体修剪规整、密度高，适合园区入口、酒店门廊与品牌活动装置，支持阻燃户外款。</p>', '<p>A double-ball topiary with dense, neatly trimmed spheres for park entrances, hotel porches and brand events, outdoor fire-retardant version available.</p>', '/images/samples/prod-topiary-1.jpg', '["/images/samples/prod-topiary-2.jpg"]', '100cm,120cm,150cm', '100cm/3.3ft,120cm/4ft,150cm/5ft', 'Green', 'Green', '[]', '[]', 1, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z'),
(6, '螺旋造型柏', 'Spiral Topiary Cypress', '手工螺旋造型，庭院视觉焦点', 'Hand-shaped spiral, a courtyard focal point', '<p>手工螺旋造型柏，每层螺旋手工修整，造型独特，是庭院与屋顶花园的视觉焦点，可定制高度与密度。</p>', '<p>A hand-shaped spiral cypress, trimmed layer by layer for a unique silhouette that anchors courtyards and roof gardens. Custom height and density available.</p>', '/images/samples/prod-topiary-2.jpg', '["/images/samples/prod-topiary-1.jpg"]', '120cm,150cm,180cm', '120cm/4ft,150cm/5ft,180cm/6ft', 'Green', 'Green', '[]', '[]', 2, 1, '2025-09-01T08:00:00.000Z', '2025-09-01T08:00:00.000Z');

INSERT INTO articles (id, title_zh, title_en, summary_zh, summary_en, content_zh, content_en, cover_image, status, published_at, created_at, updated_at) VALUES
(1, '商业空间如何挑选仿真植物', 'How to Choose Artificial Plants for Commercial Spaces', '从场景、预算与维护三个维度，快速锁定适合的仿真植物方案。', 'Match the right artificial greenery to your venue by scene, budget and maintenance.', '<p>商业空间选仿真植物，先看场景：大堂挑高空间适合 2 米以上的仿真树；桌面与会客区适合小型盆栽与插花；外墙与隔断则优先考虑模块化植物墙。</p><p>其次看预算与维护：高品质 PU 材质初始成本略高，但色彩持久、无需养护，长期综合成本远低于鲜花绿植租赁。</p><p>最后建议向工厂索取样品与阻燃检测报告，大货前确认色板。</p>', '<p>Start with the scene: tall atriums suit artificial trees over two meters; tables and lounges suit small potted plants and floral arrangements; facades and dividers call for modular green wall panels.</p><p>Then weigh budget against maintenance: premium PU materials cost more up front but hold color for years with zero upkeep, beating rental plants on lifetime cost.</p><p>Finally, always request samples and fire-retardant certificates before placing volume orders.</p>', '/images/samples/news-1.jpg', 'published', '2025-09-10T09:00:00.000Z', '2025-09-09T09:00:00.000Z', '2025-09-10T09:00:00.000Z'),
(2, '2025 仿真绿植设计趋势', '2025 Trends in Artificial Greenery Design', '从大型装置到可持续材料，解读今年仿真绿植的四大走向。', 'From large installations to sustainable materials, four directions shaping 2025.', '<p>趋势一：大型化与装置化，仿真树与绿植墙正成为商业空间的视觉主体。</p><p>趋势二：混植美学，多品种组合墙板取代单一品种，层次更自然。</p><p>趋势三：可持续材料，可回收 PE 与环保染色工艺受到欧美买家关注。</p><p>趋势四：阻燃标准化，越来越多公共场所将阻燃等级写入采购规范。</p>', '<p>Trend one: scale. Artificial trees and green walls are becoming the visual anchor of commercial interiors.</p><p>Trend two: mixed planting. Multi-species panels are replacing single-species walls for a more natural look.</p><p>Trend three: sustainability. Recyclable PE and eco-friendly dyes are on the radar of European and American buyers.</p><p>Trend four: fire safety. More public venues now write flame-retardant grades into procurement specs.</p>', '/images/samples/news-2.jpg', 'published', '2025-09-18T09:00:00.000Z', '2025-09-17T09:00:00.000Z', '2025-09-18T09:00:00.000Z'),
(3, '工厂探访：品质管控的背后', 'Factory Tour: Behind Our Quality Control', '一支仿真树从原料到出货要经历哪些质检环节？', 'What quality checks does an artificial tree pass before shipping?', '<p>（草稿）从原料入库抽检、叶片色牢度测试、杆体承重测试到出货前整箱跌落测试，本文带你走一遍完整品控流程。</p>', '<p>(Draft) From incoming material inspection and colorfastness tests to trunk load tests and pre-shipment drop tests, this article walks through our full QC pipeline.</p>', '/images/samples/news-3.jpg', 'draft', NULL, '2025-09-20T09:00:00.000Z', '2025-09-20T09:00:00.000Z');

INSERT INTO banners (image, title_zh, title_en, subtitle_zh, subtitle_en, link, sort_order) VALUES
('/images/samples/hero-1.jpg', '让四季常青装点每个空间', 'Bring Everlasting Green to Every Space', '仿真植物工厂直供，服务批发、景观与零售客户', 'Factory-direct artificial plants for wholesale, landscaping and retail', '/products', 1),
('/images/samples/hero-2.jpg', '模块化植物墙，一面墙一片森林', 'Modular Green Walls, a Forest on Every Wall', '卡扣拼接快速安装，支持阻燃定制', 'Snap-lock panels for fast installation, fire-retardant options', '/products?category=3', 2),
('/images/samples/hero-3.jpg', '支持 OEM 定制与整柜混批', 'OEM Customization and Mixed-Container Wholesale', '从打样到出货一站式外贸服务', 'One-stop export service from sampling to shipment', '/contact', 3);

INSERT INTO page_contents (key, content_zh, content_en, image, updated_at) VALUES
('home_story', '<p>我们专注仿真植物制造十余年，从一片叶的纹理到一棵树的造型，都坚持手工调校与工业标准并重。产品远销欧美、中东与东南亚，服务批发商、景观工程商与连锁零售品牌。</p><p>自有工厂配备注塑、丝印、组装多条产线，支持来图定制与小批量试单，让每一次合作都从放心开始。</p>', '<p>For over a decade we have specialized in artificial plant manufacturing, refining every leaf vein and every tree silhouette by hand and by industrial standard alike. Our products ship to Europe, the Americas, the Middle East and Southeast Asia, serving wholesalers, landscape contractors and retail chains.</p><p>Our own factory runs injection molding, silk-screen printing and assembly lines, supporting custom designs and trial orders so every partnership starts with confidence.</p>', '/images/samples/about-2.jpg', '2025-09-01T08:00:00.000Z'),
('home_about', '<p>从原料到出货，十二道质检工序层层把关，年产能超两百万件。我们相信，好的仿真植物应该让人忘记它是仿真的。</p>', '<p>Twelve quality checkpoints guard every piece from raw material to shipment, with an annual capacity of over two million items. We believe great artificial plants should make you forget they are artificial.</p>', '/images/samples/case-2.jpg', '2025-09-01T08:00:00.000Z'),
('contact_info', '<p><strong>地址：</strong>广东省东莞市绿色产业园 A 栋</p><p><strong>电话：</strong>+86 138 0000 0000</p><p><strong>邮箱：</strong>sales@example.com</p><p><strong>WhatsApp：</strong>+86 138 0000 0000</p><p><strong>工作时间：</strong>周一至周六 9:00 - 18:00（GMT+8）</p>', '<p><strong>Address:</strong> Building A, Green Industrial Park, Dongguan, Guangdong, China</p><p><strong>Phone:</strong> +86 138 0000 0000</p><p><strong>Email:</strong> sales@example.com</p><p><strong>WhatsApp:</strong> +86 138 0000 0000</p><p><strong>Working Hours:</strong> Monday to Saturday, 9:00 - 18:00 (GMT+8)</p>', '', '2025-09-01T08:00:00.000Z');
