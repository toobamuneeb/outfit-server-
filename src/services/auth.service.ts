import { supabase } from "../config/config";

export type OtpPurpose = "signup" | "recovery";

export interface SignUpData {
  fullName: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

class AuthService {
  /**
   * Sign up a new user
   * Note: Email confirmation is ON — Supabase emails a 6-digit code
   * ({{ .Token }} in the "Confirm signup" template). full_name is copied
   * into profiles by the handle_new_user trigger.
   */
  async signUp({ fullName, email, password }: SignUpData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    console.log({ data }, error?.message, error?.status, error?.name);
    if (error) throw error;
    return data;
  }

  /**
   * Sign in an existing user
   */
  async signIn({ email, password }: SignInData) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  /**
   * Reset password (emails a recovery code)
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  /**
   * Resend the sign-up confirmation code
   */
  async resendSignupCode(email: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }

  /**
   * Change password (verify current password first)
   * Supabase doesn't have built-in current password verification,
   * so we sign in with current password to verify it
   */
  async changePassword(currentPassword: string, newPassword: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) throw new Error("No user logged in");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error("Current password is incorrect");
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  /**
   * Verify OTP for email confirmation or password reset
   */
  async verifyOTP(email: string, token: string, type: OtpPurpose = "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign in with Apple
   */
  async signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
    });
    if (error) throw error;
    return data;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export default new AuthService();
