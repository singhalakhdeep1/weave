import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // TODO: Implement JWT verification
  // For now, allow all requests with a mock user
  req.user = {
    id: 'mock-user-id',
    email: 'user@example.com',
    name: 'Mock User',
  };
  next();
}
