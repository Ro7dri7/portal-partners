import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  if (isDashboardRoute) {
    const authToken = context.cookies.get('auth_token')?.value

    if (!authToken) {
      return context.redirect('/login')
    }
  }

  return next()
})
