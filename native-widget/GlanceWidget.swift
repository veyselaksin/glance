import WidgetKit
import SwiftUI

// MARK: - Data models (mirrors widget_data.json written by the Go backend)

struct GlanceData: Codable {
    let updatedAt: String
    let github: GlanceGitHub
    let docker: GlanceDocker
    let server: GlanceServer

    enum CodingKeys: String, CodingKey {
        case updatedAt = "updated_at"
        case github, docker, server
    }

    static let placeholder = GlanceData(
        updatedAt: "",
        github: GlanceGitHub(username: "you", contributions: 0, error: nil),
        docker: GlanceDocker(running: 0, stopped: 0, total: 0, error: nil),
        server: GlanceServer(host: "server", online: true, latency: 0, error: nil)
    )
}

struct GlanceGitHub: Codable {
    let username: String
    let contributions: Int
    let error: String?
}

struct GlanceDocker: Codable {
    let running: Int
    let stopped: Int
    let total: Int
    let error: String?
}

struct GlanceServer: Codable {
    let host: String
    let online: Bool
    let latency: Double
    let error: String?
}

// MARK: - Timeline

struct GlanceEntry: TimelineEntry {
    let date: Date
    let data: GlanceData
}

// MARK: - Provider

struct GlanceProvider: TimelineProvider {

    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        completion(GlanceEntry(date: Date(), data: readData() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        let data  = readData() ?? .placeholder
        let entry = GlanceEntry(date: Date(), data: data)
        // Ask WidgetKit to refresh every 30 seconds.
        let next  = Calendar.current.date(byAdding: .second, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    // Reads ~/Library/Application Support/Glance/widget_data.json.
    // Access is granted via a sandbox temporary exception in GlanceWidget.entitlements.
    private func readData() -> GlanceData? {
        let url = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Glance/widget_data.json")
        guard
            let raw     = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode(GlanceData.self, from: raw)
        else { return nil }
        return decoded
    }
}

// MARK: - Root view (dispatches to size-specific layouts)

struct GlanceWidgetView: View {
    let entry: GlanceEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .systemSmall:  SmallView(data: entry.data)
            default:            MediumView(data: entry.data)
            }
        }
        // Space Gray background matching the macOS system aesthetics
        .containerBackground(for: .widget) {
            Color(red: 0.118, green: 0.118, blue: 0.118)
        }
    }
}

// MARK: - Medium layout (3-column)

struct MediumView: View {
    let data: GlanceData

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // ── Header ──
            HStack(spacing: 5) {
                Image(systemName: "eye.fill")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(Color(red: 0.039, green: 0.518, blue: 1.0))
                Text("Glance")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.primary)
                Spacer()
                Text(shortTime(data.updatedAt))
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 7)

            Divider().opacity(0.35)

            // ── Three columns ──
            HStack(alignment: .top, spacing: 0) {
                GitHubColumn(gh: data.github)
                Divider().opacity(0.35)
                DockerColumn(dk: data.docker)
                Divider().opacity(0.35)
                ServerColumn(sv: data.server)
            }
            .padding(.top, 8)
        }
        .padding(13)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func shortTime(_ iso: String) -> String {
        guard !iso.isEmpty,
              let d = ISO8601DateFormatter().date(from: iso) else { return "—" }
        let f = DateFormatter(); f.timeStyle = .short
        return f.string(from: d)
    }
}

