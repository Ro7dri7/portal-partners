export const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAln5Z85sKyt-u9R4e3cOmxET-ycezsXFgfizxnHiTlB3GlaOyeXRtrgOAIF2qFFwnbQTtyRyrGsK5lgU_KFUZkTri6txk2mu0rOhcd6gjR_TLI9sdLZ1sGxQK-I-4V4Nemo_v3KrDg8rNed4b0e0MFv8-LUrtLpbpO9jzZgBD1i1JLx69EJdaahjUyYGbjwzoRjOVB-J8ybDrY4QBzfgx72dv__mUNVTgE069-khD7jperUMH9juHcnA'

export const REGISTER_HERO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDWsdkq4Qh2b__ze3UWfvlTa2yg-hgvxPpshL-HShKpMbbmSBsS0I3_V3qmbBDcZlK_tsisIq0zwpiyVqNnXst7Gu_FTPLCq6ooVOVgdVqVF9BOnOJwnhZhrBLUGpxhGYA3sFjtlEmphPZgAUMdAS2YMmFn4FgEsk56oCn9koc9v1kHNES6ibJmPMGNrZ8rmfXeRS7JPT8WPdGZC59ZuWE-OZ09JrFGBuu2hD4cGpdJN84_Y4snW9LLyg'

export const LOGIN_HERO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDp72A54HDJN5My-wIsu7SrkG5bHvskfrvnts14-1DfFXB9tBgN3LpSbfmi1liJtaZ24ZsDt5UsMSheb71cCbYlAZu97srT1NHJFQvFX_-AoGmGKZ3ntMe5DawNl0N8czX03wHG1dMFSKaJnXdqU7l7com50kTJmDqcEZBhEeMIK5dfBs4CPJgYgyjIcGaOpoZOxhk9VDB8MUzsmjUXDrpbJDtoJYIreNspAgkCpFHCGoysdoxtD9eEug'

export const DASHBOARD_LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBBGSuqzuj3eP-a9VRb-LC4khgUlJSa35xLoVLpK88RhCkeG5kjGzRbN82LuT9xxGei1D0XHHGlurSdgMEjU8oGvHS8YwDcWHGR4P9oFPyev-EOcWfsX_rTStRadMg4ld0Kh1Y7TWVNmkoNL7cZgoDb8mB8Yv2LpX7IzM0sYoOYt02e1ZHEZ4KjOsvY7d9vYdfZfmL5RAic-eWI-8i60DsG6nBz4ACppOuP8LkIa3IMAPyk9RySjP9FKQ'

export const AVATAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCB__vc7BJy0BcIZeShBNKBy75GVQVsStCieLV93jpAkp3zlKw9eHTGeROjvR9PNlbSP4K-g1UzwqUKrNx89LZdc2Nr_-rKdCgJ9tDjg7e1YmeWClhQsNi0qtAcqqm4VNHaLsLtWbN0dXtiz62rSsg79wF7qMLTIBysB3urvZpGKUYMpwqceCJ7rs5EH6VFc3jpBP8LtBoPxWy4iTb6jcLPbFLR4R7TZ3xhusQJk1ETb4Be6xZka7o0aA'

const AUTH_KEY = 'intercert_partner_user'

export type PartnerUser = {
  firstName: string
  lastName: string
  email: string
}

export function saveUser(user: PartnerUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

export function getUser(): PartnerUser | null {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PartnerUser
  } catch {
    return null
  }
}

export function clearUser() {
  localStorage.removeItem(AUTH_KEY)
}
