// lib/constants.ts
export const ROBOFLOW_ENDPOINT: string =
  'https://detect.roboflow.com/pothole-vhmow-kjr71/1?api_key=IQxP3o1vXxb8IOm35xXh&confidence=30';

export const STORAGE_BUCKET: string = 'hazard-images';
export const BBOX_DELTA: number = 0.05;

export const COLORS: Record<string, string> = {
  asphalt:    '#111318',
  surface:    '#1C1E26',
  card:       '#23262F',
  border:     '#2E3140',
  stripe:     '#008015',
  stripeDeep: '#024e0e',
  alert:      '#FF4D4D',
  good:       '#22C55E',
  text:       '#E8E8E0',
  muted:      '#7C7C8A',
  overlay:    'rgba(17,19,24,0.82)',
};