import {StyleProp, ViewStyle} from 'react-native';

export type IconType =
  | 'AntDesign'
  | 'Feather'
  | 'FontAwesome'
  | 'Ionicons'
  | 'MaterialCommunityIcons'
  | 'MaterialIcons';

export interface CustomIconProps {
  icon: string;
  type: IconType;
  color?: string;
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}
