import { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: unknown
    ) {
        super(message)
    }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details)
export const unauthorized = (message = 'Not authorized') => new HttpError(401, message)
export const forbidden = (message = 'Forbidden') => new HttpError(403, message)
export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`)
export const conflict = (message: string) => new HttpError(409, message)

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/** Forwards rejected promises to the error middleware (Express 4 does not do this itself). */
export const handle =
    (fn: AsyncHandler): RequestHandler =>
    (req, res, next) => {
        fn(req, res, next).catch(next)
    }

/** Parses a numeric route param; throws a 400 instead of passing NaN to Prisma. */
export const intParam = (value: string | undefined, name = 'id'): number => {
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`)
    return n
}
