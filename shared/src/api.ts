/** REST 路径常量（前后端共用，避免手写字符串不一致） */

export const API_PREFIX = '/api'

export const ApiPaths = {
  health: '/health',

  books: '/books',
  book: (id: number) => `/books/${id}`,
  bookFile: (id: number) => `/books/${id}/file`,

  sessionsForBook: (bookId: number) => `/books/${bookId}/sessions`,
  session: (id: number) => `/sessions/${id}`,
  messages: (sessionId: number) => `/sessions/${sessionId}/messages`,

  chatStream: '/chat/stream',

  notesForBook: (bookId: number) => `/books/${bookId}/notes`,
  note: (id: number) => `/notes/${id}`,

  highlightsForBook: (bookId: number) => `/books/${bookId}/highlights`,
  highlight: (id: number) => `/highlights/${id}`,

  annotationsForBook: (bookId: number) => `/books/${bookId}/annotations`,
  annotation: (id: number) => `/annotations/${id}`,

  settings: '/settings',

  media: (sessionId: number, file: string) => `/media/${sessionId}/${file}`,
} as const
