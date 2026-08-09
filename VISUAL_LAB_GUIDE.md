# SPNVISUALZ Visual Lab — publishing and activation guide

## Activate GA4

1. Open `assets/js/spn-config.js`.
2. Keep the production web stream set to `G-QYJX274KM5` unless the GA4 property is intentionally replaced.
3. Leave the consent defaults denied. The tag loads only after the visitor allows Analytics.
4. In GA4, mark `generate_lead` as a key event. The site also records the studio-specific events documented below.

Automatic GA4 reporting covers users, page views, acquisition source/medium, device category, approximate country and engagement time. Custom events:

- `order_button_clicked`
- `package_selected`
- `service_preview_opened`
- `contact_button_clicked`
- `instagram_clicked`
- `email_clicked`
- `portfolio_project_opened`
- `section_bottom_reached`
- `visual_lab_article_opened`
- `article_read_progress`
- `project_brief_submitted`
- `generate_lead`

## Activate AdSense safely

1. Complete AdSense approval and install a Google-certified CMP for EEA/UK/Switzerland traffic.
2. Connect that CMP to `window.SPNConsent.syncFromCmp({ analytics, advertising })`.
3. Keep the verified publisher ID set to `ca-pub-6262494647963659` unless the AdSense account is intentionally replaced.
4. Replace each `ADSENSE_SLOT_ID` with its numeric ad-unit slot.
5. Set `certifiedCmpReady: true` only after the certified CMP is live and verified.

Until every check passes, no content ad unit is rendered. The base AdSense tag and seller record are present for site ownership verification, while ad slots stay gated behind valid slot IDs, advertising consent and certified CMP readiness. Ad reserves have fixed minimum heights to protect layout stability.

## Publish a Visual Lab article

1. Copy `visual-lab/article-template.html` to `visual-lab/articles/clean-slug/index.html`.
2. Write one original, complete answer to a real search question. Do not publish thin AI filler.
3. Add a unique title, description, canonical URL, social image and Article/Breadcrumb schema.
4. Use one H1 and descriptive H2 IDs. Add internal links to related Visual Lab files.
5. Add one relevant SPNVISUALZ service CTA.
6. Use no more than two ad reserves, only after substantial editorial content.
7. Change robots from `noindex` to `index,follow`, then add the URL to `sitemap.xml`.
8. Test at 320px, 375px, 430px and desktop widths before release.

## Event attributes

Use these data attributes on future UI:

- `data-order-button`
- `data-package-select`
- `data-service-preview`
- `data-contact-button`
- `data-instagram-link`
- `data-email-link`
- `data-visual-lab-article`
- `data-section-track="section_name"`
- `data-ad-slot-key="visualLabInline"`

## Editorial quality rule

Publishing less is acceptable. Every file must provide a useful point of view, original examples or a clear decision framework, and a natural route into the service most relevant to the reader.

## Search and social launch

1. Verify `https://spnvisualz.com/` in Google Search Console and submit `https://spnvisualz.com/sitemap.xml`.
2. Request indexing for the Visual Lab landing page and each finished article after the live page passes QA.
3. Use this tagged URL in the Instagram bio so GA4 can separate it from Direct traffic:
   `https://spnvisualz.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio`
4. Add descriptive links between future articles and the closest service or selected project.
5. Review Search Console queries monthly. Expand articles only when the new section genuinely improves the answer.
