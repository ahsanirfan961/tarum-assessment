/**
 * Downloads a same- or cross-origin file with a chosen filename.
 *
 * A plain `<a download href="https://other-origin/...">` only gets treated as
 * a download by the browser when the response opts in via CORS; otherwise it
 * just navigates. Fetching the bytes first and downloading the resulting
 * same-origin blob URL works regardless of the source's CORS headers, as long
 * as the fetch itself isn't blocked.
 */
export async function downloadAsset(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed with ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    // CORS or network failure on the source: fall back to opening it in a
    // new tab so the user can still save it manually.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
