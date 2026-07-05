// screens/CameraScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { ROBOFLOW_ENDPOINT, STORAGE_BUCKET, COLORS } from '../lib/constants';
import { RootStackParamList, RoboflowPrediction } from '../lib/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type StepKey = 'READY' | 'VERIFYING' | 'UPLOADING' | 'SAVING' | 'DONE';

interface Step {
  key: StepKey;
  label: string;
}

const STEPS: Step[] = [
  { key: 'READY',     label: 'Ready' },
  { key: 'VERIFYING', label: 'AI Verifying…' },
  { key: 'UPLOADING', label: 'Uploading…' },
  { key: 'SAVING',    label: 'Saving…' },
  { key: 'DONE',      label: 'Done!' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

export default function CameraScreen({ navigation, route }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<StepKey>('READY');
  const [stepMsg, setStepMsg] = useState<string>('');
  const [facing] = useState<CameraType>('back');

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const animateProgress = (toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          CivicLane needs your camera to document road hazards.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>GRANT PERMISSION</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (step !== 'READY' || !cameraRef.current) return;

    let coords = route.params?.userLocation ?? null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coords = loc.coords;
    } catch {
      // Fall back
    }

    if (!coords) {
      Alert.alert('Location Error', 'Cannot get GPS coordinates. Please enable location and try again.');
      return;
    }

    let photo: any;
    try {
      photo = await cameraRef.current.takePictureAsync({
        quality:    0.7,
        base64:     true,
        exif:       false,
        skipProcessing: Platform.OS === 'android',
      });
    } catch (e) {
      console.error('[Camera] Capture failed:', e);
      Alert.alert('Capture Error', 'Could not take photo. Please try again.');
      return;
    }

    setStep('VERIFYING');
    setStepMsg('Sending to AI model…');
    animateProgress(0.33);

    let predictions: RoboflowPrediction[] = [];
    let confidenceScore: number = 0;

    try {
      const rfResponse = await fetch(ROBOFLOW_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    photo.base64,
      });

      if (!rfResponse.ok) {
        throw new Error(`Roboflow HTTP ${rfResponse.status}`);
      }

      const rfData = await rfResponse.json();
      predictions  = rfData.predictions ?? [];

      if (predictions.length === 0) {
        setStep('READY');
        setStepMsg('');
        animateProgress(0);
        Alert.alert(
          'No Hazard Detected',
          'The AI could not find a pothole in this image. Please reposition and try again.',
          [{ text: 'Try Again', style: 'default' }]
        );
        return;
      }

      confidenceScore = Math.max(...predictions.map((p) => p.confidence));
      setStepMsg(`Pothole confirmed — ${Math.round(confidenceScore * 100)}% confidence`);
    } catch (e: any) {
      console.error('[Camera] Roboflow error:', e.message);
      setStep('READY');
      setStepMsg('');
      animateProgress(0);
      Alert.alert(
        'AI Verification Failed',
        'Could not reach the AI service. Check your internet connection and try again.'
      );
      return;
    }

    setStep('UPLOADING');
    setStepMsg('Uploading image to cloud…');
    animateProgress(0.66);

    let publicUrl: string | null = null;
    try {
      const fileName   = `pothole_${Date.now()}.jpg`;
      const base64Data = photo.base64;
      const binaryStr  = atob(base64Data);
      const bytes      = new Uint8Array(binaryStr.length);
      
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
          upsert:      false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(uploadData.path);

      publicUrl = urlData?.publicUrl ?? null;
    } catch (e: any) {
      console.error('[Camera] Storage upload error:', e.message);
      publicUrl = null;
    }

    setStep('SAVING');
    setStepMsg('Saving to database…');
    animateProgress(0.88);

    try {
      const { error: insertError } = await supabase.from('hazards').insert({
        latitude:         coords.latitude,
        longitude:        coords.longitude,
        hazard_type:      'pothole',
        confidence_score: confidenceScore,
        image_url:        publicUrl,
      });

      if (insertError) throw insertError;
    } catch (e: any) {
      console.error('[Camera] DB insert error:', e.message);
      Alert.alert(
        'Save Failed',
        `Could not save to database: ${e.message}`,
        [{ text: 'OK', onPress: () => { setStep('READY'); setStepMsg(''); animateProgress(0); } }]
      );
      return;
    }

    setStep('DONE');
    setStepMsg('Report submitted!');
    animateProgress(1);

    setTimeout(() => {
      setStep('READY');
      setStepMsg('');
      animateProgress(0);
      navigation.navigate('Map');
    }, 1400);
  };

  const isBusy    = step !== 'READY' && step !== 'DONE';
  const isDone    = step === 'DONE';
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
      />

      <View style={styles.vignette} pointerEvents="none" />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          disabled={isBusy}
        >
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>DOCUMENT HAZARD</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isBusy && !isDone && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.reticleHint}>Aim at the road hazard</Text>
        </View>
      )}

      {(isBusy || isDone) && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <View style={styles.stepRow}>
              {STEPS.filter(s => s.key !== 'READY').map((s, i) => {
                const realIdx = i + 1;
                const isActive  = realIdx === stepIndex;
                const isComplete= realIdx < stepIndex;
                return (
                  <View key={s.key} style={styles.stepItem}>
                    <View style={[
                      styles.stepDot,
                      isComplete && styles.stepDotDone,
                      isActive   && styles.stepDotActive,
                    ]}>
                      <Text style={styles.stepDotText}>
                        {isComplete ? '✓' : (i + 1)}
                      </Text>
                    </View>
                    {i < 3 && <View style={[styles.stepLine, isComplete && styles.stepLineDone]} />}
                  </View>
                );
              })}
            </View>

            {isDone ? (
              <Text style={styles.doneIcon}>✅</Text>
            ) : (
              <ActivityIndicator size="large" color={COLORS.stripe} style={{ marginTop: 20 }} />
            )}

            <Text style={styles.processingTitle}>
              {isDone ? 'SUBMITTED!' : 'AI VERIFYING…'}
            </Text>
            <Text style={styles.processingMsg}>{stepMsg}</Text>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>
        </View>
      )}

      <View style={styles.bottomBar}>
        {!isBusy && !isDone ? (
          <>
            <Text style={styles.hint}>
              Position the pothole in frame, then tap capture
            </Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.subHint}>AI will verify before submitting</Text>
          </>
        ) : (
          <View style={{ height: 100 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor:   'black',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
  },
  topBar: {
    position:       'absolute',
    top:            Platform.OS === 'ios' ? 56 : 36,
    left:           0,
    right:          0,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    COLORS.border,
  },
  backBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  topTitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      12,
    letterSpacing: 3,
    color:         COLORS.text,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reticleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
  },
  reticle: {
    width:  220,
    height: 220,
    position: 'relative',
  },
  corner: {
    position:    'absolute',
    width:       28,
    height:      28,
    borderColor: COLORS.stripe,
    borderWidth: 3,
  },
  tl: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0 },
  reticleHint: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      11,
    letterSpacing: 1.5,
    color:         'rgba(255,255,255,0.7)',
    textAlign:     'center',
    marginTop:     8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,19,24,0.88)',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 24,
  },
  processingCard: {
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         28,
    width:           '100%',
    alignItems:      'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  4,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     COLORS.border,
  },
  stepDotActive: { borderColor: COLORS.stripe, backgroundColor: 'rgba(245,197,24,0.15)' },
  stepDotDone:   { borderColor: COLORS.good,   backgroundColor: 'rgba(34,197,94,0.15)' },
  stepDotText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:   10,
    color:      COLORS.text,
    fontWeight: '700',
  },
  stepLine:     { width: 24, height: 2, backgroundColor: COLORS.border, marginHorizontal: 2 },
  stepLineDone: { backgroundColor: COLORS.good },
  doneIcon: { fontSize: 44, marginTop: 20 },
  processingTitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize:      20,
    fontWeight:    '900',
    color:         COLORS.stripe,
    letterSpacing: 4,
    marginTop:     16,
  },
  processingMsg: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      11,
    color:         COLORS.muted,
    letterSpacing: 1,
    marginTop:     8,
    textAlign:     'center',
  },
  progressTrack: {
    width:           '100%',
    height:          3,
    backgroundColor: COLORS.border,
    marginTop:       20,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    backgroundColor: COLORS.stripe,
  },
  bottomBar: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingBottom:   Platform.OS === 'ios' ? 44 : 28,
    paddingTop:      20,
    alignItems:      'center',
    gap:             12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  hint: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      11,
    color:         'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    textAlign:     'center',
    paddingHorizontal: 32,
  },
  captureBtn: {
    width:           76,
    height:          76,
    borderRadius:    38,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth:     3,
    borderColor:     COLORS.stripe,
    alignItems:      'center',
    justifyContent:  'center',
  },
  captureBtnInner: {
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: COLORS.stripe,
  },
  subHint: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      10,
    color:         'rgba(255,255,255,0.35)',
    letterSpacing: 1,
  },
  permissionScreen: {
    flex:            1,
    backgroundColor: COLORS.asphalt,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 36,
    gap:             16,
  },
  permissionIcon:    { fontSize: 56 },
  permissionTitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize:      22,
    fontWeight:    '900',
    color:         COLORS.text,
    letterSpacing: 2,
    textAlign:     'center',
  },
  permissionSub: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:   12,
    color:      COLORS.muted,
    textAlign:  'center',
    lineHeight: 20,
  },
  permissionBtn: {
    marginTop:         8,
    backgroundColor:   COLORS.stripe,
    paddingHorizontal: 28,
    paddingVertical:   14,
    borderRadius:      4,
  },
  permissionBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize:      13,
    fontWeight:    '700',
    color:         COLORS.asphalt,
    letterSpacing: 2,
  },
});