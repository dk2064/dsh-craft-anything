window.__ModuleLoader__.load({
  id: 'dsh-craft-anything',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const CATALOG = /*__CATALOG_JSON__*/ null

    const STRINGS = {
      zh: {
        'panel.label': 'Craft Anything',
        'panel.title': 'Craft Anything',
        'panel.subtitle': '研究任意应用、网站、游戏或文件如何运作，再让编码代理复刻一个自己的版本。整台引擎通过 MCP 全量接入 Harness。',
        'panel.search': '搜索工具、工具集或说明',
        'panel.count': '共 {n} 个工具',
        'panel.toolsets': '{n} 个工具集',
        'panel.bridged': 'MCP 服务 craft-anything',
        'panel.hint': '工具以 mcp__craft-anything__<工具名> 调用。首轮只列出 Essentials；需要其他能力时先调用 list_toolsets，再调用 enable_toolset 打开对应工具集，新工具会立即出现在会话里。',
        'panel.defaultListed': '默认已列出',
        'panel.readOnly': '只读',
        'panel.empty': '没有匹配的工具。',
        'panel.more': '显示剩余 {n} 条',
        'panel.foot': '目录由本机 craft-anything-cli 生成，生成时间见下；工具集数量来自服务端 list_toolsets。',
        'panel.generated': '生成时间',
        'panel.repo': '项目主页',
        'panel.catalog': '工具目录',
        'panel.engine': '引擎',
        'panel.mode': '模式',
        'panel.modeDeep': 'Deep（--deep）',
        'panel.bridge': '桥接',
        'panel.bridgeSlim': '精简桥 · 15 个工具',
        'panel.check': '检查更新',
        'panel.checking': '检查中…',
        'panel.upToDate': '已是最新',
        'panel.newer': '有新版本 {v}',
        'panel.checkFail': '检查失败：{e}',
        'panel.notice': '声明：本插件是社区非官方桥接，与上游作者无隶属关系；引擎、工具与提示词版权归 storytold/craft-anything 所有（Apache-2.0）。净室模式只看公开可见的表面，Deep 模式读取文件与源码——用在你自己的或已获授权的目标上。模型与算力费用由你自行承担。',
      },
      en: {
        'panel.label': 'Craft Anything',
        'panel.title': 'Craft Anything',
        'panel.subtitle': 'See how any app, website, game or file works, then have a coding agent build your own: the whole engine bridged into Harness over MCP.',
        'panel.search': 'Search tools, toolsets or descriptions',
        'panel.count': '{n} tools',
        'panel.toolsets': '{n} toolsets',
        'panel.bridged': 'MCP server craft-anything',
        'panel.hint': 'Tools are called as mcp__craft-anything__<tool>. Only Essentials is listed at first: call list_toolsets, then enable_toolset with a toolset id to add its tools to the session.',
        'panel.defaultListed': 'listed by default',
        'panel.readOnly': 'read-only',
        'panel.empty': 'No matching tools.',
        'panel.more': 'Show the remaining {n}',
        'panel.foot': 'Catalog generated on this machine from craft-anything-cli; toolset counts come from the server list_toolsets.',
        'panel.generated': 'Generated',
        'panel.repo': 'Repository',
        'panel.catalog': 'Tool catalog',
        'panel.engine': 'Engine',
        'panel.mode': 'Mode',
        'panel.modeDeep': 'Deep (--deep)',
        'panel.bridge': 'Bridge',
        'panel.bridgeSlim': 'slim bridge · 15 tools',
        'panel.check': 'Check for updates',
        'panel.checking': 'Checking…',
        'panel.upToDate': 'up to date',
        'panel.newer': 'newer release {v}',
        'panel.checkFail': 'check failed: {e}',
        'panel.notice': 'Notice: an unofficial community bridge, not affiliated with the upstream author. The engine, its tools and prompts belong to storytold/craft-anything (Apache-2.0). Clean room studies only what a normal user can see; Deep mode reads files and source — point it at targets you own or are authorised to study. Model and compute costs are yours.',
      },
    }

    const CSS = [
      '.ca-root{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);overflow:hidden;font-family:inherit}',
      '.ca-head{padding:22px 26px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-shrink:0}',
      '.ca-title{margin:0;font-size:17px;font-weight:600;letter-spacing:.2px}',
      '.ca-sub{margin:6px 0 0;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary);max-width:62ch}',
      '.ca-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.ca-chip{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}',
      '.ca-link{font-size:12px;color:var(--dsw-alias-brand-primary);text-decoration:none;white-space:nowrap}',
      '.ca-link:hover{text-decoration:underline}',
      '.ca-toolbar{display:flex;gap:12px;align-items:center;padding:12px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0}',
      '.ca-search{flex:1;max-width:420px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:inherit;font:inherit;font-size:13px;padding:7px 10px;outline:none}',
      '.ca-search:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.ca-count{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.ca-body{flex:1;overflow:auto;padding:16px 26px 34px}',
      '.ca-hint{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:12px;line-height:1.75;color:var(--dsw-alias-label-secondary)}',
      '.ca-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
      '.ca-set{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;margin-bottom:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.ca-set-head{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;background:var(--dsw-alias-bg-layer-2);border:0;text-align:left;color:inherit;font:inherit;cursor:pointer}',
      '.ca-caret{width:10px;font-size:10px;color:var(--dsw-alias-label-secondary)}',
      '.ca-set-title{font-size:13px;font-weight:600}',
      '.ca-id{font-size:11px;color:var(--dsw-alias-label-secondary)}',
      '.ca-badge{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.ca-badge-on{color:var(--dsw-alias-state-success-primary)}',
      '.ca-tools{padding:3px 0}',
      '.ca-tool{display:grid;grid-template-columns:minmax(190px,290px) 1fr;gap:14px;padding:7px 14px;align-items:baseline}',
      '.ca-tool+.ca-tool{border-top:1px solid var(--dsw-alias-border-l1)}',
      '.ca-tool-name{font-size:12px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.ca-tool-desc{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}',
      '.ca-ro{font-size:10px;color:var(--dsw-alias-state-idle-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:0 5px;margin-left:6px}',
      '.ca-empty{padding:36px 0;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.ca-more{width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;padding:8px;cursor:pointer}',
      '.ca-foot{margin-top:16px;font-size:11px;line-height:1.7;color:var(--dsw-alias-label-secondary)}',
      '.ca-vitals{display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:9px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:11.5px;color:var(--dsw-alias-label-secondary);flex-shrink:0}',
      '.ca-vital b{color:var(--dsw-alias-label-primary);font-weight:600}',
      '.ca-check{margin-left:auto;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-brand-primary);border-radius:6px;font:inherit;font-size:11px;padding:3px 9px;cursor:pointer}',
      '.ca-ok{color:var(--dsw-alias-state-success-primary, #5aa469)}',
      '.ca-news{color:var(--dsw-alias-state-warning-primary, #d9a441)}',
      '.ca-notice{margin-top:14px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;line-height:1.75;color:var(--dsw-alias-label-secondary)}',
    ].join('\n')

    function makeI18n(ctx) {
      const locale = ctx.get ? ctx.get('locale') : undefined
      let bound
      try {
        if (locale && typeof locale.register === 'function') {
          locale.register('craft-anything', { en: STRINGS.en, zh: STRINGS.zh })
          bound = typeof locale.bind === 'function' ? locale.bind('craft-anything') : undefined
        }
      } catch (error) {
        bound = undefined
      }
      const language = () => {
        let id = ''
        try {
          const snapshot = locale && typeof locale.getLocale === 'function' ? locale.getLocale() : undefined
          id = String((snapshot && (snapshot.id || snapshot.locale || snapshot.language)) || '')
        } catch (error) {
          id = ''
        }
        if (!id) return 'zh'
        return id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      }
      const t = (key, fallback) => {
        if (bound !== undefined) {
          try {
            const value = bound(key)
            if (typeof value === 'string' && value && value !== key) return value
          } catch (error) {
            /* fall through to the built-in table */
          }
        }
        const table = STRINGS[language()] || STRINGS.zh
        return table[key] || fallback || key
      }
      const subscribe = locale && typeof locale.subscribe === 'function'
        ? (listener) => locale.subscribe(listener)
        : undefined
      return { t, subscribe }
    }

    function Icon(props) {
      const size = props && props.size ? props.size : 20
      const active = Boolean(props && props.active)
      return h('svg', {
        viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block' },
      },
        h('rect', { x: 6, y: 6, width: 52, height: 52, rx: 14, fill: 'currentColor', opacity: active ? 1 : 0.72 }),
        h('path', { d: 'M20 44 40 24', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round', fill: 'none' }),
        h('path', { d: 'M38 18h12v12', stroke: '#fff', strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
        h('circle', { cx: 22, cy: 46, r: 4, fill: '#9fe3ff' }),
      )
    }

    function Panel(props) {
      const t = props.t
      // `draft` is what the field shows; `query` is the debounced value the
      // filter runs on, so a fast typist does not refilter 325 rows per key.
      const [draft, setDraft] = React.useState('')
      const [query, setQuery] = React.useState('')
      const [open, setOpen] = React.useState(function () {
        return { core: true }
      })
      // Per-toolset "show everything" switch, set by the tail button.
      const [full, setFull] = React.useState({})
      // Latest-release probe: null | 'checking' | { latest, newer } | { error }.
      const [probe, setProbe] = React.useState(null)

      React.useEffect(function () {
        if (draft === query) return undefined
        const timer = setTimeout(function () { setQuery(draft) }, 120)
        return function () { clearTimeout(timer) }
      }, [draft, query])

      const toolsets = (CATALOG && CATALOG.toolsets) || []
      const tools = (CATALOG && CATALOG.tools) || []
      const chars = String(query || '').trim().toLowerCase()

      const groups = toolsets.map(function (set) {
        const own = tools.filter(function (tool) { return tool.toolset === set.id })
        const visible = chars
          ? own.filter(function (tool) {
            return (tool.name + ' ' + tool.title + ' ' + (tool.zh || '') + ' ' + tool.description + ' ' + set.id + ' ' + set.title)
              .toLowerCase().indexOf(chars) >= 0
          })
          : own
        return { set: set, visible: visible }
      }).filter(function (group) {
        if (!chars) return true
        return group.visible.length > 0 ||
          (group.set.id + ' ' + group.set.title).toLowerCase().indexOf(chars) >= 0
      })

      const matched = groups.reduce(function (sum, group) { return sum + group.visible.length }, 0)
      const totalTools = toolsets.reduce(function (sum, set) { return sum + set.declared }, 0)
      const generated = CATALOG && CATALOG.generatedAt ? String(CATALOG.generatedAt).slice(0, 10) : '—'

      const toggle = function (id) {
        setOpen(function (current) {
          const next = Object.assign({}, current)
          if (next[id]) delete next[id]
          else next[id] = true
          return next
        })
      }

      // A collapsed list stays cheap: 40 rows per toolset until asked for more,
      // and a search result shows everything because it is already small.
      const ROW_LIMIT = 40
      const showAll = function (id) {
        setFull(function (current) {
          const next = Object.assign({}, current)
          next[id] = true
          return next
        })
      }

      const engineVersion = String((CATALOG && CATALOG.server && CATALOG.server.version) || '—')
      // One release probe, only on click: the panel must stay offline-quiet.
      const checkUpdate = function () {
        setProbe('checking')
        const url = 'https://api.github.com/repos/storytold/craft-anything/releases/latest'
        const done = function (next) { setProbe(next) }
        let pending
        try {
          pending = fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
        } catch (error) {
          done({ error: String((error && error.message) || error) })
          return
        }
        pending
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
          })
          .then(function (json) {
            const latest = String((json && (json.tag_name || json.name)) || '').replace(/^v/i, '')
            if (!latest) throw new Error('no tag in response')
            done({ latest: latest, newer: Boolean(engineVersion && engineVersion !== '—' && latest !== engineVersion) })
          })
          .catch(function (error) {
            done({ error: String((error && error.message) || error) })
          })
      }

      const header = h('div', { className: 'ca-head' },
        h('div', null,
          h('h1', { className: 'ca-title' }, t('panel.title', 'Craft Anything')),
          h('p', { className: 'ca-sub' }, t('panel.subtitle', '')),
          h('div', { className: 'ca-chips' },
            h('span', { className: 'ca-chip ca-mono' }, t('panel.bridged', '')),
            h('span', { className: 'ca-chip' }, t('panel.toolsets', '{n} 个工具集').replace('{n}', String(toolsets.length))),
            h('span', { className: 'ca-chip' }, t('panel.count', '共 {n} 个工具').replace('{n}', String(totalTools))),
            h('span', { className: 'ca-chip ca-mono' }, t('panel.engine', '引擎') + ' ' + engineVersion),
          ),
        ),
        h('a', {
          className: 'ca-link',
          href: (CATALOG && CATALOG.source) || 'https://github.com/storytold/craft-anything',
          target: '_blank',
          rel: 'noreferrer noopener',
        }, t('panel.repo', '项目主页')),
      )

      const toolbar = h('div', { className: 'ca-toolbar' },
        h('input', {
          className: 'ca-search',
          type: 'search',
          value: draft,
          placeholder: t('panel.search', '搜索'),
          onChange: function (event) { setDraft(event.target.value) },
          'aria-label': t('panel.search', '搜索'),
        }),
        h('span', { className: 'ca-count' }, (chars ? matched + ' / ' : '') + String(tools.length)),
      )

      const sections = groups.length === 0
        ? [h('div', { key: 'empty', className: 'ca-empty' }, t('panel.empty', '没有匹配的工具。'))]
        : groups.map(function (group) {
          const set = group.set
          const isOpen = Boolean(open[set.id]) || Boolean(chars)
          const head = h('button', {
            key: 'h-' + set.id,
            className: 'ca-set-head',
            type: 'button',
            'aria-expanded': isOpen,
            onClick: function () { toggle(set.id) },
          },
            h('span', { className: 'ca-caret' }, isOpen ? '▾' : '▸'),
            h('span', { className: 'ca-set-title' }, set.title),
            h('span', { className: 'ca-id ca-mono' }, set.id),
            h('span', { className: 'ca-badge' + (set.enabledByDefault ? ' ca-badge-on' : '') },
              group.visible.length + ' / ' + set.declared + (set.enabledByDefault ? ' · ' + t('panel.defaultListed', '默认已列出') : '')),
          )
          const unlimited = Boolean(chars) || Boolean(full[set.id])
          const slice = unlimited ? group.visible : group.visible.slice(0, ROW_LIMIT)
          const rest = group.visible.length - slice.length
          const rows = isOpen
            ? h('div', { className: 'ca-tools' },
              slice.map(function (tool) {
                return h('div', { key: tool.name, className: 'ca-tool' },
                  h('div', { className: 'ca-tool-name ca-mono' },
                    tool.name,
                    tool.readOnly ? h('span', { className: 'ca-ro' }, t('panel.readOnly', '只读')) : null,
                  ),
                  // Chinese one-liner first; the original English text stays
                  // reachable as the hover title.
                  h('div', {
                    className: 'ca-tool-desc',
                    title: tool.description || tool.title || '',
                  }, tool.zh || tool.description || tool.title),
                )
              }),
              rest > 0
                ? h('button', {
                  key: 'more',
                  className: 'ca-more',
                  type: 'button',
                  onClick: function () { showAll(set.id) },
                }, t('panel.more', '显示剩余 {n} 条').replace('{n}', String(rest)))
                : null,
            )
            : null
          return h('section', { key: set.id, className: 'ca-set' }, head, rows)
        })

      const probeLabel = probe === 'checking'
        ? t('panel.checking', '检查中…')
        : probe && probe.error
          ? t('panel.checkFail', '检查失败：{e}').replace('{e}', probe.error)
          : probe && probe.latest
            ? (probe.newer
              ? t('panel.newer', '有新版本 {v}').replace('{v}', 'v' + probe.latest)
              : t('panel.upToDate', '已是最新') + ' · v' + probe.latest)
            : ''

      const vitals = h('div', { className: 'ca-vitals' },
        h('span', null, t('panel.bridge', '桥接') + ' ', h('b', null, t('panel.bridgeSlim', ''))),
        h('span', null, t('panel.mode', '模式') + ' ', h('b', null, t('panel.modeDeep', ''))),
        h('span', null, t('panel.engine', '引擎') + ' ', h('b', { className: 'ca-mono' }, engineVersion)),
        h('button', {
          className: 'ca-check',
          type: 'button',
          onClick: checkUpdate,
          disabled: probe === 'checking',
        }, t('panel.check', '检查更新')),
        probeLabel
          ? h('span', { className: probe && probe.newer ? 'ca-news' : probe && probe.error ? '' : 'ca-ok' }, probeLabel)
          : null,
      )

      const body = h('div', { className: 'ca-body' },
        h('div', { className: 'ca-hint' }, t('panel.hint', '')),
        sections,
        h('div', { className: 'ca-foot' },
          t('panel.generated', '生成时间') + ' ' + generated + ' · ' + tools.length + ' ' + t('panel.catalog', '工具目录'),
        ),
        h('div', { className: 'ca-notice' }, t('panel.notice', '')),
      )

      return h('div', { className: 'ca-root' },
        h('style', null, CSS),
        header,
        vitals,
        toolbar,
        body,
      )
    }

    return {
      inject: ['slots'],
      apply: function (ctx) {
        const i18n = makeI18n(ctx)

        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'craft-anything',
            order: 20,
            label: function () { return i18n.t('panel.label', 'Craft Anything') },
          }, Icon)
        })

        ctx.slots.inject('main', function () {
          return ctx.slots.register({
            name: 'main',
            key: 'craft-anything',
          }, function () { return h(Panel, { t: i18n.t }) })
        })
      },
    }
  },
})
