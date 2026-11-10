import React from 'react';
import {StyleSheet, View} from 'react-native';
import {CustomText} from '../CustomText';
import {COLORS} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
}

/** Centred serif title + italic subtitle used at the top of every auth screen. */
const AuthHeader: React.FC<AuthHeaderProps> = ({title, subtitle}) => {
  return (
    <View style={styles.container}>
      <CustomText fontSize="S28" fontFamily="bold" lineHeight={35} center>
        {title}
      </CustomText>
      {subtitle && (
        <CustomText
          fontSize="S16"
          italic
          color={COLORS.subtitle}
          tracking={0.4}
          lineHeight={24}
          center
          textStyle={styles.subtitle}>
          {subtitle}
        </CustomText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: sizeLevel.S16,
  },
  subtitle: {
    marginTop: sizeLevel.S4,
  },
});

export default AuthHeader;
