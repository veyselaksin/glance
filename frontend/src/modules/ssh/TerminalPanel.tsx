import { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { connectSSH, sshWrite, sshResize, disconnectSSH } from '../../services/ssh.service';
import { onSshOutput, onSshClosed } from '../../lib/events';

interface TerminalPanelProps {
  serverID: string;
  serverName: string;
  onDisconnect: () => void;
}

export function TerminalPanel({ serverID, serverName, onDisconnect }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIDRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, SF Mono, Fira Code, monospace',
      theme: {
        background: '#000000',
        foreground: '#e5e5e5',
        cursor: '#0A84FF',
        cursorAccent: '#000000',
        selectionBackground: '#0A84FF55',
        black: '#000000',
        red: '#FF453A',
        green: '#30D158',
        yellow: '#FF9500',
        blue: '#0A84FF',
        magenta: '#BF5AF2',
        cyan: '#64D2FF',
        white: '#e5e5e5',
        brightBlack: '#808080',
        brightRed: '#FF6961',
        brightGreen: '#42E680',
        brightYellow: '#FFB340',
        brightBlue: '#3D9BFF',
        brightMagenta: '#D070FF',
        brightCyan: '#85DCFF',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.writeln(`\x1b[38;2;10;132;255mConnecting to ${serverName}...\x1b[0m`);

    connectSSH(serverID).then(sid => {
      sessionIDRef.current = sid;
      setConnected(true);
      term.writeln(`\x1b[38;2;10;132;255mConnected. Session: ${sid.slice(0, 8)}\x1b[0m\r\n`);

      sshResize(sid, term.cols, term.rows).catch(() => {});
    }).catch(e => {
      setError(String(e));
      term.writeln(`\x1b[38;2;255;69;58mConnection failed: ${e}\x1b[0m`);
    });

    const offOutput = onSshOutput((payload) => {
      if (payload.session_id === sessionIDRef.current) {
        term.write(payload.data);
      }
    });

    const offClosed = onSshClosed((payload) => {
      if (payload.session_id === sessionIDRef.current) {
        term.writeln(`\r\n\x1b[38;2;255;69;58m[Session closed: ${payload.reason}]\x1b[0m`);
        setConnected(false);
      }
    });

    const inputDisp = term.onData(data => {
      if (sessionIDRef.current) {
        sshWrite(sessionIDRef.current, data).catch(() => {});
      }
    });

    const resizeDisp = term.onResize(({ cols, rows }) => {
      if (sessionIDRef.current) {
        sshResize(sessionIDRef.current, cols, rows).catch(() => {});
      }
    });

    const onResize = () => {
      if (fitRef.current) {
        try { fitRef.current.fit(); } catch {}
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      offOutput();
      offClosed();
      inputDisp.dispose();
      resizeDisp.dispose();
      window.removeEventListener('resize', onResize);
      if (sessionIDRef.current) {
        disconnectSSH(sessionIDRef.current).catch(() => {});
      }
      term.dispose();
    };
  }, [serverID, serverName]);

  const handleDisconnect = () => {
    if (sessionIDRef.current) {
      disconnectSSH(sessionIDRef.current).catch(() => {});
      sessionIDRef.current = null;
    }
    setConnected(false);
    onDisconnect();
  };

  return (
    <div className="flex flex-col h-full bg-surface-container border border-outline rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline">
        <div className="flex items-center gap-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-status-pulse' : 'bg-warning'}`} />
          <span className="text-label-caps font-label-caps text-primary uppercase">{serverName} — Terminal</span>
          {connected && <span className="text-[10px] text-on-surface-variant font-code-sm">● LIVE</span>}
        </div>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-xs px-sm py-xs rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors text-body-sm font-body-sm cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>power_off</span>
          Disconnect
        </button>
      </div>

      <div ref={containerRef} className="flex-1 bg-black overflow-hidden min-h-0" />

      {error && (
        <div className="px-md py-sm text-error text-body-sm bg-error/10 border-t border-error/30">
          {error}
        </div>
      )}
    </div>
  );
}
