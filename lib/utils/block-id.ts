/**
 * Generate a unique block ID with prefix
 * Format: blk_[random alphanumeric]
 */
export function generateBlockId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'blk_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Check if an ID is a block ID
 */
export function isBlockId(id: string): boolean {
  return id.startsWith('blk_');
}