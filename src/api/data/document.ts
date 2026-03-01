import { parseHTML } from "linkedom";
import { REQUEST_TIMEOUT_MS } from "../../settings";

export async function getDocument(searchURL: string, signal?: AbortSignal): Promise<Document> {
  const effectiveSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(searchURL, { signal: effectiveSignal });
    const htmlString = await response.text();
    const { document } = parseHTML(htmlString);
    return document as unknown as Document;
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "AbortError" || name === "TimeoutError") throw e;
    throw new Error(`Error occured while fetching document of ${searchURL}`);
  }
}
