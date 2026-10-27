import type { Context } from "koa";
import isUUID from "validator/lib/isUUID";
import env from "@server/env";
import { AuthorizationError, NotFoundError } from "@server/errors";
import { Attachment } from "@server/models";
import { serveFile } from "plugins/storage/server/utils/serveFile";

/**
 * Serves a public attachment at a stable, indexable URL of the form
 * `/file/<attachment id>/<file name>`. The file name is only cosmetic. Add
 * `?download` to force the browser to download the file.
 *
 * @param ctx the Koa context.
 * @throws NotFoundError if the attachment does not exist.
 * @throws AuthorizationError if the attachment is private.
 */
export async function renderFile(ctx: Context) {
  const { id } = ctx.params;

  if (!isUUID(id)) {
    throw NotFoundError();
  }

  const attachment = await Attachment.findByPk(id);
  if (!attachment) {
    throw NotFoundError();
  }

  if (attachment.isPrivate) {
    throw AuthorizationError();
  }

  if (env.FILE_STORAGE !== "local") {
    ctx.redirect(attachment.publicUrl);
    return;
  }

  await attachment.updateAccessedAt();

  await serveFile(ctx, {
    key: attachment.key,
    fileName: attachment.name,
    contentType: attachment.contentType,
    forceDownload: ctx.query.download !== undefined,
    // The download variant and the plain URL share one search engine entry
    canonicalUrl: `${env.URL}${attachment.publicUrl}`,
  });
}
