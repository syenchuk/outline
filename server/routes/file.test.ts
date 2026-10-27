import { copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureDirSync } from "fs-extra";
import env from "@server/env";
import AttachmentHelper from "@server/models/helpers/AttachmentHelper";
import { buildAttachment, buildTeam, buildUser } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

async function buildStoredAttachment(acl: string) {
  const team = await buildTeam();
  const user = await buildUser({ teamId: team.id });
  const fileName = "images.docx";

  const attachment = await buildAttachment(
    {
      acl,
      key: AttachmentHelper.getKey({
        id: randomUUID(),
        name: fileName,
        userId: user.id,
      }),
      teamId: team.id,
      userId: user.id,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    fileName
  );

  const destination = path.join(
    env.FILE_STORAGE_LOCAL_ROOT_DIR,
    attachment.key
  );
  ensureDirSync(path.dirname(destination));
  copyFileSync(
    path.resolve(
      __dirname,
      "../../plugins/storage/server/test/fixtures",
      fileName
    ),
    destination
  );

  return attachment;
}

describe("/file/:id/:name", () => {
  it("should serve a public attachment without authentication", async () => {
    const attachment = await buildStoredAttachment("public-read");
    const res = await server.get(attachment.publicUrl);

    expect(res.status).toEqual(200);
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Link")).toEqual(
      `<${env.URL}${attachment.publicUrl}>; rel="canonical"`
    );
  });

  it("should force a download with the download parameter", async () => {
    const attachment = await buildStoredAttachment("public-read");
    const res = await server.get(`${attachment.publicUrl}?download`);

    expect(res.status).toEqual(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Link")).toEqual(
      `<${env.URL}${attachment.publicUrl}>; rel="canonical"`
    );
  });

  it("should ignore the file name in the path", async () => {
    const attachment = await buildStoredAttachment("public-read");
    const res = await server.get(`/file/${attachment.id}/other.docx`);

    expect(res.status).toEqual(200);
  });

  it("should fail with status 403 for a private attachment", async () => {
    const attachment = await buildStoredAttachment("private");
    const res = await server.get(attachment.publicUrl);

    expect(res.status).toEqual(403);
  });

  it("should fail with status 404 for an unknown attachment", async () => {
    const res = await server.get(`/file/${randomUUID()}/missing.png`);

    expect(res.status).toEqual(404);
  });

  it("should fail with status 404 for an invalid id", async () => {
    const res = await server.get("/file/junk/missing.png");

    expect(res.status).toEqual(404);
  });
});
