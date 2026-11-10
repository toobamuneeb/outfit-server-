import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { supabase } from "../../../config/config";
import {
  clearAuth,
  setSession,
  setUser,
  updateUserProfile,
  User,
} from "../../../redux/reducers/userSlice";
import type { RootState } from "../../../redux/store";
import authService, { OtpPurpose } from "../../../services/auth.service";
import { showToast } from "../../../utils/helper";

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, session, isAuthenticated } = useSelector(
    (state: RootState) => state.user,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user profile from database (used after sign in/up)
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data) {
        dispatch(setUser(data as User));
      }
    } catch (error: any) {
      console.error("Fetch profile error:", error);
    }
  };

  // Sign up
  const signUp = async (fullName: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await authService.signUp({ fullName, email, password });
      console.log(data);
      // Supabase hides whether an email exists; a confirmed account comes back
      // with no identities instead of an error.
      if (data.user && data.user.identities?.length === 0) {
        const errorMessage = "Email already exists. Please login instead.";
        setError(errorMessage);
        showToast("error", errorMessage);
        return { success: false, error: errorMessage };
      }

      // Email confirmation is on, so there is no session yet — the user
      // verifies the emailed code on the VerifyEmail screen.
      showToast("success", "We sent a verification code to your email.");
      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create account";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await authService.signIn({ email, password });

      if (data.session && data.user) {
        dispatch(setSession(data.session));
        await fetchUserProfile(data.user.id);
      }

      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to sign in";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      await authService.signOut();
      dispatch(clearAuth());
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to sign out";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!user?.id) throw new Error("No user logged in");

      setIsLoading(true);
      setError(null);

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      // Update Redux state - this will trigger AppNavigator to re-evaluate routing
      dispatch(updateUserProfile(updates));

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update profile";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password (sends the recovery code)
  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.resetPassword(email);

      showToast("success", "A reset code has been sent to your email.");

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send reset email";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Resend the code for sign-up or password reset
  const resendCode = async (email: string, type: OtpPurpose) => {
    try {
      setIsLoading(true);
      setError(null);

      if (type === "signup") {
        await authService.resendSignupCode(email);
      } else {
        await authService.resetPassword(email);
      }

      showToast("success", "A new code has been sent to your email.");
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send code";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Upload avatar
  const uploadAvatar = async (uri: string) => {
    try {
      if (!user?.id) throw new Error("No user logged in");

      setIsLoading(true);
      setError(null);

      // <user id>/<timestamp>.jpg — the storage policy only lets users write their own folder
      const filePath = `${user.id}/${Date.now()}.jpg`;

      // React Native blobs can upload as 0 bytes; an ArrayBuffer is reliable
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: avatarUrl });

      return { success: true, avatarUrl };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to upload avatar";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP code
  const verifyOTP = async (
    email: string,
    token: string,
    type: OtpPurpose = "recovery",
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await authService.verifyOTP(email, token, type);

      // For recovery, DON'T log user in - just verify the OTP
      // User will set new password in ResetPassword screen
      if (type === "recovery") {
        showToast("success", "Code verified successfully!");
        return { success: true, data };
      }

      // For signup, log user in
      if (data.session && data.user) {
        dispatch(setSession(data.session));
        await fetchUserProfile(data.user.id);
      }

      return { success: true, data };
    } catch (error: any) {
      const errorMessage = error.message || "Invalid verification code";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Update password (for reset password flow)
  const updatePasswordWithCode = async (newPassword: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.updatePassword(newPassword);

      // End the recovery session so the user logs in with the new password
      await authService.signOut();

      showToast("success", "Password updated successfully!");
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to update password";
      setError(errorMessage);
      showToast("error", errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    resendCode,
    uploadAvatar,
    verifyOTP,
    updatePasswordWithCode,
  };
};
