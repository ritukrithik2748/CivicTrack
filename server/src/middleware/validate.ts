import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', fields } });
        return;
      }
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } });
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', fields } });
        return;
      }
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } });
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid route parameters', fields } });
        return;
      }
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid route parameters' } });
    }
  };
}