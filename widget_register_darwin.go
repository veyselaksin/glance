//go:build darwin

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// registerWidgetHostApp registers Glance.app with Launch Services when the
// embedded GlanceWidget.appex is present. This makes the widget appear in
// Edit Widgets after the user opens Glance for the first time — no manual
// Xcode steps required.
func registerWidgetHostApp() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return
	}

	// .../Glance.app/Contents/MacOS/Glance
	appBundle := filepath.Clean(filepath.Join(filepath.Dir(exe), "..", ".."))
	if !strings.HasSuffix(appBundle, ".app") {
		return
	}

	appex := filepath.Join(appBundle, "Contents", "PlugIns", "GlanceWidget.appex")
	if _, err := os.Stat(appex); err != nil {
		return
	}

	lsregister := "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"
	cmd := exec.Command(lsregister, "-f", "-R", "-trusted", appBundle)
	_ = cmd.Run()
}
