import { redirect } from 'next/navigation';

export default function DatabookNewRedirectPage() {
  redirect('/?new=true');
}
