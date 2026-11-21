/**
 * Headless render smoke test for client.js: no browser, no React install.
 * It loads the module loader payload, invokes both slot registrations and
 * walks the returned element tree so a throw in the panel body is caught here
 * instead of showing as a blank sidebar entry.
 */
import { readFileSync } from 'node:fs'

const file = new URL('../client.js', import.meta.url)
const source = readFileSync(file, 'utf8')

let payload
globalThis.window = {
  __ModuleLoader__: {
    load(entry) { payload = entry },
  },
}

const fakeReact = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children }
  },
  useState(initial) {
    const state = typeof initial === 'function' ? initial() : initial
    return [state, () => {}]
  },
  useEffect() {},
}

new Function('window', source)(globalThis.window)
if (!payload || payload.id !== 'dsh-craft-anything') throw new Error('module did not load')

const module = payload.factory((id) => {
  if (id === 'react') return fakeReact
  throw new Error('unexpected require: ' + id)
})

const registrations = []
const ctx = {
  get: () => undefined,
  slots: {
    inject(key, callback) { callback(); return () => {} },
    register(options, component) { registrations.push({ options, component }); return () => {} },
  },
}

module.apply(ctx)
console.log('registrations:', registrations.map((r) => JSON.stringify(r.options)).join('\n              '))

const panelEntry = registrations.find((r) => r.options.key === 'craft-anything')
if (!panelEntry) throw new Error('panel not registered')
const iconEntry = registrations.find((r) => r.options.id === 'craft-anything')
if (!iconEntry) throw new Error('sidebar icon not registered')

const icon = iconEntry.component({ size: 22, active: true })
console.log('icon element:', icon.type, 'viewBox', icon.props.viewBox)

const tree = panelEntry.component()
const visited = []
const textParts = []
const strings = (value) => {
  if (typeof value === 'string') textParts.push(value)
  else if (Array.isArray(value)) value.forEach(strings)
  else if (value && typeof value === 'object') strings(value.children)
}
const walk = (node) => {
  if (node === null || node === undefined || node === false) return
  if (typeof node === 'string') { textParts.push(node); return }
  if (Array.isArray(node)) { node.forEach(walk); return }
  if (typeof node !== 'object') return
  if (node.type === 'div' && node.props.className === 'ca-tool') {
    visited.push(node.children[0].children[0])
    strings(node)
    return
  }
  if (typeof node.type === 'function') {
    walk(node.type(node.props))
    return
  }
  if (node.children) node.children.forEach(walk)
  strings(node.props && node.props.children)
}
walk(tree)

const text = textParts.join(' ') + ' ' + visited.join(' ')
console.log('rendered tool rows:', visited.length)
console.log('contains core_target_open:', text.includes('core_target_open'))
console.log('contains native toolset:', text.includes('native'))
console.log('contains default-listed badge text:', text.includes('默认已列出') || text.includes('listed by default'))
console.log('sample rows:', visited.slice(0, 5).join(', '));
console.log('contains chinese label:', /[\u4e00-\u9fa5]/.test(text));
console.log('first tool row text:', (text.match(/[\u4e00-\u9fa5]{2,}[^ ]*/) || [''])[0])
console.log('contains engine version chip:', text.includes('0.6.1'))
console.log('contains update button:', text.includes('检查更新') || text.includes('Check for updates'))
console.log('contains notice:', text.includes('非官方') || text.includes('unofficial'))
