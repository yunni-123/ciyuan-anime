# Manga and light novel annual shelves

- Separate manga and light novel routes (`#manga`, `#novels`), each with 2010–2026 annual popularity snapshots of up to 50 entries. Initial import: 850 per category, 1,700 annual records.
- Bangumi public book search, sort=heat, category tags and Japanese title/tag validation. Source publication date assigns the year. Excludes adult flags, single-volume tags and numbered-volume suffixes. This is a community popularity sample, not a sales chart or independently verified top list of all Japanese publications.
- Every record includes source ID, original/translated title, date, summary when supplied, cover, rating, rank and timestamp. Publisher search links are generated and explicitly labeled; they do not establish availability of full text, Chinese translation or a complete volume set. Matching existing light novel entries also retain curated publisher/reading links by exact Bangumi ID.
- Local reading favorites use category-prefixed IDs; the original TXT reader and curated shelf remain accessible. Only the selected year's JSON is loaded; no full comic/novel downloads or increase in the anime search index.
- GitHub Actions refreshes both categories every Monday at 08:47 Asia/Shanghai and on manual full refresh. Retains the last snapshot per failed year, records attempts separately from successful fetches and exposes both category statuses in update details. GitHub scheduling can be delayed.
- Content-addressed manifests carry all 34 annual packs and the index through the existing Cloudflare worker. Worker accepts no arbitrary upstream book URL.
- Checkout tracks current main and generated commits rebase before push, avoiding stale queued workflow commits. Failures remain visible rather than force-pushing.

Validation: ranking eligibility/search and snapshot integrity tests; mobile/desktop browser checks for categories, year switch, favorites, exact search, three themes, original anime navigation and TXT shelf.
