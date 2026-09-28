/**
 * 上传文件真实类型校验
 * - 读取文件头魔数（magic bytes），防止仅通过伪造 Content-Type 上传恶意文件
 * - 拒绝可执行脚本风险高的 SVG（image/svg+xml）上传；如需展示矢量图，请转换为 PNG 后上传
 * - 非图片类文件强制以 attachment 形式下载，降低 XSS 面
 */

const IMAGE_MAGIC: Record<string, (bytes: Uint8Array) => boolean> = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  gif: (b) =>
    (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) ||
    (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x39),
  webp: (b) => {
    // RIFF....WEBP
    if (b.length < 12) return false;
    const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
    const webp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    return riff && webp;
  },
  avif: (b) => {
    // ftyp...avif
    if (b.length < 12) return false;
    const ftyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
    const avif = b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66;
    return ftyp && avif;
  },
  bmp: (b) => b[0] === 0x42 && b[1] === 0x4d,
};

const IMAGE_EXTS = new Set(Object.keys(IMAGE_MAGIC));

/** 是否属于图片扩展名 */
export function isImageExt(ext: string): boolean {
  return IMAGE_EXTS.has(ext.toLowerCase());
}

/** 拒绝 SVG 上传：SVG 内可嵌入 <script>，存在存储型 XSS 风险 */
export function isDangerousSvg(file: File, ext: string): boolean {
  return ext.toLowerCase() === 'svg' || file.type === 'image/svg+xml';
}

/** 读取文件前 16 字节并校验魔数；返回是否通过 */
export async function verifyMagicBytes(file: File, expectedExt: string): Promise<boolean> {
  const ext = expectedExt.toLowerCase();
  const checker = IMAGE_MAGIC[ext];
  if (!checker) return true; // 非图片类型不强制魔数校验，由扩展名白名单控制
  try {
    const slice = file.slice(0, 16);
    const buf = await slice.arrayBuffer();
    const bytes = new Uint8Array(buf);
    return checker(bytes);
  } catch {
    return false;
  }
}

/** 根据扩展名决定 R2 /media 响应是否应强制 inline 还是 attachment */
export function shouldInline(ext: string): boolean {
  return isImageExt(ext) || ['pdf', 'txt', 'md', 'csv'].includes(ext.toLowerCase());
}
