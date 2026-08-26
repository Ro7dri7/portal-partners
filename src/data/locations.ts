export type PhoneCountry = {
  iso: string
  name: string
  flag: string
  dial: string
  nationalLength: number
  groups: number[]
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'PE', name: 'Perú', flag: '🇵🇪', dial: '51', nationalLength: 9, groups: [3, 3, 3] },
  { iso: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '54', nationalLength: 10, groups: [2, 4, 4] },
  { iso: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '591', nationalLength: 8, groups: [1, 3, 4] },
  { iso: 'CL', name: 'Chile', flag: '🇨🇱', dial: '56', nationalLength: 9, groups: [1, 4, 4] },
  { iso: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '57', nationalLength: 10, groups: [3, 3, 4] },
  { iso: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '506', nationalLength: 8, groups: [4, 4] },
  { iso: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '593', nationalLength: 9, groups: [2, 3, 4] },
  { iso: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '503', nationalLength: 8, groups: [4, 4] },
  { iso: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '502', nationalLength: 8, groups: [4, 4] },
  { iso: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '504', nationalLength: 8, groups: [4, 4] },
  { iso: 'MX', name: 'México', flag: '🇲🇽', dial: '52', nationalLength: 10, groups: [2, 4, 4] },
  { iso: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '505', nationalLength: 8, groups: [4, 4] },
  { iso: 'PA', name: 'Panamá', flag: '🇵🇦', dial: '507', nationalLength: 8, groups: [4, 4] },
  { iso: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '595', nationalLength: 9, groups: [3, 3, 3] },
  { iso: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '598', nationalLength: 8, groups: [4, 4] },
  { iso: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '58', nationalLength: 10, groups: [3, 3, 4] },
  { iso: 'ES', name: 'España', flag: '🇪🇸', dial: '34', nationalLength: 9, groups: [3, 3, 3] },
  { iso: 'US', name: 'Estados Unidos', flag: '🇺🇸', dial: '1', nationalLength: 10, groups: [3, 3, 4] },
]

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  Perú: ['Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Piura', 'Chiclayo', 'Iquitos', 'Huancayo'],
  Argentina: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucumán'],
  Bolivia: ['La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre'],
  Chile: ['Santiago', 'Valparaíso', 'Concepción', 'Antofagasta', 'La Serena'],
  Colombia: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'],
  'Costa Rica': ['San José', 'Alajuela', 'Cartago', 'Heredia'],
  Ecuador: ['Quito', 'Guayaquil', 'Cuenca', 'Manta'],
  'El Salvador': ['San Salvador', 'Santa Ana', 'San Miguel'],
  Guatemala: ['Ciudad de Guatemala', 'Quetzaltenango', 'Antigua Guatemala'],
  Honduras: ['Tegucigalpa', 'San Pedro Sula'],
  México: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Cancún'],
  Nicaragua: ['Managua', 'León', 'Granada'],
  Panamá: ['Ciudad de Panamá', 'Colón', 'David'],
  Paraguay: ['Asunción', 'Ciudad del Este', 'Encarnación'],
  Uruguay: ['Montevideo', 'Punta del Este', 'Salto'],
  Venezuela: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto'],
  España: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
  'Estados Unidos': ['Miami', 'Houston', 'Los Ángeles', 'Nueva York'],
}

