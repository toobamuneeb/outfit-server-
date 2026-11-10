import React from 'react';
import {Text} from 'react-native';
import {CustomTextProps} from './interface';
import {COLORS, FONTS, FONTS_ITALIC, FONTS_NUMERIC} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';

export const CustomText: React.FC<CustomTextProps> = ({
  children,
  textStyle,
  color,
  center,
  uppercase,
  italic,
  numeric,
  onPress,
  underline,
  numberOfLines,
  fontFamily = 'regular',
  fontSize = 'S14',
  tracking,
  lineHeight,
  ...rest
}) => {
  const size = sizeLevel[fontSize];
  // tracking/lineHeight are given in design px; keep them proportional to the scaled font.
  const scale = size / Number(fontSize.slice(1));

  const family = numeric
    ? FONTS_NUMERIC.semiBold
    : (italic ? FONTS_ITALIC : FONTS)[fontFamily];

  return (
    <Text
      allowFontScaling={false}
      style={[
        {fontFamily: family, fontSize: size, color: color || COLORS.textPrimary},
        tracking !== undefined && {letterSpacing: tracking * scale},
        lineHeight !== undefined && {lineHeight: lineHeight * scale},
        underline && {textDecorationLine: 'underline'},
        center && {textAlign: 'center'},
        uppercase && {textTransform: 'uppercase'},
        textStyle,
      ]}
      disabled={typeof onPress !== 'function'}
      onPress={onPress}
      numberOfLines={numberOfLines}
      {...rest}>
      {children}
    </Text>
  );
};
