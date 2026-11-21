/**
 * Build client.js from tools/client.template.js + catalog.json (+ catalog-zh.json).
 *
 * The Web client runs one self-contained module per plugin, so the catalog is
 * embedded in the bundle instead of imported at runtime.
 *
 * Usage: node tools/build-client.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const template = readFileSync(new URL('./client.template.js', import.meta.url), 'utf8')
const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8'))

/** Chinese one-liners, keyed by raw tool name. */
let zh = {}
try {
  zh = JSON.parse(readFileSync(new URL('../catalog-zh.json', import.meta.url), 'utf8'))
} catch {
  console.warn('catalog-zh.json missing; the panel will fall back to English descriptions')
}

const missing = []
for (const tool of catalog.tools) {
  const label = zh[tool.name]
  if (typeof label === 'string' && label.trim().length > 0) tool.zh = label.trim()
  else missing.push(tool.name)
}

const marker = '/*__CATALOG_JSON__*/ null'
if (!template.includes(marker)) throw new Error('client template marker missing')
const output = template.replace(marker, JSON.stringify(catalog))
writeFileSync(new URL('../client.js', import.meta.url), output, 'utf8')

const covered = catalog.tools.length - missing.length
console.log(`client.js written (${output.length} bytes) from ${catalog.tools.length} tools in ${root}`)
console.log(`zh coverage: ${covered}/${catalog.tools.length}`)
if (missing.length > 0) console.log(`zh missing: ${missing.join(', ')}`)
