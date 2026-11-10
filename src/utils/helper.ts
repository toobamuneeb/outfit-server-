import Toast from 'react-native-toast-message';

export function showToast(type: 'success' | 'error' | 'info', message: string) {
  try {
    Toast.show({
      type,
      text1: type.charAt(0).toUpperCase() + type.slice(1),
      text2: message,
    });
  } catch (error) {
    console.log(error);
  }
}

export const getOnboardingStatus = (user: any): 'CreateProfile' | 'Complete' => {
  // No user data means start from beginning
  if (!user || !user.id) {
    return 'CreateProfile';
  }

  // Check if display_name is missing or empty
  if (!user.display_name || user.display_name.trim() === '') {
    return 'CreateProfile';
  }

  // All onboarding steps completed
  return 'Complete';
};
