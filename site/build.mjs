// Builds the GitHub Pages site in docs/ from site/: one pre-rendered page per language and the sitemap.
//   node site/build.mjs           writes docs/index.html, docs/ko/index.html, docs/ja/index.html, docs/sitemap.xml
// Edit site/index.html, site/i18n.json or site/runtime.js, never the generated files; CI fails if they drift.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const docs = join(here, '..', 'docs')
const { site, updated, languages } = JSON.parse(readFileSync(join(here, 'i18n.json'), 'utf8'))
const template = readFileSync(join(here, 'index.html'), 'utf8')
const runtime = readFileSync(join(here, 'runtime.js'), 'utf8').trimEnd()
const LANGS = Object.keys(languages)

const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const text = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const json = s => JSON.stringify(s).replace(/</g, '\\u003c')
// A path from one language page to another, relative so the pages also open from disk.
const rel = (from, to) => from === to ? './' : (languages[from].path ? '../' : './') + languages[to].path

function render(lang) {
  const L = languages[lang]
  const t = L.strings
  const url = site + L.path
  const fields = {
    lang,
    root: languages[lang].path ? '../' : './',
    title: text(L.title),
    description: attr(L.description),
    url,
    ogTitle: attr(L.ogTitle),
    ogDescription: attr(L.ogDescription),
    ogImageAlt: attr(L.ogImageAlt),
    ogLocale: L.ogLocale,
    ogLocaleAlternates: LANGS.filter(l => l !== lang)
      .map(l => `<meta property="og:locale:alternate" content="${languages[l].ogLocale}">`)
      .join('\n'),
    ldDescription: json(L.description),
    copied: attr(t.copied),
  }
  let html = template.replace('/*RUNTIME*/', () => runtime)
  html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in fields)) throw new Error(`site/index.html: unknown placeholder ${m}`)
    return fields[key]
  })

  // Text: an element with data-i18n="key" gets t[key] as its content. No such element nests one of its own tag.
  html = html.replace(/(<(\w+)\b[^>]*\sdata-i18n="(\w+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, _, close) => {
    if (!(key in t)) throw new Error(`${lang}: no string for data-i18n="${key}"`)
    return open + t[key] + close
  })
  html = html.replace(/(\sdata-i18n-aria="(\w+)"[^>]*?\saria-label=")[^"]*"/g, (m, head, key) => {
    if (!(key in t)) throw new Error(`${lang}: no string for data-i18n-aria="${key}"`)
    return head + attr(t[key]) + '"'
  })
  // Language links: real links, so crawlers find every language page, with the current one marked.
  html = html.replace(/<a data-lang-link="(\w+)"/g, (m, to) =>
    `${m} href="${rel(lang, to)}"${to === lang ? ' aria-current="page"' : ''}`)

  const left = html.match(/\{\{\w+\}\}|data-i18n="(\w+)">\s*<\/|\/\*RUNTIME\*\//)
  if (left) throw new Error(`${lang}: left over in the page: ${left[0]}`)
  return html
}

for (const lang of LANGS) {
  const out = join(docs, languages[lang].path, 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, render(lang))
}

const alternates = LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${site + languages[l].path}"/>`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${site}"/>`)
  .join('\n')
const urls = LANGS.map(l => `  <url>
    <loc>${site + languages[l].path}</loc>
    <lastmod>${updated}</lastmod>
${alternates}
  </url>`).join('\n')
writeFileSync(join(docs, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`)
