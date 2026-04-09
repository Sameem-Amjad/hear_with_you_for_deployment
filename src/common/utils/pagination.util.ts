import { PaginatedResponseDto } from '../dto/pagination.dto';

export function buildPaginatedResponse<TItem>(params: {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
}): PaginatedResponseDto<TItem> {
  const totalPages = Math.max(1, Math.ceil(params.total / params.limit));
  const page = Math.min(Math.max(1, params.page), totalPages);

  return {
    items: params.items,
    meta: {
      page,
      limit: params.limit,
      total: params.total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
