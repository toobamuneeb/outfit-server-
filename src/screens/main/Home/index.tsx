import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import MainWrapper from '../../../components/MainWrapper';
import {CustomText} from '../../../components/CustomText';
import CustomButton from '../../../components/CustomButton';
import {COLORS} from '../../../utils/theme';
import {sizeLevel} from '../../../utils/constants';
import {useAuth} from '../../auth/hooks/useAuth';

// Placeholder landing screen after login — replace with the Figma home design.
const HomeScreen: React.FC = () => {
  const {user, signOut, isLoading} = useAuth();

  return (
    <MainWrapper scrollEnabled={false}>
      <View style={styles.container}>
        {user?.avatar_url && <Image source={{uri: user.avatar_url}} style={styles.avatar} />}
        <CustomText fontSize="S28" fontFamily="bold" center>
          Hi, {user?.display_name}
        </CustomText>
        <CustomText fontSize="S16" italic color={COLORS.subtitle} center textStyle={styles.email}>
          {user?.email}
        </CustomText>
        <CustomButton title="Log out" variant="outline" onPress={signOut} loading={isLoading} />
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: sizeLevel.S24,
  },
  avatar: {
    width: sizeLevel.S80,
    height: sizeLevel.S80,
    borderRadius: sizeLevel.S40,
    alignSelf: 'center',
    marginBottom: sizeLevel.S16,
  },
  email: {
    marginTop: sizeLevel.S4,
    marginBottom: sizeLevel.S32,
  },
});

export default HomeScreen;
