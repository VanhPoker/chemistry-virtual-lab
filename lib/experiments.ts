export type ExperimentRecord = {
  id: string
  name: string
  description: string | null
  moduleId: number
  content: string
  thumbnailUrl: string | null
  createTime: string
  updateTime: string
}

type ExperimentRow = {
  id: string
  name: string
  description: string | null
  module_id: number
  content?: string
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

type SaveExperimentInput = {
  name: string
  description?: string | null
  moduleId?: number
  content: string
  thumbnailUrl?: string | null
}

export class ExperimentApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const EXPERIMENT_PATH = '/api/lab-experiments'
const EXPERIMENT_SUBJECT = 'chemistry'
const REQUEST_TIMEOUT_MS = 20000

function getApiBase() {
  return (process.env.SMART_CLASS_API_URL || '').trim().replace(/\/+$/, '')
}

export function isExperimentApiReady() {
  return Boolean(getApiBase())
}

function normalizeExperiment(row: ExperimentRow): ExperimentRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    moduleId: row.module_id,
    content: row.content ?? '',
    thumbnailUrl: row.thumbnail_url,
    createTime: row.created_at,
    updateTime: row.updated_at,
  }
}

function toPayload(input: SaveExperimentInput) {
  return {
    subject: EXPERIMENT_SUBJECT,
    name: input.name,
    description: input.description?.trim() || null,
    module_id: input.moduleId ?? 9,
    content: input.content,
    thumbnail_url: input.thumbnailUrl?.trim() || null,
  }
}

async function requestApi<T>(path: string, init: RequestInit & { authorization?: string } = {}) {
  const { authorization, headers, ...rest } = init
  const res = await fetch(`${getApiBase()}${EXPERIMENT_PATH}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const text = await res.text()
  let json: { success?: boolean; data?: T; error?: string } = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = {}
    }
  }

  if (!res.ok) {
    throw new ExperimentApiError(json.error || `HTTP ${res.status}`, res.status)
  }

  return json.data as T
}

export async function listExperiments(params: { page?: unknown; pageSize?: unknown; keyword?: unknown }) {
  const query = new URLSearchParams({ subject: EXPERIMENT_SUBJECT })
  if (params.page != null) query.set('page', String(params.page))
  if (params.pageSize != null) query.set('pageSize', String(params.pageSize))
  if (typeof params.keyword === 'string' && params.keyword.trim()) {
    query.set('keyword', params.keyword.trim())
  }

  const data = await requestApi<{ list: ExperimentRow[]; total: number; page: number; pageSize: number }>(
    `?${query.toString()}`,
  )

  return {
    list: (data?.list || []).map(normalizeExperiment),
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.pageSize || 20,
  }
}

export async function getExperimentDetail(id: string) {
  try {
    const data = await requestApi<ExperimentRow>(`/${encodeURIComponent(id)}`)
    return data ? normalizeExperiment(data) : null
  } catch (error) {
    if (error instanceof ExperimentApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function createExperiment(input: SaveExperimentInput, authorization?: string) {
  const data = await requestApi<ExperimentRow>('', {
    method: 'POST',
    body: JSON.stringify(toPayload(input)),
    authorization,
  })

  return normalizeExperiment(data)
}

export async function updateExperiment(input: SaveExperimentInput & { id: string }, authorization?: string) {
  const data = await requestApi<ExperimentRow>(`/${encodeURIComponent(input.id)}`, {
    method: 'PUT',
    body: JSON.stringify(toPayload(input)),
    authorization,
  })

  return normalizeExperiment(data)
}

export async function deleteExperiment(id: string, authorization?: string) {
  await requestApi<undefined>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    authorization,
  })

  return true
}
