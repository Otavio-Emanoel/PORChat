import React from 'react';
import { Image, Text, View } from 'react-native';
import { getAvatarBgColor, getMonogram } from '../utils/chatHelpers';

interface AvatarBadgeProps {
  name: string;
  color?: string;
  avatarUrl?: string | null;
  size?: number;
  rounded?: boolean;
}

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  name,
  color,
  avatarUrl,
  size = 40,
  rounded = true,
}) => {
  const monogram = getMonogram(name);
  const bg = color || getAvatarBgColor(name);
  const radius = rounded ? size / 2 : 12;

  if (avatarUrl && avatarUrl.trim().startsWith('http')) {
    return (
      <Image
        source={{ uri: avatarUrl.trim() }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: '#E2E8F0',
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: Math.max(10, Math.floor(size * 0.38)),
          fontWeight: '800',
          letterSpacing: 0.5,
        }}
      >
        {monogram}
      </Text>
    </View>
  );
};
