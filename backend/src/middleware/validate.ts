import { NextFunction, Request, Response } from 'express'
import { ZodTypeAny, z } from 'zod'
import { badRequest } from '../lib/errors'

type Source = 'body' | 'query' | 'params'

/** Validates and replaces req[source] with the parsed (coerced, trimmed) value. */
export const validate =
    <T extends ZodTypeAny>(schema: T, source: Source = 'body') =>
    (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source])
        if (!result.success) {
            const issues = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
            return next(badRequest(issues[0] ? `${issues[0].field ? issues[0].field + ': ' : ''}${issues[0].message}` : 'Invalid request', issues))
        }
        Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true })
        next()
    }

export type Infer<T extends ZodTypeAny> = z.infer<T>
