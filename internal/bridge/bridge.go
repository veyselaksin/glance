// Package bridge is the only place backend code touches the Wails runtime.
// Every call is a no-op until SetContext is called, so domain packages and
// their tests can use a Bridge without a running Wails app.
package bridge

import (
	"context"
	"sync/atomic"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Event names shared with the frontend (see frontend/src/lib/events.ts).
const (
	EventAgentLog     = "agent_log"
	EventDataUpdated  = "data_updated"
	EventDeviceCode   = "device_code"
	EventOAuthSuccess = "oauth_success"
	EventOAuthError   = "oauth_error"
	EventSSHOutput    = "ssh_output"
	EventSSHClosed    = "ssh_closed"
)

// Bridge wraps the Wails runtime context.
type Bridge struct {
	ctx atomic.Pointer[context.Context]
}

// New returns an unattached Bridge.
func New() *Bridge { return &Bridge{} }

// SetContext attaches the Wails runtime context (called from OnStartup).
func (b *Bridge) SetContext(ctx context.Context) { b.ctx.Store(&ctx) }

// Context returns the runtime context, or context.Background if unattached.
func (b *Bridge) Context() context.Context {
	if p := b.ctx.Load(); p != nil {
		return *p
	}
	return context.Background()
}

func (b *Bridge) attached() (context.Context, bool) {
	p := b.ctx.Load()
	if p == nil {
		return nil, false
	}
	return *p, true
}

// Emit sends an event to the frontend.
func (b *Bridge) Emit(name string, data ...any) {
	if ctx, ok := b.attached(); ok {
		runtime.EventsEmit(ctx, name, data...)
	}
}

// Log emits an agent_log line shown in the Activity Log.
func (b *Bridge) Log(tag, msg string) {
	b.Emit(EventAgentLog, map[string]string{"tag": tag, "msg": msg})
}

// OpenURL opens a URL in the user's default browser.
func (b *Bridge) OpenURL(url string) {
	if ctx, ok := b.attached(); ok {
		runtime.BrowserOpenURL(ctx, url)
	}
}

// SetWindowTheme switches the native window appearance ("light" or "dark").
func (b *Bridge) SetWindowTheme(mode string) {
	ctx, ok := b.attached()
	if !ok {
		return
	}
	if mode == "light" {
		runtime.WindowSetLightTheme(ctx)
	} else {
		runtime.WindowSetDarkTheme(ctx)
	}
}
