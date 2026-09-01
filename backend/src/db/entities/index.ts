import { Annotation } from './Annotation'
import { AppSetting } from './AppSetting'
import { Book } from './Book'
import { ChatMessage } from './ChatMessage'
import { ChatSession } from './ChatSession'
import { Highlight } from './Highlight'
import { Note } from './Note'

/** 供 DataSource 使用的实体数组（双方言共用） */
export const entities = [Book, ChatSession, ChatMessage, Note, Highlight, Annotation, AppSetting]

export { Annotation, AppSetting, Book, ChatMessage, ChatSession, Highlight, Note }
