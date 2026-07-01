# Graph Report - .  (2026-07-01)

## Corpus Check
- Corpus is ~20,510 words - fits in a single context window. You may not need a graph.

## Summary
- 344 nodes · 430 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend App Components|Frontend App Components]]
- [[_COMMUNITY_Go Backend Core|Go Backend Core]]
- [[_COMMUNITY_Wails Go Model Bindings|Wails Go Model Bindings]]
- [[_COMMUNITY_Server & SSH Management|Server & SSH Management]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Wails Runtime Package|Wails Runtime Package]]
- [[_COMMUNITY_UI Design Components|UI Design Components]]
- [[_COMMUNITY_Wails Project Config|Wails Project Config]]
- [[_COMMUNITY_Runtime Type Definitions|Runtime Type Definitions]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_Sign-In Page|Sign-In Page]]
- [[_COMMUNITY_Design Tokens|Design Tokens]]
- [[_COMMUNITY_Glass Panel Styling|Glass Panel Styling]]
- [[_COMMUNITY_Event Listener API|Event Listener API]]
- [[_COMMUNITY_OpenCode Plugin Core|OpenCode Plugin Core]]
- [[_COMMUNITY_OpenCode Package Config|OpenCode Package Config]]
- [[_COMMUNITY_Medium Widget Design|Medium Widget Design]]
- [[_COMMUNITY_Small Widget Design|Small Widget Design]]
- [[_COMMUNITY_Dev Stats Widget|Dev Stats Widget]]

## God Nodes (most connected - your core abstractions)
1. `App` - 35 edges
2. `compilerOptions` - 16 edges
3. `App` - 11 edges
4. `dockerClient()` - 8 edges
5. `Dashboard` - 8 edges
6. `Config` - 7 edges
7. `AppData` - 6 edges
8. `sshSession` - 6 edges
9. `ServersView()` - 5 edges
10. `compilerOptions` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Main TSX Entry Point` --references--> `Dashboard`  [INFERRED]
  frontend/index.html → design/glance_dashboard_macos_blue/code.html
- `App` --references--> `sshSession`  [EXTRACTED]
  app.go → ssh.go
- `main()` --calls--> `NewApp()`  [INFERRED]
  main.go → app.go
- `Glass Panel Effect` --semantically_similar_to--> `Apple Glass Effect (Widget)`  [INFERRED] [semantically similar]
  design/glance_dashboard_macos_blue/code.html → design/glance_medium_widget_macos_blue/code.html
- `Glass Panel Effect` --semantically_similar_to--> `Glass Panel Effect (Sign In)`  [INFERRED] [semantically similar]
  design/glance_dashboard_macos_blue/code.html → design/glance_sign_in_macos_blue/code.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared Tailwind Design System** — design_glance_dashboard_macos_blue_code_design_tokens, design_glance_medium_widget_macos_blue_code_design_tokens, design_glance_sign_in_macos_blue_code_design_tokens, design_glance_small_widget_macos_blue_code_design_tokens [INFERRED 0.95]
- **GitHub Integration Pattern** — design_glance_dashboard_macos_blue_code_github_settings_card, design_glance_medium_widget_macos_blue_code_github_contribution_grid, design_glance_small_widget_macos_blue_code_contribution_grid, design_glance_sign_in_macos_blue_code_github_oauth_button [INFERRED 0.85]
- **Infrastructure Monitoring Pattern** — design_glance_dashboard_macos_blue_code_docker_daemon_card, design_glance_dashboard_macos_blue_code_remote_servers_card, design_glance_dashboard_macos_blue_code_status_console, design_glance_medium_widget_macos_blue_code_docker_container_stats, design_glance_medium_widget_macos_blue_code_vps_latency [INFERRED 0.85]

## Communities (26 total, 5 thin omitted)

### Community 1 - "Frontend App Components"
Cohesion: 0.06
Nodes (35): AppData, Config, ContainerInfo, LogLine, ServerConfig, TabId, container, root (+27 more)

### Community 2 - "Go Backend Core"
Cohesion: 0.09
Nodes (18): cpuPercent(), dockerClient(), Client, App, ServerConfig, NewApp(), Context, CPUStats (+10 more)

### Community 3 - "Wails Go Model Bindings"
Cohesion: 0.09
Nodes (8): AppData, Config, ContainerInfo, DockerStats, GitHubStats, ServerConfig, ServerMetrics, ServerStatus

### Community 4 - "Server & SSH Management"
Cohesion: 0.14
Nodes (13): CancelFunc, ServerMetrics, sshSession, Session, deleteSSHKey(), Client, App, ServerConfig (+5 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, react, react-dom, @xterm/addon-fit, @xterm/xterm, devDependencies, autoprefixer, postcss (+14 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+10 more)

### Community 7 - "Wails Runtime Package"
Cohesion: 0.12
Nodes (15): author, bugs, url, description, homepage, keywords, license, main (+7 more)

### Community 8 - "UI Design Components"
Cohesion: 0.15
Nodes (15): Dashboard, Docker Daemon Card, GitHub Settings Card, Sign in with GitHub Button, Remote Servers Card, Sidebar Navigation, Floating Status Console, Widget Docker Container Stats (+7 more)

### Community 9 - "Wails Project Config"
Cohesion: 0.18
Nodes (10): author, email, name, frontend:build, frontend:dev:serverUrl, frontend:dev:watcher, frontend:install, name (+2 more)

### Community 10 - "Runtime Type Definitions"
Cohesion: 0.25
Nodes (7): EnvironmentInfo, NotificationAction, NotificationCategory, NotificationOptions, Position, Screen, Size

### Community 11 - "Node TS Config"
Cohesion: 0.29
Nodes (6): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, include

### Community 12 - "Sign-In Page"
Cohesion: 0.40
Nodes (3): Config, SignInPage(), BrowserOpenURL()

### Community 13 - "Design Tokens"
Cohesion: 0.50
Nodes (4): Dashboard Design Tokens, Medium Widget Design Tokens, Sign In Design Tokens, Small Widget Design Tokens

### Community 14 - "Glass Panel Styling"
Cohesion: 0.50
Nodes (4): Glass Panel Effect, Apple Glass Effect (Widget), Glass Panel Effect (Sign In), Glass Panel Effect (Small Widget)

### Community 15 - "Event Listener API"
Cohesion: 0.67
Nodes (3): EventsOn(), EventsOnce(), EventsOnMultiple()

## Knowledge Gaps
- **101 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `ServerConfig`, `name` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App` connect `Go Backend Core` to `Server & SSH Management`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `sshSession` connect `Server & SSH Management` to `Go Backend Core`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `sshKeyDir()` connect `Server & SSH Management` to `Go Backend Core`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Wails JS Runtime API` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._
- **Should `Frontend App Components` be split into smaller, more focused modules?**
  _Cohesion score 0.060408163265306125 - nodes in this community are weakly interconnected._
- **Should `Go Backend Core` be split into smaller, more focused modules?**
  _Cohesion score 0.08788159111933395 - nodes in this community are weakly interconnected._