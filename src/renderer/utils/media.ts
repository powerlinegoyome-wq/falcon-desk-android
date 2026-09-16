export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return `media://${path.replace(/\\/g, '/')}`;
}
