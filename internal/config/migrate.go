package config

import "dev-stats-widget/internal/secrets"

// CurrentVersion is the config schema version written by this build.
//
//	v1: secrets stored in plain text in config.json
//	v2: secrets in the keychain; config.json holds none
const CurrentVersion = 2

// MigrateSecrets moves any plain-text GitHub token and SSH passwords into
// sec and removes them from config.json. A secret is only cleared from the
// file after it was stored successfully, so a keychain failure never loses
// data; the migration simply runs again next launch.
func (s *Store) MigrateSecrets(sec secrets.Store) error {
	cur := s.Get()
	if cur.Version >= CurrentVersion && !hasPlainSecrets(cur) {
		return nil
	}
	var firstErr error
	keep := func(err error) bool {
		if err != nil && firstErr == nil {
			firstErr = err
		}
		return err == nil
	}
	_, err := s.Update(func(c *Config) {
		if c.GitHubToken != "" && keep(sec.Set(secrets.GitHubToken, c.GitHubToken)) {
			c.GitHubToken = ""
		}
		for i := range c.Servers {
			srv := &c.Servers[i]
			if srv.Password != "" && keep(sec.Set(secrets.SSHPassword(srv.ID), srv.Password)) {
				srv.Password = ""
			}
		}
		if !hasPlainSecrets(*c) {
			c.Version = CurrentVersion
		}
	})
	if firstErr != nil {
		return firstErr
	}
	return err
}

func hasPlainSecrets(c Config) bool {
	if c.GitHubToken != "" {
		return true
	}
	for _, srv := range c.Servers {
		if srv.Password != "" {
			return true
		}
	}
	return false
}
