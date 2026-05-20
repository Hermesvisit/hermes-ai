import fs from "fs/promises";
import path from "path";

function getProjectRoot(): string {
  return process.cwd();
}
const MAX_READ_CHARS = 50_000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_LIST_DEPTH = 6;
const MAX_LIST_FILES = 500;

const BLOCKED_DIR_NAMES = new Set(["node_modules", ".next", ".git"]);
const BLOCKED_FILE_NAMES = new Set([
  "package-lock.json",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".bin",
  ".exe",
  ".dll",
  ".mp3",
  ".mp4",
  ".wav",
  ".webm",
]);

export type ProjectReaderResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type ProjectFileContent = {
  relativePath: string;
  content: string;
  truncated: boolean;
};

function isPathInsideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
}

function getBlockedReason(relativePath: string): string | null {
  const normalized = normalizeRelativePath(relativePath);

  if (!normalized) {
    return "Dosya yolu boş.";
  }

  if (normalized.includes("..")) {
    return "Geçersiz yol: '..' kullanılamaz.";
  }

  const segments = normalized.split("/");
  const fileName = segments[segments.length - 1] ?? "";

  if (BLOCKED_DIR_NAMES.has(fileName)) {
    return `"${fileName}" dizinine erişim engelli.`;
  }

  for (const segment of segments) {
    if (BLOCKED_DIR_NAMES.has(segment)) {
      return `"${segment}" altına erişim engelli.`;
    }
  }

  if (BLOCKED_FILE_NAMES.has(fileName)) {
    return `"${fileName}" dosyasına erişim engelli.`;
  }

  if (fileName.startsWith(".env")) {
    return "Ortam dosyalarına erişim engelli.";
  }

  const extension = path.extname(fileName).toLowerCase();

  if (extension && BLOCKED_EXTENSIONS.has(extension)) {
    return `"${extension}" dosyaları okunamaz.`;
  }

  return null;
}

function resolveSafePath(
  filePath: string
): ProjectReaderResult<{ absolutePath: string; relativePath: string }> {
  const blocked = getBlockedReason(filePath);

  if (blocked) {
    return { success: false, message: blocked };
  }

  const relativePath = normalizeRelativePath(filePath);
  const projectRoot = getProjectRoot();
  const absolutePath = path.resolve(projectRoot, relativePath);

  if (!isPathInsideRoot(absolutePath, projectRoot)) {
    return { success: false, message: "Dosya yalnızca proje kökü içinde okunabilir." };
  }

  return {
    success: true,
    data: { absolutePath, relativePath },
  };
}

async function isDirectory(absolutePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function walkProject(
  currentDir: string,
  relativeDir: string,
  depth: number,
  files: string[]
): Promise<void> {
  if (depth > MAX_LIST_DEPTH || files.length >= MAX_LIST_FILES) {
    return;
  }

  let entries;

  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= MAX_LIST_FILES) {
      return;
    }

    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const blocked = getBlockedReason(relativePath);

    if (blocked) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkProject(
        path.join(currentDir, entry.name),
        relativePath,
        depth + 1,
        files
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath.replace(/\\/g, "/"));
    }
  }
}

export async function listProjectFiles(): Promise<
  ProjectReaderResult<string[]>
> {
  try {
    const files: string[] = [];
    await walkProject(getProjectRoot(), "", 0, files);

    return {
      success: true,
      data: files,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Proje dosyaları listelenemedi.",
    };
  }
}

export async function readProjectFile(
  filePath: string
): Promise<ProjectReaderResult<ProjectFileContent>> {
  const resolved = resolveSafePath(filePath);

  if (!resolved.success) {
    return resolved;
  }

  const { absolutePath, relativePath } = resolved.data;

  if (await isDirectory(absolutePath)) {
    return {
      success: false,
      message: "Bu yol bir dizin. Dosya yolu ver.",
    };
  }

  try {
    const stat = await fs.stat(absolutePath);

    if (!stat.isFile()) {
      return { success: false, message: "Yalnızca dosyalar okunabilir." };
    }

    if (stat.size > MAX_FILE_BYTES) {
      return {
        success: false,
        message: `Dosya çok büyük (${stat.size} bayt). Limit: ${MAX_FILE_BYTES} bayt.`,
      };
    }

    const raw = await fs.readFile(absolutePath, "utf8");
    const truncated = raw.length > MAX_READ_CHARS;
    const content = truncated ? raw.slice(0, MAX_READ_CHARS) : raw;

    return {
      success: true,
      data: {
        relativePath,
        content,
        truncated,
      },
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { success: false, message: `Dosya bulunamadı: ${relativePath}` };
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Dosya okunamadı.",
    };
  }
}

export async function summarizeProjectStructure(): Promise<
  ProjectReaderResult<string>
> {
  const listed = await listProjectFiles();

  if (!listed.success) {
    return listed;
  }

  const tree = new Map<string, string[]>();

  for (const filePath of listed.data) {
    const parts = filePath.split("/");
    const top = parts.length > 1 ? parts[0] : "(root)";
    const bucket = tree.get(top) ?? [];
    bucket.push(filePath);
    tree.set(top, bucket);
  }

  const lines: string[] = [
    `Hermes proje özeti (${listed.data.length} dosya):`,
    `Kök: ${getProjectRoot().replace(/\\/g, "/")}`,
    "",
  ];

  const tops = [...tree.keys()].sort((a, b) => a.localeCompare(b));

  for (const top of tops) {
    const files = tree.get(top) ?? [];
    lines.push(`${top}/ (${files.length})`);

    for (const file of files.slice(0, 12)) {
      lines.push(`  - ${file}`);
    }

    if (files.length > 12) {
      lines.push(`  - ... +${files.length - 12} dosya`);
    }

    lines.push("");
  }

  if (listed.data.length >= MAX_LIST_FILES) {
    lines.push(`Not: Liste ${MAX_LIST_FILES} dosya ile sınırlandı.`);
  }

  return {
    success: true,
    data: lines.join("\n").trim(),
  };
}

export function extractProjectFilePath(
  message: string,
  commandPattern: RegExp
): string {
  const match = message.match(commandPattern);
  return match?.[1]?.trim() ?? "";
}
