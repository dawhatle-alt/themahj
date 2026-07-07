import { Router, type IRouter } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const objectStorage = new ObjectStorageService();

// Serves /api/storage/objects/... by redirecting to the file's Supabase Storage
// public URL — avoids proxying image bandwidth through the API server.
router.get("/storage/{*splat}", async (req, res): Promise<void> => {
  const splatParam = req.params as { splat?: string | string[] };
  const splat = Array.isArray(splatParam.splat)
    ? splatParam.splat.join("/")
    : (splatParam.splat ?? "");

  if (!splat.startsWith("objects/")) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const objectPath = `/${splat}`;
    const { publicUrl } = await objectStorage.getObjectEntityFile(objectPath);
    res.redirect(302, publicUrl);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
    } else {
      logger.error({ err }, "Storage error");
      res.status(500).json({ error: "Storage error" });
    }
  }
});

export default router;
