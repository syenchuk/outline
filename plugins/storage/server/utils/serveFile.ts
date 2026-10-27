import contentDisposition from "content-disposition";
import mime from "mime-types";
import type { Context } from "koa";
import FileStorage from "@server/storage/files";
import type LocalStorage from "@server/storage/files/LocalStorage";
import { ByteRangeHelper } from "./ByteRangeHelper";

interface ServeFileOptions {
  /** The storage key of the file. */
  key: string;
  /** The name of the file, used for the content disposition header. */
  fileName?: string;
  /** The content type, derived from the file name when not provided. */
  contentType?: string;
  /** Whether the browser should download the file rather than display it. */
  forceDownload?: boolean;
  /** An absolute URL to advertise as the canonical location of the file. */
  canonicalUrl?: string;
}

/**
 * Streams a file from local storage into the response, with support for byte
 * ranges, long-lived caching and a restrictive content security policy.
 *
 * @param ctx the Koa context.
 * @param options the file to serve and how to serve it.
 */
export async function serveFile(ctx: Context, options: ServeFileOptions) {
  const { key, fileName, forceDownload, canonicalUrl } = options;
  const contentType =
    options.contentType ||
    (fileName ? mime.lookup(fileName) : undefined) ||
    "application/octet-stream";

  if (contentType === "application/pdf") {
    ctx.remove("X-Frame-Options");
  }

  ctx.set("Accept-Ranges", "bytes");
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Cache-Control", "max-age=604800, immutable");
  ctx.set("Content-Type", contentType);
  ctx.set(
    "Content-Security-Policy",
    // Safari will not render PDFs in an embed if the sandbox directive is used, so we use a
    // tight CSP in that case. For all other file types we use the strict sandbox directive
    // which blocks all content from being loaded and rendered.
    contentType === "application/pdf"
      ? "default-src 'self'; object-src 'self'; base-uri 'none';"
      : "sandbox"
  );
  ctx.set(
    "Content-Disposition",
    contentDisposition(fileName, {
      type: forceDownload
        ? "attachment"
        : FileStorage.getContentDispositionType(contentType),
    })
  );

  if (canonicalUrl) {
    ctx.set("Link", `<${canonicalUrl}>; rel="canonical"`);
  }

  // Handle byte range requests
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
  const stats = await (FileStorage as LocalStorage).stat(key);
  const range = ByteRangeHelper.parse(ctx.headers.range, stats.size);

  if (range === ByteRangeHelper.unsatisfiable) {
    ctx.status = 416;
    ctx.set("Content-Range", `bytes */${stats.size}`);
    return;
  }

  if (range) {
    ctx.status = 206;
    ctx.set("Content-Length", String(range.end - range.start + 1));
    ctx.set("Content-Range", `bytes ${range.start}-${range.end}/${stats.size}`);
  } else {
    ctx.set("Content-Length", String(stats.size));
  }

  ctx.body = await FileStorage.getFileStream(key, range);
}
