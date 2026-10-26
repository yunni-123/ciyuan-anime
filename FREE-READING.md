# Verified free reading samples

The reading sections now distinguish catalogue candidates, responding HTML pages, source-account requirements and actual anonymous sample evidence. HTTP 200 alone is never a free-reading badge.

Initial verified set: 12 Chinese light novels at public linovelib.com chapter URLs and four Japanese manga public episodes at Shonen Jump+ / Tonari no Young Jump. Novel checks validate the work title, same-book chapter path and sufficient Chinese text inside the complete nested TextContent element. Only character/paragraph counts, status, timestamp and URLs are stored. No chapter text is saved or republished. Manga checks require `isPublic: true`, matching original series name and a successful JPEG/PNG/WebP signature response from the first public page image. Only a short range is requested and the response stream is cancelled. No manga image is saved or relayed.

These are sampled free pages/episodes, not verified complete books or entire series. Chinese novel chapters can span multiple pages. Four manga episodes are Japanese originals and explicitly labeled; they are not claimed to be Chinese translations. Mainland network reachability remains unverified.

Hikarinagi's browser reader displays a login requirement. Its entries are `account-required`, anonymous=false, and excluded from the free shelf. DM5 entries with responding HTML but no image evidence remain unverified. Ordinary metadata entries excluded by the existing explicit-content resource policy retain text-only presentation and no reading or purchasing links.

`free-reading-index.json` is derived by the immutable-pack compiler. It includes only current eligible annual-book records with anonymous `sample-readable` evidence from the past 14 days. Candidate, account-required, failed and stale entries never qualify. The cross-year free shelf is independently accessible at `#free-novels` and `#free-manga`; its rank column retains the original annual position, not a fabricated global ranking.

The additional source adapter uses exact annual-title matches from the Japanese section of kxgxs.com and public comic search results at hlgmh.com. It follows only matching book chapter paths, extracts the actual chapter-content container and verifies two manga image signatures at the fixed image CDN. It never imports the mixed Chinese/Korean/adult site catalogue. The Chinese-source label describes the source version; translation quality and every page are not independently reviewed. Mobile browser QA confirmed anonymous Chinese novel text and Chinese manga images for the sampled examples.

GitHub Actions checks existing novel sample pages daily and manga public episode samples daily. Additional-source daily checks rotate through up to 48 existing works per kind; weekly discovery checks up to 32 novels and 16 manga from bounded title-matched candidates. Weekly jobs rotate through up to 24 additional novel candidates, up to 80 new reader entrances and bounded catalogues. Authentication/price gates are respected, and 403/429 stops further requests to the affected source. Failed sample rechecks remove the free state while retaining the last evidence separately. The full workflow budget is 30 minutes; it remains on the existing free public-repository runner and independent Cloudflare site.

Browser QA covers free-shelf deep links, counts and language labels, account-required alternatives, collapsed publication links, original annual Top50, favorites, TXT reader and three responsive themes. Unit checks cover nested chapter extraction, title/path isolation, gated content, stale evidence and immutable data/index integration.

## Ambiguous user-supplied source name

The name “轻小说网” did not uniquely identify a domain. aireads.cn uses that name but its current listing is predominantly Chinese original/fan fiction, so it was not imported as Japanese light novels. Existing linovelib and newly checked kxgxs are selected for actual matching Japanese titles and anonymous chapter evidence, not asserted to be the exact site the user remembered. Colamanga/Yoyomanga search timed out during this check and is not promoted as a working reading source.
