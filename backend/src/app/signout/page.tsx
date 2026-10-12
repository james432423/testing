import { connection } from 'next/server';
import { auth, signOut } from '../../auth.ts';
import { redirect } from 'next/navigation';

export default async function SignOut() {
  await connection();
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="sheet">
      <p className="wordmark">ida</p>
      <h1>Sign out of Ida?</h1>
      <p>Ida keeps working on anything you set to run on its own. You can sign back in any time.</p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/signin' });
        }}
      >
        <button className="btn" type="submit">Sign out</button>
      </form>
      <p className="fine"><a href="/app/">Back to Ida</a></p>
    </main>
  );
}
