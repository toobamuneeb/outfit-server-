import React from 'react';
import {TouchableOpacity} from 'react-native';
import {
  AntDesign,
  Feather,
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import {COLORS} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';
import {CustomIconProps, IconType} from './interface';

export type {IconType};

const ICON_SETS = {
  AntDesign,
  Feather,
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
};

export const CustomIcon: React.FC<CustomIconProps> = ({
  icon,
  type,
  color = COLORS.textPrimary,
  onPress,
  size = sizeLevel.S20,
  disabled,
  style,
}) => {
  const Icon = ICON_SETS[type] as React.ComponentType<{
    name: string;
    color: string;
    size: number;
  }>;

  return (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      disabled={disabled || typeof onPress !== 'function'}
      hitSlop={8}>
      <Icon name={icon} color={color} size={size} />
    </TouchableOpacity>
  );
};
