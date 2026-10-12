import { redirect } from 'next/navigation';

// The proxy already sent signed-out visitors to /signin.
export default function Home() {
  redirect('/app/');
}
