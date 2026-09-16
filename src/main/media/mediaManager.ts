import fs from 'fs';
import path from 'path';
import { app, protocol, net } from 'electron';

function getExtensionFromBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return '.jpg';
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return '.png';
  }
  if (buf.length >= 6 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) {
    return '.gif';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return '.webp';
  }
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF') {
    return '.pdf';
  }
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return '.zip';
  }
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS') {
    return '.ogg';
  }
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') {
    return '.mp3';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    return '.mp4';
  }
  return '';
}

class MediaManager {
  private mediaDir: string = '';

  public init(): void {
    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.data');
    this.mediaDir = path.join(userDataPath, 'media');
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
  }

  public getMediaDir(): string {
    if (!this.mediaDir) {
      this.init();
    }
    return this.mediaDir;
  }

  /**
   * Saves a downloaded file buffer to the media folder preserving real name and extension
   */
  public async saveBuffer(buffer: ArrayBuffer | Buffer, originalFilename: string = 'file'): Promise<{
    filePath: string;
    fileName: string;
    fileSize: number;
  }> {
    const mediaDir = this.getMediaDir();
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    let cleanName = path.basename(originalFilename).replace(/[^\w\d.\-_\s()]/g, '_').trim();
    if (!cleanName || cleanName === 'file') {
      cleanName = 'photo';
    }

    let ext = path.extname(cleanName).toLowerCase();
    if (!ext) {
      ext = getExtensionFromBuffer(buf) || '.jpg';
      cleanName = `${cleanName}${ext}`;
    }

    const uniqueName = `${Date.now()}_${cleanName}`;
    const targetPath = path.join(mediaDir, uniqueName);

    await fs.promises.writeFile(targetPath, buf);

    return {
      filePath: targetPath,
      fileName: cleanName,
      fileSize: buf.length,
    };
  }

  /**
   * Copies an external file selected by the operator to the internal media directory preserving filename
   */
  public async copyLocalFile(sourcePath: string): Promise<{
    filePath: string;
    fileName: string;
    fileSize: number;
  }> {
    const mediaDir = this.getMediaDir();
    const originalName = path.basename(sourcePath);
    let cleanName = originalName.replace(/[^\w\d.\-_\s()]/g, '_').trim();
    if (!cleanName) cleanName = 'file';

    const uniqueName = `${Date.now()}_${cleanName}`;
    const targetPath = path.join(mediaDir, uniqueName);

    await fs.promises.copyFile(sourcePath, targetPath);
    const stat = await fs.promises.stat(targetPath);

    return {
      filePath: targetPath,
      fileName: originalName,
      fileSize: stat.size,
    };
  }

  /**
   * Registers the custom protocol 'media://' to serve local media files securely to the renderer
   */
  public registerCustomProtocol(): void {
    protocol.handle('media', async (request) => {
      try {
        const rawUrl = request.url;
        // Strip media:// protocol prefix
        let pathPart = rawUrl.replace(/^media:\/\/local\//, '').replace(/^media:\/\//, '');
        pathPart = decodeURIComponent(pathPart);

        // Normalize Windows drive letters: "c/Users/..." -> "C:/Users/..." or "/C:/Users/..." -> "C:/Users/..."
        if (process.platform === 'win32') {
          if (pathPart.startsWith('/')) {
            pathPart = pathPart.substring(1);
          }
          // Fix hostname like "c/Users" -> "C:/Users"
          if (/^[a-zA-Z]\//.test(pathPart)) {
            pathPart = pathPart[0].toUpperCase() + ':' + pathPart.substring(1);
          }
        }

        const normalizedPath = path.normalize(pathPart);

        if (!fs.existsSync(normalizedPath)) {
          console.warn('Media file not found:', normalizedPath);
          return new Response('File not found', { status: 404 });
        }

        const fileBuffer = await fs.promises.readFile(normalizedPath);
        const ext = path.extname(normalizedPath).toLowerCase();

        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.ogg': 'audio/ogg',
          '.mp3': 'audio/mpeg',
          '.pdf': 'application/pdf',
          '.zip': 'application/zip',
          '.txt': 'text/plain; charset=utf-8',
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'max-age=31536000',
          },
        });
      } catch (err) {
        console.error('Media protocol handler error:', err);
        return new Response('Internal error serving media', { status: 500 });
      }
    });
  }

  public async getStorageSize(): Promise<number> {
    const mediaDir = this.getMediaDir();
    if (!fs.existsSync(mediaDir)) return 0;

    let total = 0;
    const files = await fs.promises.readdir(mediaDir);
    for (const file of files) {
      const fullPath = path.join(mediaDir, file);
      try {
        const stat = await fs.promises.stat(fullPath);
        total += stat.size;
      } catch {}
    }
    return total;
  }

  public async clearStorage(): Promise<void> {
    const mediaDir = this.getMediaDir();
    if (!fs.existsSync(mediaDir)) return;

    const files = await fs.promises.readdir(mediaDir);
    for (const file of files) {
      const fullPath = path.join(mediaDir, file);
      try {
        await fs.promises.unlink(fullPath);
      } catch {}
    }
  }
}

export const mediaManager = new MediaManager();
