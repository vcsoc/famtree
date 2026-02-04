import { Router } from "express";
import { z } from "zod";
import { createId, getDb } from "./db.js";
import { authRequired, hashPassword, signToken, verifyPassword } from "./auth.js";
import { hasRole } from "./rbac.js";
import type { Role } from "./types.js";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// Configure multer for .famtree file uploads
const famtreeUpload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for .famtree files
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/json" || file.originalname.endsWith('.famtree')) {
      cb(null, true);
    } else {
      cb(new Error("Only .famtree files are allowed"));
    }
  }
});

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(2).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/auth/register", async (req, res) => {
  const db = getDb();
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { email, password, tenantName } = parsed.data;
  const existing = await db.get("SELECT id FROM users WHERE email = ?", email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const tenantCount = (await db.get("SELECT COUNT(*) as count FROM tenants")) as { count: number };
  const isFirstUser = tenantCount.count === 0;

  let tenantId: string | null = null;
  let role: Role = "Visitor";

  if (isFirstUser) {
    tenantId = createId();
    await db.run("INSERT INTO tenants (id, name) VALUES (?, ?)", tenantId, tenantName ?? "Default Tenant");
    role = "Admin";
  }

  const userId = createId();
  const passwordHash = await hashPassword(password);
  await db.run(
    "INSERT INTO users (id, email, password_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?)",
    userId,
    email,
    passwordHash,
    role,
    tenantId
  );

  const token = signToken({ id: userId, email, role, tenantId });
  res.json({ token, role, tenantId });
});

router.post("/auth/login", async (req, res) => {
  const db = getDb();
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log("Login validation failed:", parsed.error);
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { email, password } = parsed.data;
  console.log("Login attempt for:", email);
  const user = (await db.get("SELECT * FROM users WHERE email = ?", email)) as any;
  if (!user) {
    console.log("User not found:", email);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  console.log("User found, verifying password...");
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    console.log("Password verification failed");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  console.log("Login successful for:", email);
  const token = signToken({ id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id });
  res.json({ token, role: user.role, tenantId: user.tenant_id });
});

router.get("/me", authRequired, (req, res) => {
  const user = (req as any).user;
  res.json({ user });
});

router.post("/tenants", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { role: Role };
  if (!hasRole(user.role, "Admin")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  const payload = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const tenantId = createId();
  await db.run("INSERT INTO tenants (id, name) VALUES (?, ?)", tenantId, payload.data.name);
  res.json({ id: tenantId, name: payload.data.name });
});

router.get("/forests", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  if (!user.tenantId) {
    res.json({ forests: [] });
    return;
  }

  const forests = await db.all("SELECT * FROM forests WHERE tenant_id = ?", user.tenantId);
  res.json({ forests });
});

router.get("/forests/:id", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  const forestId = req.params.id;

  const forest = await db.get("SELECT * FROM forests WHERE id = ? AND tenant_id = ?", forestId, user.tenantId);
  if (!forest) {
    res.status(404).json({ error: "Forest not found" });
    return;
  }

  res.json(forest);
});

router.post("/forests", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string; role: Role; tenantId: string | null };
  if (!user.tenantId || !hasRole(user.role, "Ranger")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  const payload = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const forestId = createId();
  await db.run(
    "INSERT INTO forests (id, tenant_id, name, created_by) VALUES (?, ?, ?, ?)",
    forestId,
    user.tenantId,
    payload.data.name,
    user.id
  );

  await db.run(
    "INSERT INTO forest_members (id, forest_id, user_id, role) VALUES (?, ?, ?, ?)",
    createId(),
    forestId,
    user.id,
    "Ranger"
  );

  res.json({ id: forestId, name: payload.data.name });
});

router.put("/forests/:id", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { role: Role };
  if (!hasRole(user.role, "Ranger")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  const payload = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const forestId = req.params.id;
  await db.run("UPDATE forests SET name = ? WHERE id = ?", payload.data.name, forestId);
  res.json({ id: forestId, name: payload.data.name });
});

router.get("/trees", authRequired, async (req, res) => {
  const db = getDb();
  const forestId = String(req.query.forestId || "");
  if (!forestId) {
    res.status(400).json({ error: "forestId is required" });
    return;
  }

  const trees = await db.all("SELECT * FROM trees WHERE forest_id = ?", forestId);
  res.json({ trees });
});

router.post("/trees", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string; role: Role };
  if (!hasRole(user.role, "Arborist")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  const payload = z.object({ forestId: z.string().min(1), name: z.string().min(2) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const treeId = createId();
  await db.run(
    "INSERT INTO trees (id, forest_id, name, created_by) VALUES (?, ?, ?, ?)",
    treeId,
    payload.data.forestId,
    payload.data.name,
    user.id
  );

  await db.run(
    "INSERT INTO tree_members (id, tree_id, user_id, role) VALUES (?, ?, ?, ?)",
    createId(),
    treeId,
    user.id,
    "Arborist"
  );

  res.json({ id: treeId, name: payload.data.name });
});

// Delete a tree
router.delete("/trees/:treeId", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string; role: Role };
  const { treeId } = req.params;

  // Check if user has access to this tree
  const member = await db.get(
    "SELECT role FROM tree_members WHERE tree_id = ? AND user_id = ?",
    treeId,
    user.id
  );

  if (!member) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  if (!hasRole(member.role, "Arborist")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  // Delete all associated data (person_images, relationships, people, tree_members, tree)
  // The CASCADE delete in the schema should handle most of this, but we'll be explicit
  await db.run("DELETE FROM person_images WHERE person_id IN (SELECT id FROM people WHERE tree_id = ?)", treeId);
  await db.run("DELETE FROM relationships WHERE tree_id = ?", treeId);
  await db.run("DELETE FROM people WHERE tree_id = ?", treeId);
  await db.run("DELETE FROM tree_members WHERE tree_id = ?", treeId);
  await db.run("DELETE FROM trees WHERE id = ?", treeId);

  res.json({ success: true });
});

