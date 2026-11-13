import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { MobileReplyPreviewMeta } from '../utils/chatHelpers';

interface ReplyPreviewContentProps {
  meta: MobileReplyPreviewMeta;
  iconSize?: number;
  textVariant?: 'bubble' | 'bar';
}

const REPLY_ICON_MAP: Record<
  Exclude<MobileReplyPreviewMeta['kind'], 'text'>,
  keyof typeof Ionicons.glyphMap
> = {
  image: 'camera',
  voice: 'mic',
  file: 'document-text',
  poll: 'stats-chart',
};

export const ReplyPreviewContent: React.FC<ReplyPreviewContentProps> = ({
  meta,
  iconSize = 12,
  textVariant = 'bubble',
}) => {
  const textStyle = textVariant === 'bar' ? styles.barText : styles.bubbleText;

  if (meta.kind === 'text') {
    return (
      <Text style={textStyle} numberOfLines={1}>
        {meta.label}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      <Ionicons
        name={REPLY_ICON_MAP[meta.kind]}
        size={iconSize}
        color={colors.brand.primary}
        style={styles.icon}
      />
      <Text style={textStyle} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  icon: {
    marginRight: 4,
  },
  bubbleText: {
    fontSize: 11,
    color: '#495057',
    flexShrink: 1,
  },
  barText: {
    fontSize: 12,
    color: '#495057',
    flexShrink: 1,
  },
});
