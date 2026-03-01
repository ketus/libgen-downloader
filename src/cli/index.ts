import meow from "meow";

export const cli = meow(
  `
	Usage
	  $ libgen-downloader <input>

	Options
    -s, --search <query>      search for a book
    -b, --bulk <MD5LIST.txt>  start the app in bulk downloading mode (requires --name)
    -u, --url <MD5>           get the download URL
    -d, --download <MD5>      download the file (requires --name)
    -n, --name <label>        folder name for -b / -d downloads
    -h, --help                display help

	Examples
    $ libgen-downloader    (start the app in interactive mode witout flags)
    $ libgen-downloader -s "The Art of War"
    $ libgen-downloader -b ./MD5_LIST.txt --name "machine learning"
    $ libgen-downloader -u 1234567890abcdef1234567890abcdef
    $ libgen-downloader -d 1234567890abcdef1234567890abcdef --name "my books"
`,
  {
    importMeta: import.meta,
    flags: {
      search: {
        type: "string",
        shortFlag: "s",
      },
      bulk: {
        type: "string",
        shortFlag: "b",
      },
      url: {
        type: "string",
        shortFlag: "u",
      },
      download: {
        type: "string",
        shortFlag: "d",
      },
      name: {
        type: "string",
        shortFlag: "n",
      },
      help: {
        type: "boolean",
        shortFlag: "h",
      },
    },
  }
);
