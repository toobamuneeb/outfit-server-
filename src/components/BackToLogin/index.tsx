import React from 'react';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {CustomText} from '../CustomText';
import CustomSvg from '../CustomSvg';
import {COLORS} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';

interface BackToLoginProps {
  onPress: () => void;
}

/** "← Back to Log in" link used on Forgot password and Create new password. */
const BackToLogin: React.FC<BackToLoginProps> = ({onPress}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      accessibilityRole="link"
      hitSlop={8}>
      <CustomSvg name="arrowLeft" />
      <CustomText fontSize="S16" color={COLORS.inkMuted}>
        Back to Log in
      </CustomText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: sizeLevel.S6,
    paddingVertical: sizeLevel.S4,
  },
});

export default BackToLogin;
