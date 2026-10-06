import { useEffect, useState } from 'react'
import {
  getNearbyBusStops,
  formatArrival,
  formatDistance,
  formatClockTime,
  LOCATION,
  type NearbyBusStop,
} from './mbta'
import './App.css'

function App() {
  const [stops, setStops] = useState<NearbyBusStop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadNearbyBuses() {
      setIsLoading(true)
      setError(null)

      try {
        const nearbyStops = await getNearbyBusStops(LOCATION, controller.signal)
        setStops(nearbyStops)
        setLastUpdated(new Date())
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load nearby MBTA buses.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadNearbyBuses()
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshKey((key) => key + 1)
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Near Me home">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>near me<span className="brand-period">.</span></span>
        </a>
        <span className="service-label">
          <span className="service-dot" />
          MBTA REAL-TIME TRANSIT
        </span>
      </header>

      <section className="intro" id="home">
        <p className="eyebrow">BOSTON, MASSACHUSETTS</p>
        <h1>Your next bus<br />is <span>nearby.</span></h1>
        <p className="intro-copy">
          The next three departures from the closest bus stop to your location.
        </p>

        <div className="location-pill">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>42.349516, -71.104080</span>
          <span className="location-divider" />
          <span>Within 1.5 km</span>
        </div>
      </section>

      <section className="results" aria-labelledby="results-title">
        <div className="results-heading">
          <div>
            <p className="eyebrow">LIVE DEPARTURES</p>
            <h2 id="results-title">Closest bus stop</h2>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isLoading}
          >
            <svg
              className={isLoading ? 'refresh-icon spinning' : 'refresh-icon'}
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M16.4 7A6.8 6.8 0 0 0 4 5.2L2.5 6.7M3.6 13A6.8 6.8 0 0 0 16 14.8l1.5-1.5M2.5 3.5v3.2h3.2M17.5 16.5v-3.2h-3.2" />
            </svg>
            {isLoading ? 'Updating' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="notice notice-error" role="alert">
            <strong>Couldn’t load bus arrivals.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => setRefreshKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        )}

        {isLoading && stops.length === 0 && !error && (
          <div className="notice loading-card" role="status">
            <span className="loading-spinner" />
            <span>Finding nearby bus stops and live arrivals…</span>
          </div>
        )}

        {!isLoading && !error && stops.length === 0 && (
          <div className="notice">
            No bus stops were found within 1.5 km of these coordinates.
          </div>
        )}

        <div className="stop-list" aria-live="polite">
          {stops.map((stop, index) => (
            <article className="stop-card" key={stop.id}>
              <div className="stop-topline">
                <div className="stop-name-group">
                  <span className="stop-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{stop.name}</h3>
                    {stop.platformName && (
                      <p className="platform-name">{stop.platformName}</p>
                    )}
                  </div>
                </div>
                <span className="distance">{formatDistance(stop.distanceMeters)}</span>
              </div>

              {stop.arrivals.length > 0 ? (
                <ul className="arrival-list">
                  {stop.arrivals.map((arrival) => (
                    <li className="arrival" key={arrival.id}>
                      <span className="route-badge">{arrival.routeName}</span>
                      <span className="arrival-destination">
                        <strong>{arrival.routeDescription}</strong>
                      </span>
                      <span className="arrival-time">
                        <strong>{formatArrival(arrival.time)}</strong>
                        <span>{formatClockTime(arrival.time)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-arrivals">No upcoming bus predictions at this stop.</p>
              )}
            </article>
          ))}
        </div>

        {lastUpdated && (
          <p className="updated-at">
            Updated {formatClockTime(lastUpdated.toISOString())} · Refreshes every 30 seconds
          </p>
        )}
      </section>

      <footer className="footer">
        <span>Transit data provided by the MBTA.</span>
        <a href="https://api-v3.mbta.com/" target="_blank" rel="noreferrer">
          MBTA V3 API
          <span aria-hidden="true"> ↗</span>
        </a>
      </footer>
    </main>
  )
}

export default App
