CREATE TABLE road_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hazard_type TEXT NOT NULL, -- Will be 'pothole' or 'poor_lighting'
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  sensor_value DOUBLE PRECISION, -- The actual Z-axis or Lux number they recorded
  image_url TEXT, -- Link to the photo (if it's a pothole)
  is_verified BOOLEAN DEFAULT FALSE
);