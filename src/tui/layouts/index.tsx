import React from "react";
import { Layout } from "./Layout";
import { LAYOUT_KEY } from "./keys";
import Search from "./search/index";
import ResultList from "./result-list/index";
import { ResultListContextProvider } from "../contexts/ResultListContext";
import Detail from "./detail/index";
import { BulkDownload } from "./bulk-download";
import { BulkDownloadBeforeExit } from "./bulk-download-before-exit";
import { DownloadQueueBeforeExit } from "./download-queue-before-exit";
import { ResumeSession } from "./resume-session";
import { SessionBrowser } from "./session-browser";
import { SearchFilters } from "./search-filters";

const Layouts: React.FC = () => {
  return (
    <>
      <Layout layoutName={LAYOUT_KEY.SEARCH_LAYOUT}>
        <Search />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.RESULT_LIST_LAYOUT}>
        <ResultListContextProvider>
          <ResultList />
        </ResultListContextProvider>
      </Layout>

      <Layout layoutName={LAYOUT_KEY.DETAIL_LAYOUT}>
        <Detail />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.BULK_DOWNLOAD_LAYOUT}>
        <BulkDownload />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.BULK_DOWNLOAD_BEFORE_EXIT_LAYOUT}>
        <BulkDownloadBeforeExit />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.DOWNLOAD_QUEUE_BEFORE_EXIT_LAYOUT}>
        <DownloadQueueBeforeExit />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.RESUME_SESSION_LAYOUT}>
        <ResumeSession />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.SESSION_BROWSER_LAYOUT}>
        <SessionBrowser />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.SEARCH_FILTERS_LAYOUT}>
        <SearchFilters />
      </Layout>
    </>
  );
};

export default Layouts;
