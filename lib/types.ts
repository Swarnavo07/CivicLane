// lib/types.ts
import { LocationObjectCoords } from 'expo-location';

// Defines exactly what the Navigation Stack expects
export type RootStackParamList = {
  Map: undefined;
  Camera: { userLocation?: LocationObjectCoords | null };
};

// Defines exactly what a Hazard row looks like from Supabase
export interface Hazard {
  id: string;
  latitude: number;
  longitude: number;
  hazard_type: string;
  confidence_score: number | null;
  image_url: string | null;
}

// Defines the Roboflow AI prediction structure
export interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}