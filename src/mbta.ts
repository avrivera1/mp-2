const API = 'https://api-v3.mbta.com'
const MAX_DISTANCE_METERS = 1_500
const DEPARTURE_COUNT = 3

export const LOCATION = {
  latitude: 42.34951581654144,
  longitude: -71.10407980245883,
}

interface Coordinates {
  latitude: number
  longitude: number
}

interface Resource<Attributes> {
  id: string
  type: string
  attributes: Attributes
  relationships?: Record<string, { data: { id: string } | null } | undefined>
}

interface ApiResponse<Attributes> {
  data: Resource<Attributes>[]
  included?: Resource<Record<string, unknown>>[]
}

interface StopAttributes {
  name: string
  latitude: number | null
  longitude: number | null
  platform_name: string | null
  vehicle_type: number | null
}

interface PredictionAttributes {
  arrival_time: string | null
  departure_time: string | null
}

export interface BusArrival {
  id: string
  routeName: string
  routeDescription: string
  time: string
}

export interface NearbyBusStop {
  id: string
  name: string
  platformName: string | null
  distanceMeters: number
  arrivals: BusArrival[]
}

async function getJson<Attributes>(
  url: URL,
  signal: AbortSignal,
): Promise<ApiResponse<Attributes>> {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json' },
    signal,
  })
  if (!response.ok) {
    throw new Error(`MBTA API request failed with status ${response.status}.`)
  }
  return response.json() as Promise<ApiResponse<Attributes>>
}

function distanceBetween(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const lat = radians(to.latitude - from.latitude)
  const lon = radians(to.longitude - from.longitude)
  const startLat = radians(from.latitude)
  const endLat = radians(to.latitude)
  const a =
    Math.sin(lat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lon / 2) ** 2

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getDepartures(
  stopId: string,
  signal: AbortSignal,
): Promise<BusArrival[]> {
  const url = new URL('/predictions', API)
  url.searchParams.set('filter[stop]', stopId)
  url.searchParams.set('sort', 'arrival_time')
  url.searchParams.set('include', 'route')
  url.searchParams.set('page[limit]', String(DEPARTURE_COUNT))

  const { data, included = [] } =
    await getJson<PredictionAttributes>(url, signal)

  return data.flatMap((prediction) => {
    const time =
      prediction.attributes.arrival_time ??
      prediction.attributes.departure_time
    if (!time || Number.isNaN(Date.parse(time))) return []

    const routeId = prediction.relationships?.route?.data?.id
    const route = included.find(
      (item) => item.type === 'route' && item.id === routeId,
    )
    const routeName = route?.attributes.short_name
    const routeDescription = route?.attributes.long_name

    return [{
      id: prediction.id,
      routeName:
        typeof routeName === 'string' && routeName ? routeName : route?.id || 'Bus',
      routeDescription:
        typeof routeDescription === 'string' && routeDescription
          ? routeDescription
          : 'MBTA bus',
      time,
    }]
  })
}

export async function getNearbyBusStops(
  coordinates: Coordinates,
  signal: AbortSignal,
): Promise<NearbyBusStop[]> {
  const url = new URL('/stops', API)
  url.searchParams.set('filter[latitude]', String(coordinates.latitude))
  url.searchParams.set('filter[longitude]', String(coordinates.longitude))
  url.searchParams.set('filter[location_type]', '0')
  url.searchParams.set('sort', 'distance')
  url.searchParams.set('page[limit]', '100')

  const { data } = await getJson<StopAttributes>(url, signal)
  const closestStop = data
    .filter(
      (stop) =>
        stop.attributes.vehicle_type === 3 &&
        stop.attributes.latitude !== null &&
        stop.attributes.longitude !== null,
    )
    .map((stop) => ({
      id: stop.id,
      name: stop.attributes.name,
      platformName: stop.attributes.platform_name,
      distanceMeters: distanceBetween(coordinates, {
        latitude: stop.attributes.latitude!,
        longitude: stop.attributes.longitude!,
      }),
    }))
    .filter((stop) => stop.distanceMeters <= MAX_DISTANCE_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]

  if (!closestStop) return []
  return [{
    ...closestStop,
    arrivals: await getDepartures(closestStop.id, signal),
  }]
}

export function formatDistance(meters: number): string {
  return meters < 1_000
    ? `${Math.round(meters)} m away`
    : `${(meters / 1_000).toFixed(1)} km away`
}

export function formatArrival(time: string): string {
  const minutes = Math.ceil((Date.parse(time) - Date.now()) / 60_000)
  if (minutes <= 0) return 'Arrived'
  if (minutes === 1) return '1 min'
  if (minutes < 60) return `${minutes} min`
  return formatClockTime(time)
}

export function formatClockTime(time: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(time))
}
