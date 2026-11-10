import {LinkingOptions} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import {RootStackParamList} from './types';

// Deep links, e.g. outfitstudio://login (or exp://<host>/--/login in Expo Go).
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Auth: {
        screens: {
          Landing: 'welcome',
          Signup: 'signup',
          Login: 'login',
          ForgotPassword: 'forgot-password',
          VerifyEmail: 'verify/:purpose/:email',
          ResetPassword: 'reset-password/:email',
        },
      },
      CreateProfile: 'create-profile',
      Main: {
        screens: {
          Home: 'home',
        },
      },
    },
  },
};
