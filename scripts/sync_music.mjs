// Synchronise C:\_Perso\UNIVERSE3D\sounds\ (dépôt en vrac des nouveaux
// morceaux) vers frontend/public/sounds/ (dossier réellement servi par le
// site) et met à jour frontend/src/musicPlaylist.json en conséquence.
// À relancer à chaque ajout de musique, avant un build/déploiement du site :
//   node scripts/sync_music.mjs
import { readdirSync, existsSync, renameSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = join(ROOT, "sounds");
const DEST_DIR = join(ROOT, "frontend", "public", "sounds");
const MANIFEST_PATH = join(ROOT, "frontend", "src", "musicPlaylist.json");
const AUTHOR = "cycyno";
const AUDIO_EXTENSIONS = [".mp3"];

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

if (!existsSync(SRC_DIR)) {
  console.log(`Pas de dossier ${SRC_DIR}, rien à faire.`);
  process.exit(0);
}

const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) : [];
const knownFiles = new Set(manifest.map((t) => t.file));

const sourceFiles = readdirSync(SRC_DIR).filter((f) => AUDIO_EXTENSIONS.includes(extname(f).toLowerCase()));

let moved = 0;
let cleaned = 0;
let added = 0;

for (const sourceName of sourceFiles) {
  const ext = extname(sourceName);
  const title = basename(sourceName, ext);
  const slug = `${slugify(title)}${ext.toLowerCase()}`;
  const srcPath = join(SRC_DIR, sourceName);
  const destPath = join(DEST_DIR, slug);

  if (existsSync(destPath)) {
    // Déjà migré lors d'un passage précédent : le fichier source en trop est supprimé.
    unlinkSync(srcPath);
    cleaned++;
  } else {
    renameSync(srcPath, destPath);
    moved++;
    console.log(`Déplacé : ${sourceName} -> public/sounds/${slug}`);
  }

  if (!knownFiles.has(slug)) {
    manifest.push({ file: slug, title, author: AUTHOR });
    knownFiles.add(slug);
    added++;
    console.log(`Ajouté au playlist : "${title}"`);
  }
}

if (added > 0) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

console.log(`Terminé : ${moved} déplacé(s), ${cleaned} doublon(s) nettoyé(s), ${added} entrée(s) ajoutée(s) au playlist.`);
