import { useState } from 'react';
import type { ServerConfig } from '../../types';
import { saveServer, saveSSHKey } from '../../services/ssh.service';

interface ServerFormProps {
  onSaved: () => void;
  onCancel: () => void;
  editing: ServerConfig | null;
}

export function ServerForm({ onSaved, onCancel, editing }: ServerFormProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [ip, setIp] = useState(editing?.ip ?? '');
  const [port, setPort] = useState(editing?.port ?? 22);
  const [username, setUsername] = useState(editing?.username ?? 'root');
  const [authMethod, setAuthMethod] = useState(editing?.auth_method ?? 'password');
  const [password, setPassword] = useState('');
  const [privateKeyContent, setPrivateKeyContent] = useState('');
  const [keyMode, setKeyMode] = useState<'paste' | 'path'>(
    editing?.private_key_path ? 'path' : 'paste'
  );
  const [privateKeyPath, setPrivateKeyPath] = useState(editing?.private_key_path ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !ip.trim()) {
      setError('Name and IP are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let keyPath = authMethod === 'private_key' ? privateKeyPath : '';

      if (authMethod === 'private_key' && keyMode === 'paste' && privateKeyContent.trim()) {
        const serverID = editing?.id ?? '';
        if (!serverID) {
          const tempID = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
          keyPath = await saveSSHKey(tempID, privateKeyContent);
        } else {
          keyPath = await saveSSHKey(serverID, privateKeyContent);
        }
      }

      await saveServer({
        id: editing?.id ?? '',
        name: name.trim(),
        ip: ip.trim(),
        port,
        username: username.trim() || 'root',
        auth_method: authMethod,
        password: authMethod === 'password' ? password : '',
        private_key_path: authMethod === 'private_key' ? keyPath : '',
      });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container border border-outline rounded-xl p-md space-y-md animate-fade-in">
      <div className="flex items-center gap-xs text-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dns</span>
        <span className="text-label-caps font-label-caps uppercase">{editing ? 'Edit Server' : 'Add Server'}</span>
      </div>

      {error && (
        <div className="px-sm py-xs text-error text-body-sm bg-error/10 rounded border border-error/30">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Name</label>
          <input className="mac-input" value={name} onChange={e => setName(e.target.value)} placeholder="My VPS" spellCheck={false} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">IP / Hostname</label>
          <input className="mac-input" value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.42" spellCheck={false} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Port</label>
          <input className="mac-input" type="number" value={port} onChange={e => setPort(parseInt(e.target.value) || 22)} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Username</label>
          <input className="mac-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="root" spellCheck={false} />
        </div>
      </div>

      {/* Secret Type */}
      <div className="space-y-sm">
        <label className="block text-label-caps font-label-caps text-on-surface-variant">Secret Type</label>
        <div className="flex gap-sm">
          <button
            onClick={() => setAuthMethod('password')}
            className={`flex items-center gap-xs px-md py-xs rounded text-body-sm font-body-sm transition-colors cursor-pointer ${authMethod === 'password' ? 'bg-primary text-on-primary' : 'bg-background border border-outline text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>key</span>
            Password
          </button>
          <button
            onClick={() => setAuthMethod('private_key')}
            className={`flex items-center gap-xs px-md py-xs rounded text-body-sm font-body-sm transition-colors cursor-pointer ${authMethod === 'private_key' ? 'bg-primary text-on-primary' : 'bg-background border border-outline text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>vpn_key</span>
            SSH Private Key
          </button>
        </div>
      </div>

      {authMethod === 'password' ? (
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">
            Password {editing && <span className="text-on-surface-variant/50 normal-case">(leave blank to keep existing)</span>}
          </label>
          <input className="mac-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="off" />
        </div>
      ) : (
        <div className="space-y-sm">
          {/* Key input mode toggle */}
          <div className="flex items-center justify-between">
            <label className="block text-label-caps font-label-caps text-on-surface-variant">Private Key</label>
            <div className="flex gap-xs">
              <button
                onClick={() => setKeyMode('paste')}
                className={`px-sm py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${keyMode === 'paste' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Paste Key
              </button>
              <button
                onClick={() => setKeyMode('path')}
                className={`px-sm py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${keyMode === 'path' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                File Path
              </button>
            </div>
          </div>

          {keyMode === 'paste' ? (
            <div className="space-y-sm">
              <textarea
                className="mac-input font-mono text-[12px] leading-relaxed resize-y"
                style={{ minHeight: '140px', height: '140px', userSelect: 'text' }}
                value={privateKeyContent}
                onChange={e => setPrivateKeyContent(e.target.value)}
                placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmU...\n-----END OPENSSH PRIVATE KEY-----'}
                spellCheck={false}
                autoComplete="off"
              />
              <div className="flex items-center gap-xs text-[11px] text-on-surface-variant/60">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                <span>Key is stored at <code className="text-primary font-mono">~/.glance/ssh_keys/</code> with 0600 permissions. Never written to config.json.</span>
              </div>
              {editing?.private_key_path && !privateKeyContent && (
                <div className="flex items-center gap-xs text-[11px] text-warning">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
                  <span>A key is already saved. Paste a new key to replace it, or switch to "File Path" mode.</span>
                </div>
              )}
            </div>
          ) : (
            <input
              className="mac-input font-mono"
              value={privateKeyPath}
              onChange={e => setPrivateKeyPath(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              spellCheck={false}
            />
          )}
        </div>
      )}

      <div className="flex justify-end gap-sm pt-sm">
        <button onClick={onCancel} className="px-md py-xs rounded text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all disabled:opacity-40 cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save Server'}
        </button>
      </div>
    </div>
  );
}