router.get("/trees/:id", authRequired, async (req, res) => {
  const db = getDb();
  const treeId = req.params.id;
  const tree = await db.get("SELECT * FROM trees WHERE id = ?", treeId) as any;
  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }
  res.json(tree);
});

router.put("/trees/:id", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { role: Role };
  if (!hasRole(user.role, "Arborist")) {
    res.status(403).json({ error: "Insufficient role" });
    return;
  }

  const payload = z.object({ name: z.string().min(2) }).safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const treeId = req.params.id;
  await db.run("UPDATE trees SET name = ? WHERE id = ?", payload.data.name, treeId);
  res.json({ id: treeId, name: payload.data.name });
});

router.get("/people", authRequired, async (req, res) => {
  const db = getDb();
  const treeId = String(req.query.treeId || "");
  if (!treeId) {
    res.status(400).json({ error: "treeId is required" });
    return;
  }

  const people = await db.all("SELECT * FROM people WHERE tree_id = ?", treeId);
  res.json({ people });
});

router.post("/people", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string };

  const payload = z.object({
    treeId: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    maidenName: z.string().optional(),
    gender: z.string().optional(),
    birthDate: z.string().optional(),
    birthPlace: z.string().optional(),
    deathDate: z.string().optional(),
    deathPlace: z.string().optional(),
    biography: z.string().optional(),
    photoUrl: z.string().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional()
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const personId = createId();
  const data = payload.data;
  await db.run(
    `INSERT INTO people (id, tree_id, first_name, middle_name, last_name, maiden_name, gender, 
     birth_date, birth_place, death_date, death_place, biography, photo_url, position_x, position_y) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    personId, data.treeId, data.firstName, data.middleName || null, data.lastName || null,
    data.maidenName || null, data.gender || null, data.birthDate || null, data.birthPlace || null,
    data.deathDate || null, data.deathPlace || null, data.biography || null, data.photoUrl || null,
    data.positionX || 0, data.positionY || 0
  );

  res.json({ id: personId, ...data });
});

router.put("/people/:id", authRequired, async (req, res) => {
  const db = getDb();
  const personId = req.params.id;

  const payload = z.object({
    firstName: z.string().optional(),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    maidenName: z.string().optional(),
    gender: z.string().optional(),
    birthDate: z.string().optional(),
    birthPlace: z.string().optional(),
    deathDate: z.string().optional(),
    deathPlace: z.string().optional(),
    biography: z.string().optional(),
    photoUrl: z.string().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional()
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const data = payload.data;
  const updates: string[] = [];
  const values: any[] = [];

  if (data.firstName !== undefined) { updates.push("first_name = ?"); values.push(data.firstName); }
  if (data.middleName !== undefined) { updates.push("middle_name = ?"); values.push(data.middleName); }
  if (data.lastName !== undefined) { updates.push("last_name = ?"); values.push(data.lastName); }
  if (data.maidenName !== undefined) { updates.push("maiden_name = ?"); values.push(data.maidenName); }
  if (data.gender !== undefined) { updates.push("gender = ?"); values.push(data.gender); }
  if (data.birthDate !== undefined) { updates.push("birth_date = ?"); values.push(data.birthDate); }
  if (data.birthPlace !== undefined) { updates.push("birth_place = ?"); values.push(data.birthPlace); }
  if (data.deathDate !== undefined) { updates.push("death_date = ?"); values.push(data.deathDate); }
  if (data.deathPlace !== undefined) { updates.push("death_place = ?"); values.push(data.deathPlace); }
  if (data.biography !== undefined) { updates.push("biography = ?"); values.push(data.biography); }
  if (data.photoUrl !== undefined) { updates.push("photo_url = ?"); values.push(data.photoUrl); }
  if (data.positionX !== undefined) { updates.push("position_x = ?"); values.push(data.positionX); }
  if (data.positionY !== undefined) { updates.push("position_y = ?"); values.push(data.positionY); }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  values.push(personId);
  await db.run(`UPDATE people SET ${updates.join(", ")} WHERE id = ?`, ...values);
  res.json({ id: personId, ...data });
});

router.delete("/people/:id", authRequired, async (req, res) => {
  const db = getDb();
  // Delete all relationships involving this person
  await db.run("DELETE FROM relationships WHERE person1_id = ? OR person2_id = ?", req.params.id, req.params.id);
  // Delete the person
  await db.run("DELETE FROM people WHERE id = ?", req.params.id);
  res.json({ success: true });
});

// Photo upload endpoint - supports multiple images
router.post("/people/:id/photo", authRequired, upload.single("photo"), async (req, res) => {
  const db = getDb();
  const personId = req.params.id;

  if (!req.file) {
    res.status(400).json({ error: "No photo file provided" });
    return;
  }

  try {
    // Create uploads directories if they don't exist
    const uploadsDir = path.join(__dirname, "../uploads");
    const originalsDir = path.join(uploadsDir, "originals");
    const thumbnailsDir = path.join(uploadsDir, "thumbnails");

    [uploadsDir, originalsDir, thumbnailsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Generate unique filename
    const filename = `${personId}-${Date.now()}.jpg`;
    const originalPath = path.join(originalsDir, filename);
    const thumbnailPath = path.join(thumbnailsDir, filename);

    // Save original image
    await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toFile(originalPath);

    // Generate thumbnail (120x120 for node display, cropped)
    await sharp(req.file.buffer)
      .resize(120, 120, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);

    const photoUrl = `/uploads/thumbnails/${filename}`;
    const originalUrl = `/uploads/originals/${filename}`;
    
    // Check if person has any images
    const existingImages = await db.all("SELECT id FROM person_images WHERE person_id = ?", personId);
    const isPrimary = existingImages.length === 0 ? 1 : 0;

    // Add to person_images table
    const imageId = createId();
    await db.run(
      "INSERT INTO person_images (id, person_id, image_url, is_primary) VALUES (?, ?, ?, ?)",
      imageId, personId, originalUrl, isPrimary
    );

    // Update photo_url with thumbnail for backward compatibility (node display)
    if (isPrimary) {
      await db.run("UPDATE people SET photo_url = ? WHERE id = ?", photoUrl, personId);
    }

    res.json({ photo_url: photoUrl, original_url: originalUrl, image_id: imageId, is_primary: isPrimary === 1 });
  } catch (error) {
    console.error("Photo upload error:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// Get all images for a person
router.get("/people/:id/images", authRequired, async (req, res) => {
  const db = getDb();
  const personId = req.params.id;

  try {
    const images = await db.all(
      "SELECT id, image_url, is_primary, uploaded_at FROM person_images WHERE person_id = ? ORDER BY is_primary DESC, uploaded_at DESC",
      personId
    );
    res.json({ images });
  } catch (error) {
    console.error("Get images error:", error);
    res.status(500).json({ error: "Failed to get images" });
  }
});

// Set primary image
router.put("/people/:personId/images/:imageId/primary", authRequired, async (req, res) => {
  const db = getDb();
  const { personId, imageId } = req.params;

  try {
    // Unset all primary images for this person
    await db.run("UPDATE person_images SET is_primary = 0 WHERE person_id = ?", personId);
    
    // Set new primary
    await db.run("UPDATE person_images SET is_primary = 1 WHERE id = ? AND person_id = ?", imageId, personId);
    
    // Get the new primary image URL
    const image = await db.get("SELECT image_url FROM person_images WHERE id = ?", imageId);
    
    // Update person's photo_url for backward compatibility
    await db.run("UPDATE people SET photo_url = ? WHERE id = ?", image.image_url, personId);
    
    res.json({ success: true, photo_url: image.image_url });
  } catch (error) {
    console.error("Set primary image error:", error);
    res.status(500).json({ error: "Failed to set primary image" });
  }
});

// Delete a specific image
router.delete("/people/:personId/images/:imageId", authRequired, async (req, res) => {
  const db = getDb();
  const { personId, imageId } = req.params;

  try {
    const image = await db.get("SELECT image_url, is_primary FROM person_images WHERE id = ? AND person_id = ?", imageId, personId);
    
    if (!image) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const uploadsDir = path.join(__dirname, "../uploads");
    const filename = path.basename(image.image_url);
    const originalPath = path.join(uploadsDir, "originals", filename);
    const thumbnailPath = path.join(uploadsDir, "thumbnails", filename);
    
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
    if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);

    await db.run("DELETE FROM person_images WHERE id = ?", imageId);

    // If deleted image was primary, set another image as primary
    if (image.is_primary) {
      const nextImage = await db.get(
        "SELECT id, image_url FROM person_images WHERE person_id = ? ORDER BY uploaded_at DESC LIMIT 1",
        personId
      );
      
      if (nextImage) {
        await db.run("UPDATE person_images SET is_primary = 1 WHERE id = ?", nextImage.id);
        await db.run("UPDATE people SET photo_url = ? WHERE id = ?", nextImage.image_url, personId);
      } else {
        await db.run("UPDATE people SET photo_url = NULL WHERE id = ?", personId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Image delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// Delete photo endpoint (legacy - deletes all images)
router.delete("/people/:id/photo", authRequired, async (req, res) => {
  const db = getDb();
  const personId = req.params.id;

  try {
    const images = await db.all("SELECT image_url FROM person_images WHERE person_id = ?", personId);
    
    const uploadsDir = path.join(__dirname, "../uploads");
    
    for (const img of images) {
      const filename = path.basename(img.image_url);
      const originalPath = path.join(uploadsDir, "originals", filename);
      const thumbnailPath = path.join(uploadsDir, "thumbnails", filename);
      
      if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    }

    await db.run("DELETE FROM person_images WHERE person_id = ?", personId);
    await db.run("UPDATE people SET photo_url = NULL WHERE id = ?", personId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Photo delete error:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

router.get("/relationships", authRequired, async (req, res) => {
  const db = getDb();
  const treeId = String(req.query.treeId || "");
  if (!treeId) {
    res.status(400).json({ error: "treeId is required" });
    return;
  }

  const relationships = await db.all("SELECT * FROM relationships WHERE tree_id = ?", treeId);
  res.json({ relationships });
});

router.post("/relationships", authRequired, async (req, res) => {
  const db = getDb();
  const payload = z.object({
    treeId: z.string().min(1),
    person1Id: z.string().min(1),
    person2Id: z.string().min(1),
    type: z.string().min(1),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const relationshipId = createId();
  const data = payload.data;
  await db.run(
    "INSERT INTO relationships (id, tree_id, person1_id, person2_id, type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    relationshipId, data.treeId, data.person1Id, data.person2Id, data.type, data.startDate || null, data.endDate || null
  );

  res.json({ id: relationshipId, ...data });
});

router.delete("/relationships/:id", authRequired, async (req, res) => {
  const db = getDb();
  await db.run("DELETE FROM relationships WHERE id = ?", req.params.id);
  res.json({ success: true });
});

router.put("/relationships/:id", authRequired, async (req, res) => {
  const db = getDb();
  const payload = z.object({
    type: z.string().min(1)
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  await db.run("UPDATE relationships SET type = ? WHERE id = ?", payload.data.type, req.params.id);
  res.json({ success: true });
});

router.get("/events", authRequired, async (req, res) => {
  const db = getDb();
  const personId = String(req.query.personId || "");
  if (!personId) {
    res.status(400).json({ error: "personId is required" });
    return;
  }

  const events = await db.all("SELECT * FROM life_events WHERE person_id = ? ORDER BY event_date", personId);
  res.json({ events });
});

router.post("/events", authRequired, async (req, res) => {
  const db = getDb();
  const payload = z.object({
    personId: z.string().min(1),
    type: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    eventDate: z.string().optional(),
    location: z.string().optional()
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const eventId = createId();
  const data = payload.data;
  await db.run(
    "INSERT INTO life_events (id, person_id, type, title, description, event_date, location) VALUES (?, ?, ?, ?, ?, ?, ?)",
    eventId, data.personId, data.type, data.title, data.description || null, data.eventDate || null, data.location || null
  );

  res.json({ id: eventId, ...data });
});

router.get("/stories", authRequired, async (req, res) => {
  const db = getDb();
  const personId = String(req.query.personId || "");
  const treeId = String(req.query.treeId || "");

  let stories;
  if (personId) {
    stories = await db.all("SELECT * FROM stories WHERE person_id = ? ORDER BY created_at DESC", personId);
  } else if (treeId) {
    stories = await db.all("SELECT * FROM stories WHERE tree_id = ? ORDER BY created_at DESC", treeId);
  } else {
    res.status(400).json({ error: "personId or treeId is required" });
    return;
  }

  res.json({ stories });
});

router.post("/stories", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string };

  const payload = z.object({
    personId: z.string().min(1),
    treeId: z.string().min(1),
    title: z.string().min(1),
    content: z.string().min(1)
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const storyId = createId();
  const data = payload.data;
  await db.run(
    "INSERT INTO stories (id, person_id, tree_id, title, content, author_id) VALUES (?, ?, ?, ?, ?, ?)",
    storyId, data.personId, data.treeId, data.title, data.content, user.id
  );

  res.json({ id: storyId, ...data });
});

router.post("/invitations", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string };

  const payload = z.object({
    forestId: z.string().optional(),
    treeId: z.string().optional(),
    inviteeEmail: z.string().email(),
    role: z.string().min(1)
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const invitationId = createId();
  const token = createId();
  const data = payload.data;
  await db.run(
    "INSERT INTO invitations (id, forest_id, tree_id, inviter_id, invitee_email, role, token) VALUES (?, ?, ?, ?, ?, ?, ?)",
    invitationId, data.forestId || null, data.treeId || null, user.id, data.inviteeEmail, data.role, token
  );

  res.json({ id: invitationId, token });
});

router.post("/invitations/:token/accept", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string };
  const token = req.params.token;

  const invitation = await db.get("SELECT * FROM invitations WHERE token = ? AND status = 'pending'", token) as any;
  if (!invitation) {
    res.status(404).json({ error: "Invalid or expired invitation" });
    return;
  }

  if (invitation.forest_id) {
    await db.run(
      "INSERT INTO forest_members (id, forest_id, user_id, role) VALUES (?, ?, ?, ?)",
      createId(), invitation.forest_id, user.id, invitation.role
    );
  }

  if (invitation.tree_id) {
    await db.run(
      "INSERT INTO tree_members (id, tree_id, user_id, role) VALUES (?, ?, ?, ?)",
      createId(), invitation.tree_id, user.id, invitation.role
    );
  }

  await db.run("UPDATE invitations SET status = 'accepted' WHERE id = ?", invitation.id);
  res.json({ success: true });
});

router.post("/ai/tasks", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  if (!user.tenantId) {
    res.status(400).json({ error: "Missing tenant context" });
    return;
  }

  const payload = z.object({
    provider: z.string().min(2),
    taskType: z.string().min(1),
    task: z.string().min(4),
    treeId: z.string().optional(),
    personId: z.string().optional()
  }).safeParse(req.body);
  
  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const taskId = createId();
  const data = payload.data;
  await db.run(
    "INSERT INTO ai_tasks (id, tenant_id, tree_id, person_id, status, provider, task_type, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    taskId, user.tenantId, data.treeId || null, data.personId || null, "queued", data.provider, data.taskType, data.task
  );

  res.json({ id: taskId, status: "queued" });
});

// Export tree to YAML
router.get("/trees/:id/export", authRequired, async (req, res) => {
  const db = getDb();
  const treeId = req.params.id;
  const user = (req as any).user as { id: string };
  const includeImages = req.query.includeImages === 'true';

  // Check access
  const tree = await db.get("SELECT * FROM trees WHERE id = ?", treeId) as any;
  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  // Get all people in tree
  const people = await db.all("SELECT * FROM people WHERE tree_id = ?", treeId);
  
  // Get all relationships
  const relationships = await db.all(
    "SELECT r.* FROM relationships r JOIN people p ON r.person1_id = p.id WHERE p.tree_id = ?",
    treeId
  );

  // If includeImages, add base64 encoded images
  const images: Record<string, { original: string; thumbnail: string }> = {};
  if (includeImages) {
    const uploadsDir = path.join(__dirname, "../uploads");
    for (const person of people as any[]) {
      if (person.photo_url) {
        const filename = path.basename(person.photo_url);
        const originalPath = path.join(uploadsDir, "originals", filename);
        const thumbnailPath = path.join(uploadsDir, "thumbnails", filename);
        
        if (fs.existsSync(originalPath) && fs.existsSync(thumbnailPath)) {
          const originalBuffer = fs.readFileSync(originalPath);
          const thumbnailBuffer = fs.readFileSync(thumbnailPath);
          images[filename] = {
            original: originalBuffer.toString('base64'),
            thumbnail: thumbnailBuffer.toString('base64')
          };
        }
      }
    }
  }

  const exportData: any = {
    tree: {
      id: tree.id,
      name: tree.name,
      created_at: tree.created_at
    },
    people: people,
    relationships: relationships
  };

  if (includeImages && Object.keys(images).length > 0) {
    exportData.images = images;
  }

  res.json(exportData);
});

// Export forest to YAML
router.get("/forests/:id/export", authRequired, async (req, res) => {
  const db = getDb();
  const forestId = req.params.id;
  const user = (req as any).user as { id: string };
  const includeImages = req.query.includeImages === 'true';

  // Check access
  const forest = await db.get("SELECT * FROM forests WHERE id = ?", forestId) as any;
  if (!forest) {
    res.status(404).json({ error: "Forest not found" });
    return;
  }

  // Get all trees in forest
  const trees = await db.all("SELECT * FROM trees WHERE forest_id = ?", forestId);
  
  const images: Record<string, { original: string; thumbnail: string }> = {};
  const uploadsDir = path.join(__dirname, "../uploads");
  
  const treesData = [];
  for (const tree of trees) {
    const people = await db.all("SELECT * FROM people WHERE tree_id = ?", tree.id);
    const relationships = await db.all(
      "SELECT r.* FROM relationships r JOIN people p ON r.person1_id = p.id WHERE p.tree_id = ?",
      tree.id
    );
    
    // Collect images if needed
    if (includeImages) {
      for (const person of people as any[]) {
        if (person.photo_url) {
          const filename = path.basename(person.photo_url);
          if (!images[filename]) {
            const originalPath = path.join(uploadsDir, "originals", filename);
            const thumbnailPath = path.join(uploadsDir, "thumbnails", filename);
            
            if (fs.existsSync(originalPath) && fs.existsSync(thumbnailPath)) {
              const originalBuffer = fs.readFileSync(originalPath);
              const thumbnailBuffer = fs.readFileSync(thumbnailPath);
              images[filename] = {
                original: originalBuffer.toString('base64'),
                thumbnail: thumbnailBuffer.toString('base64')
              };
            }
          }
        }
      }
    }
    
    treesData.push({
      tree: {
        id: tree.id,
        name: tree.name,
        created_at: tree.created_at
      },
      people: people,
      relationships: relationships
    });
  }

  const exportData: any = {
    forest: {
      id: forest.id,
      name: forest.name,
      created_at: forest.created_at
    },
    trees: treesData
  };

  if (includeImages && Object.keys(images).length > 0) {
    exportData.images = images;
  }

  res.json(exportData);
});

// Import tree from YAML
router.post("/trees/import", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string; tenantId: string | null };

  const payload = z.object({
    forestId: z.string(),
    treeData: z.object({
      tree: z.object({
        name: z.string()
      }).passthrough(),
      people: z.array(z.any()),
      relationships: z.array(z.any()),
      images: z.record(z.object({
        original: z.string(),
        thumbnail: z.string()
      })).optional()
    })
  }).safeParse(req.body);

  if (!payload.success) {
    console.error('Validation error:', JSON.stringify(payload.error, null, 2));
    res.status(400).json({ error: "Invalid payload", details: payload.error.issues });
    return;
  }

  const { forestId, treeData } = payload.data;

  // Process images if present
  const uploadsDir = path.join(__dirname, "../uploads");
  const originalsDir = path.join(uploadsDir, "originals");
  const thumbnailsDir = path.join(uploadsDir, "thumbnails");
  
  if (treeData.images) {
    for (const [filename, imageData] of Object.entries(treeData.images)) {
      const originalPath = path.join(originalsDir, filename);
      const thumbnailPath = path.join(thumbnailsDir, filename);
      
      // Only write if files don't already exist
      if (!fs.existsSync(originalPath)) {
        const originalBuffer = Buffer.from(imageData.original, 'base64');
        fs.writeFileSync(originalPath, originalBuffer);
      }
      
      if (!fs.existsSync(thumbnailPath)) {
        const thumbnailBuffer = Buffer.from(imageData.thumbnail, 'base64');
        fs.writeFileSync(thumbnailPath, thumbnailBuffer);
      }
    }
  }

  // Create new tree
  const newTreeId = createId();
  await db.run(
    "INSERT INTO trees (id, forest_id, name, created_by) VALUES (?, ?, ?, ?)",
    newTreeId,
    forestId,
    treeData.tree.name,
    user.id
  );

  // Map old IDs to new IDs
  const personIdMap = new Map<string, string>();

  // Import people
  for (const person of treeData.people) {
    const newPersonId = createId();
    personIdMap.set(person.id, newPersonId);
    
    await db.run(
      "INSERT INTO people (id, tree_id, first_name, middle_name, last_name, gender, birth_date, death_date, photo_url, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      newPersonId,
      newTreeId,
      person.first_name,
      person.middle_name,
      person.last_name,
      person.gender,
      person.birth_date,
      person.death_date,
      person.photo_url,
      person.position_x,
      person.position_y
    );
  }

  // Import relationships with mapped IDs
  for (const rel of treeData.relationships) {
    const newRelId = createId();
    const newPerson1Id = personIdMap.get(rel.person1_id);
    const newPerson2Id = personIdMap.get(rel.person2_id);
    
    if (newPerson1Id && newPerson2Id) {
      await db.run(
        "INSERT INTO relationships (id, tree_id, person1_id, person2_id, type) VALUES (?, ?, ?, ?, ?)",
        newRelId,
        newTreeId,
        newPerson1Id,
        newPerson2Id,
        rel.type
      );
    }
  }

  res.json({ id: newTreeId, name: treeData.tree.name });
});

// Import forest from YAML
router.post("/forests/import", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { id: string; tenantId: string | null };

  const payload = z.object({
    forestData: z.object({
      forest: z.object({
        name: z.string()
      }),
      trees: z.array(z.any()),
      images: z.record(z.object({
        original: z.string(),
        thumbnail: z.string()
      })).optional()
    })
  }).safeParse(req.body);

  if (!payload.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { forestData } = payload.data;

  // Process images if present
  const uploadsDir = path.join(__dirname, "../uploads");
  const originalsDir = path.join(uploadsDir, "originals");
  const thumbnailsDir = path.join(uploadsDir, "thumbnails");
  
  if (forestData.images) {
    for (const [filename, imageData] of Object.entries(forestData.images)) {
      const originalPath = path.join(originalsDir, filename);
      const thumbnailPath = path.join(thumbnailsDir, filename);
      
      // Only write if files don't already exist
      if (!fs.existsSync(originalPath)) {
        const originalBuffer = Buffer.from(imageData.original, 'base64');
        fs.writeFileSync(originalPath, originalBuffer);
      }
      
      if (!fs.existsSync(thumbnailPath)) {
        const thumbnailBuffer = Buffer.from(imageData.thumbnail, 'base64');
        fs.writeFileSync(thumbnailPath, thumbnailBuffer);
      }
    }
  }

  // Create new forest
  const newForestId = createId();
  await db.run(
    "INSERT INTO forests (id, tenant_id, name, created_by) VALUES (?, ?, ?, ?)",
    newForestId,
    user.tenantId,
    forestData.forest.name,
    user.id
  );

  // Import each tree
  for (const treeData of forestData.trees) {
    const newTreeId = createId();
    await db.run(
      "INSERT INTO trees (id, forest_id, name, created_by) VALUES (?, ?, ?, ?)",
      newTreeId,
      newForestId,
      treeData.tree.name,
      user.id
    );

    const personIdMap = new Map<string, string>();

    // Import people
    for (const person of treeData.people) {
      const newPersonId = createId();
      personIdMap.set(person.id, newPersonId);
      
      await db.run(
        "INSERT INTO people (id, tree_id, first_name, middle_name, last_name, gender, birth_date, death_date, photo_url, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        newPersonId,
        newTreeId,
        person.first_name,
        person.middle_name,
        person.last_name,
        person.gender,
        person.birth_date,
        person.death_date,
        person.photo_url,
        person.position_x,
        person.position_y
      );
    }

    // Import relationships
    for (const rel of treeData.relationships) {
      const newRelId = createId();
      const newPerson1Id = personIdMap.get(rel.person1_id);
      const newPerson2Id = personIdMap.get(rel.person2_id);
      
      if (newPerson1Id && newPerson2Id) {
        await db.run(
          "INSERT INTO relationships (id, tree_id, person1_id, person2_id, type) VALUES (?, ?, ?, ?, ?)",
          newRelId,
          newTreeId,
          newPerson1Id,
          newPerson2Id,
          rel.type
        );
      }
    }
  }

  res.json({ id: newForestId, name: forestData.forest.name });
});

// Metrics endpoint
router.get("/metrics", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  
  if (!user.tenantId) {
    res.json({ metrics: [] });
    return;
  }

  // Get metrics over the last 30 days (simulated historical data for now)
  const forests = await db.all("SELECT * FROM forests WHERE tenant_id = ?", user.tenantId);
  const forestIds = forests.map(f => f.id);
  
  const metrics = [];
  const now = Date.now();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    let totalPeople = 0;
    let totalImages = 0;
    let totalTrees = 0;
    
    for (const forest of forests) {
      const trees = await db.all("SELECT * FROM trees WHERE forest_id = ?", forest.id);
      totalTrees += trees.length;
      
      for (const tree of trees) {
        const people = await db.all("SELECT * FROM people WHERE tree_id = ?", tree.id);
        totalPeople += people.length;
        totalImages += people.filter((p: any) => p.photo_url).length;
      }
    }
    
    metrics.push({
      date: dateStr,
      forests: forests.length,
      trees: totalTrees,
      people: totalPeople,
      images: totalImages
    });
  }
  
  res.json({ metrics });
});

// Statistics endpoint
router.get("/statistics", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  
  if (!user.tenantId) {
    res.json({ statistics: { forests: [], totals: {} } });
    return;
  }

  const forests = await db.all("SELECT * FROM forests WHERE tenant_id = ?", user.tenantId);
  const forestStats = [];
  
  let totalPeople = 0;
  let totalMales = 0;
  let totalFemales = 0;
  let totalImages = 0;
  let totalRelationships = 0;
  let totalDiskSpace = 0;
  
  for (const forest of forests) {
    const trees = await db.all("SELECT * FROM trees WHERE forest_id = ?", forest.id);
    const treeStats = [];
    
    for (const tree of trees) {
      const people = await db.all("SELECT * FROM people WHERE tree_id = ?", tree.id);
      const relationships = await db.all("SELECT * FROM relationships WHERE tree_id = ?", tree.id);
      
      const males = people.filter((p: any) => p.gender === 'Male').length;
      const females = people.filter((p: any) => p.gender === 'Female').length;
      const withImages = people.filter((p: any) => p.photo_url).length;
      
      // Calculate disk space (approximate)
      let diskSpace = 0;
      for (const person of people) {
        if (person.photo_url) {
          const originalPath = path.join(__dirname, "..", "uploads", "originals", path.basename(person.photo_url));
          const thumbnailPath = path.join(__dirname, "..", "uploads", "thumbnails", path.basename(person.photo_url));
          
          try {
            if (fs.existsSync(originalPath)) {
              diskSpace += fs.statSync(originalPath).size;
            }
            if (fs.existsSync(thumbnailPath)) {
              diskSpace += fs.statSync(thumbnailPath).size;
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
      
      treeStats.push({
        id: tree.id,
        name: tree.name,
        people: people.length,
        males,
        females,
        relationships: relationships.length,
        images: withImages,
        diskSpaceBytes: diskSpace,
        diskSpaceMB: (diskSpace / (1024 * 1024)).toFixed(2)
      });
      
      totalPeople += people.length;
      totalMales += males;
      totalFemales += females;
      totalImages += withImages;
      totalRelationships += relationships.length;
      totalDiskSpace += diskSpace;
    }
    
    // Find largest and smallest trees
    const sortedTrees = [...treeStats].sort((a, b) => b.people - a.people);
    const largestTree = sortedTrees[0];
    const smallestTree = sortedTrees[sortedTrees.length - 1];
    
    forestStats.push({
      id: forest.id,
      name: forest.name,
      trees: treeStats,
      summary: {
        totalTrees: trees.length,
        totalPeople: treeStats.reduce((sum, t) => sum + t.people, 0),
        totalMales: treeStats.reduce((sum, t) => sum + t.males, 0),
        totalFemales: treeStats.reduce((sum, t) => sum + t.females, 0),
        totalRelationships: treeStats.reduce((sum, t) => sum + t.relationships, 0),
        totalImages: treeStats.reduce((sum, t) => sum + t.images, 0),
        totalDiskSpaceBytes: treeStats.reduce((sum, t) => sum + t.diskSpaceBytes, 0),
        totalDiskSpaceMB: (treeStats.reduce((sum, t) => sum + t.diskSpaceBytes, 0) / (1024 * 1024)).toFixed(2),
        largestTree: largestTree ? { name: largestTree.name, people: largestTree.people } : null,
        smallestTree: smallestTree ? { name: smallestTree.name, people: smallestTree.people } : null
      }
    });
  }
  
  // Ensure table exists
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_activity (
      user_id TEXT PRIMARY KEY,
      last_seen TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Get active users count (active in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const activeUsersResult = await db.all(
    `SELECT COUNT(DISTINCT ua.user_id) as count 
     FROM user_activity ua
     JOIN users u ON ua.user_id = u.id
     WHERE ua.last_seen > ? AND u.tenant_id = ?`,
    fiveMinutesAgo,
    user.tenantId
  ) as any[];
  const activeUsers = activeUsersResult[0]?.count || 0;
  
  res.json({
    statistics: {
      forests: forestStats,
      totals: {
        forests: forests.length,
        trees: forestStats.reduce((sum, f) => sum + f.summary.totalTrees, 0),
        people: totalPeople,
        males: totalMales,
        females: totalFemales,
        relationships: totalRelationships,
        images: totalImages,
        diskSpaceBytes: totalDiskSpace,
        diskSpaceMB: (totalDiskSpace / (1024 * 1024)).toFixed(2),
        activeUsers: activeUsers
      }
    }
  });
});

// Get active users count
router.get("/active-users", authRequired, async (req, res) => {
  const db = getDb();
  const user = (req as any).user as { tenantId: string | null };
  
  try {
    if (!user.tenantId) {
      res.json({ activeUsers: 0 });
      return;
    }
    
    // Ensure table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_activity (
        user_id TEXT PRIMARY KEY,
        last_seen TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Active in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const activeUsersResult = await db.all(
      `SELECT COUNT(DISTINCT ua.user_id) as count 
       FROM user_activity ua
       JOIN users u ON ua.user_id = u.id
       WHERE ua.last_seen > ? AND u.tenant_id = ?`,
      fiveMinutesAgo,
      user.tenantId
    ) as any[];
    
    console.log('Active users query:', {
      fiveMinutesAgo,
      tenantId: user.tenantId,
      result: activeUsersResult[0]
    });
    
    res.json({ 
      activeUsers: activeUsersResult[0]?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Active users error:', error);
    res.json({ activeUsers: 0, error: String(error) });
  }
});

// Export tree as .famtree file (JSON with embedded images)
router.get("/trees/:treeId/export-famtree", authRequired, async (req, res) => {
  const db = getDb();
  const { treeId } = req.params;
  
  try {
    // Get tree info
    const tree = await db.get("SELECT * FROM trees WHERE id = ?", treeId) as any;
    if (!tree) {
      res.status(404).json({ error: "Tree not found" });
      return;
    }
    
    // Get all people in the tree
    const people = await db.all("SELECT * FROM people WHERE tree_id = ?", treeId) as any[];
    
    // Get all relationships in the tree
    const relationships = await db.all(`
      SELECT r.* FROM relationships r
      JOIN people p1 ON r.person1_id = p1.id
      WHERE p1.tree_id = ?
    `, treeId) as any[];
    
    // Get all images for all people in the tree
    const peopleIds = people.map(p => p.id);
    const images: any[] = [];
    
    for (const personId of peopleIds) {
      const personImages = await db.all(`
        SELECT * FROM person_images WHERE person_id = ?
      `, personId) as any[];
      
      for (const img of personImages) {
        const imagePath = path.join(__dirname, "..", img.image_url);
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const base64Image = imageBuffer.toString('base64');
          images.push({
            person_id: img.person_id,
            is_primary: img.is_primary,
            uploaded_at: img.uploaded_at,
            data: base64Image,
            filename: path.basename(img.image_url)
          });
        }
      }
    }
    
    const famtreeData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      tree: {
        name: tree.name,
        created_at: tree.created_at
      },
      people,
      relationships,
      images
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${tree.name || 'tree'}.famtree"`);
    res.json(famtreeData);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export tree" });
  }
});

