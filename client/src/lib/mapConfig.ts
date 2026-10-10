import L from 'leaflet';

export const INDIA_BOUNDS = [[6.5, 68.0], [35.7, 97.5]] as [L.LatLngTuple, L.LatLngTuple];
export const INDIA_CENTER: L.LatLngTuple = [22.5, 79.0];
export const INDIA_DEFAULT_ZOOM = 5;
export const INDIA_MIN_ZOOM = 5;
export const INDIA_MAX_ZOOM = 18;

// Using multiple tile server options for reliability
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

// Alternative tile servers (CartoDB Voyager - better styling)
export const CARTO_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MAP_DEFAULTS = {
  center: INDIA_CENTER,
  zoom: 5,
  minZoom: 5,
  maxZoom: 18,
  maxBounds: [[6.5, 68.0], [35.7, 97.5]] as [L.LatLngTuple, L.LatLngTuple],
  maxBoundsViscosity: 1.0,
} as const;

export function createTileLayer(): L.TileLayer {
  return L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 18,
  });
}

export function createTileLayerWithErrorFallback(): L.TileLayer {
  return L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 18,
  });
}