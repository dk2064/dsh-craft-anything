# Security policy

## What this plugin can do to your machine

The bridge itself only spawns one child process and speaks JSON-RPC to it. The
power comes from the upstream engine's 323 tools, which reach this session
through three surfaces:

| Surface | Exposure |
|---|---|
| 13 first-class tools | read-mostly investigation tools (`core_*`, `rebuild_check`, `list_toolsets`, `enable_toolset`) |
| `craft_tool` | **every** upstream tool by name, including ones that run commands, write files, change settings or spend money |
| `craft_engine` | settings and engine control (Deep mode, Ghidra path, doctor) |

## Guard rails that are implemented here

- 18 state-changing tools require `ctx.approval.request(...)` before the call is
  forwarded: `build_command_run`, `build_file_write`, `build_file_edit`,
  `settings_set`, `plugins_add`, `plugins_remove`, `engines_install`,
  `setup_apply`, `setup_uninstall`, `project_delete`, `project_rename`,
  `project_duplicate`, `adb_app_install`, `adb_app_remove`,
  `core_action_approve`, `rebuild_start`, `assets_image_generate`,
  `assets_model_generate`.
- Only `allowed-once` proceeds. `rejected`, `cancelled`, `unavailable` and a
  missing approval service all stop the call (fail closed).
- `craft_tool` refuses recursive names (`craft_tool`, `craft_reverse`) and
  anything starting with `mcp__`, so it cannot become a way to call the host's
  own tools. Names are restricted to `^[A-Za-z0-9_.-]{1,64}$`.
- Catalog listings are capped (120 lines), results are capped (200,000
  characters, with a pointer to `core_evidence_browse`), and one JSON-RPC line
  is capped at 32 MB.
- `craft_skill_export` needs approval when it writes outside the session
  workspace; an explicit `dir` is treated as consented, a derived `host=` path
  is not (it may overwrite another agent's skill file).

## Guard rails that are NOT implemented here

- No OS sandbox. An approved `build_command_run` runs with your user's rights.
- No filesystem boundary. Read-only tools can still read paths you did not think
  about; keep secrets out of the reachable tree.
- No network isolation. Deep mode may fetch engine components; asset tools spend
  real money.
- No audit log beyond what the session and the upstream engine keep.

## Reporting a problem

- Vulnerability in this bridge (approval bypass, injection, path escape, crash):
  open a private security advisory on this repository, or a minimal issue if the
  report can be public.
- Vulnerability in the engine or its tools: report upstream at
  <https://github.com/storytold/craft-anything>.
- Include: plugin version (`package.json`), Harness version, the tool name, the
  arguments, and whether an approval prompt appeared.
