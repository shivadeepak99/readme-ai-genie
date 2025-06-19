# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2025-06-19

### Fixed

- Removed chaining logic for multiple AI providers; now uses only Google Gemini for smoother, reliable API calls.
- Improved API key handling with an interactive prompt for first-time setup, guiding users to obtain and save their Gemini key easily.
- Optimized console messages and error handling for cleaner user experience.
- Minor typo fixes and formatting tweaks across the codebase.
- Updated documentation and CLI help messages to reflect single-provider usage.
