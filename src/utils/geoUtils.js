/**
 * CareConnect — Geo-fence Utilities
 * Pure functions, no dependencies, safe to import anywhere.
 */

const EARTH_RADIUS_METERS = 6_371_000

/**
 * Haversine formula — returns the great-circle distance in metres
 * between two WGS-84 coordinate pairs.
 *
 * @param {number} lat1  Elder's current latitude
 * @param {number} lon1  Elder's current longitude
 * @param {number} lat2  Safe zone centre latitude
 * @param {number} lon2  Safe zone centre longitude
 * @returns {number}     Distance in metres (integer)
 */
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2

  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * Returns whether the elder is outside the configured safe zone.
 *
 * @param {number} elderLat
 * @param {number} elderLng
 * @param {number} safeLat
 * @param {number} safeLng
 * @param {number} radiusInMeters
 * @returns {{ outside: boolean, distanceMeters: number }}
 */
export function checkSafeZone(elderLat, elderLng, safeLat, safeLng, radiusInMeters) {
  const distanceMeters = getDistanceInMeters(elderLat, elderLng, safeLat, safeLng)
  return { outside: distanceMeters > radiusInMeters, distanceMeters }
}

/**
 * Formats a metre distance into a human-readable string.
 * < 1000 m  →  "340 m"
 * ≥ 1000 m  →  "1.3 km"
 *
 * @param {number} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters == null) return '—'
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(1)} km`
}
