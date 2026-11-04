package main

import (
	"embed"
	"encoding/json"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"

	"dev-stats-widget/api"
	"dev-stats-widget/internal/config"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed wails.json
var wailsConfig []byte

// version is read from wails.json so it only needs to change in one place.
func version() string {
	var cfg struct {
		Version string `json:"version"`
	}
	if json.Unmarshal(wailsConfig, &cfg) == nil && cfg.Version != "" {
		return cfg.Version
	}
	return "dev"
}

func main() {
	dir, err := config.DefaultDir()
	if err != nil {
		log.Fatalf("data dir: %v", err)
	}
	app, err := api.New(dir, version())
	if err != nil {
		log.Fatalf("init: %v", err)
	}

	err = wails.Run(&options.App{
		Title:     "Glance",
		Width:     1280,
		Height:    800,
		MinWidth:  1100,
		MinHeight: 700,
		// Transparent so the vibrancy material shows through.
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		Bind:             app.Bindings(),
		Mac: &mac.Options{
			TitleBar: &mac.TitleBar{
				// Transparent titlebar; traffic lights float over the webview.
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
				FullSizeContent:            true,
				HideToolbarSeparator:       true,
			},
			// Appearance follows the resolved theme via SystemService.SetAppTheme.
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
