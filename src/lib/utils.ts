/**
 * Get current date string in Asia/Kuala_Lumpur (YYYY-MM-DD)
 * This ensures business logic stays in UTC+8 regardless of server/client location.
 */
export function getKLDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency = 'RM'): string {
  const value = typeof amount === 'number' ? amount : 0
  return `${currency} ${value.toFixed(2)}`
}

/**
 * Format date/time in a readable format
 */
export function formatTime(date: Date | number): string {
  if (!date) return ''

  const d = typeof date === 'number' ? new Date(date) : date
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  return d.toLocaleDateString()
}

/**
 * Validate plate number format
 */
export function validatePlateNumber(plate: string): boolean {
  // Malaysian plate format: ABC1234 or ABC 1234
  return /^[A-Z]{1,3}\s?[0-9]{1,4}$/.test(plate.toUpperCase())
}

/**
 * Format plate number
 */
export function formatPlateNumber(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, '')
}

/**
 * Get car level based on number of cars
 */
export function getCarLevel(totalCars: number): string {
  if (totalCars <= 19) return 'JUNIOR'
  if (totalCars <= 29) return 'MID'
  return 'SENIOR'
}

/**
 * Fuzzy search filter
 */
export function fuzzySearch(items: any[], query: string, keys: string[]): any[] {
  if (!query) return items

  const searchLower = query.toLowerCase()

  return items.filter((item) =>
    keys.some((key) => {
      const value = String(item[key] || '').toLowerCase()
      return value.includes(searchLower)
    })
  )
}
