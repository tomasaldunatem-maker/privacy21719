import 'express';

export type Role = 'ADMIN' | 'DPO' | 'STAFF' | 'VIEWER';
export interface SessionUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
