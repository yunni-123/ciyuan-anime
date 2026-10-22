// This output deliberately contains names and availability labels only.
export function buildTextOnlyCatalog(report, manual = {items: []}) {
  const subjects = new Map();
  for (const s of [...report.years.flatMap(y => y.items.map(x => x.coverage)), ...report.series.flatMap(f => f.entries)]) {
    if (!s || !['missing', 'no-episodes', 'metadata-only'].includes(s.status)) continue;
    if (s.resourceIds?.length) continue;
    subjects.set(String(s.id), {id: 'reference-' + s.id, title: String(s.name || '').trim(), status: '内容不可用'});
  }
  const titles = new Set([...subjects.values()].map(x => x.title.normalize('NFKC').toLowerCase()));
  for (const [i, item] of (manual.items || []).entries()) {
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '';
    if (!title || titles.has(title.normalize('NFKC').toLowerCase())) continue;
    subjects.set('manual-' + i, {id: 'manual-' + i, title, status: '内容不可用'});
    titles.add(title.normalize('NFKC').toLowerCase());
  }
  return {updatedAt: report.checkedAt, scope: '收录当前年度榜单及系列对照中未提供播放内容的条目，并保留用户指定的名称占位。此处是文字目录，不代表全网作品全集。', items: [...subjects.values()].filter(x => x.title).sort((a,b) => a.title.localeCompare(b.title, 'zh-CN'))};
}
