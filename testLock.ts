import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gneisngrdqmugibdmzig.supabase.co';
const supabaseKey = 'sb_publishable_ABCwGUZjk2CqMQPY3s1sVw_UlF9qQjH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLock() {
  console.log('Fetching users...');
  const { data: users, error: fetchError } = await supabase.from('user').select('id, name').limit(1);
  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('No users found.');
    return;
  }

  const testUser = users[0];
  console.log('Testing update on user:', testUser.id, '...');
  
  // Set a strict timeout so we know if it hangs
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_HANG')), 5000));
  
  const updatePromise = supabase
    .from('user')
    .update({ name: testUser.name }) // No-op update
    .eq('id', testUser.id);
    
  try {
    const { error: updateError } = await Promise.race([updatePromise, timeoutPromise]) as any;
    if (updateError) {
      console.log('Update finished with error:', updateError.message);
    } else {
      console.log('Update finished successfully! No locks detected.');
    }
  } catch (e: any) {
    if (e.message === 'TIMEOUT_HANG') {
      console.log('CRITICAL: Update hung for >5s. The row is locked!');
    } else {
      console.log('Other error:', e);
    }
  }
}

testLock();
