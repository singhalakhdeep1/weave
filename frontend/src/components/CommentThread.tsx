import { useState, useEffect } from 'react';

interface Comment {
  id: string;
  text: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  resolved: boolean;
  replies?: Comment[];
}

interface CommentThreadProps {
  documentId: string;
  blockId?: string;
}

export default function CommentThread({ documentId, blockId }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [documentId, blockId]);

  const fetchComments = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/documents/${documentId}/comments`);
      // const data = await response.json();
      // setComments(data);
      
      // Mock data for now
      setComments([
        {
          id: '1',
          text: 'This section needs more detail',
          user: { id: '1', name: 'John Doe' },
          createdAt: '2024-01-15T10:00:00Z',
          resolved: false,
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      // TODO: Replace with actual API call
      // await fetch(`/documents/${documentId}/comments`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ text: newComment, blockId }),
      // });

      const comment: Comment = {
        id: Date.now().toString(),
        text: newComment,
        user: { id: 'current-user', name: 'You' },
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      setComments([...comments, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      // TODO: Replace with actual API call
      // await fetch(`/comments/${commentId}/resolve`, { method: 'PATCH' });
      setComments(comments.map(c => 
        c.id === commentId ? { ...c, resolved: true } : c
      ));
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  return (
    <div className="comment-thread w-80 border-l bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Comments</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-gray-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-gray-500">No comments yet</div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg ${comment.resolved ? 'bg-gray-100 opacity-60' : 'bg-white border'}`}
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs">
                  {comment.user.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{comment.user.name}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{comment.text}</p>
                  {!comment.resolved && (
                    <button
                      onClick={() => handleResolve(comment.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 mt-2"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={3}
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          className="mt-2 w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors disabled:bg-gray-300"
        >
          Add Comment
        </button>
      </div>
    </div>
  );
}