struct GitHubColumn: View {
    let gh: GlanceGitHub
    // Royal Blue accent (#0A84FF)
    let blue = Color(red: 0.039, green: 0.518, blue: 1.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("GITHUB")
                .font(.system(size: 7, weight: .semibold))
                .foregroundColor(.secondary)

            if let err = gh.error, !err.isEmpty {
                Text("Error").font(.system(size: 10)).foregroundColor(.red)
            } else {
                Text("\(gh.contributions)")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)
                    .minimumScaleFactor(0.7)
                Text("today")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Mini contribution squares
            HStack(spacing: 2) {
                ForEach(0..<7, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(i < min(gh.contributions, 7) ? blue : Color.secondary.opacity(0.2))
                        .frame(width: 6, height: 6)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.trailing, 9)
    }
}

struct DockerColumn: View {
    let dk: GlanceDocker
    let blue  = Color(red: 0.039, green: 0.518, blue: 1.0)
    let amber = Color(red: 1.0,   green: 0.584, blue: 0.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("DOCKER")
                .font(.system(size: 7, weight: .semibold))
                .foregroundColor(.secondary)

            if let err = dk.error, !err.isEmpty {
                Text("Error").font(.system(size: 10)).foregroundColor(amber)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("UP").font(.system(size: 7, weight: .bold)).foregroundColor(.secondary)
                        Spacer()
                        Text("\(dk.running)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(blue)
                    }
                    
                    GeometryReader { geo in
                        let ratio = dk.total > 0 ? CGFloat(dk.running) / CGFloat(dk.total) : 0
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(Color.secondary.opacity(0.15))
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(blue)
                                .frame(width: geo.size.width * ratio)
                        }
                    }
                    .frame(height: 3)
                    
                    HStack {
                        Text("OFF").font(.system(size: 7, weight: .bold)).foregroundColor(.secondary)
                        Spacer()
                        Text("\(dk.stopped)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(amber)
                    }
                }
                .padding(.top, 4)

                Spacer()

                Text("\(dk.total) total")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 9)
    }
}

struct ServerColumn: View {
    let sv: GlanceServer
    let amber = Color(red: 1.0,   green: 0.584, blue: 0.0)
    let blue  = Color(red: 0.039, green: 0.518, blue: 1.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("SERVER")
                .font(.system(size: 7, weight: .semibold))
                .foregroundColor(.secondary)

            HStack(spacing: 4) {
                Circle()
                    .fill(sv.online ? blue : amber)
                    .frame(width: 5, height: 5)
                Text(sv.online ? String(format: "%.0f ms", sv.latency) : "Offline")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(sv.online ? blue : amber)
                    .minimumScaleFactor(0.7)
            }

            Text(sv.host)
                .font(.system(size: 8, design: .monospaced))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer()

            HStack(alignment: .bottom, spacing: 2) {
                RoundedRectangle(cornerRadius: 0.5).fill(Color.secondary.opacity(0.15)).frame(width: 3, height: 8)
                RoundedRectangle(cornerRadius: 0.5).fill(blue.opacity(0.4)).frame(width: 3, height: 12)
                RoundedRectangle(cornerRadius: 0.5).fill(blue.opacity(0.6)).frame(width: 3, height: 10)
                RoundedRectangle(cornerRadius: 0.5).fill(blue).frame(width: 3, height: 16)
                RoundedRectangle(cornerRadius: 0.5).fill(blue.opacity(0.8)).frame(width: 3, height: 14)
            }
            .frame(height: 16)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 9)
    }
}

// MARK: - Small layout

struct SmallView: View {
    let data: GlanceData
    let amber = Color(red: 1.0,   green: 0.584, blue: 0.0)
    let blue  = Color(red: 0.039, green: 0.518, blue: 1.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: "eye.fill")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundColor(blue)
                Text("Glance")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.primary)
                Spacer()
            }

            Divider().opacity(0.35).padding(.vertical, 7)

            // GitHub
            HStack(spacing: 4) {
                Image(systemName: "chevron.left.forwardslash.chevron.right")
                    .font(.system(size: 8)).foregroundColor(.secondary).frame(width: 11)
                Text("\(data.github.contributions)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                Text("commits")
                    .font(.system(size: 9)).foregroundColor(.secondary)
            }
            .padding(.bottom, 5)

            // Docker
            HStack(spacing: 4) {
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 8)).foregroundColor(.secondary).frame(width: 11)
                Text("\(data.docker.running)").font(.system(size: 12, weight: .semibold)).foregroundColor(blue)
                Text("/").foregroundColor(.secondary)
                Text("\(data.docker.total)").font(.system(size: 12, weight: .semibold))
                Text("up").font(.system(size: 9)).foregroundColor(.secondary)
            }
            .padding(.bottom, 5)

            // Server
            HStack(spacing: 5) {
                Circle().fill(data.server.online ? blue : amber).frame(width: 5, height: 5).padding(.leading, 3)
                Text(data.server.online ? String(format: "%.0f ms", data.server.latency) : "Offline")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(data.server.online ? blue : amber)
            }

            Spacer()
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Widget

struct GlanceWidget: Widget {
    let kind = "GlanceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GlanceProvider()) { entry in
            GlanceWidgetView(entry: entry)
        }
        .configurationDisplayName("Glance")
        .description("Live developer metrics — GitHub, Docker, server status.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