// Import tree from .famtree file
router.post("/trees/:treeId/import-famtree", authRequired, famtreeUpload.single('file'), async (req, res) => {
  const db = getDb();
  const { treeId } = req.params;
  const { mode } = req.query; // 'overwrite' or 'append'
  
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    
    // Parse the .famtree file
    const famtreeData = JSON.parse(req.file.buffer.toString('utf-8'));
    
    if (famtreeData.version !== "1.0") {
      res.status(400).json({ error: "Unsupported .famtree version" });
      return;
    }
    
    // If overwrite mode, delete existing tree data
    if (mode === 'overwrite') {
      const people = await db.all("SELECT id FROM people WHERE tree_id = ?", treeId) as any[];
      for (const person of people) {
        await db.run("DELETE FROM relationships WHERE person1_id = ? OR person2_id = ?", person.id, person.id);
        await db.run("DELETE FROM person_images WHERE person_id = ?", person.id);
      }
      await db.run("DELETE FROM people WHERE tree_id = ?", treeId);
      
      // Update tree name
      if (famtreeData.tree?.name) {
        await db.run("UPDATE trees SET name = ? WHERE id = ?", famtreeData.tree.name, treeId);
      }
    }
    
    // Map old person IDs to new person IDs
    const personIdMap = new Map<string, string>();
    
    // Import people
    for (const person of famtreeData.people) {
      const newPersonId = createId();
      personIdMap.set(person.id, newPersonId);
      
      await db.run(`
        INSERT INTO people (id, tree_id, first_name, middle_name, last_name, gender, birth_date, death_date, position_x, position_y, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        newPersonId,
        treeId,
        person.first_name,
        person.middle_name,
        person.last_name,
        person.gender,
        person.birth_date,
        person.death_date,
        person.position_x,
        person.position_y,
        new Date().toISOString()
      );
    }
    
    // Import relationships
    for (const rel of famtreeData.relationships) {
      const newPerson1Id = personIdMap.get(rel.person1_id);
      const newPerson2Id = personIdMap.get(rel.person2_id);
      
      if (newPerson1Id && newPerson2Id) {
        await db.run(`
          INSERT INTO relationships (id, tree_id, person1_id, person2_id, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          createId(),
          treeId,
          newPerson1Id,
          newPerson2Id,
          rel.type,
          new Date().toISOString()
        );
      }
    }
    
    // Import images
    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    for (const img of famtreeData.images) {
      const newPersonId = personIdMap.get(img.person_id);
      if (!newPersonId) continue;
      
      // Decode base64 image
      const imageBuffer = Buffer.from(img.data, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = path.extname(img.filename);
      const filename = `${timestamp}-${random}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save original image
      fs.writeFileSync(filepath, imageBuffer);
      
      // Create thumbnail
      const thumbFilename = `thumb-${filename}`;
      const thumbPath = path.join(uploadsDir, thumbFilename);
      await sharp(imageBuffer)
        .resize(120, 120, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
      
      // Insert into person_images table
      await db.run(`
        INSERT INTO person_images (id, person_id, image_url, is_primary, uploaded_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        createId(),
        newPersonId,
        `uploads/${filename}`,
        img.is_primary,
        img.uploaded_at || new Date().toISOString()
      );
      
      // Update person's photo_url if this is the primary image
      if (img.is_primary) {
        await db.run(`
          UPDATE people SET photo_url = ? WHERE id = ?
        `, `uploads/${filename}`, newPersonId);
      }
    }
    
    res.json({
      success: true,
      mode: mode || 'append',
      imported: {
        people: famtreeData.people.length,
        relationships: famtreeData.relationships.length,
        images: famtreeData.images.length
      }
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import tree" });
  }
});

// Import as new tree
router.post("/forests/:forestId/import-famtree-new", authRequired, famtreeUpload.single('file'), async (req, res) => {
  const db = getDb();
  const { forestId } = req.params;
  
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    
    // Parse the .famtree file
    const famtreeData = JSON.parse(req.file.buffer.toString('utf-8'));
    
    if (famtreeData.version !== "1.0") {
      res.status(400).json({ error: "Unsupported .famtree version" });
      return;
    }
    
    // Create new tree
    const newTreeId = createId();
    await db.run(
      "INSERT INTO trees (id, forest_id, name, created_at) VALUES (?, ?, ?, ?)",
      newTreeId,
      forestId,
      famtreeData.tree?.name || "Imported Tree",
      new Date().toISOString()
    );
    
    // Map old person IDs to new person IDs
    const personIdMap = new Map<string, string>();
    
    // Import people
    for (const person of famtreeData.people) {
      const newPersonId = createId();
      personIdMap.set(person.id, newPersonId);
      
      await db.run(`
        INSERT INTO people (id, tree_id, first_name, middle_name, last_name, gender, birth_date, death_date, position_x, position_y, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        newPersonId,
        newTreeId,
        person.first_name,
        person.middle_name,
        person.last_name,
        person.gender,
        person.birth_date,
        person.death_date,
        person.position_x,
        person.position_y,
        new Date().toISOString()
      );
    }
    
    // Import relationships
    for (const rel of famtreeData.relationships) {
      const newPerson1Id = personIdMap.get(rel.person1_id);
      const newPerson2Id = personIdMap.get(rel.person2_id);
      
      if (newPerson1Id && newPerson2Id) {
        await db.run(`
          INSERT INTO relationships (id, tree_id, person1_id, person2_id, type, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          createId(),
          newTreeId,
          newPerson1Id,
          newPerson2Id,
          rel.type,
          new Date().toISOString()
        );
      }
    }
    
    // Import images
    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    for (const img of famtreeData.images) {
      const newPersonId = personIdMap.get(img.person_id);
      if (!newPersonId) continue;
      
      // Decode base64 image
      const imageBuffer = Buffer.from(img.data, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const ext = path.extname(img.filename);
      const filename = `${timestamp}-${random}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save original image
      fs.writeFileSync(filepath, imageBuffer);
      
      // Create thumbnail
      const thumbFilename = `thumb-${filename}`;
      const thumbPath = path.join(uploadsDir, thumbFilename);
      await sharp(imageBuffer)
        .resize(120, 120, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
      
      // Insert into person_images table
      await db.run(`
        INSERT INTO person_images (id, person_id, image_url, is_primary, uploaded_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        createId(),
        newPersonId,
        `uploads/${filename}`,
        img.is_primary,
        img.uploaded_at || new Date().toISOString()
      );
      
      // Update person's photo_url if this is the primary image
      if (img.is_primary) {
        await db.run(`
          UPDATE people SET photo_url = ? WHERE id = ?
        `, `uploads/${filename}`, newPersonId);
      }
    }
    
    res.json({
      success: true,
      treeId: newTreeId,
      treeName: famtreeData.tree?.name || "Imported Tree",
      imported: {
        people: famtreeData.people.length,
        relationships: famtreeData.relationships.length,
        images: famtreeData.images.length
      }
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import tree" });
  }
});

export default router;
