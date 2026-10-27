import { escape } from "es-toolkit/compat";

/** A page listed in a sitemap. */
export interface SitemapEntry {
  /** The absolute URL of the page. */
  url: string;
  /** The date the page was last modified, if known. */
  lastmod?: Date;
}

/**
 * Converts a list of pages to a sitemap XML string.
 *
 * @param entries The pages to list.
 * @returns The sitemap XML string.
 */
export function entriesToSitemap(entries: SitemapEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(
      ({ url, lastmod }) =>
        `  <url><loc>${escape(url)}</loc>${
          lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""
        }</url>`
    )
    .join("\n")}\n</urlset>`;
}
