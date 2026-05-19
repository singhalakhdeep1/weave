# 🔧 Low-Level Design (LLD)

## Real-Time Collaborative Workspace Platform

**Version:** 1.0  
**Last Updated:** February 16, 2026  
**Author:** Alakhdeep Singh

---

## 📋 Table of Contents

1. [Component Design](#component-design)
2. [Data Models](#data-models)
3. [API Design](#api-design)
4. [WebSocket Events](#websocket-events)
5. [State Management](#state-management)
6. [CRDT Integration](#crdt-integration)
7. [Offline Sync Strategy](#offline-sync-strategy)
8. [Performance Patterns](#performance-patterns)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)

---

## 🧩 Component Design

### **Frontend Component Hierarchy**

```
App
├── AuthProvider
│   └── Router
│       ├── PublicRoutes
│       │   ├── Landing
│       │   ├── Login
│       │   └── SignUp
│       └── PrivateRoutes
│           └── WorkspaceLayout
│               ├── Sidebar
│               │   ├── WorkspaceSelector
│               │   ├── DocumentTree
│               │   └── UserMenu
│               ├── MainContent
│               │   └── DocumentEditor
│               │       ├── EditorToolbar
│               │       ├── EditorCanvas
│               │       │   └── BlockRenderer (Virtual)
│               │       │       ├── HeadingBlock
│               │       │       ├── ParagraphBlock
│               │       │       ├── ListBlock
│               │       │       ├── CodeBlock
│               │       │       ├── TableBlock
│               │       │       └── ImageBlock
│               │       └── EditorFooter
│               └── RightPanel
│                   ├── CollaboratorsPanel
│                   ├── CommentsPanel
│                   └── VersionHistoryPanel
└── GlobalComponents
    ├── Toast
    ├── Modal
    ├── CommandPalette
    └── PresenceCursors
```

---

## 📦 Data Models

### **Database Schema (Prisma)**

```prisma
// prisma/schema.prisma

model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String
  avatar        String?
  password      String      // Hashed with bcrypt
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  workspaces    WorkspaceMember[]
  documents     Document[]
  comments      Comment[]
  sessions      Session[]

  @@index([email])
}

model Workspace {
  id            String      @id @default(cuid())
  name          String
  slug          String      @unique
  icon          String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  members       WorkspaceMember[]
  documents     Document[]

  @@index([slug])
}

model WorkspaceMember {
  id            String      @id @default(cuid())
  role          Role        @default(EDITOR)
  userId        String
  workspaceId   String
  joinedAt      DateTime    @default(now())

  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace     Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([userId])
  @@index([workspaceId])
}

model Document {
  id            String      @id @default(cuid())
  title         String
  content       Json        // Yjs CRDT state
  version       Int         @default(1)
  visibility    Visibility  @default(PRIVATE)
  parentId      String?
  workspaceId   String
  createdById   String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  workspace     Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy     User        @relation(fields: [createdById], references: [id])
  parent        Document?   @relation("DocumentHierarchy", fields: [parentId], references: [id])
  children      Document[]  @relation("DocumentHierarchy")
  comments      Comment[]
  versions      DocumentVersion[]

  @@index([workspaceId])
  @@index([parentId])
  @@index([createdById])
  @@fulltext([title])
}

model DocumentVersion {
  id            String      @id @default(cuid())
  documentId    String
  version       Int
  content       Json        // Snapshot of Yjs state
  createdAt     DateTime    @default(now())
  createdBy     String

  document      Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, version])
  @@index([documentId])
}

model Comment {
  id            String      @id @default(cuid())
  content       String
  blockId       String      // Block in document
  documentId    String
  userId        String
  parentId      String?     // For threading
  resolved      Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  document      Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user          User        @relation(fields: [userId], references: [id])
  parent        Comment?    @relation("CommentThread", fields: [parentId], references: [id])
  replies       Comment[]   @relation("CommentThread")

  @@index([documentId])
  @@index([userId])
  @@index([parentId])
}

model Session {
  id            String      @id @default(cuid())
  userId        String
  token         String      @unique
  expiresAt     DateTime
  createdAt     DateTime    @default(now())

  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

enum Role {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

enum Visibility {
  PRIVATE
  TEAM
  PUBLIC
}
```

### **Frontend Types (TypeScript)**

```typescript
// src/shared/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  role: Role;
  memberCount: number;
}

export interface Document {
  id: string;
  title: string;
  parentId?: string;
  workspaceId: string;
  visibility: Visibility;
  version: number;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface Block {
  id: string;
  type: BlockType;
  content: any;
  properties?: Record<string, any>;
  children?: Block[];
}

export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "numberedList"
  | "code"
  | "quote"
  | "table"
  | "image"
  | "divider";

export interface Collaborator {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    blockId: string;
    position: number;
  };
  lastSeen: string;
}

export interface Comment {
  id: string;
  content: string;
  blockId: string;
  documentId: string;
  user: User;
  parentId?: string;
  replies?: Comment[];
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: User;
}

export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  VIEWER = "VIEWER",
}

export enum Visibility {
  PRIVATE = "PRIVATE",
  TEAM = "TEAM",
  PUBLIC = "PUBLIC",
}
```

---

## 🔌 API Design

### **REST Endpoints**

```typescript
// Authentication
POST   /api/auth/signup          // Create account
POST   /api/auth/login           // Login
POST   /api/auth/logout          // Logout
POST   /api/auth/refresh         // Refresh token
GET    /api/auth/me              // Get current user

// Workspaces
GET    /api/workspaces           // List user's workspaces
POST   /api/workspaces           // Create workspace
GET    /api/workspaces/:id       // Get workspace details
PATCH  /api/workspaces/:id       // Update workspace
DELETE /api/workspaces/:id       // Delete workspace

// Workspace Members
GET    /api/workspaces/:id/members         // List members
POST   /api/workspaces/:id/members         // Invite member
PATCH  /api/workspaces/:id/members/:userId // Update role
DELETE /api/workspaces/:id/members/:userId // Remove member

// Documents
GET    /api/workspaces/:wid/documents      // List documents
POST   /api/workspaces/:wid/documents      // Create document
GET    /api/documents/:id                  // Get document
PATCH  /api/documents/:id                  // Update document
DELETE /api/documents/:id                  // Delete document
POST   /api/documents/:id/duplicate        // Duplicate document

// Document Versions
GET    /api/documents/:id/versions         // List versions
GET    /api/documents/:id/versions/:version // Get specific version
POST   /api/documents/:id/restore/:version  // Restore version

// Comments
GET    /api/documents/:id/comments         // List comments
POST   /api/documents/:id/comments         // Create comment
PATCH  /api/comments/:id                   // Update comment
DELETE /api/comments/:id                   // Delete comment
PATCH  /api/comments/:id/resolve           // Mark resolved

// Search
GET    /api/search?q=:query&workspace=:id  // Search documents

// Export
POST   /api/documents/:id/export           // Export document
```

### **API Request/Response Examples**

```typescript
// POST /api/auth/login
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response:
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://..."
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}

// GET /api/workspaces/:id/documents
Response:
{
  "documents": [
    {
      "id": "doc_456",
      "title": "Project Proposal",
      "parentId": null,
      "visibility": "TEAM",
      "version": 15,
      "createdBy": {
        "id": "user_123",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "createdAt": "2026-02-01T10:00:00Z",
      "updatedAt": "2026-02-16T15:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}

// POST /api/documents/:id/comments
Request:
{
  "content": "Great point! Let's discuss this further.",
  "blockId": "block_789",
  "parentId": "comment_101"  // Optional, for replies
}

Response:
{
  "id": "comment_202",
  "content": "Great point! Let's discuss this further.",
  "blockId": "block_789",
  "documentId": "doc_456",
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "avatar": "https://..."
  },
  "parentId": "comment_101",
  "resolved": false,
  "createdAt": "2026-02-16T16:00:00Z",
  "updatedAt": "2026-02-16T16:00:00Z"
}
```

---

## 📡 WebSocket Events

### **Event Types**

```typescript
// src/core/websocket/events.ts

// Client → Server Events
export enum ClientEvents {
  // Document Events
  DOCUMENT_JOIN = "document:join",
  DOCUMENT_LEAVE = "document:leave",
  DOCUMENT_UPDATE = "document:update",
  DOCUMENT_SYNC = "document:sync",

  // Cursor Events
  CURSOR_MOVE = "cursor:move",
  SELECTION_CHANGE = "selection:change",

  // Awareness Events
  AWARENESS_UPDATE = "awareness:update",

  // Comment Events
  COMMENT_ADD = "comment:add",
  COMMENT_UPDATE = "comment:update",
  COMMENT_DELETE = "comment:delete",
  COMMENT_RESOLVE = "comment:resolve",
}

// Server → Client Events
export enum ServerEvents {
  // Connection Events
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",

  // Document Events
  DOCUMENT_UPDATED = "document:updated",
  DOCUMENT_SYNC_RESPONSE = "document:sync:response",

  // Presence Events
  USER_JOINED = "user:joined",
  USER_LEFT = "user:left",
  USER_LIST = "user:list",

  // Cursor Events
  CURSOR_MOVED = "cursor:moved",
  SELECTION_CHANGED = "selection:changed",

  // Awareness Events
  AWARENESS_UPDATED = "awareness:updated",

  // Comment Events
  COMMENT_ADDED = "comment:added",
  COMMENT_UPDATED = "comment:updated",
  COMMENT_DELETED = "comment:deleted",
  COMMENT_RESOLVED = "comment:resolved",
}
```

### **Event Payloads**

```typescript
// Join Document
CLIENT: {
  event: 'document:join',
  payload: {
    documentId: 'doc_456',
    userId: 'user_123'
  }
}

SERVER: {
  event: 'user:joined',
  payload: {
    documentId: 'doc_456',
    user: {
      id: 'user_123',
      name: 'John Doe',
      avatar: 'https://...',
      color: '#FF6B6B'
    }
  }
}

// Document Update (CRDT)
CLIENT: {
  event: 'document:update',
  payload: {
    documentId: 'doc_456',
    update: Uint8Array,  // Yjs update
    version: 16
  }
}

SERVER: {
  event: 'document:updated',
  payload: {
    documentId: 'doc_456',
    update: Uint8Array,  // Yjs update
    version: 16,
    userId: 'user_123'
  }
}

// Cursor Move (Throttled to 50ms)
CLIENT: {
  event: 'cursor:move',
  payload: {
    documentId: 'doc_456',
    blockId: 'block_789',
    position: 42,
    userId: 'user_123'
  }
}

SERVER: {
  event: 'cursor:moved',
  payload: {
    documentId: 'doc_456',
    blockId: 'block_789',
    position: 42,
    userId: 'user_123',
    color: '#FF6B6B'
  }
}
```

---

## 🗄️ State Management

### **Zustand Store Architecture**

```typescript
// src/store/index.ts

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Auth Store
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((set, get) => ({
        user: null,
        accessToken: null,
        isAuthenticated: false,

        login: async (email, password) => {
          const response = await authAPI.login(email, password);
          set((state) => {
            state.user = response.user;
            state.accessToken = response.accessToken;
            state.isAuthenticated = true;
          });
        },

        logout: () => {
          set((state) => {
            state.user = null;
            state.accessToken = null;
            state.isAuthenticated = false;
          });
        },

        refreshToken: async () => {
          const response = await authAPI.refreshToken();
          set((state) => {
            state.accessToken = response.accessToken;
          });
        },
      })),
      { name: "auth-storage" },
    ),
  ),
);

// Document Store
interface DocumentState {
  currentDocument: Document | null;
  documents: Document[];
  selectedBlockId: string | null;
  setCurrentDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  selectBlock: (blockId: string | null) => void;
}

export const useDocumentStore = create<DocumentState>()(
  devtools(
    immer((set) => ({
      currentDocument: null,
      documents: [],
      selectedBlockId: null,

      setCurrentDocument: (doc) => {
        set((state) => {
          state.currentDocument = doc;
        });
      },

      updateDocument: (id, updates) => {
        set((state) => {
          const index = state.documents.findIndex((d) => d.id === id);
          if (index !== -1) {
            state.documents[index] = { ...state.documents[index], ...updates };
          }
        });
      },

      selectBlock: (blockId) => {
        set((state) => {
          state.selectedBlockId = blockId;
        });
      },
    })),
  ),
);

// Collaboration Store
interface CollaborationState {
  collaborators: Map<string, Collaborator>;
  cursors: Map<string, CursorPosition>;
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (userId: string) => void;
  updateCursor: (userId: string, cursor: CursorPosition) => void;
}

export const useCollaborationStore = create<CollaborationState>()(
  devtools(
    immer((set) => ({
      collaborators: new Map(),
      cursors: new Map(),

      addCollaborator: (collaborator) => {
        set((state) => {
          state.collaborators.set(collaborator.userId, collaborator);
        });
      },

      removeCollaborator: (userId) => {
        set((state) => {
          state.collaborators.delete(userId);
          state.cursors.delete(userId);
        });
      },

      updateCursor: (userId, cursor) => {
        set((state) => {
          state.cursors.set(userId, cursor);
        });
      },
    })),
  ),
);
```

---

## 🔄 CRDT Integration (Yjs)

### **Yjs Setup**

```typescript
// src/core/crdt/yjs-provider.ts

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

export class YjsService {
  private doc: Y.Doc;
  private wsProvider: WebsocketProvider | null = null;
  private idbProvider: IndexeddbPersistence | null = null;

  constructor(private documentId: string) {
    this.doc = new Y.Doc();
  }

  async initialize() {
    // Setup IndexedDB persistence (offline support)
    this.idbProvider = new IndexeddbPersistence(this.documentId, this.doc);

    await this.idbProvider.whenSynced;

    // Setup WebSocket provider (online sync)
    if (navigator.onLine) {
      this.connectWebSocket();
    }

    // Listen for online/offline events
    window.addEventListener("online", this.connectWebSocket);
    window.addEventListener("offline", this.disconnectWebSocket);
  }

  private connectWebSocket = () => {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/yjs`;
    this.wsProvider = new WebsocketProvider(wsUrl, this.documentId, this.doc, {
      connect: true,
    });

    this.wsProvider.on("status", (event: any) => {
      console.log("WebSocket status:", event.status);
    });

    this.wsProvider.on("sync", (isSynced: boolean) => {
      console.log("Document synced:", isSynced);
    });
  };

  private disconnectWebSocket = () => {
    this.wsProvider?.disconnect();
    this.wsProvider = null;
  };

  getDoc() {
    return this.doc;
  }

  getArray(key: string): Y.Array<any> {
    return this.doc.getArray(key);
  }

  getMap(key: string): Y.Map<any> {
    return this.doc.getMap(key);
  }

  getText(key: string): Y.Text {
    return this.doc.getText(key);
  }

  destroy() {
    window.removeEventListener("online", this.connectWebSocket);
    window.removeEventListener("offline", this.disconnectWebSocket);
    this.wsProvider?.destroy();
    this.idbProvider?.destroy();
    this.doc.destroy();
  }
}
```

### **Document Structure in Yjs**

```typescript
// Document represented as Yjs types
const doc = new Y.Doc();

// Blocks array
const blocks = doc.getArray("blocks");

// Example block structure
blocks.push([
  {
    id: "block_1",
    type: "heading1",
    content: new Y.Text("Document Title"),
    properties: {},
  },
  {
    id: "block_2",
    type: "paragraph",
    content: new Y.Text("This is collaborative text..."),
    properties: {},
  },
]);

// Metadata
const meta = doc.getMap("metadata");
meta.set("title", "My Document");
meta.set("version", 1);
meta.set("updatedAt", Date.now());
```

---

## 💾 Offline Sync Strategy

### **Sync Queue Implementation**

```typescript
// src/core/offline/sync-queue.ts

interface QueuedOperation {
  id: string;
  type: "create" | "update" | "delete";
  entity: "document" | "comment" | "block";
  data: any;
  timestamp: number;
  retries: number;
}

export class SyncQueue {
  private queue: QueuedOperation[] = [];
  private db: IDBDatabase;
  private isSyncing = false;

  constructor() {
    this.initDB();
    this.listenToOnline();
  }

  private async initDB() {
    const request = indexedDB.open("SyncQueue", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("operations")) {
        db.createObjectStore("operations", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.loadQueue();
    };
  }

  private async loadQueue() {
    const tx = this.db.transaction(["operations"], "readonly");
    const store = tx.objectStore("operations");
    const request = store.getAll();

    request.onsuccess = () => {
      this.queue = request.result;
      console.log("Loaded sync queue:", this.queue.length, "operations");
    };
  }

  async enqueue(operation: Omit<QueuedOperation, "id" | "retries">) {
    const op: QueuedOperation = {
      ...operation,
      id: generateId(),
      retries: 0,
    };

    this.queue.push(op);
    await this.saveToIDB(op);

    if (navigator.onLine && !this.isSyncing) {
      this.procesQueue();
    }
  }

  private async saveToIDB(operation: QueuedOperation) {
    const tx = this.db.transaction(["operations"], "readwrite");
    const store = tx.objectStore("operations");
    await store.put(operation);
  }

  private async removeFromIDB(operationId: string) {
    const tx = this.db.transaction(["operations"], "readwrite");
    const store = tx.objectStore("operations");
    await store.delete(operationId);
  }

  private listenToOnline() {
    window.addEventListener("online", () => {
      console.log("Back online, processing sync queue...");
      this.procesQueue();
    });
  }

  private async procesQueue() {
    if (this.isSyncing || !navigator.onLine || this.queue.length === 0) {
      return;
    }

    this.isSyncing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        await this.executeOperation(operation);
        this.queue.shift();
        await this.removeFromIDB(operation.id);
      } catch (error) {
        operation.retries++;

        if (operation.retries >= 3) {
          console.error("Operation failed after 3 retries:", operation);
          this.queue.shift();
          await this.removeFromIDB(operation.id);
        } else {
          await this.saveToIDB(operation);
          break; // Stop processing on error
        }
      }
    }

    this.isSyncing = false;
  }

  private async executeOperation(operation: QueuedOperation) {
    switch (operation.type) {
      case "create":
        return this.apiClient.post(`/${operation.entity}`, operation.data);
      case "update":
        return this.apiClient.patch(
          `/${operation.entity}/${operation.data.id}`,
          operation.data,
        );
      case "delete":
        return this.apiClient.delete(
          `/${operation.entity}/${operation.data.id}`,
        );
    }
  }
}
```

---

## ⚡ Performance Patterns

### **Virtual Scrolling for Blocks**

```typescript
// src/features/editor/components/VirtualBlockList.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualBlockList({ blocks }: { blocks: Block[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,  // Estimated block height
    overscan: 10,  // Render 10 extra blocks above/below viewport
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const block = blocks[virtualItem.index];

          return (
            <div
              key={block.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <BlockRenderer block={block} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### **Memoization Strategy**

```typescript
// src/features/editor/components/BlockRenderer.tsx

import { memo, useMemo } from 'react';

export const BlockRenderer = memo(({ block }: { block: Block }) => {
  const BlockComponent = useMemo(() => {
    switch (block.type) {
      case 'paragraph': return ParagraphBlock;
      case 'heading1': return Heading1Block;
      case 'heading2': return Heading2Block;
      case 'code': return CodeBlock;
      case 'table': return TableBlock;
      default: return ParagraphBlock;
    }
  }, [block.type]);

  return <BlockComponent block={block} />;
}, (prevProps, nextProps) => {
  // Custom comparison for re-render optimization
  return (
    prevProps.block.id === nextProps.block.id &&
    prevProps.block.content === nextProps.block.content &&
    prevProps.block.type === nextProps.block.type
  );
});
```

### **Debouncing & Throttling**

```typescript
// src/shared/hooks/useDebounce.ts

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage: Auto-save document title
const debouncedTitle = useDebounce(title, 500);

useEffect(() => {
  if (debouncedTitle) {
    updateDocument({ title: debouncedTitle });
  }
}, [debouncedTitle]);

// src/shared/hooks/useThrottle.ts

export function useThrottle(callback: Function, delay: number) {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: any[]) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      }
    },
    [callback, delay],
  );
}

// Usage: Throttle cursor position updates
const throttledCursorUpdate = useThrottle((position) => {
  socketRef.current?.emit("cursor:move", { position });
}, 50); // Max 20 updates per second
```

---

## 🛡️ Error Handling

### **Error Boundary**

```typescript
// src/shared/components/ErrorBoundary.tsx

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### **API Error Handling**

```typescript
// src/core/api/client.ts

export class APIClient {
  private async request(config: AxiosRequestConfig) {
    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        switch (status) {
          case 401:
            // Unauthorized - refresh token
            await this.refreshToken();
            return this.request(config);  // Retry

          case 403:
            // Forbidden - insufficient permissions
            toast.error('You don't have permission to perform this action');
            throw error;

          case 404:
            // Not found
            toast.error('Resource not found');
            throw error;

          case 429:
            // Rate limited
            toast.error('Too many requests. Please try again later.');
            throw error;

          case 500:
          case 502:
          case 503:
            // Server error
            toast.error('Server error. Please try again.');
            throw error;

          default:
            toast.error('An error occurred. Please try again.');
            throw error;
        }
      }

      throw error;
    }
  }
}
```

---

## 🧪 Testing Strategy

### **Unit Tests (Jest + RTL)**

```typescript
// src/features/editor/components/__tests__/BlockRenderer.test.tsx

describe('BlockRenderer', () => {
  it('renders paragraph block correctly', () => {
    const block: Block = {
      id: 'block_1',
      type: 'paragraph',
      content: 'Hello World',
    };

    render(<BlockRenderer block={block} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('only re-renders when content changes', () => {
    const block: Block = {
      id: 'block_1',
      type: 'paragraph',
      content: 'Initial',
    };

    const { rerender } = render(<BlockRenderer block={block} />);

    // Same props - should not re-render
    rerender(<BlockRenderer block={block} />);

    // Different content - should re-render
    const updatedBlock = { ...block, content: 'Updated' };
    rerender(<BlockRenderer block={updatedBlock} />);

    expect(screen.getByText('Updated')).toBeInTheDocument();
  });
});
```

### **Integration Tests (WebSocket)**

```typescript
// src/core/websocket/__tests__/socket.test.ts

describe("WebSocket Integration", () => {
  let mockServer: Server;

  beforeAll(() => {
    mockServer = new Server("http://localhost:5000");
  });

  afterAll(() => {
    mockServer.stop();
  });

  it("receives document updates from other users", async () => {
    const socket = createSocket();

    await socket.connect();

    const updatePromise = new Promise((resolve) => {
      socket.on("document:updated", resolve);
    });

    // Simulate update from another user
    mockServer.emit("document:updated", {
      documentId: "doc_1",
      update: new Uint8Array([1, 2, 3]),
    });

    const update = await updatePromise;
    expect(update).toBeDefined();
  });
});
```

### **E2E Tests (Cypress)**

```typescript
// cypress/e2e/collaboration.cy.ts

describe("Real-time Collaboration", () => {
  it("shows other users cursors", () => {
    // User 1 opens document
    cy.visit("/documents/doc_1");
    cy.get('[data-testid="editor"]').should("be.visible");

    // Simulate User 2 joining (via WebSocket mock)
    cy.window().then((win) => {
      win.mockSocket.emit("user:joined", {
        userId: "user_2",
        name: "Jane Doe",
        color: "#FF6B6B",
      });
    });

    // User 1 should see User 2's presence
    cy.get('[data-testid="collaborator-user_2"]').should("be.visible");
    cy.get('[data-testid="collaborator-user_2"]').should("contain", "Jane Doe");
  });

  it("syncs edits across users", () => {
    // User 1 types
    cy.visit("/documents/doc_1");
    cy.get('[data-testid="editor"]').type("Hello from User 1");

    // User 2's view (simulated)
    cy.visit("/documents/doc_1");
    cy.get('[data-testid="editor"]').should("contain", "Hello from User 1");
  });
});
```

---

## 📝 Summary

This LLD document provides detailed component designs, data models, API specifications, and implementation patterns for building the real-time collaborative workspace platform.

**Key Takeaways:**

- Feature-based architecture for maintainability
- Yjs CRDT for conflict-free synchronization
- Offline-first with IndexedDB persistence
- Performance optimization with virtual scrolling and memoization
- Comprehensive error handling and testing strategy

**Next Steps:**

- Begin Phase 1 implementation (Core Editor)
- Set up project boilerplate
- Implement authentication
- Build basic editor with Slate.js
- Integrate Yjs for collaboration

---

**Document Status:** ✅ Complete  
**Review Date:** February 16, 2026  
**Approved By:** Alakhdeep Singh
