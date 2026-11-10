import React from 'react';
import {Image, ImageProps, ImageSourcePropType, ImageStyle, StyleProp} from 'react-native';

interface CustomImageProps {
  source?: ImageSourcePropType | null;
  style?: StyleProp<ImageStyle>;
  width?: number;
  height?: number;
  tintColor?: string;
  resizeMode?: ImageProps['resizeMode'];
}

const CustomImage: React.FC<CustomImageProps> = ({
  source,
  style,
  width,
  height,
  tintColor,
  resizeMode,
}) => {
  if (!source) {
    return null;
  }

  return (
    <Image
      source={source}
      style={[
        style,
        width !== undefined && {width},
        height !== undefined && {height},
        tintColor !== undefined && {tintColor},
      ]}
      resizeMode={resizeMode}
    />
  );
};

export default CustomImage;
