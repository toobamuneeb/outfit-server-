import AsyncStorage from '@react-native-async-storage/async-storage';

// Shared key-value storage for the Supabase session and redux-persist.
// Same shape as La-Kala's MMKVstorage.ts, but AsyncStorage also works in Expo Go.
const AppStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export default AppStorage;
