import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface FloatingReactionProps {
  id: string;
  emoji: string;
  startX: number;
  onComplete: (id: string) => void;
}

export const FloatingReaction: React.FC<FloatingReactionProps> = ({
  id,
  emoji,
  startX,
  onComplete,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      // Scale up initially with spring
      Animated.spring(scale, {
        toValue: 1.25,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      // Float up smoothly
      Animated.timing(translateY, {
        toValue: -220,
        duration: 1400,
        useNativeDriver: true,
      }),
      // Fade out near the top
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Gentle horizontal sway
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 14,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -14,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete(id);
    });
  }, [id, onComplete, opacity, scale, sway, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingContainer,
        {
          left: startX,
          opacity,
          transform: [
            { translateY },
            { translateX: sway },
            { scale },
          ],
        },
      ]}
    >
      <Text style={styles.floatingEmoji}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 80,
    zIndex: 9999,
  },
  floatingEmoji: {
    fontSize: 32,
  },
});
