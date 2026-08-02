// GraphQL subscriptions for weave

import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

export const subscriptionResolvers = {
  documentUpdated: {
    subscribe: () => pubsub.asyncIterator(['DOCUMENT_UPDATED'])
  },
  documentCreated: {
    subscribe: () => pubsub.asyncIterator(['DOCUMENT_CREATED'])
  },
  documentDeleted: {
    subscribe: () => pubsub.asyncIterator(['DOCUMENT_DELETED'])
  },
  collaborationStarted: {
    subscribe: () => pubsub.asyncIterator(['COLLABORATION_STARTED'])
  },
  cursorMoved: {
    subscribe: () => pubsub.asyncIterator(['CURSOR_MOVED'])
  }
};

export const publishDocumentUpdate = (document: any) => {
  pubsub.publish('DOCUMENT_UPDATED', { documentUpdated: document });
};

export const publishDocumentCreate = (document: any) => {
  pubsub.publish('DOCUMENT_CREATED', { documentCreated: document });
};

export const publishDocumentDelete = (documentId: string) => {
  pubsub.publish('DOCUMENT_DELETED', { documentDeleted: documentId });
};

export const publishCollaborationStart = (collaboration: any) => {
  pubsub.publish('COLLABORATION_STARTED', { collaborationStarted: collaboration });
};

export const publishCursorMove = (cursorData: any) => {
  pubsub.publish('CURSOR_MOVED', { cursorMoved: cursorData });
};
