/** Shared list pagination. Keeps large tables from dumping years of rows into the browser. */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type PageParams = {
  page: number;
  pageSize: number;
  skip: number;
};

export function parsePageParam(value: string | string[] | undefined, fallback = 1): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function parsePageSizeParam(
  value: string | string[] | undefined,
  fallback = DEFAULT_PAGE_SIZE,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export function toPageParams(input: {
  page?: string | string[];
  pageSize?: string | string[];
  defaultPageSize?: number;
}): PageParams {
  const page = parsePageParam(input.page);
  const pageSize = parsePageSizeParam(input.pageSize, input.defaultPageSize ?? DEFAULT_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function totalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function buildPageHref(
  basePath: string,
  page: number,
  current: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
