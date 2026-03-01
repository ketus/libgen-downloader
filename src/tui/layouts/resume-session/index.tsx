import React from "react";
import { useBoundStore } from "../../store";
import { LAYOUT_KEY } from "../keys";

// This layout is superseded by SessionBrowser. Redirect immediately.
export function ResumeSession() {
  const setActiveLayout = useBoundStore((state) => state.setActiveLayout);
  setActiveLayout(LAYOUT_KEY.SESSION_BROWSER_LAYOUT);
  return null;
}
