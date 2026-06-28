//go:build darwin

package main

// PinToDesktop is kept as a no-op stub.
// Desktop-level pinning is now handled by the native WidgetKit extension,
// not by the Wails management panel.
func PinToDesktop() {}
