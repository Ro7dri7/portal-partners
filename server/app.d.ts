import type { IncomingMessage, ServerResponse } from 'node:http'

type NextFunction = (err?: unknown) => void
type ConnectHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void

export function createApi(): ConnectHandler
