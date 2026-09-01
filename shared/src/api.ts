/** REST 路径常量（前后端共用，避免手写字符串不一致） */

export const API_PREFIX = '/api'

export const ApiPaths = {
  health: '/health',

  books: '/books',
  book: (id: number | string) => `/books/${id}`,
  bookFile: (id: number | string) => `/books/${id}/file`,

  sessionsForBook: (bookId: number | string) => `/books/${bookId}/sessions`,
  session: (id: number | string) => `/sessions/${id}`,
  messages: (sessionId: number | string) => `/sessions/${sessionId}/messages`,

  chatStream: '/chat/stream',

  notesForBook: (bookId: number | string) => `/books/${bookId}/notes`,
  note: (id: number | string) => `/notes/${id}`,

  highlightsForBook: (bookId: number | string) => `/books/${bookId}/highlights`,
  highlight: (id: number | string) => `/highlights/${id}`,

  annotationsForBook: (bookId: number | string) => `/books/${bookId}/annotations`,
  annotation: (id: number | string) => `/annotations/${id}`,

  settings: '/settings',

  media: (sessionId: number, file: string) => `/media/${sessionId}/${file}`,
} as const
