import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const objectStorage = new ObjectStorageService();

router.get("/storage/{*splat}", async (req, res): Promise<void> => {
  const splatParam = req.params as { splat?: string | string[] };
  const splat = Array.isArray(splatParam.splat)
    ? splatParam.splat.join("/")
    : (splatParam.splat ?? "");

  if (splat.startsWith("objects/")) {
    try {
      const objectPath = `/${splat}`;
      const { publicUrl } = await objectStorage.getObjectEntityFile(objectPath);
      // Redirect to Supabase public URL — avoids proxying bandwidth through the API server
      res.redirect(302, publicUrl);
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "File not found" });
      } else {
        logger.error({ err }, "Storage error");
        res.status(500).json({ error: "Storage error" });
      }
    }
    return;
  }

  // Legacy local file serving (uploads/ directory — dev only)
  const filePath = path.resolve(uploadsDir, splat);
  if (!filePath.startsWith(uploadsDir)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
