import JWT from "jsonwebtoken";
import Router from "@koa/router";
import { bytesToHumanReadable } from "@shared/utils/files";
import env from "@server/env";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@server/errors";
import auth from "@server/middlewares/authentication";
import multipart from "@server/middlewares/multipart";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import timeout from "@server/middlewares/timeout";
import validate from "@server/middlewares/validate";
import { Attachment } from "@server/models";
import AttachmentHelper from "@server/models/helpers/AttachmentHelper";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import { getJWTPayload } from "@server/utils/jwt";
import { serveFile } from "../utils/serveFile";
import * as T from "./schema";

const router = new Router();

router.post(
  "files.create",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth({ optional: true }),
  validate(T.FilesCreateSchema),
  timeout(30 * 60 * 1000), // 30 minutes for large file uploads
  multipart({
    maximumFileSize: Math.max(
      env.FILE_STORAGE_UPLOAD_MAX_SIZE,
      env.FILE_STORAGE_IMPORT_MAX_SIZE
    ),
  }),
  async (ctx: APIContext<T.FilesCreateReq>) => {
    const actor = ctx.state.auth.user;
    const { key, sig } = ctx.input.body;
    const file = ctx.input.file;

    if (!file) {
      throw ValidationError("Request must include a file parameter");
    }

    // A short-lived signature authorizes the upload to this key without a session.
    if (sig) {
      verifyUploadSignature(sig, key);
    } else if (!actor) {
      throw AuthenticationError("Authentication required");
    }

    const attachment = await Attachment.findOne({
      where: { key },
      rejectOnEmpty: true,
    });

    // For session-based uploads, ensure the attachment belongs to the actor.
    if (!sig && actor && attachment.userId !== actor.id) {
      throw AuthorizationError("Invalid key");
    }

    const declaredSize = Number(attachment.size);

    if (file.size > declaredSize) {
      await attachment.destroy();
      throw ValidationError(
        `The uploaded file exceeds the declared size of ${bytesToHumanReadable(
          declaredSize
        )}`
      );
    }

    try {
      await attachment.writeFile(file);
    } catch (err) {
      await attachment.destroy();
      if (err instanceof Error && err.message.includes("permission denied")) {
        throw Error(
          `Permission denied writing to "${key}". Check the host machine file system permissions.`
        );
      }
      throw err;
    }

    if (declaredSize !== file.size) {
      await attachment.update({ size: file.size }, { silent: true });
    }

    ctx.body = {
      success: true,
    };
  }
);

router.get(
  "files.get",
  // Signed requests are authorized by their signature alone.
  auth({ optional: true, skip: (ctx) => !!ctx.query.sig }),
  validate(T.FilesGetSchema),
  async (ctx: APIContext<T.FilesGetReq>) => {
    const actor = ctx.state.auth.user;
    const key = getKeyFromContext(ctx);
    const forceDownload = !!ctx.input.query.download;
    const isSignedRequest = !!ctx.input.query.sig;
    const { isPublicBucket, fileName } = AttachmentHelper.parseKey(key);
    const attachment = await Attachment.findByKey(key);

    // Skip authorization for public bucket, signed requests, or public-read ACL attachments
    const skipAuthorize =
      isPublicBucket ||
      isSignedRequest ||
      (attachment && !attachment.isPrivate);

    if (!skipAuthorize) {
      if (!attachment && !!ctx.input.query.key) {
        throw NotFoundError();
      }

      authorize(actor, "read", attachment);
    }

    await serveFile(ctx, {
      key,
      fileName,
      contentType: attachment?.contentType,
      forceDownload,
    });
  }
);

/**
 * Verifies a short-lived signature authorizing an upload to a single key.
 *
 * @param sig The signature to verify.
 * @param key The key the upload is being made to.
 * @throws AuthenticationError if the signature is invalid, expired, or scoped
 * to a different key.
 */
function verifyUploadSignature(sig: string, key: string) {
  const payload = getJWTPayload(sig);

  if (payload.type !== "attachment-upload" || payload.key !== key) {
    throw AuthenticationError("Invalid signature");
  }

  try {
    JWT.verify(sig, env.SECRET_KEY);
  } catch (_err) {
    throw AuthenticationError("Invalid signature");
  }
}

function getKeyFromContext(ctx: APIContext<T.FilesGetReq>): string {
  const { key, sig } = ctx.input.query;
  if (sig) {
    const payload = getJWTPayload(sig);

    if (payload.type !== "attachment") {
      throw AuthenticationError("Invalid signature");
    }

    try {
      JWT.verify(sig, env.SECRET_KEY);
    } catch (_err) {
      throw AuthenticationError("Invalid signature");
    }

    return payload.key as string;
  }

  if (key) {
    return key;
  }

  throw ValidationError("Must provide either key or sig parameter");
}

export default router;
