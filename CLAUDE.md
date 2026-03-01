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

- `libgen-downloader` - Interactive TUI mode (shows session browser if past sessions exist)
- `libgen-downloader -s "query"` - Direct search with TUI
- `libgen-downloader -b file.txt -n <folder>` - Bulk download from MD5 list into named folder
- `libgen-downloader -u <MD5>` - Get download URL for MD5
- `libgen-downloader -d <MD5> -n <folder>` - Download single file by MD5 into named folder

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
- Non-blocking downloads with live progress indicators
- Search filter screen: appears after entering a search phrase; toggle columns, objects, and topics (all on by default) before confirming the search
- Bulk download functionality with "Add All to Bulk Download Queue" option
- Per-search download folders: each search creates `libgen-downloads/<search-phrase>/` with its own session and tracking files
- Session browser: shown at launch when past sessions exist; lists all sessions with completion status for resumption
- Session persisted immediately when items are added to the bulk queue (survives early exit)
- Result caching (capped at 50 entries per filter combination)
- Dynamic mirror discovery

## Core Patterns & Architecture

**Adapter Pattern:** `/src/api/adapters/` implements pluggable source adapters:
- `Adapter.ts` - Abstract base class defining interface
- `LibgenPlusAdapter.ts` - Concrete LibGen+ implementation
- Handles URL construction, HTML parsing, download link extraction
- Supports dynamic mirror discovery and failover mechanisms

**Layout System:** `/src/tui/layouts/` uses enum-based layout keys:
- Search, Result List, Detail, Bulk Download, Download Queue management
- `SEARCH_FILTERS_LAYOUT` — shown after submitting a search; user toggles columns/objects/topics filters before confirming
- `SESSION_BROWSER_LAYOUT` — shown at launch when past sessions exist; lists all sessions for resumption
- `RESUME_SESSION_LAYOUT` — legacy redirect to `SESSION_BROWSER_LAYOUT`
- Layout switching handled via `LAYOUT_KEY` enum and store actions

**Error Handling:** Retry mechanism with 5 attempts, 2-second delays
- Graceful mirror failover for availability issues
- User-friendly error messages with retry options

## Key Data Files

All output is written under `libgen-downloads/<folder-name>/` in the current working directory. Each search phrase (or `--name` value for CLI modes) gets its own subfolder.

Per-folder files:

- `session.json` — tracks the bulk download session: search phrase, timestamp, and all items with MD5, title, filename, and status (`in_queue` | `downloaded` | `failed`). Created as soon as items are added to the queue; updated per item.
- `downloaded.txt` — append-only log of successfully downloaded MD5s.
- `failed.txt` — append-only log of failed MD5s.

Downloaded ebook files are saved alongside these tracking files in the same subfolder.

`findAllSessions(baseDir?)` in `src/api/data/session.ts` scans all subfolders of `libgen-downloads/` for `session.json` files and returns them sorted newest-first.

## Build System & Configuration

**TypeScript:** ES2016 target, CommonJS modules, strict type checking
**ESLint:** React + TypeScript rules with Prettier integration
**Prettier:** 100-char line width, double quotes, trailing commas
**Bun:** Used for building standalone executables (`bun build --compile`); replaces the legacy `pkg` tool

## Current Development Context

**Branch:** Currently on `v3/lg-plus-support` targeting LibGen+ support
**Config:** Remote configuration fetched from GitHub for dynamic mirror management
**Status:** LibGen mirrors have availability issues - see https://open-slum.org/ for status
