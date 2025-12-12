// Validation helper functions
export const validateNumber = (value: number, fallback = 0): number => {
  return isNaN(value) || !isFinite(value) ? fallback : value
}

export const validatePositive = (value: number, fallback = 1): number => {
  const validated = validateNumber(value, fallback)
  return validated <= 0 ? fallback : validated
}

