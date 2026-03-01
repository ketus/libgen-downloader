import React from "react";
import { IOption } from "../../components/Option";
import { useBoundStore } from "../../store";
import { LAYOUT_KEY } from "../keys";
import OptionList from "../../components/OptionList";

export function BulkDownloadAfterCompleteOptions() {
  const setActiveLayout = useBoundStore((state) => state.setActiveLayout);
  const resetBulkDownloadQueue = useBoundStore((state) => state.resetBulkDownloadQueue);
  const backToSearch = useBoundStore((state) => state.backToSearch);

  const options: Record<string, IOption> = {
    view_sessions: {
      label: "View download sessions",
      onSelect: () => {
        resetBulkDownloadQueue();
        setActiveLayout(LAYOUT_KEY.SESSION_BROWSER_LAYOUT);
      },
      order: 0,
    },
    back_to_search: {
      label: "New search",
      onSelect: () => {
        resetBulkDownloadQueue();
        backToSearch();
      },
      order: 1,
    },
  };

  return <OptionList options={options} />;
}
