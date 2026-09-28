/**
 * HTTP 工具：统一响应格式 { code, message, data } 与分页参数解析
 * code=0 成功；其余 code 与 HTTP status 保持一致（业务校验失败为 400，未登录 401，无权限 403，冲突 409 等）
 */

/** 成功响应 */
export function ok(data: unknown = null, message: string = 'ok'): Response {
  return Response.json({ code: 0, message, data });
}

/** 失败响应（status 为 HTTP 状态码，默认 400） */
export function fail(code: number, message: string, status: number = 400, data: unknown = null): Response {
  return Response.json({ code, message, data }, { status });
}

export interface PageParams {
  page: number;
  pageSize: number;
}

/**
 * 解析 ?page=&pageSize= 查询参数
 * page 从 1 开始；pageSize 缺省 defaultSize，上限 100
 */
export function parsePage(
  query: Record<string, string | undefined>,
  defaultSize: number,
): PageParams {
  let page = Number.parseInt(query.page ?? '', 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let pageSize = Number.parseInt(query.pageSize ?? '', 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultSize;
  if (pageSize > 100) pageSize = 100;
  return { page, pageSize };
}
