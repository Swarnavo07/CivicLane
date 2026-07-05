// screens/MapScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { BBOX_DELTA, COLORS } from '../lib/constants';
import { RootStackParamList, Hazard } from '../lib/types';

const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#1a1a24' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#111318' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#7c7c8a' }] },
  { featureType: 'road',                elementType: 'geometry',       stylers: [{ color: '#2c2d3a' }] },
  { featureType: 'road.highway',        elementType: 'geometry',       stylers: [{ color: '#3a3b4e' }] },
  { featureType: 'road.highway',        elementType: 'labels.text.fill', stylers: [{ color: '#f5c518' }] },
  { featureType: 'water',               elementType: 'geometry',       stylers: [{ color: '#0d1620' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',      elementType: 'geometry',       stylers: [{ color: '#2e3140' }] },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Map'>;

export default function MapScreen({ navigation }: Props) {
  const mapRef = useRef<MapView>(null);
  const fabAnim = useRef(new Animated.Value(0)).current;
  
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [locError, setLocError] = useState<boolean>(false);
  const [pinCount, setPinCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError(true);
        setLoading(false);
        Alert.alert(
          'Location Required',
          'CivicLane needs your location to show nearby hazards.',
        );
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(loc.coords);
        await fetchHazards(loc.coords.latitude, loc.coords.longitude);
      } catch (e) {
        console.error('[MapScreen] Location error:', e);
        setLocError(true);
        Alert.alert('Location Error', 'Could not get your GPS position. Showing global view.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.spring(fabAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      if (location) {
        fetchHazards(location.latitude, location.longitude);
      }
    }, [location]),
  );

  const fetchHazards = async (lat: number, lng: number) => {
    try {
      const { data, error } = await supabase
        .from('hazards')
        .select('id, latitude, longitude, hazard_type, confidence_score, image_url')
        .gte('latitude',  lat - BBOX_DELTA)
        .lte('latitude',  lat + BBOX_DELTA)
        .gte('longitude', lng - BBOX_DELTA)
        .lte('longitude', lng + BBOX_DELTA);

      if (error) throw error;
      setHazards(data as Hazard[] ?? []);
      setPinCount(data?.length ?? 0);
    } catch (e: any) {
      console.error('[MapScreen] Supabase fetch error:', e.message);
      setHazards([]);
    }
  };

  const region: Region = location
    ? {
        latitude:       location.latitude,
        longitude:      location.longitude,
        latitudeDelta:  0.08,
        longitudeDelta: 0.08,
      }
    : {
        latitude:       20.5937,
        longitude:      78.9629,
        latitudeDelta:  10,
        longitudeDelta: 10,
      };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.asphalt} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {hazards.map((h) => (
          <Marker
            key={h.id}
            coordinate={{
              latitude:  h.latitude,
              longitude: h.longitude,
            }}
            title="Pothole"
            pinColor={COLORS.alert}
          >
            <View style={styles.markerOuter}>
              <View style={styles.markerInner}>
                <Text style={styles.markerText}>⚠</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.header}>
        <Text style={styles.headerLogo}>CIVIC<Text style={styles.headerAccent}>LANE</Text></Text>
        {pinCount !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pinCount} nearby</Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.stripe} />
          <Text style={styles.loadingText}>Acquiring GPS…</Text>
        </View>
      )}

      {!loading && (
        <Animated.View
          style={[
            styles.fabWrapper,
            {
              opacity:   fabAnim,
              transform: [{ scale: fabAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Camera', { userLocation: location })}
          >
            <Text style={styles.fabIcon}>📷</Text>
            <Text style={styles.fabLabel}>REPORT HAZARD</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.asphalt },
  header: {
    position:        'absolute',
    top:             Platform.OS === 'ios' ? 56 : 40,
    left:            16,
    right:           16,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },
  headerLogo: {
    fontFamily:    Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize:      22,
    fontWeight:    '900',
    color:         COLORS.text,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  headerAccent: { color: COLORS.stripe },
  badge: {
    backgroundColor: COLORS.overlay,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:    4,
  },
  badgeText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      11,
    color:         COLORS.stripe,
    letterSpacing: 1,
  },
  markerOuter: {
    width:          36,
    height:         36,
    borderRadius:   18,
    backgroundColor: 'rgba(255,77,77,0.25)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  markerInner: {
    width:          26,
    height:         26,
    borderRadius:   13,
    backgroundColor: COLORS.alert,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    2,
    borderColor:    COLORS.stripe,
  },
  markerText: { fontSize: 12 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             12,
  },
  loadingText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      12,
    color:         COLORS.stripe,
    letterSpacing: 2,
  },
  fabWrapper: {
    position:      'absolute',
    bottom:        40,
    alignSelf:     'center',
  },
  fab: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: COLORS.stripe,
    paddingHorizontal: 28,
    paddingVertical:   16,
    borderRadius:    4,
    elevation:       10,
    shadowColor:     COLORS.stripe,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.5,
    shadowRadius:    12,
  },
  fabIcon:  { fontSize: 20 },
  fabLabel: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      13,
    fontWeight:    '700',
    color:         COLORS.asphalt,
    letterSpacing: 2,
  },
});