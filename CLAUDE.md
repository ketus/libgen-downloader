# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`libgen-downloader` is a command-line tool for searching and downloading ebooks from libgen. It's built with TypeScript, React, Ink (for terminal UI), and Zustand for state management. The application provides both interactive TUI and CLI modes.

## Common Commands

**Development:**
- `npm start` - Run in development mode with ts-node
- `npm run build` - Build TypeScript to JavaScript
- `npm run watch` - Build and watch for changes
- `npm run lint` - Lint TypeScript/JavaScript files with ESLint + Prettier
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier (100-char line width)

**Production:**
- `bun build --compile` - Create standalone executable (replaces legacy `pkg`)
- `npm run rimraf` - Clean build and standalone-executables directories

**Testing/Debug:**
- `npm run inspect` - Run with Node.js debugger
- `npm run react-dt` - Launch React DevTools for TUI debugging

**CLI Usage:**
- `libgen-downloader` - Interactive TUI mode
- `libgen-downloader -s "query"` - Direct search with TUI
- `libgen-downloader -b file.txt` - Bulk download from MD5 list
- `libgen-downloader -u <MD5>` - Get download URL for MD5  
- `libgen-downloader -d <MD5>` - Download single file by MD5

## Architecture

The codebase follows a clean separation between CLI operations and the terminal user interface:

**Entry Point:** `src/index.ts` → `src/cli/operate.ts` - handles command-line arguments and determines execution mode

**Core Structure:**
- `/api/` - Data fetching and source adapters for libgen/Anna's Archive
  - `Adapter.ts` - Abstract base for different search sources
  - `/data/` - Data models and configuration
  - `/models/` - TypeScript interfaces for entries, downloads, etc.
- `/cli/` - Command-line interface logic and argument parsing
- `/tui/` - Terminal user interface built with React + Ink
  - `/components/` - Reusable UI components
  - `/layouts/` - Different app screens (search, results, downloads, etc.)
  - `/store/` - Zustand state management (app state, cache, queues)
  - `/hooks/` - Custom React hooks for list controls and dimensions

**State Management:** Uses Zustand with combined store architecture (`useBoundStore`):
- `app.ts` - UI state, layouts, loading indicators, search state
- `config.ts` - Mirror configuration and adapter management  
- `download-queue.ts` - Download queue with progress tracking
- `bulk-download-queue.ts` - Bulk download operations
- `cache.ts` - Search result caching mechanism
- `events.ts` - User interaction handlers (search, navigation, exit)

**Key Features:**
- Interactive TUI with keyboard navigation (vim-style J/K keys supported)
- Non-blocking downloads with progress indicators
- Bulk download functionality with "Add All to Bulk Download Queue" option
- Session tracking: persists download progress to `~/.libgen-downloader/session.json`; prompts to resume on next launch if there are unfinished items
- Files saved to `libgen-downloads/` subdirectory (created automatically)
- Incremental MD5 list files: created before downloads start, updated per item
- Alternative download source support
- Result caching (capped at 50 entries to prevent memory growth)
- Dynamic mirror discovery

## Core Patterns & Architecture

**Adapter Pattern:** `/src/api/adapters/` implements pluggable source adapters:
- `Adapter.ts` - Abstract base class defining interface
- `LibgenPlusAdapter.ts` - Concrete LibGen+ implementation
- Handles URL construction, HTML parsing, download link extraction
- Supports dynamic mirror discovery and failover mechanisms

**Layout System:** `/src/tui/layouts/` uses enum-based layout keys:
- Search, Result List, Detail, Bulk Download, Download Queue management
- `RESUME_SESSION_LAYOUT` — shown at startup when a previous session has unfinished items; user can resume or start fresh
- Layout switching handled via `LAYOUT_KEY` enum and store actions

**Error Handling:** Retry mechanism with 5 attempts, 2-second delays
- Graceful mirror failover for availability issues
- User-friendly error messages with retry options

## Key Data Files

Session and history files are stored in `~/.libgen-downloader/`:

- `session.json` — tracks the current/last bulk download run: search phrase, all items with MD5, title, filename, and status (`in_queue` | `downloaded` | `failed`). Written at run start, updated per item, never deleted.
- `downloaded.txt` — append-only log of successfully downloaded MD5s; used to skip re-downloads in future runs.

Per-run output files are written to the current working directory:

- `libgen_downloader_md5_list_<timestamp>.txt` — MD5s of successfully downloaded items (created before download starts, appended to per completion).
- `libgen_downloader_failed_<timestamp>.txt` — MD5s of failed items (created lazily on first failure).

Downloaded files are saved in the `libgen-downloads/` subdirectory of the current working directory.

## Build System & Configuration

**TypeScript:** ES2016 target, CommonJS modules, strict type checking
**ESLint:** React + TypeScript rules with Prettier integration
**Prettier:** 100-char line width, double quotes, trailing commas
**Bun:** Used for building standalone executables (`bun build --compile`); replaces the legacy `pkg` tool

## Current Development Context

**Branch:** Currently on `v3/lg-plus-support` targeting LibGen+ support
**Config:** Remote configuration fetched from GitHub for dynamic mirror management
**Status:** LibGen mirrors have availability issues - see https://open-slum.org/ for status
