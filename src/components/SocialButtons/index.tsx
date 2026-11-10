import React from 'react';
import {StyleSheet, View} from 'react-native';
import CustomButton from '../CustomButton';
import CustomSvg from '../CustomSvg';
import CustomImage from '../CustomImage';
import {ICONS, sizeLevel} from '../../utils/constants';
import {showToast} from '../../utils/helper';

/** "Continue with Google / Apple" buttons shared by Login and Create account. */
const SocialButtons: React.FC = () => {
  // TODO: wire up Google / Apple sign-in once the auth backend exists.
  const handlePress = (provider: string) => {
    showToast('info', `${provider} sign-in is coming soon`);
  };

  return (
    <View style={styles.container}>
      <CustomButton
        variant="outline"
        title="Continue with Google"
        leftIcon={<CustomSvg name="google" />}
        onPress={() => handlePress('Google')}
      />
      <CustomButton
        variant="outline"
        title="Continue with Apple"
        iconGap={sizeLevel.S8}
        leftIcon={<CustomImage source={ICONS.APPLE} width={23} height={23} resizeMode="contain" />}
        onPress={() => handlePress('Apple')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: sizeLevel.S12,
  },
});

export default SocialButtons;
