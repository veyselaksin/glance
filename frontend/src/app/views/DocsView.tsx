import { Icon } from '../../components/Icon';
export function DocsView() {
  return (
    <div className="max-w-2xl mx-auto animate-page-in space-y-xl">

      <div className="bg-surface-container border border-outline rounded-xl p-md space-y-md">
        <div>
          <h4 className="text-headline-sm font-headline-sm text-on-surface mb-sm">Architecture Overview</h4>
          <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
            Glance is a macOS desktop application built with Go + Wails. The Go agent runs a background ticker every 30 seconds, fetching GitHub contributions, Docker container stats, and server latency data.
          </p>
        </div>

        <div className="border-t border-outline pt-md">
          <h4 className="text-headline-sm font-headline-sm text-on-surface mb-sm">Data Pipeline</h4>
          <div className="space-y-sm">
            {[
              { icon: 'account_tree', label: 'GitHub GraphQL API', desc: "Fetches today's contribution count using OAuth token." },
              { icon: 'terminal',     label: 'Docker Socket',      desc: 'Reads /var/run/docker.sock for container stats.' },
              { icon: 'dns',          label: 'ICMP/HTTP Ping',     desc: 'Pings configured server host for latency tracking.' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-sm p-sm bg-background border border-outline rounded">
                <Icon name={item.icon} size={18} className="text-primary shrink-0" />
                <div>
                  <div className="text-body-sm font-body-sm text-on-surface font-semibold">{item.label}</div>
                  <div className="text-[11px] text-on-surface-variant">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
