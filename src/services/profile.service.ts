import {supabase} from '../config/config';
import type {User} from '../redux/reducers/userSlice';

class ProfileService {
  /**
   * Get a user's profile
   */
  async getProfile(userId: string) {
    const {data, error} = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data as User;
  }

  /**
   * Update a user's profile
   */
  async updateProfile(userId: string, updates: Partial<User>) {
    const {data, error} = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  }

  /**
   * Delete a user's profile
   */
  async deleteProfile(userId: string) {
    const {error} = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
  }
}

export default new ProfileService();
