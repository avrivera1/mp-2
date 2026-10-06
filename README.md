# Nearby MBTA Buses

A small React + TypeScript app that shows the next three MBTA bus departures at
the closest bus stop to a fixed Boston University East location:

- Latitude: `42.34951581654144`
- Longitude: `-71.10407980245883`

The app requests nearby stops from the MBTA V3 API, selects the nearest bus
stop within 1.5 km, and loads its three earliest live predictions. Results
refresh automatically every 30 seconds, or on demand with the **Refresh**
button. Distance is the straight-line distance from the configured coordinates.

## Run locally

```sh
npm install
npm run dev
```

The MBTA API is public; this app does not require an API key or server proxy.

## API

- `GET https://api-v3.mbta.com/stops` finds nearby stops and orders them by
  distance.
- `GET https://api-v3.mbta.com/predictions` retrieves the next three arrivals
  at the nearest bus stop, including route details.
