# Changelog

## [1.1.0] - 2026-11-04

### Added
- **GitHub activity**: commit history for today / 7 / 30 / 90 days with a daily
  chart, per-repository breakdown (click to filter) and a list of commits that
  open on github.com. Available on the GitHub page and on Overview.
- Docker: restart containers, and launch Docker Desktop / OrbStack / Colima
  when the daemon is not running.
- Light mode, with a Light / Dark / Auto switch in Settings.
- Settings page; a warning when the GitHub token can't see any repositories.

### Changed
- Redesigned UI with a macOS-style sidebar and grouped settings.
- The GitHub token and SSH passwords are now stored in the macOS Keychain.
  Existing values in `config.json` are migrated automatically.
- Sign-in now uses a GitHub **OAuth App**. Disconnect and sign in again once
  after updating.

### Fixed
- "Commits today" showed 0 for commits pushed to branches other than the
  default branch. Every branch is now counted, only your own commits are
  counted, and organization repositories are included.
- The app bundle's version number now matches the app (it reported 1.0.0).

## [1.0.0] - 2026-07-05

- First release.
