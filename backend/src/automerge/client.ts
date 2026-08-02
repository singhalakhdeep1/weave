// Automerge client for weave

import Automerge from 'automerge';

class AutomergeService {
  private documents: Map<string, any> = new Map();

  createDocument(initialState: any = {}) {
    const doc = Automerge.from(initialState);
    const docId = this.generateDocId();
    this.documents.set(docId, doc);
    return { docId, doc };
  }

  getDocument(docId: string) {
    return this.documents.get(docId);
  }

  updateDocument(docId: string, callback: (doc: any) => void) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    const newDoc = Automerge.change(doc, callback);
    this.documents.set(docId, newDoc);
    return newDoc;
  }

  mergeDocuments(docId1: string, docId2: string) {
    const doc1 = this.documents.get(docId1);
    const doc2 = this.documents.get(docId2);

    if (!doc1 || !doc2) {
      throw new Error('One or both documents not found');
    }

    const merged = Automerge.merge(doc1, doc2);
    this.documents.set(docId1, merged);
    return merged;
  }

  getChanges(docId: string) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    return Automerge.getChanges(Automerge.init(), doc);
  }

  applyChanges(docId: string, changes: any[]) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    const newDoc = Automerge.applyChanges(doc, changes);
    this.documents.set(docId, newDoc);
    return newDoc;
  }

  encodeDocument(docId: string) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    return Automerge.save(doc);
  }

  decodeDocument(data: Uint8Array) {
    const doc = Automerge.load(data);
    const docId = this.generateDocId();
    this.documents.set(docId, doc);
    return { docId, doc };
  }

  private generateDocId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createTextDocument() {
    return this.createDocument({
      text: new Automerge.Text()
    });
  }

  updateText(docId: string, updates: any) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    const newDoc = Automerge.change(doc, (d: any) => {
      if (updates.insert) {
        d.text.insertAt(updates.position, ...updates.insert);
      }
      if (updates.delete) {
        d.text.deleteAt(updates.position, updates.length);
      }
    });

    this.documents.set(docId, newDoc);
    return newDoc;
  }

  getText(docId: string) {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    return doc.text.toString();
  }
}

export default AutomergeService;
