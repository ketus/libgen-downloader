
# libgen-downloader

[![npm version](https://badge.fury.io/js/libgen-downloader.svg)](https://badge.fury.io/js/libgen-downloader)


`libgen-downloader` is a command-line tool for searching and downloading ebooks from **LibGen**. Built with `Node.js`, `TypeScript`, `React`, `Ink`, and `Zustand`, it works by visiting LibGen’s web pages, parsing the HTML, and displaying results. Since it relies on LibGen’s servers, you may occasionally encounter connection errors when searching, downloading, or loading more pages.

## Important Update
After the original `libgen` mirrors are blocked and not available anymore (see their status from here https://open-slum.org/), `libgen-downloader` now uses the `libgen+` mirrors as its primary source. You can see the new available mirrors from [configuration](https://github.com/obsfx/libgen-downloader/blob/configuration/config.v3.json).

https://github.com/user-attachments/assets/3d92eb78-1567-478d-a0d1-5724f647be10

https://github.com/user-attachments/assets/9896d457-ccbf-40aa-ae6b-c253f7a97824



## Installation


if you have already installed `NodeJS` and `npm`, you can install it using `npm`:

```
npm i -g libgen-downloader
```

or you can download one of the `standalone executable` versions.

#### [Standalone Executables](https://github.com/obsfx/libgen-downloader/releases)

**macOS users:** After downloading, you need to remove the quarantine attribute and make it executable:
```bash
xattr -c ./libgen-downloader-macos-*
chmod +x ./libgen-downloader-macos-*
```

**Linux users:** Make it executable:
```bash
chmod +x ./libgen-downloader-linux-*
```

## Features

- Interactive user interface.
- Non-blocking direct downloading with live progress indicators.
- **Search filter screen**: after entering a search phrase, choose which fields (Title, Author, Series, Year, Publisher, ISBN), objects (Files, Editions, Series, Authors, Publishers, Works), and topics (Libgen, Comics, Fiction, Scientific Articles, Magazines, Fiction RUS, Standards) to include — all enabled by default, individually togglable.
- **Per-search download folders**: each search phrase gets its own subfolder inside `libgen-downloads/`, keeping files and session data organized by topic.
- **Session browser**: on launch, lists all previous download sessions with completion status so you can resume any interrupted bulk download.
- Bulk downloading with persistent session tracking (session survives exiting before download completes).
- Command line parameters:
  ```
  Usage
  	$ libgen-downloader <input>

  Options
  	-s, --search <query>       search for a book
  	-b, --bulk <MD5LIST.txt>   start the app in bulk downloading mode
  	-n, --name <folder>        folder name for bulk/download modes (required with -b and -d)
  	-u, --url <MD5>            get the download URL
  	-d, --download <MD5>       download the file
  	-h, --help                 display help

  Examples
  	$ libgen-downloader    (start the app in interactive mode without flags)
  	$ libgen-downloader -s "The Art of War"
  	$ libgen-downloader -b ./my_list.txt -n "stoicism"
  	$ libgen-downloader -u 1234567890abcdef1234567890abcdef
  	$ libgen-downloader -d 1234567890abcdef1234567890abcdef -n "stoicism"

  ```



## Changelogs

v3.2.0

- Added **search filter screen**: after entering a search phrase, a filter screen appears letting you enable/disable which fields (Title, Author, etc.), objects (Files, Editions, etc.), and topics (Libgen, Comics, Fiction, etc.) are included in the search. All filters are on by default with a "Toggle all" shortcut.
- Added **per-search download folders**: each search now gets its own named subfolder inside `libgen-downloads/` (e.g., `libgen-downloads/machine_learning/`), keeping downloaded files and session data organized by topic.
- Added **session browser**: on launch, all previous download sessions are listed with their date, item counts, and completion status, so you can resume any interrupted bulk download.
- Added `--name` / `-n` CLI flag, required when using `--bulk` or `--download` to specify the target folder name.
- Bulk download session and tracking files are created as soon as items are added to the queue (not just when the download starts), so sessions are always resumable even if you exit before downloading.

---

v3.0.0

- Added new `libgen+` mirrors as primary source. App is now usable as long as the `libgen+` mirrors are available.
- Dropped `search by` filtering options to make it compatible with the new `libgen+` mirrors.
- Dropped `alternative downloads` feature to make it compatible with the new `libgen+` mirrors.

---

v2.0.0

- Added alternative downloads.
- Added new download progress indicators.
- Added a cache mechanism to quickly retrieve previously searched results..
- Added new CLI parameter `-s, --search` to search queries directly in the command line.
- Added new shortcut keys to simplify usage:
	- `[J]` and `[K]` to move up and down for vimmers.
	- `[TAB]` to add an entry to the bulk download queue.
	- `[D]` to download an entry directly.
- Dropped result filtering. Instead added `Search by` filtering options to filter in columns like the original libgen search functionality.

---

v1.3.7

- Changed cli module and usage.
- Refactored downloading processes.
- README simplified.

---

v1.3

- Whole app was rewritten using `React`, `Ink` and `Zustand`.
- Added result filtering.
- Now you do not have to wait while downloading files using the `direct download` option.
- New version notifier.
- Due to the https://gen.lib.rus.ec is banned in my country, now libgen-downloader fetches the latest configuration file from the [configuration](https://github.com/obsfx/libgen-downloader/tree/configuration) branch and finds an available mirror dynamically.

---

v1.2

- Direct download option added as a cli functionality.

---

v1.1

- New and mostly resizeable UI.

---

v1.0

- Addded bulk downloading
- Improved error handling.
- When a connection error occurs, `libgen-downloader` does not shut down instantly. It tries 5 times to do same request with 3 seconds of delay.
- New customized UI module.
