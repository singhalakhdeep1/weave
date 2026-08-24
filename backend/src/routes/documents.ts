import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /documents - list user documents
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { createdById: userId },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /documents - create document
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { title, workspaceId } = req.body;
    
    const document = await prisma.document.create({
      data: {
        title: title || 'Untitled Document',
        workspaceId: workspaceId || 'default',
        createdById: userId,
        content: {},
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// GET /documents/:id - get document metadata
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        workspace: { select: { id: true, name: true } },
        versions: { orderBy: { createdAt: 'desc' }, take: 10 },
        comments: {
          where: { resolved: false },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const hasAccess = 
      document.createdById === userId ||
      document.workspace.members.some((m: any) => m.userId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// PATCH /documents/:id - update title
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { title } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: { title },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /documents/:id - delete
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.document.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /documents/:id/snapshots - list snapshots
router.get('/:id/snapshots', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const snapshots = await prisma.documentVersion.findMany({
      where: { documentId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// POST /documents/:id/snapshots - create snapshot
router.post('/:id/snapshots', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: req.params.id },
      orderBy: { version: 'desc' },
    });

    const snapshot = await prisma.documentVersion.create({
      data: {
        documentId: req.params.id,
        version: (latestVersion?.version || 0) + 1,
        content: document.content,
        createdBy: userId,
      },
    });
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// POST /documents/:id/snapshots/:snapshotId/restore - restore snapshot
router.post('/:id/snapshots/:snapshotId/restore', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const snapshot = await prisma.documentVersion.findUnique({
      where: { id: req.params.snapshotId },
    });

    if (!snapshot || snapshot.documentId !== req.params.id) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        content: snapshot.content,
        version: snapshot.version,
      },
    });
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore snapshot' });
  }
});

// POST /documents/:id/share - invite collaborator
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { email, role } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { workspace: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // TODO: Send invitation email
    res.json({ message: 'Invitation sent', email, role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share document' });
  }
});

// GET /documents/:id/comments - list comments
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { documentId: req.params.id },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        replies: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /documents/:id/comments - add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { text, blockId, parentId } = req.body;

    const comment = await prisma.comment.create({
      data: {
        documentId: req.params.id,
        userId,
        text,
        blockId,
        parentId,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PATCH /comments/:id/resolve - mark resolved
router.patch('/comments/:id/resolve', authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { resolved: true },
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

// GET /documents/search?q= - full-text search
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const documents = await prisma.document.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