export function flagFromIso(iso: string) {
  return iso
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

export type OriginCountry = {
  iso: string
  name: string
  flag: string
}

const ORIGIN_COUNTRY_ROWS: Array<[string, string]> = [
  ['PE', 'Perú'],
  ['CO', 'Colombia'],
  ['MX', 'México'],
  ['CR', 'Costa Rica'],
  ['AR', 'Argentina'],
  ['BO', 'Bolivia'],
  ['CL', 'Chile'],
  ['EC', 'Ecuador'],
  ['SV', 'El Salvador'],
  ['GT', 'Guatemala'],
  ['HN', 'Honduras'],
  ['NI', 'Nicaragua'],
  ['PA', 'Panamá'],
  ['PY', 'Paraguay'],
  ['UY', 'Uruguay'],
  ['VE', 'Venezuela'],
  ['BR', 'Brasil'],
  ['CU', 'Cuba'],
  ['DO', 'República Dominicana'],
  ['PR', 'Puerto Rico'],
  ['US', 'Estados Unidos'],
  ['CA', 'Canadá'],
  ['ES', 'España'],
  ['PT', 'Portugal'],
  ['FR', 'Francia'],
  ['IT', 'Italia'],
  ['DE', 'Alemania'],
  ['GB', 'Reino Unido'],
  ['IE', 'Irlanda'],
  ['NL', 'Países Bajos'],
  ['BE', 'Bélgica'],
  ['CH', 'Suiza'],
  ['AT', 'Austria'],
  ['SE', 'Suecia'],
  ['NO', 'Noruega'],
  ['DK', 'Dinamarca'],
  ['FI', 'Finlandia'],
  ['PL', 'Polonia'],
  ['CZ', 'Chequia'],
  ['RO', 'Rumania'],
  ['GR', 'Grecia'],
  ['TR', 'Turquía'],
  ['UA', 'Ucrania'],
  ['RU', 'Rusia'],
  ['CN', 'China'],
  ['JP', 'Japón'],
  ['KR', 'Corea del Sur'],
  ['IN', 'India'],
  ['AU', 'Australia'],
  ['NZ', 'Nueva Zelanda'],
  ['ZA', 'Sudáfrica'],
  ['EG', 'Egipto'],
  ['MA', 'Marruecos'],
  ['NG', 'Nigeria'],
  ['AE', 'Emiratos Árabes Unidos'],
  ['SA', 'Arabia Saudita'],
  ['IL', 'Israel'],
  ['PH', 'Filipinas'],
  ['ID', 'Indonesia'],
  ['TH', 'Tailandia'],
  ['VN', 'Vietnam'],
  ['SG', 'Singapur'],
  ['MY', 'Malasia'],
  ['HT', 'Haití'],
  ['JM', 'Jamaica'],
  ['TT', 'Trinidad y Tobago'],
  ['GY', 'Guyana'],
  ['SR', 'Surinam'],
  ['BZ', 'Belice'],
]

export const ORIGIN_COUNTRIES: OriginCountry[] = ORIGIN_COUNTRY_ROWS.map(([iso, name]) => ({
  iso,
  name,
  flag: flagFromIso(iso),
}))

export const COUNTRY_OPTIONS = ORIGIN_COUNTRIES.map((item) => item.name)

export const COUNTRY_SELECT_OPTIONS = ORIGIN_COUNTRIES.map((item) => ({
  value: item.name,
  label: item.name,
  prefix: item.flag,
}))

export const ORIGIN_COUNTRY_STORAGE_KEY = 'intercert_origin_country'

export function findOriginCountry(name: string | null | undefined) {
  const normalized = String(name || '').trim().toLowerCase()
  return ORIGIN_COUNTRIES.find((item) => item.name.toLowerCase() === normalized) || null
}

export function formatNational(digits: string, groups: number[], useFormat: boolean) {
  const clean = digits.replace(/\D/g, '')
  if (!useFormat) return clean
  let remaining = clean
  const parts: string[] = []
  groups.forEach((size, index) => {
    if (!remaining) return
    const chunk = remaining.slice(0, size)
    remaining = remaining.slice(size)
    if (index === 0 && size === 3) {
      parts.push(chunk.length === size ? `(${chunk})` : `(${chunk}`)
    } else {
      parts.push(chunk)
    }
  })
  if (remaining) parts.push(remaining)
  if (groups[0] === 3) return `${parts[0] || ''}${parts.slice(1).join('-')}`
  return parts.join('-')
}

export function composePhone(dial: string, national: string, useFormat: boolean, groups: number[]) {
  const formatted = formatNational(national, groups, useFormat)
  if (!formatted) return `+${dial}`
  return useFormat ? `+${dial}${formatted}` : `+${dial} ${formatted}`
}

export function parsePhone(value: string) {
  const digits = (value || '').replace(/\D/g, '')
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((country) => digits.startsWith(country.dial))
  const country = match || PHONE_COUNTRIES[0]
  const national = match ? digits.slice(country.dial.length) : digits
  return { country, national }
}

export function isValidNational(national: string, country: PhoneCountry) {
  return national.replace(/\D/g, '').length === country.nationalLength
}
